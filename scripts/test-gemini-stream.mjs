import assert from 'node:assert/strict';
import { parseSseEvents, createStreamAccumulator, fetchGeminiStream } from '../lib/geminiStream.js';
import { MODEL_CHAINS, STREAM_IDLE_MS } from '../lib/modelChains.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`;
const textChunk = (text, extra = {}) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...extra }] });

// --- 체인 설정: 텍스트 모델마다 첫 조각 대기 < 전체 대기, thinking 'low'는 생각 시간만큼 넉넉히
for (const tier of ['generate', 'fast']) {
    for (const entry of MODEL_CHAINS[tier]) {
        assert.ok(entry.firstChunkMs > 0, `${entry.model}: firstChunkMs 필요`);
        assert.ok(entry.firstChunkMs < entry.timeoutMs, `${entry.model}: 첫 조각 대기는 전체보다 짧아야 함`);
        if (entry.thinkingLevel === 'low') assert.ok(entry.firstChunkMs >= 15_000, `${entry.model}: 생각을 마칠 시간 (Hydrogen 강의 첫 조각 실측 최대 11.1초)`);
        if (entry.thinkingLevel === 'minimal' && !entry.model.startsWith('gemma')) assert.equal(entry.firstChunkMs, 8_000);
    }
}
assert.ok(STREAM_IDLE_MS >= 10_000);
assert.ok(MODEL_CHAINS.tts.every((e) => e.firstChunkMs === undefined), 'TTS는 비스트리밍');

// --- SSE 파싱: 완성된 이벤트만, 나머지는 다음 읽기로
{
    const { events, rest } = parseSseEvents('data: {"a":1}\n\n: comment\n\nevent: x\ndata: {"b":\ndata: 2}\n\ndata: {"c"');
    assert.deepEqual(events, ['{"a":1}', '{"b":\n2}']);
    assert.equal(rest, 'data: {"c"');
    assert.deepEqual(parseSseEvents('').events, []);
}

// --- 조각 합치기: 생각 파트 제외, 마지막 finishReason/usage 유지, error 조각
{
    const acc = createStreamAccumulator();
    acc.push({ candidates: [{ content: { parts: [{ text: 'plan...', thought: true }] } }] });
    acc.push(textChunk('Hello '));
    acc.push({ candidates: [{ content: { parts: [{ text: 'world', thoughtSignature: 'sig' }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 9 }, modelVersion: 'm1' });
    assert.deepEqual(acc.result(), {
        candidates: [{ content: { role: 'model', parts: [{ text: 'Hello world' }] }, finishReason: 'STOP' }],
        usageMetadata: { totalTokenCount: 9 },
        modelVersion: 'm1',
    });
    const empty = createStreamAccumulator();
    assert.deepEqual(empty.result().candidates[0].content.parts, []);
    const failed = createStreamAccumulator();
    failed.push({ error: { code: 503, message: 'overloaded' } });
    assert.deepEqual(failed.result(), { error: { code: 503, message: 'overloaded' } });
}

// --- 가짜 서버: 헤더 지연, 조각 일정, 멈춤, 무한 스트림, 오류 상태
const fakeFetch = (script) => (url, init) => new Promise((resolve, reject) => {
    const { signal } = init;
    const abortError = () => new DOMException('aborted', 'AbortError');
    if (signal.aborted) return reject(abortError());
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
    if (script.headersAfter === Infinity) return; // 헤더조차 안 옴 (매달린 모델)
    setTimeout(() => {
        if (script.status && script.status !== 200) {
            resolve(new Response(script.body ?? '', { status: script.status }));
            return;
        }
        const enc = new TextEncoder();
        resolve(new Response(new ReadableStream({
            async start(controller) {
                signal.addEventListener('abort', () => { try { controller.error(abortError()); } catch { /* closed */ } }, { once: true });
                for (const [delay, piece] of script.pieces || []) {
                    await sleep(delay);
                    if (signal.aborted) return;
                    controller.enqueue(typeof piece === 'string' ? enc.encode(piece) : piece);
                }
                if (script.every) {
                    while (!signal.aborted) {
                        await sleep(script.every);
                        if (!signal.aborted) controller.enqueue(enc.encode(sse(textChunk('.'))));
                    }
                    return;
                }
                if (!script.stallAfterPieces) controller.close();
            },
        }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    }, script.headersAfter ?? 0);
});
const call = (script, opts = {}) => {
    const t0 = Date.now();
    return fetchGeminiStream({
        url: 'https://example.invalid/stream', init: { method: 'POST' },
        firstChunkMs: 80, idleMs: 120, totalMs: 1500, fetchImpl: fakeFetch(script), ...opts,
    }).then((result) => ({ ...result, elapsed: Date.now() - t0 }));
};

{ // 매달린 모델: 헤더도 안 옴 → 첫 조각 대기(80ms)만에 포기, 전체(1.5초)까지 안 기다림
    const r = await call({ headersAfter: Infinity });
    assert.deepEqual({ ok: r.ok, status: r.status, timedOut: r.timedOut, reason: r.reason }, { ok: false, status: 'network', timedOut: true, reason: 'first-chunk' });
    assert.ok(r.elapsed < 400, `너무 오래 기다림: ${r.elapsed}ms`);
}

{ // 헤더는 왔지만 첫 조각이 없음 → first-chunk
    const r = await call({ pieces: [], stallAfterPieces: true });
    assert.equal(r.reason, 'first-chunk');
}

{ // 느리지만 응답 중: 첫 조각 30ms, 이후 60ms 간격으로 6조각(총 ~400ms > firstChunkMs) → 끝까지 받음
    const pieces = [[30, sse(textChunk('안녕'))]];
    for (let i = 0; i < 5; i++) pieces.push([60, sse(textChunk(`-${i}`))]);
    pieces.push([60, sse(textChunk('', { finishReason: 'STOP' }))]);
    const r = await call({ pieces });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.candidates[0].content.parts[0].text, '안녕-0-1-2-3-4');
    assert.equal(r.data.candidates[0].finishReason, 'STOP');
    assert.ok(r.elapsed > 80, '첫 조각 대기보다 오래 걸렸어도 끊지 않음');
    assert.ok(r.firstChunkAfterMs >= 20 && r.firstChunkAfterMs < 200);
}

{ // 중간에 멈춤: 첫 조각 뒤 소식 없음 → idle
    const r = await call({ pieces: [[10, sse(textChunk('part'))]], stallAfterPieces: true });
    assert.equal(r.reason, 'idle');
    assert.ok(r.elapsed < 600);
}

{ // 계속 오지만 전체 시간 초과 → total
    const r = await call({ every: 20 }, { totalMs: 250 });
    assert.equal(r.reason, 'total');
    assert.ok(r.elapsed >= 240 && r.elapsed < 700, `${r.elapsed}`);
}

{ // HTTP 오류는 상태와 본문 그대로 (429 → 체인이 휴식 시간 계산)
    const body = '{"error":{"code":429,"details":[{"retryDelay":"7s"}]}}';
    const r = await call({ status: 429, body });
    assert.deepEqual({ ok: r.ok, status: r.status, errorText: r.errorText }, { ok: false, status: 429, errorText: body });
}

{ // 스트림 안의 error 조각 → 그 코드로 실패
    const r = await call({ pieces: [[5, sse({ error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } })]] });
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
    assert.match(r.errorText, /overloaded/);
}

{ // CRLF + 한 이벤트가 두 번에 나눠 도착 + 한글 UTF-8 바이트가 조각 경계에서 잘림
    const whole = new TextEncoder().encode(sse(textChunk('사재기하다', { finishReason: 'STOP' })));
    const cut = whole.indexOf(0xEC) + 1; // '사'(EC 82 AC)의 첫 바이트 뒤에서 자름
    assert.ok(cut > 0 && whole[cut] === 0x82);
    const r = await call({ pieces: [[5, whole.slice(0, cut)], [5, whole.slice(cut)]] });
    assert.equal(r.ok, true);
    assert.equal(r.data.candidates[0].content.parts[0].text, '사재기하다');
}

{ // 마지막 이벤트 뒤 빈 줄 없이 스트림이 끝나도 처리
    const r = await call({ pieces: [[5, `data: ${JSON.stringify(textChunk('tail', { finishReason: 'STOP' }))}`]] });
    assert.equal(r.ok, true);
    assert.equal(r.data.candidates[0].content.parts[0].text, 'tail');
}

console.log('gemini stream tests passed');

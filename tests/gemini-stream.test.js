import { describe, it, expect } from 'vitest';
import { parseSseEvents, createStreamAccumulator, fetchGeminiStream } from '../lib/geminiStream.js';
import { MODEL_CHAINS, STREAM_IDLE_MS } from '../lib/modelChains.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`;
const textChunk = (text, extra = {}) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...extra }] });

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

describe('체인 설정', () => {
  // 텍스트 모델마다 첫 조각 대기 < 전체 대기, thinking 'low'는 생각 시간만큼 넉넉히
  it('firstChunkMs가 timeoutMs보다 작고 thinking 수준별 여유가 있다', () => {
    for (const tier of ['generate', 'fast']) {
      for (const entry of MODEL_CHAINS[tier]) {
        expect(entry.firstChunkMs).toBeGreaterThan(0);
        expect(entry.firstChunkMs).toBeLessThan(entry.timeoutMs);
        if (entry.thinkingLevel === 'low') expect(entry.firstChunkMs).toBeGreaterThanOrEqual(15_000); // Hydrogen 강의 첫 조각 실측 최대 11.1초
        if (entry.thinkingLevel === 'minimal' && !entry.model.startsWith('gemma')) expect(entry.firstChunkMs).toBe(8_000);
      }
    }
    expect(STREAM_IDLE_MS).toBeGreaterThanOrEqual(10_000);
    expect(MODEL_CHAINS.tts.every((e) => e.firstChunkMs === undefined)).toBe(true);
  });
});

describe('parseSseEvents', () => {
  it('완성된 이벤트만 파싱하고 나머지는 다음 읽기로 넘긴다', () => {
    const { events, rest } = parseSseEvents('data: {"a":1}\n\n: comment\n\nevent: x\ndata: {"b":\ndata: 2}\n\ndata: {"c"');
    expect(events).toStrictEqual(['{"a":1}', '{"b":\n2}']);
    expect(rest).toBe('data: {"c"');
    expect(parseSseEvents('').events).toStrictEqual([]);
  });
});

describe('createStreamAccumulator', () => {
  it('생각 파트를 제외하고 마지막 finishReason/usage를 유지한다', () => {
    const acc = createStreamAccumulator();
    acc.push({ candidates: [{ content: { parts: [{ text: 'plan...', thought: true }] } }] });
    acc.push(textChunk('Hello '));
    acc.push({ candidates: [{ content: { parts: [{ text: 'world', thoughtSignature: 'sig' }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 9 }, modelVersion: 'm1' });
    expect(acc.result()).toStrictEqual({
      candidates: [{ content: { role: 'model', parts: [{ text: 'Hello world' }] }, finishReason: 'STOP' }],
      usageMetadata: { totalTokenCount: 9 },
      modelVersion: 'm1',
    });
  });

  it('빈 결과와 error 조각을 처리한다', () => {
    const empty = createStreamAccumulator();
    expect(empty.result().candidates[0].content.parts).toStrictEqual([]);
    const failed = createStreamAccumulator();
    failed.push({ error: { code: 503, message: 'overloaded' } });
    expect(failed.result()).toStrictEqual({ error: { code: 503, message: 'overloaded' } });
  });
});

describe('fetchGeminiStream', () => {
  it('매달린 모델은 첫 조각 대기만에 포기한다', async () => {
    const r = await call({ headersAfter: Infinity });
    expect({ ok: r.ok, status: r.status, timedOut: r.timedOut, reason: r.reason }).toStrictEqual(
      { ok: false, status: 'network', timedOut: true, reason: 'first-chunk' },
    );
    expect(r.elapsed).toBeLessThan(400);
  });

  it('헤더는 왔지만 첫 조각이 없으면 first-chunk', async () => {
    const r = await call({ pieces: [], stallAfterPieces: true });
    expect(r.reason).toBe('first-chunk');
  });

  it('첫 조각 대기보다 오래 걸려도 계속 오면 끝까지 받는다', async () => {
    const pieces = [[30, sse(textChunk('안녕'))]];
    for (let i = 0; i < 5; i++) pieces.push([60, sse(textChunk(`-${i}`))]);
    pieces.push([60, sse(textChunk('', { finishReason: 'STOP' }))]);
    const r = await call({ pieces });
    expect(r.ok).toBe(true);
    expect(r.data.candidates[0].content.parts[0].text).toBe('안녕-0-1-2-3-4');
    expect(r.data.candidates[0].finishReason).toBe('STOP');
    expect(r.elapsed).toBeGreaterThan(80);
    expect(r.firstChunkAfterMs).toBeGreaterThanOrEqual(20);
    expect(r.firstChunkAfterMs).toBeLessThan(200);
  });

  it('중간에 멈추면 idle', async () => {
    const r = await call({ pieces: [[10, sse(textChunk('part'))]], stallAfterPieces: true });
    expect(r.reason).toBe('idle');
    expect(r.elapsed).toBeLessThan(600);
  });

  it('계속 오지만 전체 시간을 초과하면 total', async () => {
    const r = await call({ every: 20 }, { totalMs: 250 });
    expect(r.reason).toBe('total');
    expect(r.elapsed).toBeGreaterThanOrEqual(240);
    expect(r.elapsed).toBeLessThan(700);
  });

  it('HTTP 오류는 상태와 본문을 그대로 반환한다', async () => {
    const body = '{"error":{"code":429,"details":[{"retryDelay":"7s"}]}}';
    const r = await call({ status: 429, body });
    expect({ ok: r.ok, status: r.status, errorText: r.errorText }).toStrictEqual(
      { ok: false, status: 429, errorText: body },
    );
  });

  it('스트림 안의 error 조각은 그 코드로 실패한다', async () => {
    const r = await call({ pieces: [[5, sse({ error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } })]] });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
    expect(r.errorText).toMatch(/overloaded/);
  });

  it('CRLF/분할 도착/한글 UTF-8 바이트 잘림을 처리한다', async () => {
    const whole = new TextEncoder().encode(sse(textChunk('사재기하다', { finishReason: 'STOP' })));
    const cut = whole.indexOf(0xEC) + 1; // '사'(EC 82 AC)의 첫 바이트 뒤에서 자름
    expect(cut).toBeGreaterThan(0);
    expect(whole[cut]).toBe(0x82);
    const r = await call({ pieces: [[5, whole.slice(0, cut)], [5, whole.slice(cut)]] });
    expect(r.ok).toBe(true);
    expect(r.data.candidates[0].content.parts[0].text).toBe('사재기하다');
  });

  it('마지막 이벤트 뒤 빈 줄 없이 스트림이 끝나도 처리한다', async () => {
    const r = await call({ pieces: [[5, `data: ${JSON.stringify(textChunk('tail', { finishReason: 'STOP' }))}`]] });
    expect(r.ok).toBe(true);
    expect(r.data.candidates[0].content.parts[0].text).toBe('tail');
  });
});

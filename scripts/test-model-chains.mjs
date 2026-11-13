import assert from 'node:assert/strict';
import {
    MODEL_CHAINS,
    CHAIN_BUDGET_MS,
    resolveTier,
    buildModelPayload,
    classifyFailure,
    msUntilPacificMidnight,
    createCooldownTracker,
    runModelChain,
    normalizeTextResponse,
    toWavBytes,
    extractAudio,
} from '../lib/modelChains.js';
import { parseWavChunks, transcodeWavToOpusWebm } from '../lib/audioTranscode.js';

const SEC = 1000;
const MIN = 60 * SEC;

// --- 용도 해석: 용도 이름과 예전 모델 이름만 허용, 임의 모델 직접 지정은 거부
assert.equal(resolveTier('tier:generate'), 'generate');
assert.equal(resolveTier('tier:fast'), 'fast');
assert.equal(resolveTier('tier:tts'), 'tts');
assert.equal(resolveTier('tier:bogus'), null);
assert.equal(resolveTier('tier:constructor'), null);
assert.equal(resolveTier('tier:__proto__'), null);
assert.equal(resolveTier('gemini-4-hydrogen'), null);
assert.equal(resolveTier('gemini-flash-latest'), 'fast');
assert.equal(resolveTier('gemini-3.5-flash-lite'), 'fast');
assert.equal(resolveTier('gemini-3.8-flash-tts'), 'tts');
assert.equal(resolveTier(undefined), null);
assert.equal(resolveTier(42), null);

// --- 체인 구성: 좋은 모델 먼저, 사라진 2.5 텍스트 모델 없음, 시간 예산 안쪽
assert.equal(MODEL_CHAINS.generate[0].model, 'gemini-4-hydrogen');
assert.equal(MODEL_CHAINS.fast[0].model, 'gemini-3.5-flash-lite');
assert.equal(MODEL_CHAINS.tts[0].model, 'gemini-3.8-flash-tts');
for (const [tier, chain] of Object.entries(MODEL_CHAINS)) {
    assert.ok(chain.length >= 4, `${tier}: 예비 모델이 여럿 있어야 함`);
    assert.equal(new Set(chain.map((e) => e.model)).size, chain.length, `${tier}: 중복 모델`);
    for (const entry of chain) {
        assert.ok(!/^gemini-2\.5-flash(-lite)?$/.test(entry.model), `${entry.model}는 신규 사용자에게 404`);
        assert.ok(entry.timeoutMs <= CHAIN_BUDGET_MS[tier]);
        if (tier !== 'tts') assert.ok(entry.thinkingLevel, `${entry.model}: thinkingLevel 없으면 작은 예산에서 빈 응답`);
    }
}
assert.ok(MODEL_CHAINS.tts.every((e) => e.model.includes('tts')));
assert.ok(Math.max(...Object.values(CHAIN_BUDGET_MS)) < 100 * SEC, 'vercel.json maxDuration(100초) 안쪽');

// --- 모델별 페이로드: thinking 설정·여유분, voice. 원본 불변
const textPayload = { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 100, temperature: 0.2 } };
const frozen = JSON.stringify(textPayload);
const hydrogen = buildModelPayload(MODEL_CHAINS.generate[0], textPayload, 'generate');
assert.deepEqual(hydrogen.generationConfig, { maxOutputTokens: 100 + 2048, temperature: 0.2, thinkingConfig: { thinkingLevel: 'low' } });
const lite = buildModelPayload(MODEL_CHAINS.fast[0], textPayload, 'fast');
assert.deepEqual(lite.generationConfig, { maxOutputTokens: 100, temperature: 0.2, thinkingConfig: { thinkingLevel: 'minimal' } });
assert.equal(JSON.stringify(textPayload), frozen, '원본 페이로드가 바뀌면 안 됨');
const noMax = buildModelPayload(MODEL_CHAINS.generate[0], { contents: [], generationConfig: { responseMimeType: 'application/json' } }, 'generate');
assert.equal(noMax.generationConfig.maxOutputTokens, undefined);
const ttsPayload = { contents: [{ parts: [{ text: 'Hello.' }] }], generationConfig: { responseModalities: ['AUDIO'] } };
const tts31 = buildModelPayload(MODEL_CHAINS.tts.find((e) => e.model === 'gemini-3.1-flash-tts-preview'), ttsPayload, 'tts');
assert.equal(tts31.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
assert.equal(buildModelPayload(MODEL_CHAINS.tts[0], ttsPayload, 'tts').generationConfig.speechConfig, undefined);
assert.equal(buildModelPayload(MODEL_CHAINS.tts[0], ttsPayload, 'tts').generationConfig.thinkingConfig, undefined);

// --- 태평양 시간 자정까지 (PST/PDT 모두)
assert.equal(msUntilPacificMidnight(Date.parse('2026-11-13T07:59:30Z')), 30 * SEC + MIN); // 23:59:30 PST
assert.equal(msUntilPacificMidnight(Date.parse('2026-07-01T06:00:00Z')), 60 * MIN + MIN); // 23:00 PDT
assert.equal(msUntilPacificMidnight(Date.parse('2026-11-13T08:00:00Z')), 24 * 60 * MIN + MIN); // 00:00 PST

// --- 실패 분류 → 휴식 시간
const now0 = Date.parse('2026-11-13T07:59:30Z');
const perDay = '{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';
const perMinute = '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}';
assert.deepEqual(classifyFailure({ status: 429, errorText: perDay }, now0), { cooldownMs: 90 * SEC, quota: true });
assert.deepEqual(classifyFailure({ status: 429, errorText: perMinute }, now0), { cooldownMs: 37 * SEC, quota: true });
assert.deepEqual(classifyFailure({ status: 429, errorText: '' }), { cooldownMs: MIN, quota: true });
assert.deepEqual(classifyFailure({ status: 503 }), { cooldownMs: 2 * MIN, quota: false });
assert.deepEqual(classifyFailure({ status: 500 }), { cooldownMs: 2 * MIN, quota: false });
assert.deepEqual(classifyFailure({ status: 'network' }), { cooldownMs: 2 * MIN, quota: false });
assert.deepEqual(classifyFailure({ status: 'network', timedOut: true }), { cooldownMs: 10 * MIN, quota: false });
assert.deepEqual(classifyFailure({ status: 404 }), { cooldownMs: 24 * 60 * MIN, quota: false });
assert.deepEqual(classifyFailure({ status: 400 }), { cooldownMs: 0, quota: false });

// --- 체인 실행 (가짜 시계 + 가짜 응답)
const clock = (start = Date.parse('2026-11-13T03:00:00Z')) => {
    let t = start;
    return { now: () => t, advance: (ms) => { t += ms; } };
};
const scripted = (responses, c) => {
    const calls = [];
    const attempt = async (entry, timeoutMs) => {
        calls.push({ model: entry.model, timeoutMs });
        const r = responses[entry.model] ?? { ok: true, value: `from ${entry.model}` };
        const res = typeof r === 'function' ? r() : r;
        if (res.elapse) c.advance(res.elapse);
        return res;
    };
    return { attempt, calls };
};
const G = MODEL_CHAINS.generate.map((e) => e.model);

{ // 주 모델이 되면 바로 끝
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted({}, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    assert.equal(out.ok, true);
    assert.equal(out.model, G[0]);
    assert.equal(calls.length, 1);
}

{ // 429(분당) → 503 → 성공, 다음 요청은 쉬는 모델을 건너뜀, 시간이 지나면 복귀
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted({ [G[0]]: { ok: false, status: 429, errorText: perMinute }, [G[1]]: { ok: false, status: 503 } }, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    assert.equal(out.model, G[2]);
    assert.deepEqual(out.tried, [G[0], G[1], G[2]]);

    const again = scripted({}, c);
    const out2 = await runModelChain({ tier: 'generate', attempt: again.attempt, cooldowns: cd, now: c.now });
    assert.equal(out2.model, G[2], '쉬는 중인 모델은 건너뜀');
    assert.equal(again.calls.length, 1);

    c.advance(38 * SEC); // 분당 한도 휴식(37초) 끝, 503 휴식(2분)은 남음
    const later = scripted({}, c);
    const out3 = await runModelChain({ tier: 'generate', attempt: later.attempt, cooldowns: cd, now: c.now });
    assert.equal(out3.model, G[0], '휴식이 끝난 주 모델로 복귀');
    assert.ok(cd.isCooling(G[1], c.now()));
    assert.equal(calls.length, 3);
}

{ // 일일 한도 초과는 자정(PT)까지 쉼
    const c = clock(Date.parse('2026-11-13T20:00:00Z')); const cd = createCooldownTracker();
    const { attempt } = scripted({ [G[0]]: { ok: false, status: 429, errorText: perDay } }, c);
    await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    // 20:00Z = 12:00 PST → PT 자정까지 12시간
    c.advance(11 * 60 * MIN);
    assert.ok(cd.isCooling(G[0], c.now()), '11시간 뒤에도 일일 한도 모델은 쉼');
    c.advance(60 * MIN + 2 * MIN);
    assert.ok(!cd.isCooling(G[0], c.now()), 'PT 자정(+1분) 이후 복귀');
}

{ // 모두 한도 초과 → 429 + 가장 이른 복귀 시각
    const c = clock(); const cd = createCooldownTracker();
    const all429 = Object.fromEntries(G.map((m) => [m, { ok: false, status: 429, errorText: perMinute }]));
    const { attempt, calls } = scripted(all429, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    assert.deepEqual({ ok: out.ok, status: out.status, retryAfterSec: out.retryAfterSec }, { ok: false, status: 429, retryAfterSec: 37 });
    assert.equal(calls.length, G.length);

    // 전부 쉬는 중이면 업스트림을 부르지 않고 곧바로 429
    const again = scripted({}, c);
    const out2 = await runModelChain({ tier: 'generate', attempt: again.attempt, cooldowns: cd, now: c.now });
    assert.equal(out2.status, 429);
    assert.equal(again.calls.length, 0);
}

{ // 한도·과부하 섞임 → 503
    const c = clock(); const cd = createCooldownTracker();
    const mixed = Object.fromEntries(G.map((m, i) => [m, i % 2 ? { ok: false, status: 503 } : { ok: false, status: 429 }]));
    const out = await runModelChain({ tier: 'generate', attempt: scripted(mixed, c).attempt, cooldowns: cd, now: c.now });
    assert.equal(out.status, 503);
}

{ // 모든 모델이 400 → 요청 자체 문제(400), 아무도 쉬게 하지 않음
    const c = clock(); const cd = createCooldownTracker();
    const all400 = Object.fromEntries(G.map((m) => [m, { ok: false, status: 400 }]));
    const out = await runModelChain({ tier: 'generate', attempt: scripted(all400, c).attempt, cooldowns: cd, now: c.now });
    assert.equal(out.status, 400);
    assert.ok(G.every((m) => !cd.isCooling(m, c.now())));
}

{ // 빈 응답(생각만 하고 본문 없음)은 다음 모델로, 휴식 없음
    const c = clock(); const cd = createCooldownTracker();
    const { attempt } = scripted({ [G[0]]: { ok: false, empty: true } }, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    assert.equal(out.model, G[1]);
    assert.ok(!cd.isCooling(G[0], c.now()));
}

{ // 시간 예산: 연속 타임아웃이면 남은 시간만큼만 기다리고, 4초 미만 남으면 멈춤
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted(Object.fromEntries(G.map((m) => [m, () => ({ ok: false, status: 'network', timedOut: true, elapse: calls.at(-1).timeoutMs })])), c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    assert.equal(out.status, 503);
    const spent = calls.reduce((sum, call) => sum + call.timeoutMs, 0);
    assert.ok(spent <= CHAIN_BUDGET_MS.generate, `예산 초과: ${spent}`);
    assert.equal(calls[0].timeoutMs, MODEL_CHAINS.generate[0].timeoutMs);
    assert.ok(calls.at(-1).timeoutMs <= MODEL_CHAINS.generate[calls.length - 1].timeoutMs);
    assert.ok(calls.length < G.length, '예산이 다하면 남은 모델은 시도하지 않음');
}

{ // 성공하면 이전 휴식 기록을 지움
    const c = clock(); const cd = createCooldownTracker();
    cd.coolDown(G[0], 10 * SEC, c.now());
    c.advance(11 * SEC);
    await runModelChain({ tier: 'generate', attempt: scripted({}, c).attempt, cooldowns: cd, now: c.now });
    assert.equal(cd.remainingMs(G[0], c.now()), 0);
}

// --- 텍스트 응답 정규화: 생각 파트 제거, 여러 파트를 parts[0] 하나로
const merged = normalizeTextResponse({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'thinking...', thought: true }, { text: 'Hello ' }, { text: 'world', thoughtSignature: 'sig' }] } }], usageMetadata: { x: 1 } });
assert.deepEqual(merged.candidates[0].content.parts, [{ text: 'Hello world' }]);
assert.equal(merged.candidates[0].finishReason, 'STOP');
assert.deepEqual(merged.usageMetadata, { x: 1 });
assert.equal(normalizeTextResponse({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x', thought: true }] } }] }), null);
assert.equal(normalizeTextResponse({ candidates: [{ content: { parts: [{ text: '   ' }] } }] }), null);
assert.equal(normalizeTextResponse({ candidates: [] }), null);
assert.equal(normalizeTextResponse(null), null);

// --- 오디오: raw PCM(L16) → WAV, WAV는 그대로, Opus 트랜스코딩까지
const samples = new Int16Array(24000); // 1초, 440Hz
for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / 24000) * 8000);
const pcm = new Uint8Array(samples.buffer);
const wrapped = toWavBytes(pcm, 'audio/L16;codec=pcm;rate=24000');
assert.equal(wrapped.mimeType, 'audio/wav');
const parsed = parseWavChunks(wrapped.bytes);
assert.deepEqual(parsed.fmt, { format: 1, channels: 1, sampleRate: 24000, bitsPerSample: 16 });
assert.equal(parsed.data.length, pcm.length);
assert.equal(toWavBytes(pcm, 'audio/l16; rate=16000; channels=1').bytes.length, pcm.length + 44);
assert.equal(parseWavChunks(toWavBytes(pcm, 'audio/l16; rate=16000; channels=1').bytes).fmt.sampleRate, 16000);
assert.equal(toWavBytes(wrapped.bytes, 'audio/wav').bytes, wrapped.bytes, 'WAV는 그대로');
assert.equal(toWavBytes(pcm, 'audio/mpeg').mimeType, 'audio/mpeg', '모르는 형식은 손대지 않음');

const fromApi = extractAudio({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/l16; rate=24000; channels=1', data: Buffer.from(pcm).toString('base64') } }] } }] });
assert.equal(fromApi.mimeType, 'audio/wav');
assert.equal(parseWavChunks(fromApi.bytes).data.length, pcm.length);
assert.equal(extractAudio({ candidates: [{ content: { parts: [{ text: 'no audio' }] } }] }), null);
assert.equal(extractAudio({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: '' } }] } }] }), null);

const webm = await transcodeWavToOpusWebm(wrapped.bytes);
assert.ok(webm && webm.webm.length > 1000, 'PCM 예비 모델 출력도 Opus/WebM으로 변환');

console.log('model chain tests passed');

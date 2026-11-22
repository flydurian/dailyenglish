import { Buffer } from 'node:buffer';
import { describe, it, expect } from 'vitest';
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
} from '../lib/modelChains';
import { parseWavChunks, transcodeWavToOpusWebm } from '../lib/audioTranscode';

const SEC = 1000;
const MIN = 60 * SEC;

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

describe('resolveTier', () => {
  // 용도 이름과 예전 모델 이름만 허용, 임의 모델 직접 지정은 거부
  it('허용된 티어/모델 이름만 해석한다', () => {
    expect(resolveTier('tier:generate')).toBe('generate');
    expect(resolveTier('tier:fast')).toBe('fast');
    expect(resolveTier('tier:tts')).toBe('tts');
    expect(resolveTier('tier:bogus')).toBeNull();
    expect(resolveTier('tier:constructor')).toBeNull();
    expect(resolveTier('tier:__proto__')).toBeNull();
    expect(resolveTier('gemini-4-hydrogen')).toBeNull();
    expect(resolveTier('gemini-flash-latest')).toBe('fast');
    expect(resolveTier('gemini-3.5-flash-lite')).toBe('fast');
    expect(resolveTier('gemini-3.8-flash-tts')).toBe('tts');
    expect(resolveTier(undefined)).toBeNull();
    expect(resolveTier(42)).toBeNull();
  });
});

describe('체인 구성', () => {
  // 좋은 모델 먼저, 사라진 2.5 텍스트 모델 없음, 시간 예산 안쪽
  it('모델 순서·중복·예산·thinkingLevel을 만족한다', () => {
    expect(MODEL_CHAINS.generate[0].model).toBe('gemini-4-hydrogen');
    expect(MODEL_CHAINS.fast[0].model).toBe('gemini-3.5-flash-lite');
    expect(MODEL_CHAINS.tts[0].model).toBe('gemini-3.8-flash-tts');
    for (const [tier, chain] of Object.entries(MODEL_CHAINS)) {
      expect(chain.length).toBeGreaterThanOrEqual(4);
      expect(new Set(chain.map((e) => e.model)).size).toBe(chain.length);
      for (const entry of chain) {
        expect(/^gemini-2\.5-flash(-lite)?$/.test(entry.model)).toBe(false);
        expect(entry.timeoutMs).toBeLessThanOrEqual(CHAIN_BUDGET_MS[tier]);
        if (tier !== 'tts') expect(entry.thinkingLevel).toBeTruthy();
      }
    }
    expect(MODEL_CHAINS.tts.every((e) => e.model.includes('tts'))).toBe(true);
    expect(Math.max(...Object.values(CHAIN_BUDGET_MS))).toBeLessThan(100 * SEC); // vercel.json maxDuration(100초)
  });
});

describe('buildModelPayload', () => {
  const textPayload = { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 100, temperature: 0.2 } };
  const ttsPayload = { contents: [{ parts: [{ text: 'Hello.' }] }], generationConfig: { responseModalities: ['AUDIO'] } };

  it('모델별 thinking 설정과 여유분을 적용하고 원본은 바꾸지 않는다', () => {
    const frozen = JSON.stringify(textPayload);
    const hydrogen = buildModelPayload(MODEL_CHAINS.generate[0], textPayload, 'generate');
    expect(hydrogen.generationConfig).toStrictEqual({ maxOutputTokens: 100 + 2048, temperature: 0.2, thinkingConfig: { thinkingLevel: 'low' } });
    const lite = buildModelPayload(MODEL_CHAINS.fast[0], textPayload, 'fast');
    expect(lite.generationConfig).toStrictEqual({ maxOutputTokens: 100, temperature: 0.2, thinkingConfig: { thinkingLevel: 'minimal' } });
    expect(JSON.stringify(textPayload)).toBe(frozen);

    const noMax = buildModelPayload(MODEL_CHAINS.generate[0], { contents: [], generationConfig: { responseMimeType: 'application/json' } }, 'generate');
    expect(noMax.generationConfig.maxOutputTokens).toBeUndefined();
  });

  it('TTS는 voice/accent 설정을 적용한다', () => {
    const tts31 = buildModelPayload(MODEL_CHAINS.tts.find((e) => e.model === 'gemini-3.1-flash-tts-preview'), ttsPayload, 'tts');
    expect(tts31.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');
    expect(buildModelPayload(MODEL_CHAINS.tts[0], ttsPayload, 'tts').generationConfig.speechConfig).toBeUndefined();
    expect(buildModelPayload(MODEL_CHAINS.tts[0], ttsPayload, 'tts').generationConfig.thinkingConfig).toBeUndefined();
    const accented = buildModelPayload(MODEL_CHAINS.tts[0], ttsPayload, 'tts', 'en-us-advisor-9');
    expect(accented.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('en-us-advisor-9');
    // accent가 없으면 기존 모델별 voice를 유지해야 합니다.
    expect(buildModelPayload(MODEL_CHAINS.tts.find((e) => e.model === 'gemini-3.1-flash-tts-preview'), ttsPayload, 'tts', undefined)
      .generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');
  });
});

describe('msUntilPacificMidnight', () => {
  // PST/PDT 모두, DST 전환일 포함
  it('태평양 시간 자정까지 남은 시간을 계산한다', () => {
    expect(msUntilPacificMidnight(Date.parse('2026-11-13T07:59:30Z'))).toBe(30 * SEC + MIN); // 23:59:30 PST
    expect(msUntilPacificMidnight(Date.parse('2026-07-01T06:00:00Z'))).toBe(60 * MIN + MIN); // 23:00 PDT
    expect(msUntilPacificMidnight(Date.parse('2026-11-13T08:00:00Z'))).toBe(24 * 60 * MIN + MIN); // 00:00 PST
    // DST 전환일: 봄은 23시간, 가을은 24시간 (벽시계 계산은 각각 1시간씩 틀렸습니다).
    expect(msUntilPacificMidnight(Date.parse('2026-03-08T08:00:00Z'))).toBe(23 * 60 * MIN + MIN);
    expect(msUntilPacificMidnight(Date.parse('2026-11-01T08:00:00Z'))).toBe(24 * 60 * MIN + MIN);
  });
});

describe('classifyFailure', () => {
  const now0 = Date.parse('2026-11-13T07:59:30Z');
  const perDay = '{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';
  const perMinute = '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}';

  it('실패 유형별 휴식 시간과 quota 여부를 분류한다', () => {
    expect(classifyFailure({ status: 429, errorText: perDay }, now0)).toStrictEqual({ cooldownMs: 90 * SEC, quota: true });
    expect(classifyFailure({ status: 429, errorText: perMinute }, now0)).toStrictEqual({ cooldownMs: 37 * SEC, quota: true });
    expect(classifyFailure({ status: 429, errorText: '' })).toStrictEqual({ cooldownMs: MIN, quota: true });
    expect(classifyFailure({ status: 503 })).toStrictEqual({ cooldownMs: 2 * MIN, quota: false });
    expect(classifyFailure({ status: 500 })).toStrictEqual({ cooldownMs: 2 * MIN, quota: false });
    expect(classifyFailure({ status: 'network' })).toStrictEqual({ cooldownMs: 2 * MIN, quota: false });
    expect(classifyFailure({ status: 'network', timedOut: true })).toStrictEqual({ cooldownMs: 10 * MIN, quota: false });
    expect(classifyFailure({ status: 404 })).toStrictEqual({ cooldownMs: 24 * 60 * MIN, quota: false });
    expect(classifyFailure({ status: 400 })).toStrictEqual({ cooldownMs: 0, quota: false });
  });
});

describe('runModelChain', () => {
  const perDay = '{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';
  const perMinute = '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}';

  it('주 모델이 되면 바로 끝난다', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted({}, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    expect(out.ok).toBe(true);
    expect(out.model).toBe(G[0]);
    expect(calls).toHaveLength(1);
  });

  it('429 → 503 → 성공, 쉬는 모델 건너뛰고 시간이 지나면 복귀', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted({ [G[0]]: { ok: false, status: 429, errorText: perMinute }, [G[1]]: { ok: false, status: 503 } }, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    expect(out.model).toBe(G[2]);
    expect(out.tried).toStrictEqual([G[0], G[1], G[2]]);

    const again = scripted({}, c);
    const out2 = await runModelChain({ tier: 'generate', attempt: again.attempt, cooldowns: cd, now: c.now });
    expect(out2.model).toBe(G[2]); // 쉬는 중인 모델은 건너뜀
    expect(again.calls).toHaveLength(1);

    c.advance(38 * SEC); // 분당 한도 휴식(37초) 끝, 503 휴식(2분)은 남음
    const later = scripted({}, c);
    const out3 = await runModelChain({ tier: 'generate', attempt: later.attempt, cooldowns: cd, now: c.now });
    expect(out3.model).toBe(G[0]); // 휴식이 끝난 주 모델로 복귀
    expect(cd.isCooling(G[1], c.now())).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('일일 한도 초과는 PT 자정까지 쉼', async () => {
    const c = clock(Date.parse('2026-11-13T20:00:00Z')); const cd = createCooldownTracker();
    const { attempt } = scripted({ [G[0]]: { ok: false, status: 429, errorText: perDay } }, c);
    await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    // 20:00Z = 12:00 PST → PT 자정까지 12시간
    c.advance(11 * 60 * MIN);
    expect(cd.isCooling(G[0], c.now())).toBe(true);
    c.advance(60 * MIN + 2 * MIN);
    expect(cd.isCooling(G[0], c.now())).toBe(false);
  });

  it('모두 한도 초과 → 429 + 가장 이른 복귀 시각', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const all429 = Object.fromEntries(G.map((m) => [m, { ok: false, status: 429, errorText: perMinute }]));
    const { attempt, calls } = scripted(all429, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    expect({ ok: out.ok, status: out.status, retryAfterSec: out.retryAfterSec }).toStrictEqual({ ok: false, status: 429, retryAfterSec: 37 });
    expect(calls).toHaveLength(G.length);

    // 전부 쉬는 중이면 업스트림을 부르지 않고 곧바로 429
    const again = scripted({}, c);
    const out2 = await runModelChain({ tier: 'generate', attempt: again.attempt, cooldowns: cd, now: c.now });
    expect(out2.status).toBe(429);
    expect(again.calls).toHaveLength(0);
  });

  it('한도·과부하가 섞이면 503', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const mixed = Object.fromEntries(G.map((m, i) => [m, i % 2 ? { ok: false, status: 503 } : { ok: false, status: 429 }]));
    const out = await runModelChain({ tier: 'generate', attempt: scripted(mixed, c).attempt, cooldowns: cd, now: c.now });
    expect(out.status).toBe(503);
  });

  it('모든 모델이 400이면 요청 자체 문제이고 아무도 쉬지 않는다', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const all400 = Object.fromEntries(G.map((m) => [m, { ok: false, status: 400 }]));
    const out = await runModelChain({ tier: 'generate', attempt: scripted(all400, c).attempt, cooldowns: cd, now: c.now });
    expect(out.status).toBe(400);
    expect(G.every((m) => !cd.isCooling(m, c.now()))).toBe(true);
  });

  it('빈 응답은 다음 모델로 넘어가고 휴식하지 않는다', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const { attempt } = scripted({ [G[0]]: { ok: false, empty: true } }, c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    expect(out.model).toBe(G[1]);
    expect(cd.isCooling(G[0], c.now())).toBe(false);
  });

  it('연속 타임아웃이면 남은 시간만큼만 기다리고 예산이 다하면 멈춘다', async () => {
    const c = clock(); const cd = createCooldownTracker();
    const { attempt, calls } = scripted(Object.fromEntries(G.map((m) => [m, () => ({ ok: false, status: 'network', timedOut: true, elapse: calls.at(-1).timeoutMs })])), c);
    const out = await runModelChain({ tier: 'generate', attempt, cooldowns: cd, now: c.now });
    expect(out.status).toBe(503);
    const spent = calls.reduce((sum, call) => sum + call.timeoutMs, 0);
    expect(spent).toBeLessThanOrEqual(CHAIN_BUDGET_MS.generate);
    expect(calls[0].timeoutMs).toBe(MODEL_CHAINS.generate[0].timeoutMs);
    expect(calls.at(-1).timeoutMs).toBeLessThanOrEqual(MODEL_CHAINS.generate[calls.length - 1].timeoutMs);
    expect(calls.length).toBeLessThan(G.length);
  });

  it('성공하면 이전 휴식 기록을 지운다', async () => {
    const c = clock(); const cd = createCooldownTracker();
    cd.coolDown(G[0], 10 * SEC, c.now());
    c.advance(11 * SEC);
    await runModelChain({ tier: 'generate', attempt: scripted({}, c).attempt, cooldowns: cd, now: c.now });
    expect(cd.remainingMs(G[0], c.now())).toBe(0);
  });
});

describe('normalizeTextResponse', () => {
  // 생각 파트 제거, 여러 파트를 parts[0] 하나로
  it('생각 파트를 제거하고 텍스트를 합친다', () => {
    const merged = normalizeTextResponse({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'thinking...', thought: true }, { text: 'Hello ' }, { text: 'world', thoughtSignature: 'sig' }] } }], usageMetadata: { x: 1 } });
    expect(merged.candidates[0].content.parts).toStrictEqual([{ text: 'Hello world' }]);
    expect(merged.candidates[0].finishReason).toBe('STOP');
    expect(merged.usageMetadata).toStrictEqual({ x: 1 });
  });

  it('본문이 없으면 null을 반환한다', () => {
    expect(normalizeTextResponse({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x', thought: true }] } }] })).toBeNull();
    expect(normalizeTextResponse({ candidates: [{ content: { parts: [{ text: '   ' }] } }] })).toBeNull();
    expect(normalizeTextResponse({ candidates: [] })).toBeNull();
    expect(normalizeTextResponse(null)).toBeNull();
  });
});

describe('오디오 변환', () => {
  const samples = new Int16Array(24000); // 1초, 440Hz
  for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / 24000) * 8000);
  const pcm = new Uint8Array(samples.buffer);
  const wrapped = toWavBytes(pcm, 'audio/L16;codec=pcm;rate=24000');

  it('raw PCM(L16)을 WAV로 감싸고 WAV는 그대로 유지한다', () => {
    expect(wrapped.mimeType).toBe('audio/wav');
    const parsed = parseWavChunks(wrapped.bytes);
    expect(parsed.fmt).toStrictEqual({ format: 1, channels: 1, sampleRate: 24000, bitsPerSample: 16 });
    expect(parsed.data.length).toBe(pcm.length);
    expect(toWavBytes(pcm, 'audio/l16; rate=16000; channels=1').bytes.length).toBe(pcm.length + 44);
    expect(parseWavChunks(toWavBytes(pcm, 'audio/l16; rate=16000; channels=1').bytes).fmt.sampleRate).toBe(16000);
    expect(toWavBytes(wrapped.bytes, 'audio/wav').bytes).toBe(wrapped.bytes);
    expect(toWavBytes(pcm, 'audio/mpeg').mimeType).toBe('audio/mpeg');
  });

  it('API 응답의 inlineData에서 오디오를 추출한다', () => {
    const fromApi = extractAudio({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/l16; rate=24000; channels=1', data: Buffer.from(pcm).toString('base64') } }] } }] });
    expect(fromApi.mimeType).toBe('audio/wav');
    expect(parseWavChunks(fromApi.bytes).data.length).toBe(pcm.length);
    expect(extractAudio({ candidates: [{ content: { parts: [{ text: 'no audio' }] } }] })).toBeNull();
    expect(extractAudio({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: '' } }] } }] })).toBeNull();
  });

  it('WAV를 Opus/WebM으로 트랜스코딩한다', async () => {
    const webm = await transcodeWavToOpusWebm(wrapped.bytes);
    expect(webm && webm.webm.length > 1000).toBeTruthy();
  });
});

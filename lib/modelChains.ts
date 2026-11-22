// 용도별 Gemini 모델 체인(주 모델 + 예비 모델)과 폴백 로직.
// 무료 티어 한도 안에서 "좋은 모델 먼저" 쓰고, 한도 초과·과부하·지연이면 다음 모델로 넘어갑니다.
// 네트워크 호출은 하지 않는 순수 로직이라 scripts/test-model-chains.mjs 로 검증합니다.
//
// 2026-11-13 실측 (무료 티어, 같은 API 키):
// - 2.5 Flash / 2.5 Flash Lite: 404 "no longer available to new users" → 제외
// - 기본 thinking은 maxOutputTokens 100에서 생각에만 토큰을 써 빈 응답 → 모델별 thinkingLevel 지정
// - 4 Hydrogen·3.8 Flash는 'minimal' 미지원(400) → 'low' + 생각 토큰 여유분(thinkingHeadroom)
// - 3.1 Flash TTS Preview는 voice 지정이 없으면 400, 2.5/3.1 TTS는 WAV가 아닌 raw PCM(L16) 반환
// - 강의(출력 ~1,000토큰): 4 Hydrogen(low) 11.7초·생각 1,188토큰, 3.6 Flash 17초, 3.5 Flash Lite 6.7초
// - 3.8 Flash는 이날 세 번 모두 60~90초 무응답 (과부하로 추정), 프로덕션에서는 3.6 Flash도 같은 증상

import type {
    AudioBytes,
    ChainAttemptResult,
    ChainEntry,
    ChainOutcome,
    CooldownTracker,
    FailureInfo,
    GeminiResult,
    GenerationConfig,
    ModelTier,
    RunChainOptions,
    SanitizedPayload,
} from './types.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// 생각 토큰도 maxOutputTokens에 포함되므로 'low' 모델은 여유분을 더해 본문이 잘리지 않게 합니다.
// 텍스트는 스트리밍으로 받으며(lib/geminiStream.js) 두 가지 시간을 따로 둡니다:
// - firstChunkMs: 첫 조각까지. 매달린 모델은 헤더조차 안 보내므로 여기서 걸러집니다.
//   thinking 'low' 모델은 생각을 마친 뒤 첫 조각이 옵니다. Hydrogen 강의 첫 조각 실측 6.8·7.6·11.1초(전체 13.8~18.4초)라
//   12초는 빠듯해 15초로 둡니다. 'minimal'은 1~7초. 매달린 3.8 Flash·3.6 Flash는 실제 API에서 정해진 시간에 정확히 포기됨.
// - timeoutMs: 끝까지 받는 전체 시간 (체인 남은 예산을 넘지 않음)
const LOW_THINKING = { thinkingLevel: 'low', thinkingHeadroom: 2048, firstChunkMs: 15 * SECOND };
const MIN_THINKING = { thinkingLevel: 'minimal', firstChunkMs: 8 * SECOND };

// 첫 조각 이후 새 조각이 이만큼 없으면 멈춘 스트림으로 보고 다음 모델로 넘어갑니다.
export const STREAM_IDLE_MS = 20 * SECOND;

// 무료 티어 한도(RPM/RPD)는 2026-11-13 AI Studio 사용량 화면 기준입니다.
export const MODEL_CHAINS: Record<ModelTier, ChainEntry[]> = {
    // 예문·설명 생성: 품질 우선. 상위 4개는 각각 하루 20회라 소진되면 Lite(하루 500회)로 내려갑니다.
    generate: [
        { model: 'gemini-4-hydrogen', ...LOW_THINKING, timeoutMs: 60 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3.8-flash', ...LOW_THINKING, timeoutMs: 60 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3.6-flash', ...MIN_THINKING, timeoutMs: 45 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3-flash-preview', ...MIN_THINKING, timeoutMs: 45 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3.5-flash-lite', ...MIN_THINKING, timeoutMs: 45 * SECOND }, // 15 RPM, 500 RPD
        { model: 'gemini-3.1-flash-lite', ...MIN_THINKING, timeoutMs: 45 * SECOND }, // 15 RPM, 500 RPD
        // Gemma 31B는 정상일 때도 첫 조각이 느려(비스트리밍 실측 31초) 넉넉히 기다립니다.
        { model: 'gemma-4-31b-it', ...MIN_THINKING, firstChunkMs: 15 * SECOND, timeoutMs: 60 * SECOND }, // 30 RPM, 14.4K RPD
        { model: 'gemma-4-26b-a4b-it', ...MIN_THINKING, firstChunkMs: 10 * SECOND, timeoutMs: 45 * SECOND }, // 30 RPM, 14.4K RPD
    ],
    // 번역·요약·헤드라인: 속도 우선. 한 번에 여러 요청이 나가므로 하루 500회 Lite부터 씁니다.
    fast: [
        { model: 'gemini-3.5-flash-lite', ...MIN_THINKING, timeoutMs: 30 * SECOND },
        { model: 'gemini-3.1-flash-lite', ...MIN_THINKING, timeoutMs: 30 * SECOND },
        { model: 'gemini-3-flash-preview', ...MIN_THINKING, timeoutMs: 30 * SECOND },
        { model: 'gemma-4-26b-a4b-it', ...MIN_THINKING, firstChunkMs: 10 * SECOND, timeoutMs: 30 * SECOND },
        { model: 'gemma-4-31b-it', ...MIN_THINKING, firstChunkMs: 15 * SECOND, timeoutMs: 40 * SECOND },
    ],
    // TTS: 모두 3 RPM, 10 RPD. 넷을 합쳐 하루 약 40회. TTS는 매달림이 관찰되지 않아 비스트리밍 그대로.
    tts: [
        { model: 'gemini-3.8-flash-tts', timeoutMs: 40 * SECOND },
        { model: 'gemini-3.8-flash-lite-tts', timeoutMs: 40 * SECOND },
        { model: 'gemini-3.1-flash-tts-preview', voiceName: 'Kore', timeoutMs: 40 * SECOND },
        { model: 'gemini-2.5-flash-preview-tts', timeoutMs: 40 * SECOND },
    ],
};

// 요청 하나가 체인 전체에 쓸 수 있는 시간 (vercel.json maxDuration 100초 안쪽)
export const CHAIN_BUDGET_MS: Record<ModelTier, number> = { generate: 85 * SECOND, fast: 50 * SECOND, tts: 85 * SECOND };
const MIN_ATTEMPT_MS = 4 * SECOND;

// 클라이언트는 용도('tier:generate' 등)를 보냅니다. 예전 클라이언트가 보내는 모델 이름도 받아줍니다.
const LEGACY_TEXT_MODELS = new Set([
    'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-flash-002',
    'gemini-2.0-flash', 'gemini-pro', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
]);
const LEGACY_TTS_MODELS = new Set(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);

export const resolveTier = (requested: unknown): ModelTier | null => {
    if (typeof requested !== 'string') return null;
    const tier = requested.startsWith('tier:') ? requested.slice(5) : null;
    if (tier) return Object.hasOwn(MODEL_CHAINS, tier) ? (tier as ModelTier) : null;
    if (LEGACY_TTS_MODELS.has(requested)) return 'tts';
    if (LEGACY_TEXT_MODELS.has(requested)) return 'fast';
    return null;
};

// 모델별 설정(thinking, voice)을 정제된 페이로드에 덧붙입니다. 원본은 바꾸지 않습니다.
export const buildModelPayload = (entry: ChainEntry, payload: SanitizedPayload, tier: ModelTier, voiceName?: string): SanitizedPayload => {
    const generationConfig: GenerationConfig = { ...payload.generationConfig };
    if (tier === 'tts') {
        const selectedVoice = voiceName || entry.voiceName;
        if (selectedVoice) {
            generationConfig.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } };
        }
    } else if (entry.thinkingLevel) {
        generationConfig.thinkingConfig = { thinkingLevel: entry.thinkingLevel };
        if (entry.thinkingHeadroom && Number.isInteger(generationConfig.maxOutputTokens)) {
            (generationConfig.maxOutputTokens as number) += entry.thinkingHeadroom;
        }
    }
    return { ...payload, generationConfig };
};

// 무료 티어 일일 한도는 태평양 시간 자정에 초기화됩니다.
// 벽시계 hour/minute로 남은 시간을 계산하면 DST 전환일(23/25시간)에 1시간 어긋나므로,
// 실제 다음 자정의 UTC 타임스탬프를 찾아 시간 차이를 구합니다.
const PACIFIC_PARTS = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const pacificDateParts = (timestamp: number): Record<string, string> => Object.fromEntries(
    PACIFIC_PARTS.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value])
);

export const msUntilPacificMidnight = (now = Date.now()) => {
    const current = pacificDateParts(now);
    const nextDate = new Date(Date.UTC(
        Number(current.year), Number(current.month) - 1, Number(current.day)
    ) + 24 * HOUR);
    const year = nextDate.getUTCFullYear();
    const month = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getUTCDate()).padStart(2, '0');

    // 태평양 자정은 UTC 07:00(PST) 또는 08:00(PDT)입니다. 둘 다 확인해 실제 자정을 찾습니다.
    for (const hour of [7, 8]) {
        const candidate = Date.UTC(year, Number(month) - 1, Number(day), hour);
        if (candidate <= now) continue;
        const parts = pacificDateParts(candidate);
        if (parts.year === String(year) && parts.month === month && parts.day === day
            && parts.hour === '00' && parts.minute === '00' && parts.second === '00') {
            return candidate - now + MINUTE; // 1분 여유
        }
    }
    return 24 * HOUR + MINUTE; // 예상치 못한 경우의 기존 폴백
};

const parseRetryDelayMs = (errorText: string): number | null => {
    const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(errorText || '');
    return match ? Math.ceil(Number(match[1]) * SECOND) : null;
};

/**
 * 실패를 분류해 이 모델을 얼마나 쉬게 할지 정합니다.
 * @returns {{ cooldownMs: number, quota: boolean }}
 */
export const classifyFailure = ({ status, errorText = '', timedOut = false }: FailureInfo, now = Date.now()): { cooldownMs: number; quota: boolean } => {
    // 응답 없이 매달리는 모델은 다음 요청도 오래 붙잡으므로 길게 쉬게 합니다.
    if (timedOut) return { cooldownMs: 10 * MINUTE, quota: false };
    if (status === 429) {
        if (/"quotaId"\s*:\s*"[^"]*PerDay/i.test(errorText)) {
            return { cooldownMs: msUntilPacificMidnight(now), quota: true };
        }
        return { cooldownMs: parseRetryDelayMs(errorText) ?? MINUTE, quota: true };
    }
    if (status === 404) return { cooldownMs: 24 * HOUR, quota: false };
    if ((status as number) >= 500 || status === 'network') return { cooldownMs: 2 * MINUTE, quota: false };
    // 400 등: 요청 자체 문제일 수 있어 쉬게 하지 않고 다음 모델만 시도합니다.
    return { cooldownMs: 0, quota: false };
};

// 서버리스 인스턴스가 살아있는 동안 모델별 휴식 시간을 기억합니다.
export const createCooldownTracker = (): CooldownTracker => {
    const until = new Map<string, number>();
    return {
        isCooling: (model: string, now = Date.now()) => (until.get(model) ?? 0) > now,
        remainingMs: (model: string, now = Date.now()) => Math.max(0, (until.get(model) ?? 0) - now),
        coolDown: (model: string, ms: number, now = Date.now()) => { if (ms > 0) until.set(model, now + ms); },
        clear: (model: string) => until.delete(model),
    };
};

// 텍스트 응답을 parts[0].text 하나로 합칩니다. 클라이언트는 parts[0].text만 읽는데,
// thinking 모델은 생각 서명 등으로 parts를 나눠 보낼 수 있습니다. 본문이 없으면 null.
export const normalizeTextResponse = (data: GeminiResult | null | undefined): GeminiResult | null => {
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const text = parts.filter((p) => !p?.thought && typeof p?.text === 'string').map((p) => p.text).join('');
    if (!text.trim()) return null;
    return {
        ...data,
        candidates: [{ ...candidate, content: { ...candidate!.content, role: 'model', parts: [{ text }] } }],
    };
};

// raw PCM(audio/L16; rate=24000)을 WAV로 감쌉니다. 이미 WAV면 그대로 둡니다.
export const toWavBytes = (bytes: Uint8Array, mimeType = ''): AudioBytes => {
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF') {
        return { bytes, mimeType: 'audio/wav' };
    }
    if (!/audio\/l16|pcm/i.test(mimeType)) return { bytes, mimeType: mimeType || 'application/octet-stream' };

    const sampleRate = Number(/rate=(\d+)/i.exec(mimeType)?.[1]) || 24000;
    const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1]) || 1;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'latin1');
    header.writeUInt32LE(36 + bytes.length, 4);
    header.write('WAVE', 8, 'latin1');
    header.write('fmt ', 12, 'latin1');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * 2, 28);
    header.writeUInt16LE(channels * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'latin1');
    header.writeUInt32LE(bytes.length, 40);
    return { bytes: new Uint8Array(Buffer.concat([header, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)])), mimeType: 'audio/wav' };
};

export const extractAudio = (data: GeminiResult | null | undefined): AudioBytes | null => {
    const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData;
    if (!inline) return null;
    const raw = new Uint8Array(Buffer.from(inline.data as string, 'base64'));
    if (raw.length === 0) return null;
    return toWavBytes(raw, inline.mimeType || '');
};

/**
 * 체인을 순서대로 시도합니다.
 * @param {object} opts
 * @param {string} opts.tier
 * @param {(entry: object, timeoutMs: number) => Promise<{ok: true, value: any} | {ok: false, status: number|'network', errorText?: string, timedOut?: boolean, empty?: boolean}>} opts.attempt
 * @param {ReturnType<typeof createCooldownTracker>} opts.cooldowns
 * @param {() => number} [opts.now]
 * @param {object[]} [opts.chain]
 * @param {number} [opts.budgetMs]
 * @returns {Promise<{ok: true, value: any, model: string, tried: string[]} | {ok: false, status: number, retryAfterSec: number, tried: string[]}>}
 */
export const runModelChain = async ({ tier, attempt, cooldowns, now = Date.now, chain = MODEL_CHAINS[tier], budgetMs = CHAIN_BUDGET_MS[tier] }: RunChainOptions): Promise<ChainOutcome> => {
    const start = now();
    const tried: string[] = [];
    let allQuota = true;
    let clientErrors = 0;
    let attempted = 0;

    for (const entry of chain) {
        if (cooldowns.isCooling(entry.model, now())) continue;
        const remaining = budgetMs - (now() - start);
        if (remaining < MIN_ATTEMPT_MS) break;

        attempted += 1;
        tried.push(entry.model);
        const result = await attempt(entry, Math.min(entry.timeoutMs, remaining));
        if (result.ok) {
            cooldowns.clear(entry.model);
            return { ok: true, value: result.value, model: entry.model, tried };
        }

        if (result.empty) {
            allQuota = false;
            continue;
        }
        const { cooldownMs, quota } = classifyFailure(result, now());
        cooldowns.coolDown(entry.model, cooldownMs, now());
        if (!quota) allQuota = false;
        if (typeof result.status === 'number' && result.status >= 400 && result.status < 500 && result.status !== 429 && result.status !== 404) {
            clientErrors += 1;
        }
    }

    // 다음에 다시 쓸 수 있는 가장 이른 시각을 Retry-After로 알려줍니다.
    // 24시간/자정까지 쿨다운인데 60초로 잘라 알리면 재시도→재실패가 반복됩니다.
    const remaining = chain.map((e) => cooldowns.remainingMs(e.model, now())).filter((ms) => ms > 0);
    const soonest = remaining.length ? Math.min(...remaining) : 60 * SECOND;
    const retryAfterSec = Math.max(5, Math.ceil(soonest / SECOND));
    if (attempted === 0 || allQuota) return { ok: false, status: 429, retryAfterSec, tried };
    // 시도한 모든 모델이 4xx로 거절했다면 모델 문제가 아니라 요청 자체가 잘못된 것입니다.
    if (clientErrors === attempted) return { ok: false, status: 400, retryAfterSec, tried };
    return { ok: false, status: 503, retryAfterSec, tried };
};

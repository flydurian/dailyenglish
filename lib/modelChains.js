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
// - 3.8 Flash는 이날 세 번 모두 60~90초 무응답 (과부하로 추정)

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// 생각 토큰도 maxOutputTokens에 포함되므로 'low' 모델은 여유분을 더해 본문이 잘리지 않게 합니다.
const LOW_THINKING = { thinkingLevel: 'low', thinkingHeadroom: 2048 };
const MIN_THINKING = { thinkingLevel: 'minimal' };

// 무료 티어 한도(RPM/RPD)는 2026-11-13 AI Studio 사용량 화면 기준입니다.
export const MODEL_CHAINS = {
    // 예문·설명 생성: 품질 우선. 상위 4개는 각각 하루 20회라 소진되면 Lite(하루 500회)로 내려갑니다.
    generate: [
        { model: 'gemini-4-hydrogen', ...LOW_THINKING, timeoutMs: 40 * SECOND }, // 5 RPM, 20 RPD
        // 3.8 Flash는 실측 중 60~90초 무응답이 반복돼 짧게 기다리고 넘어갑니다.
        { model: 'gemini-3.8-flash', ...LOW_THINKING, timeoutMs: 20 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3.6-flash', ...MIN_THINKING, timeoutMs: 25 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3-flash-preview', ...MIN_THINKING, timeoutMs: 25 * SECOND }, // 5 RPM, 20 RPD
        { model: 'gemini-3.5-flash-lite', ...MIN_THINKING, timeoutMs: 25 * SECOND }, // 15 RPM, 500 RPD
        { model: 'gemini-3.1-flash-lite', ...MIN_THINKING, timeoutMs: 25 * SECOND }, // 15 RPM, 500 RPD
        { model: 'gemma-4-31b-it', ...MIN_THINKING, timeoutMs: 30 * SECOND }, // 30 RPM, 14.4K RPD
        { model: 'gemma-4-26b-a4b-it', ...MIN_THINKING, timeoutMs: 25 * SECOND }, // 30 RPM, 14.4K RPD
    ],
    // 번역·요약·헤드라인: 속도 우선. 한 번에 여러 요청이 나가므로 하루 500회 Lite부터 씁니다.
    fast: [
        { model: 'gemini-3.5-flash-lite', ...MIN_THINKING, timeoutMs: 20 * SECOND },
        { model: 'gemini-3.1-flash-lite', ...MIN_THINKING, timeoutMs: 20 * SECOND },
        { model: 'gemini-3-flash-preview', ...MIN_THINKING, timeoutMs: 20 * SECOND },
        { model: 'gemma-4-26b-a4b-it', ...MIN_THINKING, timeoutMs: 20 * SECOND },
        { model: 'gemma-4-31b-it', ...MIN_THINKING, timeoutMs: 25 * SECOND },
    ],
    // TTS: 모두 3 RPM, 10 RPD. 넷을 합쳐 하루 약 40회.
    tts: [
        { model: 'gemini-3.8-flash-tts', timeoutMs: 40 * SECOND },
        { model: 'gemini-3.8-flash-lite-tts', timeoutMs: 40 * SECOND },
        { model: 'gemini-3.1-flash-tts-preview', voiceName: 'Kore', timeoutMs: 40 * SECOND },
        { model: 'gemini-2.5-flash-preview-tts', timeoutMs: 40 * SECOND },
    ],
};

// 요청 하나가 체인 전체에 쓸 수 있는 시간 (vercel.json maxDuration 100초 안쪽)
export const CHAIN_BUDGET_MS = { generate: 85 * SECOND, fast: 50 * SECOND, tts: 85 * SECOND };
const MIN_ATTEMPT_MS = 4 * SECOND;

// 클라이언트는 용도('tier:generate' 등)를 보냅니다. 예전 클라이언트가 보내는 모델 이름도 받아줍니다.
const LEGACY_TEXT_MODELS = new Set([
    'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-flash-002',
    'gemini-2.0-flash', 'gemini-pro', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
]);
const LEGACY_TTS_MODELS = new Set(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);

export const resolveTier = (requested) => {
    if (typeof requested !== 'string') return null;
    const tier = requested.startsWith('tier:') ? requested.slice(5) : null;
    if (tier) return Object.hasOwn(MODEL_CHAINS, tier) ? tier : null;
    if (LEGACY_TTS_MODELS.has(requested)) return 'tts';
    if (LEGACY_TEXT_MODELS.has(requested)) return 'fast';
    return null;
};

// 모델별 설정(thinking, voice)을 정제된 페이로드에 덧붙입니다. 원본은 바꾸지 않습니다.
export const buildModelPayload = (entry, payload, tier) => {
    const generationConfig = { ...payload.generationConfig };
    if (tier === 'tts') {
        if (entry.voiceName) {
            generationConfig.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: entry.voiceName } } };
        }
    } else if (entry.thinkingLevel) {
        generationConfig.thinkingConfig = { thinkingLevel: entry.thinkingLevel };
        if (entry.thinkingHeadroom && Number.isInteger(generationConfig.maxOutputTokens)) {
            generationConfig.maxOutputTokens += entry.thinkingHeadroom;
        }
    }
    return { ...payload, generationConfig };
};

// 무료 티어 일일 한도는 태평양 시간 자정에 초기화됩니다.
export const msUntilPacificMidnight = (now = Date.now()) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
    const elapsed = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * SECOND + (now % SECOND);
    return 24 * HOUR - elapsed + MINUTE; // 1분 여유
};

const parseRetryDelayMs = (errorText) => {
    const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(errorText || '');
    return match ? Math.ceil(Number(match[1]) * SECOND) : null;
};

/**
 * 실패를 분류해 이 모델을 얼마나 쉬게 할지 정합니다.
 * @returns {{ cooldownMs: number, quota: boolean }}
 */
export const classifyFailure = ({ status, errorText = '', timedOut = false }, now = Date.now()) => {
    // 응답 없이 매달리는 모델은 다음 요청도 오래 붙잡으므로 길게 쉬게 합니다.
    if (timedOut) return { cooldownMs: 10 * MINUTE, quota: false };
    if (status === 429) {
        if (/"quotaId"\s*:\s*"[^"]*PerDay/i.test(errorText)) {
            return { cooldownMs: msUntilPacificMidnight(now), quota: true };
        }
        return { cooldownMs: parseRetryDelayMs(errorText) ?? MINUTE, quota: true };
    }
    if (status === 404) return { cooldownMs: 24 * HOUR, quota: false };
    if (status >= 500 || status === 'network') return { cooldownMs: 2 * MINUTE, quota: false };
    // 400 등: 요청 자체 문제일 수 있어 쉬게 하지 않고 다음 모델만 시도합니다.
    return { cooldownMs: 0, quota: false };
};

// 서버리스 인스턴스가 살아있는 동안 모델별 휴식 시간을 기억합니다.
export const createCooldownTracker = () => {
    const until = new Map();
    return {
        isCooling: (model, now = Date.now()) => (until.get(model) ?? 0) > now,
        remainingMs: (model, now = Date.now()) => Math.max(0, (until.get(model) ?? 0) - now),
        coolDown: (model, ms, now = Date.now()) => { if (ms > 0) until.set(model, now + ms); },
        clear: (model) => until.delete(model),
    };
};

// 텍스트 응답을 parts[0].text 하나로 합칩니다. 클라이언트는 parts[0].text만 읽는데,
// thinking 모델은 생각 서명 등으로 parts를 나눠 보낼 수 있습니다. 본문이 없으면 null.
export const normalizeTextResponse = (data) => {
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const text = parts.filter((p) => !p?.thought && typeof p?.text === 'string').map((p) => p.text).join('');
    if (!text.trim()) return null;
    return {
        ...data,
        candidates: [{ ...candidate, content: { ...candidate.content, role: 'model', parts: [{ text }] } }],
    };
};

// raw PCM(audio/L16; rate=24000)을 WAV로 감쌉니다. 이미 WAV면 그대로 둡니다.
export const toWavBytes = (bytes, mimeType = '') => {
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

export const extractAudio = (data) => {
    const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData;
    if (!inline) return null;
    const raw = new Uint8Array(Buffer.from(inline.data, 'base64'));
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
export const runModelChain = async ({ tier, attempt, cooldowns, now = Date.now, chain = MODEL_CHAINS[tier], budgetMs = CHAIN_BUDGET_MS[tier] }) => {
    const start = now();
    const tried = [];
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
    const soonest = Math.min(...chain.map((e) => cooldowns.remainingMs(e.model, now())).filter((ms) => ms > 0), 60 * SECOND);
    const retryAfterSec = Math.max(5, Math.ceil(soonest / SECOND));
    if (attempted === 0 || allQuota) return { ok: false, status: 429, retryAfterSec, tried };
    // 시도한 모든 모델이 4xx로 거절했다면 모델 문제가 아니라 요청 자체가 잘못된 것입니다.
    if (clientErrors === attempted) return { ok: false, status: 400, retryAfterSec, tried };
    return { ok: false, status: 503, retryAfterSec, tried };
};

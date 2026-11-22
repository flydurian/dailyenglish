// Vercel Serverless Function for Gemini API
// 무료 티어 전용: 체인(lib/modelChains.js)에 있는 무료 티어 모델만 쓰며, 유료 모델로 폴백하지 않습니다.
import { createHash } from 'node:crypto';
import {
    setCorsHeaders,
    isTrustedRequest,
    getClientIp,
    checkRateLimit,
    setApiSecurityHeaders,
} from '../lib/security.ts';
import { transcodeWavToOpusWebm } from '../lib/audioTranscode.ts';
import {
    resolveTier,
    buildModelPayload,
    createCooldownTracker,
    normalizeTextResponse,
    extractAudio,
    runModelChain,
    STREAM_IDLE_MS,
} from '../lib/modelChains.ts';
import { fetchGeminiStream } from '../lib/geminiStream.ts';
import type { StreamFetchResult } from '../lib/geminiStream.ts';
import type {
    ApiRequest,
    ApiResponse,
    AudioBytes,
    ChainAttemptResult,
    ChainEntry,
    GeminiResult,
    GenerationConfig,
    JsonObject,
    ModelTier,
    SanitizedPayload,
} from '../lib/types.ts';
// API 키는 서버 환경변수(GEMINI_API_KEY)에만 존재하며 클라이언트로 전달되지 않습니다.

// 클라이언트는 모델 대신 용도(tier:generate | tier:fast | tier:tts)를 보내고, 실제 모델은
// lib/modelChains.js 의 체인(좋은 모델 먼저 → 한도 초과·과부하·지연 시 예비 모델)에서 고릅니다.
// 체인에 없는 모델은 호출할 수 없습니다 (임의 모델/URL 주입 방지).
const modelCooldowns = createCooldownTracker();
const MAX_REQUEST_BYTES = 80_000;
const MAX_TEXT_CHARS = 20_000;
// 뉴스 요약이 실측 1,300~1,600자라 1,200자 상한에서는 기사 읽기 TTS가 항상 400으로
// 거부됐습니다. Opus 트랜스코딩(84초 → 약 700KB) 덕분에 응답 크기는 더 이상 병목이
// 아니고, 실제 제약은 생성 시간(15~22초)이라 상한은 안전 마진을 두고 1,600자로 유지합니다.
const MAX_TTS_TEXT_CHARS = 1_600;
const TEXT_REQUESTS_PER_MINUTE = 20;
// TTS 체인 4개 모델이 각각 3 RPM이라 업스트림 이론 용량은 12회/분입니다.
// 한 요청이 실패 시 여러 모델을 순차 호출할 수 있어 절반인 6회로 제한합니다.
const TTS_REQUESTS_PER_MINUTE = 6;

// 국기 버튼으로 고르는 영어 억양 → Gemini TTS 목소리 ID (서버에서만 매핑).
const TTS_ACCENT_VOICES: Record<string, string> = {
    us: 'en-us-advisor-9', // Midwest, female — 중립적인 미국 발음
    gb: 'en-gb-advisor-1', // Winchester, female — 중립적인 영국 발음
};
// 위 ID는 Gemini 3.8 TTS의 Extended Voice Library 목소리입니다. 구형 모델은
// prebuilt voice만 지원하므로 폴백 모델에는 억양 ID를 넘기지 않습니다.
const EXTENDED_VOICE_MODELS = new Set(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);

const ALLOWED_GEN_CONFIG_KEYS = new Set([
    'temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType',
]);
const TTS_GEN_CONFIG_KEYS = new Set(['responseModalities']);
const ALLOWED_RESPONSE_MIME_TYPES = new Set(['text/plain', 'application/json']);

const isPlainObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value: JsonObject, allowed: Set<string>): boolean => Object.keys(value).every((key) => allowed.has(key));

// TTS 요청은 텍스트/오디오 필드만 허용하고, 나머지는 모두 제거합니다.
const sanitizeTtsPayload = (payload: unknown): SanitizedPayload | null => {
    if (!isPlainObject(payload) || !hasOnlyKeys(payload, new Set(['contents', 'generationConfig', 'model']))) {
        return null;
    }

    const { contents, generationConfig } = payload;
    if (!Array.isArray(contents) || contents.length !== 1) return null;

    const content = contents[0];
    if (!isPlainObject(content) || !hasOnlyKeys(content, new Set(['role', 'parts']))) return null;
    if (content.role !== undefined && content.role !== 'user') return null;
    if (!Array.isArray(content.parts) || content.parts.length !== 1) return null;

    const part = content.parts[0];
    if (!isPlainObject(part) || !hasOnlyKeys(part, new Set(['text']))) return null;
    if (typeof part.text !== 'string') return null;

    const text = part.text.trim();
    if (!text || text.length > MAX_TTS_TEXT_CHARS) return null;

    if (!isPlainObject(generationConfig) || !hasOnlyKeys(generationConfig, TTS_GEN_CONFIG_KEYS)) return null;
    if (!Array.isArray(generationConfig.responseModalities)
        || generationConfig.responseModalities.length !== 1
        || generationConfig.responseModalities[0] !== 'AUDIO') {
        return null;
    }

    return {
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'] },
    };
};

// 텍스트 요청은 user 텍스트와 안전한 generationConfig만 허용합니다.
const sanitizeTextPayload = (payload: unknown): SanitizedPayload | null => {
    if (!isPlainObject(payload) || !hasOnlyKeys(payload, new Set(['contents', 'generationConfig', 'model']))) {
        return null;
    }

    const { contents, generationConfig } = payload;
    if (!Array.isArray(contents) || contents.length < 1 || contents.length > 4) return null;
    if (!isPlainObject(generationConfig) || !hasOnlyKeys(generationConfig, ALLOWED_GEN_CONFIG_KEYS)) return null;

    let totalCharacters = 0;
    const sanitizedContents = [];

    for (const content of contents) {
        if (!isPlainObject(content) || !hasOnlyKeys(content, new Set(['role', 'parts']))) return null;
        if (content.role !== undefined && content.role !== 'user') return null;
        if (!Array.isArray(content.parts) || content.parts.length < 1 || content.parts.length > 4) return null;

        const parts = [];
        for (const part of content.parts) {
            if (!isPlainObject(part) || !hasOnlyKeys(part, new Set(['text']))) return null;
            if (typeof part.text !== 'string' || !part.text.trim()) return null;

            totalCharacters += part.text.length;
            if (totalCharacters > MAX_TEXT_CHARS) return null;
            parts.push({ text: part.text });
        }
        sanitizedContents.push({ role: 'user', parts });
    }

    const sanitizedGenerationConfig: GenerationConfig = {};
    const { temperature, topP, topK, maxOutputTokens, responseMimeType } = generationConfig;

    if (temperature !== undefined) {
        if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) return null;
        sanitizedGenerationConfig.temperature = temperature;
    }
    if (topP !== undefined) {
        if (typeof topP !== 'number' || topP < 0 || topP > 1) return null;
        sanitizedGenerationConfig.topP = topP;
    }
    if (topK !== undefined) {
        if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) return null;
        sanitizedGenerationConfig.topK = topK;
    }
    if (maxOutputTokens !== undefined) {
        if (!Number.isInteger(maxOutputTokens) || (maxOutputTokens as number) < 1 || (maxOutputTokens as number) > 8192) return null;
        sanitizedGenerationConfig.maxOutputTokens = maxOutputTokens;
    }
    if (responseMimeType !== undefined) {
        if (!ALLOWED_RESPONSE_MIME_TYPES.has(responseMimeType as string)) return null;
        sanitizedGenerationConfig.responseMimeType = responseMimeType;
    }

    return { contents: sanitizedContents, generationConfig: sanitizedGenerationConfig };
};

const sanitizeGeminiPayload = (payload: unknown, tier: ModelTier): SanitizedPayload | null => (
    tier === 'tts' ? sanitizeTtsPayload(payload) : sanitizeTextPayload(payload)
);

const tooManyRequests = (res: ApiResponse, retryAfter: number | string): ApiResponse => {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
        error: 'Too Many Requests',
        details: 'API Quota Exceeded. Please try again later.',
    });
};

// 같은 요청이 짧은 시간 안에 반복되면 업스트림 호출을 건너뜁니다.
// (서버리스 인스턴스가 살아있는 동안 적용되는 작은 LRU 캐시)
const TEXT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TEXT_CACHE_MAX_ENTRIES = 40;
const textResponseCache = new Map<string, { at: number; data: GeminiResult }>();

const getRequestCacheKey = (tier: string, payload: unknown): string => createHash('sha256')
    .update(tier)
    .update('\0')
    .update(JSON.stringify(payload))
    .digest('hex');

const readTextCache = (key: string): GeminiResult | null => {
    const entry = textResponseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > TEXT_CACHE_TTL_MS) {
        textResponseCache.delete(key);
        return null;
    }
    return entry.data;
};

const writeTextCache = (key: string, data: GeminiResult): void => {
    textResponseCache.delete(key);
    textResponseCache.set(key, { at: Date.now(), data });
    while (textResponseCache.size > TEXT_CACHE_MAX_ENTRIES) {
        const oldestKey = textResponseCache.keys().next().value;
        textResponseCache.delete(oldestKey!);
    }
};

type GeminiRequestResult =
    | { ok: true; data: GeminiResult }
    | { ok: false; status: number | 'network'; errorText?: string; timedOut?: boolean };

const requestGemini = async (targetModel: string, targetPayload: SanitizedPayload, apiKey: string, timeoutMs: number): Promise<GeminiRequestResult> => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;
    let response;
    try {
        response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(targetPayload),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        const timedOut = (error as Error)?.name === 'TimeoutError';
        console.error(`Gemini API ${timedOut ? 'timeout' : 'network error'} [${targetModel}] after ${timeoutMs}ms`);
        return { ok: false, status: 'network', timedOut };
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`Gemini API Error (${response.status}) [${targetModel}]:`, errorText);
        return { ok: false, status: response.status, errorText };
    }

    try {
        return { ok: true, data: await response.json() };
    } catch (error) {
        const timedOut = (error as Error)?.name === 'TimeoutError';
        console.error(`Gemini API body read failed [${targetModel}]`);
        return { ok: false, status: 'network', timedOut };
    }
};

// 텍스트는 스트리밍으로 받아 "첫 조각까지"와 "끝까지"를 따로 기다립니다 (lib/geminiStream.js).
// 매달린 모델은 firstChunkMs 만에 포기하고, 느리지만 응답 중인 모델은 끝까지 기다립니다.
const requestGeminiText = async (entry: ChainEntry, targetPayload: SanitizedPayload, apiKey: string, timeoutMs: number): Promise<StreamFetchResult> => {
    const result = await fetchGeminiStream({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${entry.model}:streamGenerateContent?alt=sse`,
        init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(targetPayload),
        },
        firstChunkMs: Math.min(entry.firstChunkMs ?? timeoutMs, timeoutMs),
        idleMs: STREAM_IDLE_MS,
        totalMs: timeoutMs,
    });

    if (result.ok) {
        // 첫 조각 대기 시간(firstChunkMs)을 조정할 때 참고할 실측값
        console.log(`Gemini text ok [${entry.model}] first chunk ${result.firstChunkAfterMs}ms`);
    } else {
        if (result.timedOut) {
            const waited = result.reason === 'first-chunk' ? `no first chunk in ${Math.min(entry.firstChunkMs ?? timeoutMs, timeoutMs)}ms` : `${result.reason} timeout`;
            console.error(`Gemini API stalled [${entry.model}]: ${waited}`);
        } else if (typeof result.status === 'number') {
            console.error(`Gemini API Error (${result.status}) [${entry.model}]:`, result.errorText);
        } else {
            console.error(`Gemini API network error [${entry.model}]: ${result.reason}`);
        }
    }
    return result;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    setApiSecurityHeaders(res);
    const corsAllowed = setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        return corsAllowed ? res.status(204).end() : res.status(403).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 브라우저의 same-origin 요청만 허용합니다. 외부 사이트/단순 스크립트의 프록시 사용을 차단합니다.
    if (!isTrustedRequest(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
        return res.status(415).json({ error: 'Unsupported media type' });
    }

    const contentLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return res.status(413).json({ error: 'Payload too large' });
    }

    const { payload, model: requestedModel, format: requestedTtsFormat, accent: requestedAccent } = req.body || {};

    if (!payload || typeof payload !== 'object' || !requestedModel) {
        return res.status(400).json({ error: 'Missing payload or model' });
    }

    if (JSON.stringify(req.body).length > MAX_REQUEST_BYTES) {
        return res.status(413).json({ error: 'Payload too large' });
    }

    const tier = resolveTier(requestedModel);
    if (!tier) {
        return res.status(400).json({ error: 'Unsupported model' });
    }
    const isTts = tier === 'tts';
    if (isTts && requestedAccent !== undefined && !Object.hasOwn(TTS_ACCENT_VOICES, requestedAccent as string)) {
        return res.status(400).json({ error: 'Invalid accent' });
    }
    const accentVoice = isTts ? TTS_ACCENT_VOICES[requestedAccent as string] : undefined;

    // TTS 출력 포맷 옵션: 'webm'(기본, Opus/WebM) | 'wav'(WebM 미지원 브라우저 폴백).
    // 포맷이 없는 구형 클라이언트 요청도 기본값 webm으로 트랜스코딩합니다.
    // 텍스트 요청에서는 이 값을 무시합니다.
    let ttsOutputFormat: string | undefined = isTts ? 'webm' : undefined;
    if (requestedTtsFormat !== undefined) {
        if (requestedTtsFormat !== 'webm' && requestedTtsFormat !== 'wav') {
            return res.status(400).json({ error: 'Invalid request payload' });
        }
        if (isTts) ttsOutputFormat = requestedTtsFormat as string;
    }

    const sanitizedPayload = sanitizeGeminiPayload(payload, tier);
    if (!sanitizedPayload) {
        return res.status(400).json({ error: 'Invalid request payload' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not configured');
        return res.status(500).json({ error: 'API key not configured' });
    }

    const clientIp = getClientIp(req);
    if (isTts) {
        const ipLimit = checkRateLimit(`tts:ip:${clientIp}`, TTS_REQUESTS_PER_MINUTE);
        if (!ipLimit.allowed) return tooManyRequests(res, ipLimit.retryAfter);

        const globalLimit = checkRateLimit('tts:global', TTS_REQUESTS_PER_MINUTE);
        if (!globalLimit.allowed) return tooManyRequests(res, globalLimit.retryAfter);
    } else {
        const ipLimit = checkRateLimit(`text:ip:${clientIp}`, TEXT_REQUESTS_PER_MINUTE);
        if (!ipLimit.allowed) return tooManyRequests(res, ipLimit.retryAfter);
    }

    // 캐시 히트도 한도에 포함되어야 합니다. 캐시 조회를 먼저 하면 동일 payload를
    // 무제한으로 반환해 인스턴스 메모리 기반 제한을 우회할 수 있습니다.
    const cacheKey = isTts ? null : getRequestCacheKey(tier, sanitizedPayload);

    if (cacheKey) {
        const cached = readTextCache(cacheKey);
        if (cached) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Gemini-Cache', 'HIT');
            return res.status(200).json(cached);
        }
    }

    try {
        // 체인 순서대로 시도: 성공하면 바로 반환, 한도 초과·과부하·지연·빈 응답이면 다음 모델.
        const outcome = await runModelChain({
            tier,
            cooldowns: modelCooldowns,
            attempt: async (entry, timeoutMs): Promise<ChainAttemptResult> => {
                // 구형 TTS 모델에 Extended Voice ID를 보내면 400이 나 체인 전체가 실패합니다.
                const voice = EXTENDED_VOICE_MODELS.has(entry.model) ? accentVoice : undefined;
                const modelPayload = buildModelPayload(entry, sanitizedPayload, tier, voice);
                const result = isTts
                    ? await requestGemini(entry.model, modelPayload, apiKey, timeoutMs)
                    : await requestGeminiText(entry, modelPayload, apiKey, timeoutMs);
                if (!result.ok) return result;

                const value = isTts ? extractAudio(result.data) : normalizeTextResponse(result.data);
                if (!value) {
                    console.warn(`Gemini empty ${isTts ? 'audio' : 'text'} response [${entry.model}]`);
                    return { ok: false, empty: true };
                }
                return { ok: true, value };
            },
        });

        if (!outcome.ok) {
            console.error(`Gemini ${tier} chain failed (${outcome.status}); tried: ${outcome.tried.join(', ') || 'none (all cooling down)'}`);
            if (outcome.status === 429) return tooManyRequests(res, outcome.retryAfterSec);
            if (outcome.status === 400) return res.status(400).json({ error: 'Invalid request payload' });
            // 업스트림 오류 내용은 클라이언트에 노출하지 않습니다.
            res.setHeader('Retry-After', String(outcome.retryAfterSec));
            return res.status(503).json({ error: 'Gemini API request failed' });
        }

        if (outcome.tried.length > 1) {
            console.warn(`Gemini ${tier} fell back to ${outcome.model} after: ${outcome.tried.slice(0, -1).join(', ')}`);
        }

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Gemini-Cache', cacheKey ? 'MISS' : 'BYPASS');
        res.setHeader('X-Gemini-Model', outcome.model);
        if (outcome.tried.length > 1) res.setHeader('X-Gemini-Fallback', String(outcome.tried.length - 1));

        // TTS는 후보 JSON 대신 오디오를 바이너리로 내려줍니다. WAV(24kHz s16 mono)를
        // 그대로 내려주면 84초 기준 4.0MB라 서버리스 응답 한도(4.5MB)에 근접하므로,
        // 기본값은 서버에서 Opus/WebM으로 트랜스코딩해 약 700KB(약 5.7배 작게)로 내립니다.
        // raw PCM을 내는 예비 TTS 모델도 extractAudio가 WAV로 감싸 같은 경로를 탑니다.
        // 트랜스코딩 실패 시 WAV를 그대로 내려 폴백합니다.
        if (isTts) {
            const audio = outcome.value as AudioBytes;
            if (ttsOutputFormat === 'webm') {
                const transcoded = await transcodeWavToOpusWebm(audio.bytes);
                if (transcoded) {
                    res.setHeader('Content-Type', 'audio/webm; codecs="opus"');
                    return res.status(200).end(Buffer.from(transcoded.webm));
                }
            }
            res.setHeader('Content-Type', audio.mimeType);
            return res.status(200).end(Buffer.from(audio.bytes));
        }

        if (cacheKey) writeTextCache(cacheKey, outcome.value as GeminiResult);
        res.status(200).json(outcome.value);
    } catch (error) {
        console.error('Gemini API Server Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Vercel Serverless Function for Gemini API
// 무료 티어 전용: 허용 모델은 무료 티어 모델뿐이며, 유료 모델로 폴백하지 않습니다.
import { createHash } from 'node:crypto';
import {
    setCorsHeaders,
    isTrustedRequest,
    getClientIp,
    checkRateLimit,
    setApiSecurityHeaders,
} from '../lib/security.js';
// API 키는 서버 환경변수(GEMINI_API_KEY)에만 존재하며 클라이언트로 전달되지 않습니다.

// 텍스트 생성에 사용할 기본 모델 (2026-10 기준 Gemini 3.5 Flash Lite)
const DEFAULT_TEXT_MODEL = 'gemini-3.5-flash-lite';

// 예전 모델 이름을 현재 사용 중인 모델로 매핑합니다.
const MODEL_ALIASES = {
    'gemini-flash-latest': DEFAULT_TEXT_MODEL,
    'gemini-1.5-flash': DEFAULT_TEXT_MODEL,
    'gemini-1.5-flash-001': DEFAULT_TEXT_MODEL,
    'gemini-1.5-flash-002': DEFAULT_TEXT_MODEL,
    'gemini-2.0-flash': DEFAULT_TEXT_MODEL,
    'gemini-pro': DEFAULT_TEXT_MODEL,
};

// 무료 티어 전용 TTS 모델만 허용합니다. 유료 모델로의 폴백은 없습니다.
const TTS_MODELS = new Set([
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
]);

// 1차 TTS가 429(무료 한도)일 때만 2차 무료 TTS로 전환합니다.
const TTS_FALLBACKS = new Map([
    ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
]);

// 이 엔드포인트로 호출할 수 있는 모델 목록 (임의 모델/URL 주입 방지)
const ALLOWED_MODELS = new Set([
    DEFAULT_TEXT_MODEL,
    'gemini-3.1-flash-lite', // 이전 버전 호환
    ...TTS_MODELS,
]);

const GEMINI_TIMEOUT_MS = 60_000;
const MAX_REQUEST_BYTES = 80_000;
const MAX_TEXT_CHARS = 20_000;
const MAX_TTS_TEXT_CHARS = 1_200;
const TEXT_REQUESTS_PER_MINUTE = 20;
const TTS_REQUESTS_PER_MINUTE = 3;

const ALLOWED_GEN_CONFIG_KEYS = new Set([
    'temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType',
]);
const TTS_GEN_CONFIG_KEYS = new Set(['responseModalities']);
const ALLOWED_RESPONSE_MIME_TYPES = new Set(['text/plain', 'application/json']);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, allowed) => Object.keys(value).every((key) => allowed.has(key));

// TTS 요청은 텍스트/오디오 필드만 허용하고, 나머지는 모두 제거합니다.
const sanitizeTtsPayload = (payload) => {
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
const sanitizeTextPayload = (payload) => {
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

    const sanitizedGenerationConfig = {};
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
        if (!Number.isInteger(topK) || topK < 1 || topK > 100) return null;
        sanitizedGenerationConfig.topK = topK;
    }
    if (maxOutputTokens !== undefined) {
        if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 8192) return null;
        sanitizedGenerationConfig.maxOutputTokens = maxOutputTokens;
    }
    if (responseMimeType !== undefined) {
        if (!ALLOWED_RESPONSE_MIME_TYPES.has(responseMimeType)) return null;
        sanitizedGenerationConfig.responseMimeType = responseMimeType;
    }

    return { contents: sanitizedContents, generationConfig: sanitizedGenerationConfig };
};

const sanitizeGeminiPayload = (payload, model) => (
    TTS_MODELS.has(model) ? sanitizeTtsPayload(payload) : sanitizeTextPayload(payload)
);

const tooManyRequests = (res, retryAfter) => {
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
const textResponseCache = new Map();

const getRequestCacheKey = (model, payload) => createHash('sha256')
    .update(model)
    .update('\0')
    .update(JSON.stringify(payload))
    .digest('hex');

const readTextCache = (key) => {
    const entry = textResponseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > TEXT_CACHE_TTL_MS) {
        textResponseCache.delete(key);
        return null;
    }
    return entry.data;
};

const writeTextCache = (key, data) => {
    textResponseCache.delete(key);
    textResponseCache.set(key, { at: Date.now(), data });
    while (textResponseCache.size > TEXT_CACHE_MAX_ENTRIES) {
        const oldestKey = textResponseCache.keys().next().value;
        textResponseCache.delete(oldestKey);
    }
};

const requestGemini = async (targetModel, targetPayload, apiKey) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(targetPayload),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API Error (${response.status}) [${targetModel}]:`, errorText);
        return { ok: false, status: response.status };
    }

    return { ok: true, data: await response.json() };
};

export default async function handler(req, res) {
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

    const { payload, model: requestedModel } = req.body || {};

    if (!payload || typeof payload !== 'object' || !requestedModel) {
        return res.status(400).json({ error: 'Missing payload or model' });
    }

    if (JSON.stringify(req.body).length > MAX_REQUEST_BYTES) {
        return res.status(413).json({ error: 'Payload too large' });
    }

    const model = MODEL_ALIASES[requestedModel] || requestedModel;
    if (!ALLOWED_MODELS.has(model)) {
        return res.status(400).json({ error: 'Unsupported model' });
    }

    const sanitizedPayload = sanitizeGeminiPayload(payload, model);
    if (!sanitizedPayload) {
        return res.status(400).json({ error: 'Invalid request payload' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not configured');
        return res.status(500).json({ error: 'API key not configured' });
    }

    const canCache = !TTS_MODELS.has(model);
    const cacheKey = canCache ? getRequestCacheKey(model, sanitizedPayload) : null;

    if (cacheKey) {
        const cached = readTextCache(cacheKey);
        if (cached) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Gemini-Cache', 'HIT');
            return res.status(200).json(cached);
        }
    }

    const clientIp = getClientIp(req);
    if (TTS_MODELS.has(model)) {
        const ipLimit = checkRateLimit(`tts:ip:${clientIp}`, TTS_REQUESTS_PER_MINUTE);
        if (!ipLimit.allowed) return tooManyRequests(res, ipLimit.retryAfter);

        const globalLimit = checkRateLimit('tts:global', TTS_REQUESTS_PER_MINUTE);
        if (!globalLimit.allowed) return tooManyRequests(res, globalLimit.retryAfter);
    } else {
        const ipLimit = checkRateLimit(`text:ip:${clientIp}`, TEXT_REQUESTS_PER_MINUTE);
        if (!ipLimit.allowed) return tooManyRequests(res, ipLimit.retryAfter);
    }

    try {
        let actualModel = model;
        let fallbackUsed = false;
        let result = await requestGemini(model, sanitizedPayload, apiKey);

        // 429(무료 한도)일 때만 Lite TTS로 한 번 폴백합니다. 유료 모델은 사용하지 않습니다.
        if (!result.ok && result.status === 429 && TTS_FALLBACKS.has(model)) {
            const fallbackModel = TTS_FALLBACKS.get(model);
            console.warn(`TTS quota hit for ${model}; falling back to ${fallbackModel}`);
            actualModel = fallbackModel;
            fallbackUsed = true;
            result = await requestGemini(fallbackModel, sanitizedPayload, apiKey);
        }

        if (!result.ok) {
            if (result.status === 429) {
                return tooManyRequests(res, TTS_MODELS.has(model) ? 20 : 10);
            }

            // 업스트림 오류 내용은 클라이언트에 노출하지 않습니다.
            return res.status(502).json({ error: 'Gemini API request failed' });
        }

        if (cacheKey) writeTextCache(cacheKey, result.data);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Gemini-Cache', cacheKey ? 'MISS' : 'BYPASS');
        res.setHeader('X-Gemini-Model', actualModel);
        if (fallbackUsed) res.setHeader('X-Gemini-Fallback', '1');
        res.status(200).json(result.data);
    } catch (error) {
        console.error('Gemini API Server Error:', error);
        const status = error.name === 'TimeoutError' ? 504 : 500;
        res.status(status).json({ error: 'Internal server error' });
    }
}

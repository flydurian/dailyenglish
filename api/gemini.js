// Vercel Serverless Function for Gemini API
// 무료 티어 전용: 허용 모델은 무료 티어 모델뿐이며, 유료 모델로 폴백하지 않습니다.
import { createHash } from 'node:crypto';
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
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { payload, model: requestedModel } = req.body || {};

    if (!payload || typeof payload !== 'object' || !requestedModel) {
        return res.status(400).json({ error: 'Missing payload or model' });
    }

    const model = MODEL_ALIASES[requestedModel] || requestedModel;
    if (!ALLOWED_MODELS.has(model)) {
        return res.status(400).json({ error: 'Unsupported model' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not configured');
        return res.status(500).json({ error: 'API key not configured' });
    }

    const canCache = !TTS_MODELS.has(model);
    const cacheKey = canCache ? getRequestCacheKey(model, payload) : null;

    if (cacheKey) {
        const cached = readTextCache(cacheKey);
        if (cached) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Gemini-Cache', 'HIT');
            return res.status(200).json(cached);
        }
    }

    try {
        let actualModel = model;
        let fallbackUsed = false;
        let result = await requestGemini(model, payload, apiKey);

        // 429(무료 한도)일 때만 Lite TTS로 한 번 폴백합니다. 유료 모델은 사용하지 않습니다.
        if (!result.ok && result.status === 429 && TTS_FALLBACKS.has(model)) {
            const fallbackModel = TTS_FALLBACKS.get(model);
            console.warn(`TTS quota hit for ${model}; falling back to ${fallbackModel}`);
            actualModel = fallbackModel;
            fallbackUsed = true;
            result = await requestGemini(
                fallbackModel,
                { ...payload, model: fallbackModel },
                apiKey
            );
        }

        if (!result.ok) {
            if (result.status === 429) {
                res.setHeader('Retry-After', TTS_MODELS.has(model) ? '20' : '10');
                return res.status(429).json({
                    error: 'Too Many Requests',
                    details: 'API Quota Exceeded. Please try again later.',
                    fallback: fallbackUsed ? 'exhausted' : 'not-used'
                });
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

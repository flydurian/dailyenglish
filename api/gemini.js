// Vercel Serverless Function for Gemini API
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

// 이 엔드포인트로 호출할 수 있는 모델 목록 (임의 모델/URL 주입 방지)
const ALLOWED_MODELS = new Set([
    DEFAULT_TEXT_MODEL,
    'gemini-3.1-flash-lite', // 이전 버전 호환
    'gemini-2.5-flash-preview-tts',
]);

const GEMINI_TIMEOUT_MS = 60_000;

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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini API Error (${response.status}):`, errorText);

            if (response.status === 429) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    details: 'API Quota Exceeded. Please try again later.'
                });
            }

            // 업스트림 오류 내용은 클라이언트에 노출하지 않습니다.
            return res.status(502).json({ error: 'Gemini API request failed' });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Gemini API Server Error:', error);
        const status = error.name === 'TimeoutError' ? 504 : 500;
        res.status(status).json({ error: 'Internal server error' });
    }
}

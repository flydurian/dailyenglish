// Vercel Serverless Function for Gemini API
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

    try {
        let { payload, model } = req.body;

        // 모델 버전 매핑 및 폴백 처리
        // gemini-1.5-flash가 없는 경우 gemini-2.0-flash 사용
        if (model === 'gemini-flash-latest' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-001' || model === 'gemini-1.5-flash-002' || model === 'gemini-pro') {
            model = 'gemini-2.0-flash';
        }

        if (!payload || !model) {
            return res.status(400).json({ error: 'Missing payload or model' });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error Detail:', errorText);

            if (response.status === 429) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    details: 'API Quota Exceeded. Please try again later.'
                });
            }

            throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('Gemini API Server Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

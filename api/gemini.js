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

        // gemini-flash-latest가 2.5로 연결되어 429 에러 빈발, 1.5로 고정
        if (model === 'gemini-flash-latest' || model === 'gemini-1.5-flash') {
            model = 'gemini-1.5-flash-002';
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

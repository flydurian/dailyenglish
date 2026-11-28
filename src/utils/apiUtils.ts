// API 호출 유틸리티 함수들
const GEMINI_ENDPOINT = '/api/gemini';

// 서버/클라이언트에서 attachment하는 커스텀 Error 속성 타입
export interface ApiError extends Error {
    status?: number;
    code?: string;
    retryAfterSec?: number | null;
}

// 모든 환경에서 서버리스 함수(/api/gemini)를 통해 Gemini를 호출합니다.
// model 인자는 용도(tier:generate = 예문·설명, tier:fast = 번역·요약)이며, 실제 모델은 서버 체인이 고릅니다.
// API 키는 서버의 GEMINI_API_KEY 에만 있으며 클라이언트 번들에 포함되지 않습니다.
export const callGeminiAPI = async (payload: unknown, model: string, maxRetries = 3) => {
    if (!payload || !model) {
        throw new Error('Gemini API requires payload and model');
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[gemini] 호출 시도 ${attempt + 1}/${maxRetries} (${model})`);

            const response = await fetch(GEMINI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload, model })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('USAGE_LIMIT_EXCEEDED');
                }

                const errorText = await response.text();
                console.error(`[gemini] 오류 응답 ${response.status}:`, errorText);

                const error = new Error(`Gemini API error: ${response.status}`) as ApiError;
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (e) {
            const err = e as ApiError;
            if (err.message === 'USAGE_LIMIT_EXCEEDED') {
                throw new Error("이용자가 많아 잠시 후 다시 시도해주세요. (API 할당량 초과)");
            }

            console.error(`[gemini] 호출 실패 (시도 ${attempt + 1}/${maxRetries}):`, err.message);

            // 4xx(잘못된 요청/모델)는 재시도해도 결과가 같으므로 즉시 중단합니다.
            // 503은 서버가 이미 모델 체인 전체(주 모델 + 예비 모델)를 시도한 결과라 재시도하지 않습니다.
            const status = err.status ?? 0;
            const isFinal = (status >= 400 && status < 500) || err.status === 503;
            if (attempt >= maxRetries - 1 || isFinal) {
                throw e;
            }

            // 지수 백오프
            const delay = Math.pow(2, attempt + 1) * 1000;
            console.log(`[gemini] ${delay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// AI 강의 등 긴 텍스트 응답을 SSE 스트림으로 실시간 수신합니다.
// 서버 캐시 HIT 시에는 application/json 응답이 내려오며 자동으로 처리됩니다.
export const callGeminiStreamAPI = async (
    payload: unknown,
    model: string,
    onChunk?: (accumulatedText: string) => void,
): Promise<string> => {
    if (!payload || !model) {
        throw new Error('Gemini API requires payload and model');
    }

    const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, model, stream: true }),
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('이용자가 많아 잠시 후 다시 시도해주세요. (API 할당량 초과)');
        }
        const errorText = await response.text().catch(() => '');
        console.error(`[gemini-stream] 오류 응답 ${response.status}:`, errorText);
        const error = new Error(`Gemini API error: ${response.status}`) as ApiError;
        error.status = response.status;
        throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    // 서버 메모리/Redis 캐시 히트 시 JSON으로 즉시 응답됩니다.
    if (!contentType.includes('text/event-stream') || !response.body) {
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (!text) throw new Error('응답 텍스트를 받지 못했습니다.');
        onChunk?.(text);
        return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let streamError: string | null = null;

    const processEvents = (eventsText: string) => {
        const blocks = eventsText.split('\n\n');
        const rest = blocks.pop() ?? '';
        for (const block of blocks) {
            const data = block
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).replace(/^ /, ''))
                .join('\n')
                .trim();
            if (!data || data === '[DONE]') continue;
            try {
                const parsed = JSON.parse(data) as { text?: string; error?: string };
                if (parsed.error) {
                    streamError = parsed.error;
                    continue;
                }
                if (typeof parsed.text === 'string' && parsed.text) {
                    accumulated += parsed.text;
                    onChunk?.(accumulated);
                }
            } catch {
                // 손상된 조각 무시
            }
        }
        return rest;
    };

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            buffer = processEvents(buffer);
        }
        buffer += decoder.decode().replace(/\r\n/g, '\n');
        processEvents(`${buffer}\n\n`);
    } finally {
        reader.releaseLock();
    }

    if (streamError && !accumulated.trim()) {
        throw new Error(streamError);
    }

    const trimmed = accumulated.trim();
    if (!trimmed) {
        throw new Error('설명 결과를 받지 못했습니다.');
    }
    return trimmed;
};

// 서버가 기본으로 내려주는 Opus/WebM을 재생할 수 있는지 확인합니다.
// WebM/Opus는 Chrome·Firefox는 물론 iOS Safari 17.4+에서도 재생됩니다.
// 미지원 브라우저(iOS 17.3 이하 등)는 서버에 format:'wav'를 요청합니다.
export const supportsOpusWebm = (() => {
    if (typeof Audio === 'undefined') return false;
    try {
        return !!document.createElement('audio').canPlayType('audio/webm; codecs="opus"');
    } catch {
        return false;
    }
})();

// TTS는 서버(api/gemini.js)가 오디오를 JSON이 아닌 바이너리(Content-Type: audio/*)로
// 내려주므로 텍스트 생성과 다른 방식으로 받습니다.
export const requestTtsAudio = async (sentence: string, model: string, format = 'webm', accent?: string) => {
    const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payload: {
                contents: [{ parts: [{ text: sentence }] }],
                generationConfig: { responseModalities: ['AUDIO'] }
            },
            model,
            format,
            ...(accent ? { accent } : {})
        })
    });

    if (!response.ok) {
        if (response.status === 429) {
            const error = new Error('이용자가 많아 잠시 후 다시 시도해주세요. (API 할당량 초과)') as ApiError;
            error.code = 'RATE_LIMIT';
            error.retryAfterSec = Number(response.headers.get('Retry-After')) || null;
            throw error;
        }

        const errorText = await response.text().catch(() => '');
        console.error('[tts] 오류 응답:', response.status, errorText);
        const error = new Error(`TTS 요청 실패: ${response.status}`) as ApiError;
        error.status = response.status;
        throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('audio/')) {
        throw new Error('유효한 오디오 데이터를 받지 못했습니다.');
    }

    return response.blob();
};

export const levelDescriptions = {
    A1: "Beginner",
    A2: "Elementary",
    B1: "Intermediate",
    B2: "Upper-Intermediate",
    C1: "Advanced",
    C2: "Proficient"
};

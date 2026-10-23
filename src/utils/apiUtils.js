// API 호출 유틸리티 함수들
const GEMINI_ENDPOINT = '/api/gemini';

// 모든 환경에서 서버리스 함수(/api/gemini)를 통해 Gemini를 호출합니다.
// API 키는 서버의 GEMINI_API_KEY 에만 있으며 클라이언트 번들에 포함되지 않습니다.
export const callGeminiAPI = async (payload, model, maxRetries = 3) => {
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

                const error = new Error(`Gemini API error: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (e) {
            if (e.message === 'USAGE_LIMIT_EXCEEDED') {
                throw new Error("이용자가 많아 잠시 후 다시 시도해주세요. (API 할당량 초과)");
            }

            console.error(`[gemini] 호출 실패 (시도 ${attempt + 1}/${maxRetries}):`, e.message);

            // 4xx(잘못된 요청/모델)는 재시도해도 결과가 같으므로 즉시 중단합니다.
            const isClientError = e.status >= 400 && e.status < 500;
            if (attempt >= maxRetries - 1 || isClientError) {
                throw e;
            }

            // 지수 백오프
            const delay = Math.pow(2, attempt + 1) * 1000;
            console.log(`[gemini] ${delay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

export const levelDescriptions = {
    A1: "Beginner",
    A2: "Elementary",
    B1: "Intermediate",
    B2: "Upper-Intermediate",
    C1: "Advanced",
    C2: "Proficient"
};

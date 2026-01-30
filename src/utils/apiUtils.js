// API 호출 유틸리티 함수들
export const callGeminiAPI = async (payload, model, maxRetries = 3) => {
    // 개발 환경에서는 직접 API 호출, 프로덕션에서는 서버 사이드 엔드포인트 사용
    const isDevelopment = process.env.NODE_ENV === 'development';
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    // 디버깅: 환경 변수 상태 확인 (API 키는 노출하지 않음)
    console.log('Environment:', process.env.NODE_ENV);
    console.log('API Key:', apiKey ? 'Found' : 'Not found');

    if (isDevelopment && !apiKey) {
        throw new Error('REACT_APP_GEMINI_API_KEY is not defined in development environment');
    }

    // gemini-flash-latest가 2.5로 연결되어 할당량 문제가 발생하므로 1.5로 고정 시도
    const targetModel = model === 'gemini-flash-latest' ? 'gemini-1.5-flash' : model;

    const apiUrl = isDevelopment
        ? `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`
        : '/api/gemini';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // API 키가 포함된 URL은 로그에 출력하지 않음
            const safeApiUrl = isDevelopment
                ? apiUrl.replace(/key=[^&]+/, 'key=***')
                : apiUrl;
            console.log(`API 호출 시도 ${attempt + 1}/${maxRetries}:`, { apiUrl: safeApiUrl, payload });

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: isDevelopment
                    ? JSON.stringify(payload)
                    : JSON.stringify({ payload, model })
            });

            console.log('API 응답 상태:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();

                if (response.status === 429) {
                    throw new Error('USAGE_LIMIT_EXCEEDED');
                }

                console.error('API 오류 응답:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            console.log('API 성공 응답:', result);
            return result;
        } catch (e) {
            console.error(`API 호출 실패 (시도 ${attempt + 1}):`, e);
            if (e.message === 'USAGE_LIMIT_EXCEEDED') {
                throw new Error("이용자가 많아 잠시 후 다시 시도해주세요. (API 할당량 초과)");
            }

            if (attempt >= maxRetries - 1) {
                console.error("최종 API 호출 실패:", e);
                throw e;
            }
            // 지수 백오프
            const delay = Math.pow(2, attempt + 1) * 1000;
            console.log(`${delay}ms 후 재시도...`);
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

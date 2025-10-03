// API 호출 유틸리티 함수들
export const callGeminiAPI = async (payload, model, maxRetries = 3) => {
    // 개발 환경에서는 직접 API 호출, 프로덕션에서는 서버 사이드 엔드포인트 사용
    const isDevelopment = process.env.NODE_ENV === 'development';
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    // 디버깅: 환경 변수 상태 확인
    console.log('Environment:', process.env.NODE_ENV);
    console.log('API Key:', apiKey ? 'Found' : 'Not found');
    
    if (isDevelopment && !apiKey) {
        throw new Error('REACT_APP_GEMINI_API_KEY is not defined in development environment');
    }
    
    const apiUrl = isDevelopment 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        : '/api/gemini';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`API 호출 시도 ${attempt + 1}/${maxRetries}:`, { apiUrl, payload });
            
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
                console.error('API 오류 응답:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('API 성공 응답:', result);
            return result;
        } catch (e) {
            console.error(`API 호출 실패 (시도 ${attempt + 1}):`, e);
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

// API 호출 유틸리티 함수들
export const callGeminiAPI = async (payload, model, maxRetries = 3) => {
    const apiUrl = '/api/gemini'; // 서버 사이드 엔드포인트 사용
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload, model })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (e) {
            if (attempt >= maxRetries - 1) {
                console.error("API call failed:", e);
                throw e;
            }
            // 지수 백오프
            const delay = Math.pow(2, attempt + 1) * 1000;
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

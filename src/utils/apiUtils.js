// API 호출 유틸리티 함수들
export const callGeminiAPI = async (payload, model, maxRetries = 3) => {
    const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

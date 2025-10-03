import { useState, useCallback } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';

export const useTranslation = () => {
    const [translations, setTranslations] = useState({});


    const translateText = useCallback(async (text) => {
        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // 이미 번역된 텍스트가 있으면 캐시에서 반환
        if (translations[cleanText] && translations[cleanText].translation) {
            console.log('캐시된 번역 사용:', translations[cleanText].translation);
            return translations[cleanText].translation;
        }
        
        // 간단하고 빠른 번역을 위한 최적화된 프롬프트
        const prompt = `Translate this English text to Korean: "${cleanText}"`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "text/plain",
                maxOutputTokens: 500, // 적절한 토큰 수
                temperature: 0.1 // 매우 낮은 temperature로 일관된 결과
            }
        };

        try {
            console.log('번역 요청:', cleanText);
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            
            // 응답 구조 확인
            if (!result?.candidates || result.candidates.length === 0) {
                throw new Error("API 응답에 candidates가 없습니다.");
            }
            
            const firstCandidate = result.candidates[0];
            
            // finishReason 확인
            if (firstCandidate.finishReason && firstCandidate.finishReason !== "STOP") {
                console.error('finishReason 오류:', firstCandidate.finishReason);
                throw new Error(`API 응답 오류: ${firstCandidate.finishReason}`);
            }
            
            // 번역 텍스트 추출
            let translation = null;
            
            if (firstCandidate.content?.parts?.[0]?.text) {
                translation = firstCandidate.content.parts[0].text.trim();
            }
            
            if (!translation) {
                console.error('번역 텍스트를 찾을 수 없음:', result);
                throw new Error("번역 결과를 받지 못했습니다.");
            }
            
            // 번역 결과 정리
            const cleanTranslation = translation
                .replace(/^["""]/, '') // 시작 따옴표 제거
                .replace(/["""]$/, '') // 끝 따옴표 제거
                .trim();
            
            console.log('번역 성공:', cleanTranslation);
            
            // 캐시에 저장
            setTranslations(prev => ({ 
                ...prev, 
                [cleanText]: {
                    translation: cleanTranslation,
                    timestamp: Date.now()
                }
            }));
            
            return cleanTranslation;
            
        } catch (e) {
            console.error("번역 실패:", e);
            console.error("번역 실패한 텍스트:", cleanText);
            
            // API 키가 없는 경우 안내 메시지
            if (e.message && e.message.includes('API_KEY')) {
                return "API 키가 설정되지 않았습니다. .env 파일에 REACT_APP_GEMINI_API_KEY를 설정해주세요.";
            }
            
            return "번역을 불러오는 데 실패했습니다.";
        }
    }, [translations]);

    const summarizeText = useCallback(async (text) => {
        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // 이미 요약된 텍스트가 있으면 캐시에서 반환
        const summaryKey = `summary_${cleanText}`;
        if (translations[summaryKey] && translations[summaryKey].summary) {
            return translations[summaryKey].summary;
        }
        
        // 600자 이하면 요약하지 않음
        if (cleanText.length <= 600) {
            return cleanText;
        }
        
        const prompt = `Summarize this English news article to be 600 characters or less while maintaining the key information and readability. Focus on the main points and important details. Return ONLY the summarized text, nothing else:

"${cleanText}"`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "text/plain",
                maxOutputTokens: 800,
                temperature: 0.1
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            
            if (!result?.candidates || result.candidates.length === 0) {
                throw new Error("API 응답에 candidates가 없습니다.");
            }
            
            const firstCandidate = result.candidates[0];
            
            if (firstCandidate.finishReason && firstCandidate.finishReason !== "STOP") {
                throw new Error(`API 응답 오류: ${firstCandidate.finishReason}`);
            }
            
            const summary = firstCandidate.content?.parts?.[0]?.text?.trim();
            
            if (!summary) {
                throw new Error("요약 결과를 받지 못했습니다.");
            }
            
            const cleanSummary = summary
                .replace(/^["""]/, '')
                .replace(/["""]$/, '')
                .trim();
            
            // 캐시에 저장
            setTranslations(prev => ({ 
                ...prev, 
                [summaryKey]: {
                    summary: cleanSummary,
                    timestamp: Date.now()
                }
            }));
            
            return cleanSummary;
        } catch (e) {
            console.error("요약 실패:", e);
            return cleanText.substring(0, 600) + "...";
        }
    }, [translations]);

    const generateExamples = useCallback(async (word, meaning) => {
        const examplesKey = `examples_${word}`;
        
        // 이미 생성된 예문이 있으면 캐시에서 반환
        if (translations[examplesKey] && translations[examplesKey].examples) {
            return translations[examplesKey].examples;
        }
        
        const prompt = `Create exactly 2 short, simple example sentences using the word "${word}" (meaning: ${meaning}). Each sentence should be:
- Maximum 10 words
- Easy to understand
- Show different uses of the word
- Natural and commonly used

Return ONLY the 2 sentences, each on a separate line, nothing else:`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "text/plain",
                maxOutputTokens: 200,
                temperature: 0.1
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            
            if (!result?.candidates || result.candidates.length === 0) {
                throw new Error("API 응답에 candidates가 없습니다.");
            }
            
            const firstCandidate = result.candidates[0];
            
            if (firstCandidate.finishReason && firstCandidate.finishReason !== "STOP") {
                throw new Error(`API 응답 오류: ${firstCandidate.finishReason}`);
            }
            
            const response = firstCandidate.content?.parts?.[0]?.text?.trim();
            
            if (!response) {
                throw new Error("예문 생성 결과를 받지 못했습니다.");
            }
            
            const examples = response.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .slice(0, 2); // 정확히 2개만 가져오기
            
            // 캐시에 저장
            setTranslations(prev => ({ 
                ...prev, 
                [examplesKey]: {
                    examples: examples,
                    timestamp: Date.now()
                }
            }));
            
            return examples;
        } catch (e) {
            console.error("예문 생성 실패:", e);
            return [`I need to ${word.toLowerCase()} this problem.`, `Let's ${word.toLowerCase()} it together.`];
        }
    }, [translations]);

    return { translations, translateText, summarizeText, generateExamples };
};

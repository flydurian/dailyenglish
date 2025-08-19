import { useState, useCallback } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';

export const useTranslation = () => {
    const [translations, setTranslations] = useState({});

    // 1주일 전 번역/요약 데이터 삭제
    const clearOldTranslations = useCallback(() => {
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        setTranslations(prev => {
            const newTranslations = {};
            Object.keys(prev).forEach(key => {
                const translationData = prev[key];
                // 타임스탬프가 있는 경우에만 체크
                if (translationData && translationData.timestamp) {
                    const translationDate = new Date(translationData.timestamp);
                    if (translationDate >= oneWeekAgo) {
                        newTranslations[key] = translationData;
                    }
                } else {
                    // 타임스탬프가 없는 기존 데이터는 보존 (하위 호환성)
                    newTranslations[key] = translationData;
                }
            });
            return newTranslations;
        });
    }, []);

    const translateText = useCallback(async (text) => {
        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // 이미 번역된 텍스트가 있으면 캐시에서 반환
        if (translations[cleanText] && translations[cleanText].translation) {
            return translations[cleanText].translation;
        }
        
        const prompt = `Translate this English text to Korean. Provide a natural and accurate Korean translation that maintains the original meaning and tone. Return ONLY the Korean translation, nothing else:

"${cleanText}"`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "text/plain"
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const translation = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (translation) {
                // 번역 결과에서 한국어만 추출
                const cleanTranslation = translation
                    .trim()
                    .replace(/^["""]/, '') // 시작 따옴표 제거
                    .replace(/["""]$/, '') // 끝 따옴표 제거
                    .trim();
                
                // 타임스탬프와 함께 캐시에 저장
                setTranslations(prev => ({ 
                    ...prev, 
                    [cleanText]: {
                        translation: cleanTranslation,
                        timestamp: Date.now()
                    }
                }));
                return cleanTranslation;
            } else {
                throw new Error("번역 결과를 받지 못했습니다.");
            }
        } catch (e) {
            console.error("번역 실패:", e);
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
                responseMimeType: "text/plain"
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const summary = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (summary) {
                // 요약 결과에서 텍스트만 추출
                const cleanSummary = summary
                    .trim()
                    .replace(/^["""]/, '') // 시작 따옴표 제거
                    .replace(/["""]$/, '') // 끝 따옴표 제거
                    .trim();
                
                // 타임스탬프와 함께 캐시에 저장
                setTranslations(prev => ({ 
                    ...prev, 
                    [summaryKey]: {
                        summary: cleanSummary,
                        timestamp: Date.now()
                    }
                }));
                return cleanSummary;
            } else {
                throw new Error("요약 결과를 받지 못했습니다.");
            }
        } catch (e) {
            console.error("요약 실패:", e);
            return cleanText.substring(0, 600) + "...";
        }
    }, [translations]);

    return { translations, translateText, summarizeText, clearOldTranslations };
};

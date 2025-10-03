import { useState, useCallback, useEffect } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';

export const useTranslation = () => {
    const [translations, setTranslations] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // 로컬 스토리지에서 번역 캐시 로드
    useEffect(() => {
        try {
            const cachedTranslations = localStorage.getItem('translation_cache');
            if (cachedTranslations) {
                const parsed = JSON.parse(cachedTranslations);
                // 7일 이상 된 캐시는 제거
                const now = Date.now();
                const filtered = {};
                Object.keys(parsed).forEach(key => {
                    if (parsed[key].timestamp && (now - parsed[key].timestamp) < 7 * 24 * 60 * 60 * 1000) {
                        filtered[key] = parsed[key];
                    }
                });
                setTranslations(filtered);
            }
        } catch (error) {
            console.error('번역 캐시 로드 실패:', error);
        }
    }, []);

    // 번역 캐시를 로컬 스토리지에 저장
    const saveToCache = useCallback((key, data) => {
        try {
            const updated = { ...translations, [key]: data };
            setTranslations(updated);
            localStorage.setItem('translation_cache', JSON.stringify(updated));
        } catch (error) {
            console.error('번역 캐시 저장 실패:', error);
        }
    }, [translations]);

    const translateText = useCallback(async (text) => {
        if (!text || text.trim().length === 0) {
            return '';
        }

        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        
        // 이미 번역된 텍스트가 있으면 캐시에서 반환
        if (translations[cleanText] && translations[cleanText].translation) {
            return translations[cleanText].translation;
        }

        // 로딩 상태 설정
        setIsLoading(true);
        setError(null);

        try {
            console.log('번역 요청:', cleanText);
            
            // 긴 텍스트의 경우 청크로 나누어 번역
            if (cleanText.length > 2000) {
                return await translateLongText(cleanText);
            }
            
            const prompt = `Translate this English text to Korean. Return only the Korean translation, nothing else: "${cleanText}"`;
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "text/plain",
                    maxOutputTokens: 4000,
                    temperature: 0.1
                }
            };

            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            
            if (!result?.candidates || result.candidates.length === 0) {
                throw new Error("API 응답에 candidates가 없습니다.");
            }
            
            const firstCandidate = result.candidates[0];
            
            if (firstCandidate.finishReason && firstCandidate.finishReason !== "STOP") {
                if (firstCandidate.finishReason === "MAX_TOKENS") {
                    // MAX_TOKENS 오류 시 청크 번역으로 재시도
                    return await translateLongText(cleanText);
                }
                throw new Error(`API 응답 오류: ${firstCandidate.finishReason}`);
            }
            
            const translation = firstCandidate.content?.parts?.[0]?.text?.trim();
            
            if (!translation) {
                throw new Error("번역 결과를 받지 못했습니다.");
            }
            
            // 번역 결과 정리
            const cleanTranslation = translation
                .replace(/^["""]/, '')
                .replace(/["""]$/, '')
                .replace(/^번역:/, '')
                .replace(/^Translation:/, '')
                .trim();
            
            console.log('번역 성공:', cleanTranslation);
            
            // 캐시에 저장
            const cacheData = {
                translation: cleanTranslation,
                timestamp: Date.now()
            };
            saveToCache(cleanText, cacheData);
            
            return cleanTranslation;
            
        } catch (e) {
            console.error("번역 실패:", e);
            setError(e.message);
            
            // API 키가 없는 경우 안내 메시지
            if (e.message && e.message.includes('API_KEY')) {
                return "API 키가 설정되지 않았습니다.";
            }
            
            return "번역을 불러오는 데 실패했습니다.";
        } finally {
            setIsLoading(false);
        }
    }, [translations, saveToCache]);

    // 긴 텍스트를 청크로 나누어 번역하는 함수
    const translateLongText = useCallback(async (text) => {
        try {
            // 텍스트를 문장 단위로 나누기
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const chunks = [];
            let currentChunk = '';
            
            // 청크 생성 (각 청크는 최대 1000자)
            for (const sentence of sentences) {
                if ((currentChunk + sentence).length > 1000 && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += (currentChunk ? '. ' : '') + sentence;
                }
            }
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            
            console.log(`긴 텍스트를 ${chunks.length}개 청크로 나누어 번역`);
            
            // 각 청크를 순차적으로 번역
            const translatedChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkKey = `chunk_${i}_${chunk.substring(0, 50)}`;
                
                // 청크별 캐시 확인
                if (translations[chunkKey] && translations[chunkKey].translation) {
                    translatedChunks.push(translations[chunkKey].translation);
                    continue;
                }
                
                const prompt = `Translate this English text to Korean. Return only the Korean translation, nothing else: "${chunk}"`;
                
                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "text/plain",
                        maxOutputTokens: 2000,
                        temperature: 0.1
                    }
                };
                
                const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
                
                if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const translation = result.candidates[0].content.parts[0].text.trim();
                    translatedChunks.push(translation);
                    
                    // 청크별 캐시 저장
                    const cacheData = {
                        translation: translation,
                        timestamp: Date.now()
                    };
                    saveToCache(chunkKey, cacheData);
                } else {
                    translatedChunks.push(chunk); // 번역 실패 시 원문 사용
                }
                
                // API 호출 간격 조절
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            const finalTranslation = translatedChunks.join(' ');
            
            // 전체 번역 결과 캐시 저장
            const cacheData = {
                translation: finalTranslation,
                timestamp: Date.now()
            };
            saveToCache(text, cacheData);
            
            return finalTranslation;
            
        } catch (error) {
            console.error('청크 번역 실패:', error);
            return text; // 실패 시 원문 반환
        }
    }, [translations, saveToCache]);

    const summarizeText = useCallback(async (text) => {
        if (!text || text.trim().length === 0) {
            return '';
        }

        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        
        // 600자 이하면 요약하지 않음
        if (cleanText.length <= 600) {
            return cleanText;
        }
        
        const summaryKey = `summary_${cleanText}`;
        
        // 이미 요약된 텍스트가 있으면 캐시에서 반환
        if (translations[summaryKey] && translations[summaryKey].summary) {
            return translations[summaryKey].summary;
        }

        try {
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
            const cacheData = {
                summary: cleanSummary,
                timestamp: Date.now()
            };
            saveToCache(summaryKey, cacheData);
            
            return cleanSummary;
        } catch (e) {
            console.error("요약 실패:", e);
            return cleanText.substring(0, 600) + "...";
        }
    }, [translations, saveToCache]);

    const generateExamples = useCallback(async (word, meaning) => {
        if (!word || !meaning) {
            return [];
        }

        const examplesKey = `examples_${word}`;
        
        // 이미 생성된 예문이 있으면 캐시에서 반환
        if (translations[examplesKey] && translations[examplesKey].examples) {
            return translations[examplesKey].examples;
        }

        try {
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
                    maxOutputTokens: 1000,
                    temperature: 0.1
                }
            };

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
            const cacheData = {
                examples: examples,
                timestamp: Date.now()
            };
            saveToCache(examplesKey, cacheData);
            
            return examples;
        } catch (e) {
            console.error("예문 생성 실패:", e);
            return [`I need to ${word.toLowerCase()} this problem.`, `Let's ${word.toLowerCase()} it together.`];
        }
    }, [translations, saveToCache]);

    // 캐시 정리 함수
    const clearCache = useCallback(() => {
        setTranslations({});
        localStorage.removeItem('translation_cache');
    }, []);

    return { 
        translations, 
        translateText, 
        summarizeText, 
        generateExamples, 
        isLoading, 
        error, 
        clearCache 
    };
};
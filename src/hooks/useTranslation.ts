import { useState, useCallback, useEffect, useRef } from 'react';
import { callGeminiAPI, callGeminiStreamAPI } from '../utils/apiUtils';
import type { TranslationEntry, Translations } from '../types';

const CACHE_STORAGE_KEY = 'translation_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 150;

const pruneTranslations = (entries: Translations, limit = MAX_CACHE_ENTRIES): Translations => {
    const now = Date.now();
    const valid = Object.entries(entries).filter(
        ([, value]) => value && typeof value.timestamp === 'number' && (now - value.timestamp) < CACHE_TTL_MS
    );
    valid.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    const trimmed = valid.slice(0, limit);
    const result: Translations = {};
    for (const [k, v] of trimmed) {
        result[k] = v;
    }
    return result;
};

const persistTranslations = (entries: Translations) => {
    try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // 용량 초과 시 캐시 크기를 절반으로 줄여 한 번 더 저장 시도합니다.
        try {
            const half = pruneTranslations(entries, Math.max(20, Math.floor(MAX_CACHE_ENTRIES / 2)));
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(half));
        } catch (retryError) {
            console.warn('번역 캐시 저장 실패:', retryError);
        }
    }
};

export const useTranslation = () => {
    const [translations, setTranslations] = useState<Translations>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const translationsRef = useRef<Translations>(translations);
    const inFlightRef = useRef(new Map<string, Promise<unknown>>());

    translationsRef.current = translations;

    // 로컬 스토리지에서 번역 캐시 로드
    useEffect(() => {
        try {
            const cachedTranslations = localStorage.getItem(CACHE_STORAGE_KEY);
            if (cachedTranslations) {
                const parsed = JSON.parse(cachedTranslations) as Translations;
                const filtered = pruneTranslations(parsed);
                translationsRef.current = filtered;
                setTranslations(filtered);
            }
        } catch (err) {
            console.error('번역 캐시 로드 실패:', err);
        }
    }, []);

    // 번역 캐시를 로컬 스토리지에 저장 (최대 MAX_CACHE_ENTRIES 유지)
    const saveToCache = useCallback((key: string, data: TranslationEntry) => {
        setTranslations((prev) => {
            const updated = pruneTranslations({ ...prev, [key]: data });
            translationsRef.current = updated;
            persistTranslations(updated);
            return updated;
        });
    }, []);

    const runDeduped = useCallback(<T,>(key: string, task: () => Promise<T>): Promise<T> => {
        const existing = inFlightRef.current.get(key);
        if (existing) return existing as Promise<T>;
        const promise = task().finally(() => {
            inFlightRef.current.delete(key);
        });
        inFlightRef.current.set(key, promise);
        return promise;
    }, []);

    // 긴 텍스트를 청크로 나누어 번역하는 함수
    const translateLongText = useCallback(async (text: string) => {
        try {
            const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
            const chunks: string[] = [];
            let currentChunk = '';

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

            const translatedChunks: string[] = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkKey = `chunk_${i}_${chunk.substring(0, 50)}`;

                const cachedChunk = translationsRef.current[chunkKey]?.translation;
                if (cachedChunk) {
                    translatedChunks.push(cachedChunk);
                    continue;
                }

                const prompt = `Translate this English text to Korean. Return only the Korean translation, nothing else: "${chunk}"`;

                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "text/plain",
                        maxOutputTokens: 1200,
                        temperature: 0.1
                    }
                };

                const result = await callGeminiAPI(payload, 'tier:fast');

                if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const translation = result.candidates[0].content.parts[0].text.trim();
                    translatedChunks.push(translation);
                    saveToCache(chunkKey, { translation, timestamp: Date.now() });
                } else {
                    translatedChunks.push(chunk);
                }

                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const finalTranslation = translatedChunks.join(' ');
            saveToCache(text, { translation: finalTranslation, timestamp: Date.now() });
            return finalTranslation;
        } catch (err) {
            console.error('청크 번역 실패:', err);
            return text;
        }
    }, [saveToCache]);

    const translateText = useCallback(async (text: string) => {
        if (!text || text.trim().length === 0) {
            return '';
        }

        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        const cached = translationsRef.current[cleanText]?.translation;
        if (cached) {
            return cached;
        }

        return runDeduped(`translate:${cleanText}`, async () => {
            setIsLoading(true);
            setError(null);

            try {
                if (cleanText.length > 2000) {
                    return await translateLongText(cleanText);
                }

                const prompt = `Translate this English text to Korean. Return only the Korean translation, nothing else: "${cleanText}"`;

                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "text/plain",
                        maxOutputTokens: 2000,
                        temperature: 0.1
                    }
                };

                const result = await callGeminiAPI(payload, 'tier:fast');

                if (!result?.candidates || result.candidates.length === 0) {
                    throw new Error("API 응답에 candidates가 없습니다.");
                }

                const firstCandidate = result.candidates[0];

                if (firstCandidate.finishReason && firstCandidate.finishReason !== "STOP") {
                    if (firstCandidate.finishReason === "MAX_TOKENS") {
                        return await translateLongText(cleanText);
                    }
                    throw new Error(`API 응답 오류: ${firstCandidate.finishReason}`);
                }

                const translation = firstCandidate.content?.parts?.[0]?.text?.trim();

                if (!translation) {
                    throw new Error("번역 결과를 받지 못했습니다.");
                }

                const cleanTranslation = translation
                    .replace(/^["""]/, '')
                    .replace(/["""]$/, '')
                    .replace(/^번역:/, '')
                    .replace(/^Translation:/, '')
                    .trim();

                saveToCache(cleanText, { translation: cleanTranslation, timestamp: Date.now() });
                return cleanTranslation;
            } catch (e) {
                console.error("번역 실패:", e);
                const err = e as Error;
                setError(err.message);

                if (err.message && err.message.includes('API_KEY')) {
                    return "API 키가 설정되지 않았습니다.";
                }

                return "번역을 불러오는 데 실패했습니다.";
            } finally {
                setIsLoading(false);
            }
        });
    }, [runDeduped, saveToCache, translateLongText]);

    const summarizeText = useCallback(async (text: string) => {
        if (!text || text.trim().length === 0) {
            return '';
        }

        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();

        if (cleanText.length <= 600) {
            return cleanText;
        }

        const summaryKey = `summary_${cleanText}`;
        const cached = translationsRef.current[summaryKey]?.summary;
        if (cached) {
            return cached;
        }

        return runDeduped(summaryKey, async () => {
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

                const result = await callGeminiAPI(payload, 'tier:fast');

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

                saveToCache(summaryKey, { summary: cleanSummary, timestamp: Date.now() });
                return cleanSummary;
            } catch (e) {
                console.error("요약 실패:", e);
                return cleanText.substring(0, 600) + "...";
            }
        });
    }, [runDeduped, saveToCache]);

    const generateExamples = useCallback(async (word: string, meaning: string) => {
        if (!word || !meaning) {
            return [];
        }

        const examplesKey = `examples_${word}`;
        const cached = translationsRef.current[examplesKey]?.examples;
        if (cached) {
            return cached;
        }

        return runDeduped(examplesKey, async () => {
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

                const result = await callGeminiAPI(payload, 'tier:generate');

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
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0)
                    .slice(0, 2);

                saveToCache(examplesKey, { examples, timestamp: Date.now() });
                return examples;
            } catch (e) {
                console.error("예문 생성 실패:", e);
                return [`I need to ${word.toLowerCase()} this problem.`, `Let's ${word.toLowerCase()} it together.`];
            }
        });
    }, [runDeduped, saveToCache]);

    const explainArticle = useCallback(async (
        text: string,
        level = 'B1',
        onProgress?: (partial: string) => void,
    ) => {
        if (!text || text.trim().length === 0) {
            return '';
        }

        const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        const explainKey = `explain_${level}_${cleanText}`;

        const cached = translationsRef.current[explainKey]?.explanation;
        if (cached) {
            onProgress?.(cached);
            return cached;
        }

        return runDeduped(explainKey, async () => {
            setIsLoading(true);
            setError(null);

            try {
                const prompt = `You are a friendly and enthusiastic English teacher at a top academy in Korea. Your student is learning English at a ${level} level.
            
TASK: Analyze the following news article text and provide a detailed study guide. Focus on explaining the English sentences themselves so the student can learn grammar and structure.

ARTICLE TEXT:
"${cleanText}"

OUTPUT FORMAT:
Provide the response in Korean, formatted using Markdown.

Structure your response like this:

1. **👋 선생님의 한마디 (Greeting & Brief Summary)**
   - Start with a warm, encouraging greeting.
   - Very briefly summarize what the article is about (1-2 sentences) to spark interest.

2. **🧐 문장별 집중 분석 (Sentence Analysis)**
   - Select 3-4 key sentences from the article that represent important grammar or useful expressions.
   - For each sentence:
     - **Original Sentence**: Display the full English sentence on a single line, exactly in this form: > **Original Sentence:** "<the sentence>"
     - **Structure & Grammar**: Explain the sentence structure (e.g., Subject + Verb + Object) and any important grammar points (e.g., relative clauses, participial phrases) in a simple, easy-to-understand way.
     - **Interpretation**: Explain how to translate it naturally, perhaps guiding them on how to read it in chunks (끊어 읽기).
     - **Key Vocabulary**: Point out 1-2 key words in this sentence and explain their nuance in this specific context.

3. **💡 오늘의 꿀팁 (Teacher's Tip)**
   - Start with "이것만은 꼭 기억하세요!".
   - One actionable tip related to the article's topic or a specific English expression used.

4. **🎉 마무리 (Closing)**
   - A short, encouraging closing message.

Tone: Friendly, encouraging, professional but accessible (like a favorite tutor).
Use Markdown for formatting (bolding, bullet points).
`;

                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "text/plain",
                        maxOutputTokens: 3000,
                        temperature: 0.2
                    }
                };

                const explanation = await callGeminiStreamAPI(payload, 'tier:generate', onProgress);

                saveToCache(explainKey, { explanation, timestamp: Date.now() });
                return explanation;
            } catch (e) {
                console.error("설명 생성 실패:", e);
                setError((e as Error).message);
                return "선생님이 설명을 준비하는 도중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
            } finally {
                setIsLoading(false);
            }
        });
    }, [runDeduped, saveToCache]);

    // 캐시 정리 함수
    const clearCache = useCallback(() => {
        translationsRef.current = {};
        setTranslations({});
        try { localStorage.removeItem(CACHE_STORAGE_KEY); } catch { /* ignore */ }
    }, []);

    return {
        translations,
        translateText,
        summarizeText,
        generateExamples,
        explainArticle,
        isLoading,
        error,
        clearCache
    };
};
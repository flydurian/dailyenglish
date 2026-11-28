import { useState, useCallback, useRef } from 'react';
import { callGeminiAPI, levelDescriptions } from '../utils/apiUtils';
import {
    getCachedData,
    setCachedData,
    isCacheValid,
    cleanupOldMonthlyData
} from '../utils/cacheUtils';
import { toLocalDateKey } from '../utils/dateUtils';
import { getDailyPhrasalVerbs, getDailyNewsPhrasalVerbs } from '../data/phrasalVerbsData';
import {
    containsHangul,
    needsEnglishRewrite,
    buildNewsRewritePrompt
} from '../utils/newsLanguage';

interface RawNewsItem {
    title: string;
    full_text?: string;
    description?: string;
    content?: string;
    source?: string;
    date?: string;
    category?: string;
    publishedAt?: string;
    url?: string;
    isFallback?: boolean;
}

interface SummarizedNewsResult {
    title: string;
    summary: string;
    key_points: string[];
    vocabulary_notes: string[];
    isFallback: boolean;
}

// RFC 2822("Mon, 27 Nov 2026 14:30:00 GMT") 및 ISO 8601 모두 로컬 YYYY-MM-DD로 안전하게 변환합니다.
export const parsePublishedDate = (raw?: string | null): string => {
    if (!raw || typeof raw !== 'string') return toLocalDateKey();
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? toLocalDateKey() : toLocalDateKey(parsed);
};

const buildFallbackSummary = (isKorean: boolean) => `${isKorean ? 'South Korea continues' : 'International communities continue'} to make significant progress in various fields. Recent developments show promising trends in technology, economy, and social innovation.

Key sectors are experiencing growth and transformation. Innovation and cooperation play crucial roles in addressing current challenges. Stakeholders are working together to create sustainable solutions for the future.

These developments have important implications for society and the global economy. The changes reflect broader trends that will shape our world in the coming years. Understanding these trends helps us prepare for future opportunities and challenges.

The ongoing progress demonstrates the interconnected nature of modern developments. Local achievements can have global impact, and international cooperation remains essential for continued success.`;

const FALLBACK_KEY_POINTS = [
    "come up with: 생각해내다",
    "look into: 조사하다",
    "put up with: 참다",
    "set up: 설립하다",
    "take over: 인수하다",
    "break through: 돌파하다"
];

const FALLBACK_VOCABULARY_NOTES = [
    "comprehensive: 포괄적인",
    "development: 발전",
    "significant: 중요한",
    "innovation: 혁신",
    "sustainable: 지속가능한",
    "implications: 함의, 영향"
];

// 한국 뉴스 제목을 영어로 번역합니다. 한글이 남으면 빈 문자열을 돌려줍니다.
const translateKoreanHeadlineToEnglish = async (headline: unknown, targetLevel: string) => {
    if (typeof headline !== 'string' || !containsHangul(headline)) return '';

    try {
        const translatePrompt = `Translate this Korean news headline to English appropriate for ${targetLevel} level English learners. Keep it concise and natural.

Korean headline: ${headline}

Return ONLY the English translation, nothing else. Make it suitable for ${targetLevel} level learners.`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: translatePrompt }] }],
            generationConfig: {
                responseMimeType: "text/plain",
                maxOutputTokens: 100,
                temperature: 0.3
            }
        };

        const result = await callGeminiAPI(payload, 'tier:fast');
        const translatedTitle = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translatedTitle || containsHangul(translatedTitle)) return '';

        return translatedTitle
            .split('\n')[0]
            .replace(/^["']|["']$/g, '')
            .trim();
    } catch (translateError) {
        console.warn('제목 번역 실패, 영어 폴백 사용:', translateError);
        return '';
    }
};

export const useDataFetching = () => {
    const [expressionsLoading, setExpressionsLoading] = useState(false);
    const [expressionsError, setExpressionsError] = useState<string | null>(null);
    const [newsLoading, setNewsLoading] = useState(false);
    const [newsError, setNewsError] = useState<string | null>(null);

    const inFlight = useRef(new Map<string, Promise<unknown>>());
    // 인자가 같은 중복 호출(StrictMode 이중 effect)은 같은 세대로 두고, 값이 바뀌면 세대를 올립니다.
    // 오래된 세대의 응답은 상태와 소비자에게 반영하지 않습니다.
    const lastRequest = useRef<{ expressions: string | null; news: string | null }>({ expressions: null, news: null });
    const generations = useRef({ expressions: 0, news: 0 });

    // 최소한의 폴백 뉴스 데이터 (서버 RSS API 실패 시에만 사용)
    const getFallbackNews = useCallback((type: string, dayOfYear: number) => {
        const sources = type === 'korean' ? [
            'KBS News', 'MBC News', 'SBS News', 'YTN News', 'Arirang News', 'Korea Herald'
        ] : [
            'BBC News', 'CNN', 'Reuters', 'Associated Press', 'Bloomberg', 'The Guardian'
        ];

        const selectedSource = sources[dayOfYear % sources.length];

        const fallbackNews = type === 'korean' ? {
            title: "South Korea's Latest Developments in Technology and Innovation",
            content: "South Korea continues to lead in technological innovation and economic development. Recent achievements in various sectors demonstrate the country's commitment to progress and international cooperation. The nation's focus on sustainable growth and digital transformation is setting new standards for global competitiveness.",
            source: selectedSource
        } : {
            title: "Global News: International Cooperation and Innovation",
            content: "International cooperation continues to drive global progress in various fields. Countries around the world are working together to address common challenges and create opportunities for sustainable development. These collaborative efforts are shaping a better future for all nations.",
            source: selectedSource
        };

        return {
            ...fallbackNews,
            url: `https://example.com/news/${type}/${dayOfYear}`
        };
    }, []);

    // 서버 RSS 프록시(/api/news)를 통해 실제 뉴스 기사 가져오기
    const fetchRealNews = useCallback(async (type: string): Promise<RawNewsItem> => {
        try {
            const response = await fetch(`/api/news?type=${encodeURIComponent(type)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const article = data?.article;
            if (!article || !article.title) {
                throw new Error('뉴스 기사를 찾을 수 없습니다.');
            }

            let fullText = article.description || article.content || '';
            if (fullText.length < 100) {
                fullText = `${article.title}\n\n${fullText}`;
            }

            return {
                title: article.title,
                full_text: fullText || article.title || '',
                category: type,
                source: article.source?.name || (type === 'korean' ? 'Google News Korea' : 'Google News'),
                date: parsePublishedDate(article.publishedAt),
                url: article.url || '',
                isFallback: false
            };
        } catch (error) {
            console.error('뉴스 가져오기 실패:', error);
            const fallbackData = getFallbackNews(type, new Date().getDate());
            return {
                title: fallbackData.title,
                full_text: fallbackData.content,
                category: type,
                source: fallbackData.source,
                date: toLocalDateKey(),
                url: fallbackData.url,
                isFallback: true
            };
        }
    }, [getFallbackNews]);

    // 레벨별 뉴스 요약 생성
    const summarizeNewsForLevel = useCallback(async (newsItem: RawNewsItem, targetLevel: string, dateObj: Date = new Date()): Promise<SummarizedNewsResult> => {
        if (!newsItem || !newsItem.title) {
            console.error('뉴스 데이터가 유효하지 않습니다:', newsItem);
            return {
                title: "News title unavailable",
                summary: "News summary unavailable.",
                key_points: [],
                vocabulary_notes: [],
                isFallback: true
            };
        }

        const isKorean = newsItem.category === 'korean';

        try {
            const dailyNewsVerbs = await getDailyNewsPhrasalVerbs(dateObj, 8);
            const verbsList = dailyNewsVerbs.map(v => `${v.verb} (${v.meaning})`).join(', ');

            const summaryPrompt = buildNewsRewritePrompt({
                title: newsItem.title,
                text: (newsItem.full_text || '').slice(0, 6000),
                level: targetLevel,
                verbsList,
                sourceLanguage: isKorean ? 'ko' : 'en',
                source: newsItem.source,
                date: newsItem.date
            });

            const requestSummary = async (prompt: string) => {
                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        maxOutputTokens: 2500,
                        temperature: 0.3
                    }
                };

                const result = await callGeminiAPI(payload, 'tier:fast');
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!text) {
                    throw new Error("뉴스 요약 생성에 실패했습니다.");
                }

                return JSON.parse(text);
            };

            let summaryData = await requestSummary(summaryPrompt);

            // 한글이 남아 있으면 "영어로만 다시 써라" 지시를 붙여 1회만 재시도합니다.
            if (isKorean && needsEnglishRewrite({
                title: summaryData?.title,
                summary: summaryData?.summary
            })) {
                const retryPrompt = `${summaryPrompt}

IMPORTANT: Your previous answer still contained Korean (Hangul) in "title" or "summary". Rewrite both in English only. Do not use a single Hangul character.`;

                try {
                    summaryData = await requestSummary(retryPrompt);
                } catch (retryError) {
                    console.warn('한국 뉴스 영어 재작성 재시도 실패:', retryError);
                }
            }

            const summarized: SummarizedNewsResult = {
                title: isKorean
                    ? (typeof summaryData?.title === 'string' ? summaryData.title.trim() : '')
                    : newsItem.title,
                summary: typeof summaryData?.summary === 'string' ? summaryData.summary : '',
                key_points: Array.isArray(summaryData?.key_points) ? summaryData.key_points : [],
                vocabulary_notes: Array.isArray(summaryData?.vocabulary_notes) ? summaryData.vocabulary_notes : [],
                isFallback: false
            };

            if (!summarized.summary.trim() || (isKorean && needsEnglishRewrite(summarized))) {
                const translatedTitle = isKorean
                    ? await translateKoreanHeadlineToEnglish(newsItem.title, targetLevel)
                    : newsItem.title;
                return {
                    title: translatedTitle || (isKorean ? 'Today in Korea' : newsItem.title),
                    summary: buildFallbackSummary(isKorean),
                    key_points: summarized.key_points.length > 0 ? summarized.key_points : FALLBACK_KEY_POINTS,
                    vocabulary_notes: summarized.vocabulary_notes.length > 0 ? summarized.vocabulary_notes : FALLBACK_VOCABULARY_NOTES,
                    isFallback: true
                };
            }

            return summarized;
        } catch (error) {
            console.error('뉴스 요약 생성 실패:', error);

            if (!isKorean) {
                return {
                    title: newsItem.title,
                    summary: buildFallbackSummary(false),
                    key_points: FALLBACK_KEY_POINTS,
                    vocabulary_notes: FALLBACK_VOCABULARY_NOTES,
                    isFallback: true
                };
            }

            const translatedTitle = await translateKoreanHeadlineToEnglish(newsItem.title, targetLevel);
            return {
                title: translatedTitle || (containsHangul(newsItem.title) ? 'Today in Korea' : newsItem.title),
                summary: buildFallbackSummary(true),
                key_points: FALLBACK_KEY_POINTS,
                vocabulary_notes: FALLBACK_VOCABULARY_NOTES,
                isFallback: true
            };
        }
    }, []);

    const fetchExpressionsInternal = useCallback(async (date: Date | string, selectedLevel: string, generation: number) => {
        if (generation !== generations.current.expressions) return undefined;
        setExpressionsLoading(true);
        setExpressionsError(null);

        try {
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date provided to fetchExpressions:', date);
                throw new Error('유효하지 않은 날짜입니다.');
            }

            if (isCacheValid('expressions', dateObj)) {
                const cached = getCachedData('expressions', dateObj);
                if (cached && cached.data?.[selectedLevel]) {
                    if (generation !== generations.current.expressions) return undefined;
                    setExpressionsError(null);
                    setExpressionsLoading(false);
                    return cached.data[selectedLevel];
                }
            }

            const dailyVerbs = await getDailyPhrasalVerbs(dateObj);
            const verbsList = dailyVerbs.map(v => `${v.verb} (meaning: ${v.meaning})`).join(', ');

            const prompt = `You are an expert English teacher for a language learning app. The learner's level is CEFR ${selectedLevel} (${(levelDescriptions as Record<string, string>)[selectedLevel]}).

TASK: Generate practical usage examples and details for these specific 3 phrasal verbs: ${verbsList}.

REQUIREMENTS:
- Create a natural, conversational sentence for each phrasal verb appropriate for ${selectedLevel} level.
- The sentence must clearly demonstrate the meaning of the phrasal verb.
- Highlight the phrasal verb in the sentence using **double asterisks** (e.g., "I **woke up** early").
- Provide the Korean meaning (use the one provided or a better fitting one for the context).
- Provide a 'situation' description: specific contexts where this is used (in Korean).
- Provide a 'nuance' description: subtle feeling or tone (in Korean).
- Provide 3 additional short, natural example sentences using this phrasal verb (in English).
- Select 1-2 important words from the sentence for vocabulary study.

Return the response as a valid JSON array with the following structure:
[
  {
    "phrasal_verb": "the phrasal verb: Korean meaning",
    "sentence": "a practical, real-life example sentence",
    "meaning": "Korean meaning",
    "situation": "Describes 'WHEN' and 'WHERE' this is used. Focus on the external context or scenario (in Korean). E.g., '친구가 약속에 늦었을 때', '회의 자료가 부족할 때', '오해를 풀려고 할 때'",
    "nuance": "Describes the 'FEELING', 'TONE', or 'ATTITUDE' of the verb. Focus on the internal vibe (in Korean). E.g., '다소 공격적인 느낌', '정중하지만 단호한 태도', '어쩔 수 없이 받아들이는 뉘앙스'",
    "examples": [
      "Short example sentence 1 using the phrasal verb",
      "Short example sentence 2 using the phrasal verb",
      "Short example sentence 3 using the phrasal verb"
    ],
    "other_words": [
      {
        "word": "important word",
        "meaning": "Korean meaning",
        "example": "simple example sentence"
      }
    ]
  }
]

IMPORTANT:
- YOU MUST USE THESE EXACT 3 PHRASAL VERBS: ${dailyVerbs.map(v => v.verb).join(', ')}.
- Do not select different verbs.
- Ensure the sentences are suitable for ${selectedLevel} level learners.`;

            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 2500
                }
            };

            const result = await callGeminiAPI(payload, 'tier:generate');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                const expressionsData = JSON.parse(text);
                if (generation !== generations.current.expressions) return undefined;

                // 기존 레벨 캐시를 유지하면서 현재 레벨을 머지합니다.
                const cached = getCachedData('expressions', dateObj);
                const mergedData = { ...(cached?.data || {}), [selectedLevel]: expressionsData };
                setCachedData('expressions', dateObj, mergedData);

                setExpressionsError(null);
                setExpressionsLoading(false);
                return expressionsData;
            }
            throw new Error("API 응답에서 콘텐츠를 찾을 수 없습니다.");
        } catch (e) {
            if (generation !== generations.current.expressions) return undefined;
            console.error("표현을 가져오는 데 실패했습니다:", e);
            setExpressionsLoading(false);

            const fallbackExpressions = [
                {
                    phrasal_verb: "get up: 일어나다",
                    sentence: "I **get up** early every morning to exercise.",
                    meaning: "일어나다",
                    other_words: [
                        {
                            word: "early",
                            meaning: "일찍",
                            example: "She arrives early for work."
                        },
                        {
                            word: "exercise",
                            meaning: "운동하다",
                            example: "Exercise is good for your health."
                        }
                    ]
                },
                {
                    phrasal_verb: "look for: 찾다",
                    sentence: "I'm **looking for** my keys. Have you seen them?",
                    meaning: "찾다",
                    other_words: [
                        {
                            word: "keys",
                            meaning: "열쇠",
                            example: "I lost my house keys."
                        },
                        {
                            word: "seen",
                            meaning: "본 (see의 과거분사)",
                            example: "Have you seen this movie?"
                        }
                    ]
                },
                {
                    phrasal_verb: "turn on: 켜다",
                    sentence: "Please **turn on** the lights. It's getting dark.",
                    meaning: "켜다",
                    other_words: [
                        {
                            word: "lights",
                            meaning: "불빛, 조명",
                            example: "The lights are too bright."
                        },
                        {
                            word: "dark",
                            meaning: "어두운",
                            example: "It's dark outside."
                        }
                    ]
                }
            ];

            setExpressionsError(null);
            return fallbackExpressions;
        }
    }, []);

    const fetchNewsInternal = useCallback(async (date: Date | string, selectedLevel: string, generation: number) => {
        if (generation !== generations.current.news) return undefined;
        setNewsLoading(true);
        setNewsError(null);

        try {
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date provided to fetchNews:', date);
                throw new Error('유효하지 않은 날짜입니다.');
            }

            // 로컬 기준 오늘 날짜 캐시 확인
            // 예전 캐시에 한글이 남아 있거나 source/date가 누락된 한국 뉴스가 있으면 새로 가져옵니다.
            if (isCacheValid('news', dateObj)) {
                const cached = getCachedData('news', dateObj);
                const cachedNews = cached?.data?.[selectedLevel];
                const cachedNeedsRefresh = Array.isArray(cachedNews) && cachedNews.some(
                    (item) => (item?.category === 'korean' && needsEnglishRewrite(item)) || item?.isFallback
                );

                if (Array.isArray(cachedNews) && cachedNews.length > 0 && !cachedNeedsRefresh) {
                    if (generation !== generations.current.news) return undefined;
                    setNewsError(null);
                    setNewsLoading(false);
                    return cachedNews;
                }
            }

            const [koreanNews, worldNews] = await Promise.all([
                fetchRealNews('korean'),
                fetchRealNews('world')
            ]);

            const [koreanSummary, worldSummary] = await Promise.all([
                summarizeNewsForLevel(koreanNews, selectedLevel, dateObj),
                summarizeNewsForLevel(worldNews, selectedLevel, dateObj)
            ]);

            const hasFallback = Boolean(
                koreanNews.isFallback
                || worldNews.isFallback
                || koreanSummary.isFallback
                || worldSummary.isFallback
            );

            const { isFallback: _kFlag, ...koreanFields } = koreanSummary;
            const { isFallback: _wFlag, ...worldFields } = worldSummary;

            const summarizedNews = [
                {
                    ...koreanFields,
                    category: 'korean',
                    source: koreanNews.source,
                    date: koreanNews.date,
                    url: koreanNews.url,
                    original: koreanNews
                },
                {
                    ...worldFields,
                    category: 'world',
                    source: worldNews.source,
                    date: worldNews.date,
                    url: worldNews.url,
                    original: worldNews
                }
            ];

            if (generation !== generations.current.news) return undefined;

            // 폴백 데이터가 섞인 응답은 캐시하지 않아 다음 방문 시 정상 기사를 다시 받을 수 있게 합니다.
            if (!hasFallback) {
                const existingCache = getCachedData('news', dateObj);
                const mergedData = { ...(existingCache?.data || {}), [selectedLevel]: summarizedNews };
                setCachedData('news', dateObj, mergedData);
            }

            setNewsError(null);
            setNewsLoading(false);
            return summarizedNews;
        } catch (e) {
            if (generation !== generations.current.news) return undefined;
            console.error("뉴스를 가져오는 데 실패했습니다:", e);
            setNewsLoading(false);

            const todayKey = toLocalDateKey();
            const fallbackNews = [
                {
                    title: "Daily English Learning News",
                    summary: "Today's English learning content is being prepared. Please try again in a moment.",
                    category: 'korean',
                    source: "Learning Service",
                    date: todayKey,
                    original: {
                        title: "Daily English Learning News",
                        full_text: "Today's English learning content is being prepared. Please try again in a moment.",
                        source: "Learning Service",
                        date: todayKey
                    }
                }
            ];
            setNewsError(null);
            return fallbackNews;
        }
    }, [fetchRealNews, summarizeNewsForLevel]);

    const initializeData = useCallback(() => {
        cleanupOldMonthlyData();
    }, []);

    const withDedupe = useCallback(<T,>(key: string, request: () => Promise<T>): Promise<T> => {
        if (inFlight.current.has(key)) {
            return inFlight.current.get(key) as Promise<T>;
        }
        const promise = request().finally(() => {
            inFlight.current.delete(key);
        });
        inFlight.current.set(key, promise);
        return promise;
    }, []);

    const fetchExpressions = useCallback((date: Date | string, selectedLevel: string) => {
        const dateObj = date instanceof Date ? date : new Date(date);
        const dateKey = isNaN(dateObj.getTime()) ? String(date) : toLocalDateKey(dateObj);
        const params = `${dateKey}|${selectedLevel}`;
        if (lastRequest.current.expressions !== params) {
            lastRequest.current.expressions = params;
            generations.current.expressions += 1;
        }
        const generation = generations.current.expressions;
        return withDedupe(
            `expressions:${dateKey}:${selectedLevel}#${generation}`,
            () => fetchExpressionsInternal(date, selectedLevel, generation)
        );
    }, [fetchExpressionsInternal, withDedupe]);

    const fetchNews = useCallback((date: Date | string, selectedLevel: string) => {
        const dateObj = date instanceof Date ? date : new Date(date);
        const dateKey = isNaN(dateObj.getTime()) ? String(date) : toLocalDateKey(dateObj);
        const params = `${dateKey}|${selectedLevel}`;
        if (lastRequest.current.news !== params) {
            lastRequest.current.news = params;
            generations.current.news += 1;
        }
        const generation = generations.current.news;
        return withDedupe(
            `news:${dateKey}:${selectedLevel}#${generation}`,
            () => fetchNewsInternal(date, selectedLevel, generation)
        );
    }, [fetchNewsInternal, withDedupe]);

    return {
        loading: expressionsLoading || newsLoading,
        error: expressionsError || newsError,
        expressionsLoading,
        expressionsError,
        newsLoading,
        newsError,
        fetchExpressions,
        fetchNews,
        initializeData
    };
};

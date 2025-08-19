import { useState, useCallback } from 'react';
import { callGeminiAPI, levelDescriptions } from '../utils/apiUtils';
import { 
    getCachedData, 
    setCachedData, 
    isCacheValid, 
    cleanupOldMonthlyData 
} from '../utils/cacheUtils';

export const useDataFetching = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 원본 뉴스 데이터 가져오기 (하루에 한 번만)
    const fetchOriginalNews = useCallback(async (date) => {
        const seed = `${date.toISOString().split('T')[0]}-original-news`;
        const prompt = `You are an expert news analyst. Create 2 current news articles about recent events. These should be real, current news stories that are actually happening in the world right now. Return the response as a valid JSON array with the following structure for each news article:
[
  {
    "title": "current news title",
    "full_text": "complete news article with current events",
    "original_complexity": "C1" // 원본 기사의 복잡도 레벨
  }
]
Choose real, current news topics that are actually happening. Use seed for consistency: ${seed}.`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                return JSON.parse(text);
            } else {
                throw new Error("API 응답에서 콘텐츠를 찾을 수 없습니다.");
            }
        } catch (e) {
            console.error("원본 뉴스를 가져오는 데 실패했습니다:", e);
            throw e;
        }
    }, []);

    // 레벨에 맞게 뉴스 재구성
    const adaptNewsForLevel = useCallback(async (originalNews, targetLevel) => {
        const prompt = `You are an expert English teacher and news analyst. Take the following news articles and adapt them for CEFR ${targetLevel} (${levelDescriptions[targetLevel]}) level English learners. Keep the same news content but adjust the language complexity, vocabulary, and grammar structures to be appropriate for ${targetLevel} level learners.

Original news articles:
${JSON.stringify(originalNews, null, 2)}

Return the response as a valid JSON array with the following structure for each adapted news article:
[
  {
    "title": "news title adapted for ${targetLevel} level",
    "full_text": "complete news article adapted for ${targetLevel} level with appropriate vocabulary and sentence structure",
    "key_words": [
      {
        "word": "important word from the article that is appropriate for ${targetLevel} level",
        "meaning": "Korean meaning",
        "example": "simple example sentence suitable for ${targetLevel} level"
      }
    ],
    "key_expressions": [
      {
        "expression": "useful expression from the article that is appropriate for ${targetLevel} level",
        "meaning": "Korean meaning",
        "example": "simple example sentence suitable for ${targetLevel} level"
      }
    ],
    "phrasal_verbs": [
      {
        "phrasal_verb": "phrasal verb from the article that is appropriate for ${targetLevel} level",
        "meaning": "Korean meaning",
        "example": "simple example sentence suitable for ${targetLevel} level"
      }
    ]
  }
]

For key_words, select only the most important words that are appropriate for ${targetLevel} level (maximum 10 words, ordered by importance). For key_expressions and phrasal_verbs, select only those that are appropriate for ${targetLevel} level learners.`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        try {
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                return JSON.parse(text);
            } else {
                throw new Error("API 응답에서 콘텐츠를 찾을 수 없습니다.");
            }
        } catch (e) {
            console.error("뉴스를 레벨에 맞게 재구성하는 데 실패했습니다:", e);
            throw e;
        }
    }, []);

    const fetchExpressions = useCallback(async (date, selectedLevel) => {
        setLoading(true);
        setError(null);
        
        try {
            // 캐시된 표현이 있는지 확인 (하루에 한 번만)
            if (isCacheValid('expressions', date)) {
                const cached = getCachedData('expressions', date);
                if (cached && cached.data[selectedLevel]) {
                    setLoading(false);
                    return cached.data[selectedLevel];
                }
            }
            
            // 새로운 표현 가져오기 (매일 다른 표현, 중복 방지, 레벨별 다른 표현)
            const dateStr = date.toISOString().split('T')[0];
            const randomSeed = `${dateStr}-${selectedLevel}-${Math.floor(Date.now() / 86400000)}-phrasal-verbs-random`;
            
            // 기존에 사용된 표현들 수집 (모든 레벨에서 중복 방지용)
            const usedExpressions = [];
            const usedMeanings = [];
            const oneWeekAgo = new Date(date);
            oneWeekAgo.setDate(date.getDate() - 7);
            
            // 모든 레벨의 지난 1주일 데이터 확인
            const allLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            for (let i = 0; i < 7; i++) {
                const checkDate = new Date(oneWeekAgo);
                checkDate.setDate(oneWeekAgo.getDate() + i);
                
                allLevels.forEach(level => {
                    const cachedData = getCachedData('expressions', checkDate);
                    if (cachedData && cachedData.data && cachedData.data[level]) {
                        cachedData.data[level].forEach(expr => {
                            if (expr.phrasal_verb) {
                                usedExpressions.push(expr.phrasal_verb.toLowerCase());
                            }
                            if (expr.meaning) {
                                // 의미에서 핵심 키워드 추출 (예: "일어나다", "시작하다" 등)
                                const meaningKeywords = expr.meaning.split(/[,\s]+/).filter(word => word.length > 1);
                                usedMeanings.push(...meaningKeywords);
                            }
                        });
                    }
                });
            }
            
            const excludeExpressionsList = usedExpressions.length > 0 ? 
                `\n\nIMPORTANT - NEVER use these phrasal verbs: ${usedExpressions.join(', ')}` : '';
                
            const excludeMeaningsList = usedMeanings.length > 0 ? 
                `\n\nIMPORTANT - Avoid phrasal verbs with these meanings: ${[...new Set(usedMeanings)].join(', ')}. Choose completely different meanings and concepts.` : '';
            
            const prompt = `You are an expert English teacher for a language learning app. The learner's level is CEFR ${selectedLevel} (${levelDescriptions[selectedLevel]}). 

TASK: Generate 3 distinct, very important and extremely frequently used English phrasal verbs that are essential for daily communication. These should be randomly selected from a comprehensive pool of the top 500 most important phrasal verbs that native speakers use regularly.

SELECTION POOL: Consider the top 500 most essential and frequently used phrasal verbs in English that are appropriate for ${selectedLevel} level learners. This includes but is not limited to:
- Basic daily activities (get up, wake up, sit down, stand up, etc.)
- Communication verbs (speak up, talk over, call back, etc.)
- Movement and direction (go out, come in, turn around, etc.)
- Work and study (work out, figure out, look up, etc.)
- Emotions and relationships (get along, break up, cheer up, etc.)
- Technology and modern life (log in, turn off, plug in, etc.)
- Shopping and money (pay for, save up, spend on, etc.)
- Health and lifestyle (work out, cut down, give up, etc.)

LEVEL-SPECIFIC REQUIREMENTS:
- For ${selectedLevel} level, choose phrasal verbs that are appropriate for this proficiency level from the 500-verb pool
- If a meaning like "wake up" was used in A2 level, then for B1 level use a different phrasal verb with the same meaning (like "get up") or choose completely different meanings from the 500-verb pool
- Each level should have different phrasal verbs even if they express similar concepts
- Focus on the most essential and frequently used phrasal verbs for ${selectedLevel} learners from the comprehensive 500-verb collection

RANDOMIZATION: Randomly select 3 completely different phrasal verbs from the pool of top 500 most important phrasal verbs suitable for ${selectedLevel} level. 
- Use maximum randomness and unpredictability
- Every day must bring completely NEW phrasal verbs that haven't been seen recently
- Avoid any patterns or sequences
- Make each day's selection feel completely fresh and surprising
- Prioritize variety and novelty over frequency patterns

Return the response as a valid JSON array with the following structure:
[
  {
    "phrasal_verb": "the phrasal verb (randomly selected from top 500, appropriate for ${selectedLevel} level)",
    "sentence": "a practical, real-life example sentence that ${selectedLevel} level learners can easily understand and use",
    "meaning": "clear Korean meaning (핵심 의미만 간단히)",
    "other_words": [
      {
        "word": "important word from the sentence",
        "meaning": "Korean meaning of the word",
        "example": "simple example sentence using this word"
      }
    ]
  }
]

CONSTRAINTS:${excludeExpressionsList}${excludeMeaningsList}

Use this randomization seed: ${randomSeed}. 

CRITICAL: Generate completely NEW and DIFFERENT phrasal verbs every single day from the 500-verb pool. Maximum variety and freshness is essential. Never repeat recent patterns.`;
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                const expressionsData = JSON.parse(text);
                
                // 캐시 업데이트 (하루에 한 번만 저장)
                const cached = getCachedData('expressions', date) || { data: {} };
                cached.data[selectedLevel] = expressionsData;
                setCachedData('expressions', date, cached.data);
                
                setLoading(false);
                return expressionsData;
            } else {
                throw new Error("API 응답에서 콘텐츠를 찾을 수 없습니다.");
            }
        } catch (e) {
            console.error("표현을 가져오는 데 실패했습니다:", e);
            setError("오늘의 표현을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.");
            setLoading(false);
            throw e;
        }
    }, []);

    const fetchNews = useCallback(async (date, selectedLevel) => {
        setLoading(true);
        setError(null);
        
        try {
            // 캐시된 뉴스가 있는지 확인
            if (isCacheValid('news', date)) {
                const cached = getCachedData('news', date);
                if (cached && cached.data[selectedLevel]) {
                    setLoading(false);
                    return cached.data[selectedLevel];
                }
            }
            
            // 원본 뉴스 가져오기 (하루에 한 번만)
            let originalNews;
            if (isCacheValid('news', date)) {
                const cached = getCachedData('news', date);
                originalNews = cached.data.original;
            } else {
                originalNews = await fetchOriginalNews(date);
                // 원본 뉴스를 캐시에 저장
                setCachedData('news', date, { original: originalNews });
            }
            
            // 레벨에 맞게 뉴스 재구성
            const adaptedNews = await adaptNewsForLevel(originalNews, selectedLevel);
            
            // 캐시 업데이트
            const cached = getCachedData('news', date) || { data: {} };
            cached.data[selectedLevel] = adaptedNews;
            setCachedData('news', date, cached.data);
            
            setLoading(false);
            return adaptedNews;
            
        } catch (e) {
            console.error("뉴스를 가져오는 데 실패했습니다:", e);
            setError("오늘의 뉴스를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.");
            setLoading(false);
            throw e;
        }
    }, [fetchOriginalNews, adaptNewsForLevel]);

    // 초기화 시 월별 데이터 정리
    const initializeData = useCallback(() => {
        cleanupOldMonthlyData();
    }, []);

    return {
        loading,
        error,
        fetchExpressions,
        fetchNews,
        initializeData
    };
};

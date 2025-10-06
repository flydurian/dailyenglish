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

    // Gemini API를 사용해서 실제 뉴스 기사 생성
    const fetchRealNews = useCallback(async (type) => {
        try {
            console.log(`${type} 뉴스 생성 중...`);
            
            // 날짜 기반 시드 생성 (매일 다른 뉴스를 위해)
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            
            // 뉴스 타입별 프롬프트 생성
            const newsPrompt = generateNewsPrompt(type, dateStr, dayOfYear);
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: newsPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 2000,
                    temperature: 0.7
                }
            };
            
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                try {
                    // JSON 파싱 시도
                    let newsData;
                    try {
                        newsData = JSON.parse(text);
                    } catch (parseError) {
                        console.error('뉴스 JSON 파싱 실패:', parseError);
                        console.log('원본 텍스트:', text);
                        
                        // JSON 파싱 실패 시 텍스트에서 정보 추출 시도
                        const titleMatch = text.match(/"title":\s*"([^"]+)"/);
                        const contentMatch = text.match(/"content":\s*"([^"]+)"/);
                        const sourceMatch = text.match(/"source":\s*"([^"]+)"/);
                        
                        if (titleMatch && contentMatch && sourceMatch) {
                            newsData = {
                                title: titleMatch[1],
                                content: contentMatch[1],
                                source: sourceMatch[1]
                            };
                        } else {
                            throw new Error("JSON 파싱 및 텍스트 추출 실패");
                        }
                    }
                    
                    return {
                        title: newsData.title,
                        full_text: newsData.content,
                        category: type,
                        original_complexity: "B2",
                        source: newsData.source,
                        date: dateStr,
                        url: newsData.url || `https://example.com/news/${type}/${dayOfYear}`
                    };
                } catch (error) {
                    console.error('뉴스 데이터 처리 실패:', error);
                    throw new Error("뉴스 데이터 처리에 실패했습니다.");
                }
            } else {
                throw new Error("뉴스 생성에 실패했습니다.");
            }
            
        } catch (error) {
            console.error('뉴스 생성 실패:', error);
            // 최종 폴백 뉴스 데이터 반환
            const fallbackData = getFallbackNews(type, 0);
            return {
                title: fallbackData.title,
                full_text: fallbackData.content,
                category: type,
                original_complexity: "B2",
                source: 'News Service',
                date: new Date().toISOString().split('T')[0]
            };
        }
    }, []);

    // 뉴스 생성용 프롬프트 생성 함수
    const generateNewsPrompt = useCallback((type, dateStr, dayOfYear) => {
        const topics = type === 'korean' ? [
            'semiconductor industry', 'entertainment industry', 'green technology', 'education system',
            'healthcare system', 'fintech startups', 'smart city initiatives', 'food culture',
            'robotics technology', 'sports achievements', 'digital transformation', 'economic growth',
            'cultural exchange', 'innovation hub', 'sustainable development', 'global competitiveness'
        ] : [
            'climate action', 'artificial intelligence', 'space exploration', 'global economy',
            'healthcare innovation', 'renewable energy', 'digital education', 'international sports',
            'sustainable development', 'technological advancement', 'international cooperation',
            'economic resilience', 'scientific breakthroughs', 'cultural exchange', 'environmental protection',
            'social progress'
        ];

        const sources = type === 'korean' ? [
            'KBS News', 'MBC News', 'SBS News', 'YTN News', 'Arirang News', 'Korea Herald'
        ] : [
            'BBC News', 'CNN', 'Reuters', 'Associated Press', 'Bloomberg', 'The Guardian'
        ];

        // 날짜 기반으로 주제 선택
        const selectedTopic = topics[dayOfYear % topics.length];
        const selectedSource = sources[dayOfYear % sources.length];

        return `Create a news article about ${selectedTopic}${type === 'korean' ? ' in South Korea' : ' globally'}.

Write as if published by ${selectedSource} on ${dateStr}.
Use B2 level English vocabulary.
Write 3-4 paragraphs, 200-300 words total.

Return ONLY this JSON structure:
{
  "title": "News headline about ${selectedTopic}",
  "content": "Article content with 3-4 paragraphs about ${selectedTopic}.",
  "source": "${selectedSource}",
  "url": "https://example.com/news/${type}/${dayOfYear}"
}

IMPORTANT: Return ONLY the JSON object, no other text. Make sure the JSON is complete and valid.`;
    }, []);

    // 최소한의 폴백 뉴스 데이터 (Gemini API 실패 시에만 사용)
    const getFallbackNews = useCallback((type, dayOfYear) => {
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

    // 한국 뉴스 가져오기
    const fetchKoreanNews = useCallback(async (date) => {
        return fetchRealNews('korean');
    }, [fetchRealNews]);

    // 세계 뉴스 가져오기
    const fetchWorldNews = useCallback(async (date) => {
        return fetchRealNews('world');
    }, [fetchRealNews]);

    // 레벨별 뉴스 요약 생성
    const summarizeNewsForLevel = useCallback(async (newsItem, targetLevel) => {
        // 뉴스 데이터 유효성 검사
        if (!newsItem || !newsItem.title) {
            console.error('뉴스 데이터가 유효하지 않습니다:', newsItem);
            return {
                title: "뉴스 제목을 불러올 수 없습니다",
                summary: "뉴스 요약을 생성할 수 없습니다.",
                key_points: [],
                vocabulary_notes: []
            };
        }
        
        try {
            const summaryPrompt = `Create comprehensive learning materials for ${targetLevel} level English students based on this news article.

TITLE: ${newsItem.title}
CONTENT: ${newsItem.full_text}
SOURCE: ${newsItem.source}
DATE: ${newsItem.date}

REQUIREMENTS:
- Write a detailed 4-5 paragraph summary (300-400 words) in ${targetLevel} level English
- Include specific details, statistics, and examples from the article
- Make it educational and engaging for English learners
- Extract 6 phrasal verbs from the article with Korean meanings
- Extract 4-6 important vocabulary words from the article with Korean meanings

Return ONLY this JSON structure:
{
  "summary": "Write a detailed 4-5 paragraph summary (300-400 words) in ${targetLevel} level English. Include specific details, examples, and context from the article. Make it comprehensive and educational.",
  "key_points": [
    "phrasal_verb_1: Korean meaning",
    "phrasal_verb_2: Korean meaning",
    "phrasal_verb_3: Korean meaning",
    "phrasal_verb_4: Korean meaning",
    "phrasal_verb_5: Korean meaning",
    "phrasal_verb_6: Korean meaning"
  ],
  "vocabulary_notes": [
    "word1: Korean meaning",
    "word2: Korean meaning",
    "word3: Korean meaning",
    "word4: Korean meaning",
    "word5: Korean meaning",
    "word6: Korean meaning"
  ]
}

IMPORTANT: Return ONLY the JSON object, no other text. Make the summary detailed and comprehensive.`;

            const payload = {
                contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 2500,
                    temperature: 0.3
                }
            };
            
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-05-20');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                try {
                    const summaryData = JSON.parse(text);
                    return {
                        title: newsItem.title,
                        summary: summaryData.summary,
                        key_points: summaryData.key_points,
                        vocabulary_notes: summaryData.vocabulary_notes
                    };
                } catch (parseError) {
                    console.error('JSON 파싱 실패:', parseError);
                    console.log('원본 텍스트:', text);
                    throw new Error("뉴스 요약 JSON 파싱에 실패했습니다.");
                }
            } else {
                throw new Error("뉴스 요약 생성에 실패했습니다.");
            }
            
        } catch (error) {
            console.error('뉴스 요약 생성 실패:', error);
            // 폴백 요약 반환
            return {
                title: newsItem.title,
                summary: `This comprehensive news article provides an in-depth analysis of significant developments in ${newsItem.category === 'korean' ? 'South Korea' : 'the global community'}. The report examines various aspects of current events and emerging trends that are actively shaping our world today. 

The article presents detailed information about recent achievements, challenges, and opportunities in key sectors. It highlights the importance of innovation, cooperation, and sustainable development in addressing contemporary issues. The content offers valuable insights into how different stakeholders are responding to these developments and what implications they may have for the future.

Furthermore, the report discusses the broader context and significance of these developments, providing readers with a comprehensive understanding of the situation. It explores the various factors that have contributed to these changes and examines the potential long-term effects on society, economy, and international relations.

The article serves as an excellent resource for understanding current affairs and their impact on our daily lives. It demonstrates the interconnected nature of global events and how local developments can have far-reaching consequences. This comprehensive coverage helps readers stay informed about important issues and trends that are shaping the world we live in.`,
                key_points: [
                    "come up with: 생각해내다",
                    "look into: 조사하다",
                    "put up with: 참다",
                    "set up: 설립하다",
                    "take over: 인수하다",
                    "break through: 돌파하다"
                ],
                vocabulary_notes: [
                    "comprehensive: 포괄적인",
                    "development: 발전",
                    "significant: 중요한",
                    "innovation: 혁신",
                    "sustainable: 지속가능한",
                    "implications: 함의, 영향"
                ]
            };
        }
    }, []);

    const fetchExpressions = useCallback(async (date, selectedLevel) => {
        setLoading(true);
        setError(null);
        
        try {
            // Date 객체 유효성 검사
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date provided to fetchExpressions:', date);
                throw new Error('유효하지 않은 날짜입니다.');
            }
            
            // 캐시된 표현이 있는지 확인 (하루에 한 번만)
            if (isCacheValid('expressions', dateObj)) {
                const cached = getCachedData('expressions', dateObj);
                if (cached && cached.data[selectedLevel]) {
                    setLoading(false);
                    return cached.data[selectedLevel];
                }
            }
            
            // 새로운 표현 가져오기 (매일 다른 표현, 중복 방지, 레벨별 다른 표현)
            const dateStr = dateObj.toISOString().split('T')[0];
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
                const cached = getCachedData('expressions', dateObj) || { data: {} };
                cached.data[selectedLevel] = expressionsData;
                setCachedData('expressions', dateObj, cached.data);
                
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
            // Date 객체 유효성 검사
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date provided to fetchNews:', date);
                throw new Error('유효하지 않은 날짜입니다.');
            }
            
            // 날짜 기반 캐시 키 생성 (년-월-일 형식)
            const dateKey = dateObj.toISOString().split('T')[0];
            
            // 오늘 날짜의 캐시 확인
            const cached = getCachedData('news', dateObj);
            if (cached && cached.data && cached.data[selectedLevel]) {
                console.log('캐시된 뉴스 데이터 사용:', dateKey);
                setLoading(false);
                return cached.data[selectedLevel];
            }
            
            console.log('새로운 뉴스 데이터 생성 중...');
            
            // 새로운 뉴스 데이터 생성 (안정적인 폴백 시스템 사용)
            const [koreanNews, worldNews] = await Promise.all([
                fetchKoreanNews(dateObj),
                fetchWorldNews(dateObj)
            ]);
            
            // 뉴스 데이터 유효성 검사
            if (!koreanNews || !worldNews) {
                console.error('뉴스 데이터가 없습니다:', { koreanNews, worldNews });
                throw new Error('뉴스 데이터를 가져올 수 없습니다.');
            }
            
            console.log('뉴스 요약 생성 중...');
            
            // 각 뉴스를 레벨에 맞게 요약
            const [koreanSummary, worldSummary] = await Promise.all([
                summarizeNewsForLevel(koreanNews, selectedLevel),
                summarizeNewsForLevel(worldNews, selectedLevel)
            ]);
            
            // 요약된 뉴스 배열 생성
            const summarizedNews = [
                { ...koreanSummary, category: 'korean', original: koreanNews },
                { ...worldSummary, category: 'world', original: worldNews }
            ];
            
            // 날짜별 캐시 저장
            const cacheData = { data: {} };
            cacheData.data[selectedLevel] = summarizedNews;
            setCachedData('news', dateObj, cacheData.data);
            
            console.log('뉴스 데이터 생성 완료:', dateKey);
            setLoading(false);
            return summarizedNews;
            
        } catch (e) {
            console.error("뉴스를 가져오는 데 실패했습니다:", e);
            setError("뉴스를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            setLoading(false);
            
            // 에러 발생 시에도 기본 뉴스 데이터 반환
            try {
                const fallbackNews = [
                    {
                        title: "Daily English Learning News",
                        summary: "Today's English learning content is being prepared. Please try again in a moment.",
                        category: 'korean',
                        original: {
                            title: "Daily English Learning News",
                            full_text: "Today's English learning content is being prepared. Please try again in a moment.",
                            source: "Learning Service"
                        }
                    }
                ];
                return fallbackNews;
            } catch (fallbackError) {
                console.error('폴백 뉴스 생성도 실패:', fallbackError);
                throw e;
            }
        }
    }, [fetchKoreanNews, fetchWorldNews, summarizeNewsForLevel]);

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

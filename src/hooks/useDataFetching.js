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

    // 한국 뉴스 가져오기
    const fetchKoreanNews = useCallback(async (date) => {
        // 간단한 한국 뉴스 데이터 생성 (API 호출 없이)
        const koreanNews = {
            title: "South Korea's Economic Growth and Technological Innovation",
            full_text: "South Korea has been showing remarkable achievements in economic growth and technological innovation recently. Particularly notable developments in semiconductor, automotive, and IT sectors have been prominent. This growth is enhancing South Korea's global competitiveness and establishing the foundation for sustainable future development.",
            category: "korean",
            original_complexity: "B2"
        };
        
        return koreanNews;
    }, []);

    // 세계 뉴스 가져오기
    const fetchWorldNews = useCallback(async (date) => {
        // 간단한 세계 뉴스 데이터 생성 (API 호출 없이)
        const worldNews = {
            title: "Global Climate Change and Renewable Energy Initiatives",
            full_text: "Countries around the world are taking significant steps to address climate change through renewable energy initiatives. Solar and wind power installations have reached record levels, while electric vehicle adoption continues to grow. International cooperation on environmental policies is strengthening, with new agreements on carbon reduction targets being established.",
            category: "world",
            original_complexity: "B2"
        };
        
        return worldNews;
    }, []);

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
        
        // 뉴스별 맞춤 요약 생성
        let summary, keyPoints, vocabularyNotes;
        
        if (newsItem.category === 'korean') {
            summary = `South Korea continues to demonstrate remarkable achievements in technological innovation and economic development. The nation has established itself as a global leader in semiconductor manufacturing, with companies like Samsung and SK Hynix leading the world in memory chip production. The automotive industry has also seen significant growth, with Hyundai and Kia expanding their electric vehicle offerings and autonomous driving technologies. Additionally, South Korea's IT sector has been thriving, particularly in areas such as artificial intelligence, 5G networks, and digital transformation initiatives. These technological advancements have not only strengthened the country's domestic economy but have also enhanced its global competitiveness, positioning South Korea as a key player in the international technology market. The government has been actively supporting these industries through various policies and investments, fostering an environment conducive to innovation and growth.`;
            keyPoints = [
                "come up with: 생각해내다, 제안하다",
                "look into: 조사하다, 살펴보다",
                "put up with: 참다, 견디다",
                "set up: 설립하다, 설치하다",
                "take over: 인수하다, 이어받다",
                "break through: 돌파하다, 성과를 내다"
            ];
            // 레벨별 주요 단어 필터링
            if (targetLevel === 'A1' || targetLevel === 'A2') {
                vocabularyNotes = [
                    "company: 회사",
                    "technology: 기술",
                    "growth: 성장"
                ];
            } else if (targetLevel === 'B1' || targetLevel === 'B2') {
                vocabularyNotes = [
                    "semiconductor: 반도체",
                    "automotive: 자동차 관련",
                    "competitiveness: 경쟁력",
                    "innovation: 혁신"
                ];
            } else {
                vocabularyNotes = [
                    "semiconductor: 반도체",
                    "automotive: 자동차 관련",
                    "competitiveness: 경쟁력",
                    "innovation: 혁신",
                    "manufacturing: 제조업",
                    "infrastructure: 인프라"
                ];
            }
        } else {
            summary = `The global community is intensifying its efforts to address climate change through comprehensive renewable energy initiatives and international cooperation. Countries around the world are significantly increasing their investments in solar and wind power infrastructure, with many nations setting ambitious targets to achieve carbon neutrality within the next few decades. The adoption of electric vehicles is accelerating rapidly, supported by government incentives and improved battery technology. International organizations and governments are forming new partnerships and agreements to reduce greenhouse gas emissions and protect the environment. These collaborative efforts include sharing technological innovations, establishing carbon trading systems, and implementing stricter environmental regulations. The transition to renewable energy sources is not only helping to combat climate change but is also creating new economic opportunities and jobs in the green energy sector.`;
            keyPoints = [
                "work together: 함께 일하다, 협력하다",
                "fight against: ~에 맞서 싸우다",
                "come up with: 생각해내다, 제안하다",
                "cut down: 줄이다, 감소시키다",
                "phase out: 단계적으로 폐지하다",
                "step up: 강화하다, 증대시키다"
            ];
            // 레벨별 주요 단어 필터링
            if (targetLevel === 'A1' || targetLevel === 'A2') {
                vocabularyNotes = [
                    "energy: 에너지",
                    "environment: 환경",
                    "change: 변화"
                ];
            } else if (targetLevel === 'B1' || targetLevel === 'B2') {
                vocabularyNotes = [
                    "renewable: 재생 가능한",
                    "cooperation: 협력",
                    "pollution: 오염",
                    "emissions: 배출량"
                ];
            } else {
                vocabularyNotes = [
                    "renewable: 재생 가능한",
                    "cooperation: 협력",
                    "pollution: 오염",
                    "emissions: 배출량",
                    "sustainability: 지속가능성",
                    "carbon neutrality: 탄소 중립"
                ];
            }
        }
        
        const result = {
            title: newsItem.title,
            summary: summary,
            key_points: keyPoints,
            vocabulary_notes: vocabularyNotes
        };
        
        return result;
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
            // 항상 새로운 뉴스 데이터 생성 (캐시 무시)
            const [koreanNews, worldNews] = await Promise.all([
                fetchKoreanNews(date),
                fetchWorldNews(date)
            ]);
            
            // 뉴스 데이터 유효성 검사
            if (!koreanNews || !worldNews) {
                console.error('뉴스 데이터가 없습니다:', { koreanNews, worldNews });
                throw new Error('뉴스 데이터를 가져올 수 없습니다.');
            }
            
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
            
            // 캐시 업데이트
            const cached = getCachedData('news', date) || { data: {} };
            cached.data[selectedLevel] = summarizedNews;
            setCachedData('news', date, cached.data);
            
            setLoading(false);
            return summarizedNews;
            
        } catch (e) {
            console.error("뉴스를 가져오는 데 실패했습니다:", e);
            setError("오늘의 뉴스를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.");
            setLoading(false);
            throw e;
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

import { useState, useCallback } from 'react';
import { callGeminiAPI, levelDescriptions } from '../utils/apiUtils';
import {
    getCachedData,
    setCachedData,
    isCacheValid,
    cleanupOldMonthlyData
} from '../utils/cacheUtils';
import { getDailyPhrasalVerbs, getRandomPhrasalVerbs } from '../data/phrasalVerbsData';

export const useDataFetching = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    // RSS 피드를 사용해서 실제 뉴스 기사 가져오기
    const fetchRealNews = useCallback(async (type, targetLevel = 'B1') => {
        try {
            console.log(`${type} 뉴스 가져오는 중...`);

            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];

            // RSS 피드 URL 설정
            let rssUrl;
            if (type === 'korean') {
                rssUrl = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
            } else {
                rssUrl = 'https://news.google.com/rss?hl=en&gl=US&ceid=US:en';
            }

            // 서버 사이드 API 엔드포인트 호출 (개발/프로덕션 모두)
            const isDevelopment = process.env.NODE_ENV === 'development';
            const apiUrl = isDevelopment
                ? `http://localhost:3000/api/news?type=${type}`
                : `/api/news?type=${type}`;

            let article;

            try {
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (!data.article) {
                    throw new Error("뉴스 기사를 찾을 수 없습니다.");
                }

                article = data.article;
            } catch (apiError) {
                // API 호출 실패 시 CORS 프록시를 통해 RSS 피드 가져오기 시도
                console.warn('API 호출 실패, CORS 프록시 사용:', apiError);

                // CORS 프록시 사용 (무료 서비스)
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const proxyData = await response.json();
                const xmlText = proxyData.contents;

                // XML 파싱
                const items = [];
                const itemRegex = /<item>(.*?)<\/item>/gs;
                let match;

                while ((match = itemRegex.exec(xmlText)) !== null) {
                    const itemXml = match[1];

                    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s);
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
                    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);
                    const descriptionMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s);
                    const sourceMatch = itemXml.match(/<source url="(.*?)">(.*?)<\/source>/s);

                    if (titleMatch) {
                        const title = (titleMatch[1] || titleMatch[2] || '').trim();
                        const link = linkMatch ? linkMatch[1].trim() : '';
                        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
                        const description = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').trim() : '';
                        const sourceName = sourceMatch ? sourceMatch[2].trim() : (type === 'korean' ? 'Google News Korea' : 'Google News');

                        // HTML 태그 제거
                        const cleanDescription = description
                            .replace(/<[^>]*>/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .trim();

                        items.push({
                            title: title.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'),
                            description: cleanDescription,
                            url: link,
                            publishedAt: pubDate,
                            source: {
                                name: sourceName
                            }
                        });
                    }
                }

                if (items.length === 0) {
                    throw new Error("뉴스 기사를 찾을 수 없습니다.");
                }

                // 랜덤하게 하나 선택
                article = items[Math.floor(Math.random() * items.length)];
            }

            // RSS 피드 응답 형식에 맞게 데이터 변환
            let fullText = article.description || article.content || '';

            // description이 너무 짧으면 (100자 미만) title을 포함
            if (fullText.length < 100) {
                fullText = `${article.title}\n\n${fullText}`;
            }

            // 한국 뉴스의 제목이 한글이면 영어로 번역
            let finalTitle = article.title || 'No title';
            if (type === 'korean') {
                // 한글이 포함되어 있는지 확인
                const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(finalTitle);
                if (hasKorean) {
                    try {
                        // Gemini API를 사용해서 제목을 선택한 레벨에 맞는 영어로 번역
                        const translatePrompt = `Translate this Korean news headline to English appropriate for ${targetLevel} level English learners. Keep it concise and natural.

Korean headline: ${finalTitle}

Return ONLY the English translation, nothing else. Make it suitable for ${targetLevel} level learners.`;

                        const payload = {
                            contents: [{ role: "user", parts: [{ text: translatePrompt }] }],
                            generationConfig: {
                                responseMimeType: "text/plain",
                                maxOutputTokens: 100,
                                temperature: 0.3
                            }
                        };

                        const result = await callGeminiAPI(payload, 'gemini-flash-latest');
                        const translatedTitle = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                        if (translatedTitle) {
                            finalTitle = translatedTitle;
                        }
                    } catch (translateError) {
                        console.warn('제목 번역 실패, 원본 제목 사용:', translateError);
                        // 번역 실패 시 원본 제목 사용
                    }
                }
            }

            return {
                title: finalTitle,
                full_text: fullText || article.title || '',
                category: type,
                original_complexity: "B2",
                source: article.source?.name || 'Unknown Source',
                date: article.publishedAt ? article.publishedAt.split('T')[0] : dateStr,
                url: article.url || `https://example.com/news/${type}`
            };

        } catch (error) {
            console.error('뉴스 가져오기 실패:', error);
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
    }, [getFallbackNews]);





    // 한국 뉴스 가져오기
    const fetchKoreanNews = useCallback(async (date, targetLevel = 'B1') => {
        return fetchRealNews('korean', targetLevel);
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
            // 한국 뉴스의 경우 제목이 한글이면 영어로 번역
            let articleTitle = newsItem.title;
            if (newsItem.category === 'korean') {
                const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(articleTitle);
                if (hasKorean) {
                    try {
                        const translatePrompt = `Translate this Korean news headline to English appropriate for ${targetLevel} level English learners. Keep it concise and natural.

Korean headline: ${articleTitle}

Return ONLY the English translation, nothing else. Make it suitable for ${targetLevel} level learners.`;

                        const translatePayload = {
                            contents: [{ role: "user", parts: [{ text: translatePrompt }] }],
                            generationConfig: {
                                responseMimeType: "text/plain",
                                maxOutputTokens: 100,
                                temperature: 0.3
                            }
                        };

                        const translateResult = await callGeminiAPI(translatePayload, 'gemini-flash-latest');
                        const translatedTitle = translateResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                        if (translatedTitle) {
                            articleTitle = translatedTitle;
                        }
                    } catch (translateError) {
                        console.warn('제목 번역 실패, 원본 제목 사용:', translateError);
                    }
                }
            }

            // 구동사 무작위 추출 (약 6-8개)
            const randomPhrasalVerbs = await getRandomPhrasalVerbs(8);
            const verbsList = randomPhrasalVerbs.map(v => `${v.verb} (${v.meaning})`).join(', ');

            const summaryPrompt = `Rewrite this news article in ${targetLevel} level English for language learners. Write it as an actual news article, not as a summary or explanation.

ORIGINAL ARTICLE:
TITLE: ${articleTitle}
CONTENT: ${newsItem.full_text}
SOURCE: ${newsItem.source}
DATE: ${newsItem.date}

SUGGESTED PHRASAL VERBS:
The following phrasal verbs are suggested for use in this article: ${verbsList}

REQUIREMENTS:
- Write a complete news article (4-5 paragraphs, 300-400 words) in ${targetLevel} level English
- Write it as if you are a journalist reporting the news directly, not describing what the article says
- Use direct reporting style (e.g., "South Korea announced..." not "The article says that South Korea announced...")
- Include specific details, statistics, and examples from the original article
- Make it engaging and educational for English learners
- Use natural journalistic language appropriate for ${targetLevel} level
- **Please prioritize using the SUGGESTED PHRASAL VERBS provided above ONLY IF they fit the context naturally and can replace a standard verb with a similar meaning. Do not force their use if they don't make sense.**
- Extract 6 phrasal verbs from the rewritten article with Korean meanings. Try to include the suggested verbs you successfully prioritized.
- Extract 4-6 important vocabulary words from the rewritten article with Korean meanings

WRITING STYLE EXAMPLES:
❌ WRONG: "This article discusses..." or "The report examines..." or "The article presents..."
✅ CORRECT: "South Korea announced..." or "A new study shows..." or "Scientists discovered..."

Return ONLY this JSON structure:
{
  "summary": "Write the complete news article here in ${targetLevel} level English. Write it as an actual news article with direct reporting, not as a summary or explanation of the article.",
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

IMPORTANT: 
- Return ONLY the JSON object, no other text
- Write the summary as an actual news article, not as a description of the article
- Use direct reporting style throughout
- Use the suggested phrasal verbs where appropriate and natural`;

            const payload = {
                contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 2500,
                    temperature: 0.3
                }
            };

            const result = await callGeminiAPI(payload, 'gemini-flash-latest');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                try {
                    const summaryData = JSON.parse(text);
                    return {
                        title: articleTitle, // 번역된 제목 사용
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
            // 한국 뉴스의 경우 제목이 한글이면 영어로 번역 시도
            let fallbackTitle = newsItem.title;
            if (newsItem.category === 'korean') {
                const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(fallbackTitle);
                if (hasKorean) {
                    // 간단한 번역 시도 (실패해도 원본 사용)
                    try {
                        const translatePrompt = `Translate this Korean news headline to English appropriate for ${targetLevel} level English learners. Keep it concise and natural.

Korean headline: ${fallbackTitle}

Return ONLY the English translation, nothing else.`;

                        const translatePayload = {
                            contents: [{ role: "user", parts: [{ text: translatePrompt }] }],
                            generationConfig: {
                                responseMimeType: "text/plain",
                                maxOutputTokens: 100,
                                temperature: 0.3
                            }
                        };

                        const translateResult = await callGeminiAPI(translatePayload, 'gemini-flash-latest');
                        const translatedTitle = translateResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                        if (translatedTitle) {
                            fallbackTitle = translatedTitle;
                        }
                    } catch (translateError) {
                        console.warn('폴백 제목 번역 실패:', translateError);
                    }
                }
            }

            return {
                title: fallbackTitle,
                summary: `${newsItem.category === 'korean' ? 'South Korea' : 'International communities'} continue to make significant progress in various fields. Recent developments show promising trends in technology, economy, and social innovation.

Key sectors are experiencing growth and transformation. Innovation and cooperation play crucial roles in addressing current challenges. Stakeholders are working together to create sustainable solutions for the future.

These developments have important implications for society and the global economy. The changes reflect broader trends that will shape our world in the coming years. Understanding these trends helps us prepare for future opportunities and challenges.

The ongoing progress demonstrates the interconnected nature of modern developments. Local achievements can have global impact, and international cooperation remains essential for continued success.`,
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
                    // 캐시된 데이터가 새로운 필드(situation, examples)를 포함하고 있는지 확인
                    const hasNewFields = Array.isArray(cached.data[selectedLevel]) &&
                        cached.data[selectedLevel].some(item => item.situation && item.examples);

                    if (hasNewFields) {
                        // 캐시된 데이터를 사용할 때도 에러 상태 초기화
                        setError(null);
                        setLoading(false);
                        return cached.data[selectedLevel];
                    }
                    // 새로운 필드가 없으면 캐시 무시하고 새로 요청
                    console.log('오래된 캐시 데이터 감지됨(examples 누락). 새로운 형식으로 다시 가져옵니다.');
                }
            }

            // 새로운 표현 가져오기 (매일 다른 표현, 중복 방지, 레벨별 다른 표현)


            // 로컬 데이터에서 오늘의 구동사 3개 가져오기
            const dailyVerbs = await getDailyPhrasalVerbs(dateObj);
            const verbsList = dailyVerbs.map(v => `${v.verb} (meaning: ${v.meaning})`).join(', ');

            const prompt = `You are an expert English teacher for a language learning app. The learner's level is CEFR ${selectedLevel} (${levelDescriptions[selectedLevel]}). 
            
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
                    responseMimeType: "application/json"
                }
            };

            const result = await callGeminiAPI(payload, 'gemini-flash-latest');
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                const expressionsData = JSON.parse(text);

                // 캐시 업데이트 (하루에 한 번만 저장)
                const cached = getCachedData('expressions', dateObj) || { data: {} };
                cached.data[selectedLevel] = expressionsData;
                setCachedData('expressions', dateObj, cached.data);

                // 성공적으로 데이터를 가져왔으므로 에러 상태 초기화
                setError(null);
                setLoading(false);
                return expressionsData;
            } else {
                throw new Error("API 응답에서 콘텐츠를 찾을 수 없습니다.");
            }
        } catch (e) {
            console.error("표현을 가져오는 데 실패했습니다:", e);
            setLoading(false);

            // 에러 발생 시 폴백 데이터 반환
            try {
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

                // 폴백 데이터를 반환할 때는 에러 상태를 초기화
                setError(null);
                return fallbackExpressions;
            } catch (fallbackError) {
                console.error('폴백 표현 생성도 실패:', fallbackError);
                setError("오늘의 표현을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.");
                throw e;
            }
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
                // 캐시된 데이터를 사용할 때도 에러 상태 초기화
                setError(null);
                setLoading(false);
                return cached.data[selectedLevel];
            }

            console.log('새로운 뉴스 데이터 생성 중...');

            // 새로운 뉴스 데이터 생성 (안정적인 폴백 시스템 사용)
            const [koreanNews, worldNews] = await Promise.all([
                fetchKoreanNews(dateObj, selectedLevel),
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
            // 성공적으로 데이터를 가져왔으므로 에러 상태 초기화
            setError(null);
            setLoading(false);
            return summarizedNews;

        } catch (e) {
            console.error("뉴스를 가져오는 데 실패했습니다:", e);
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
                // 폴백 데이터를 반환할 때는 에러 상태를 초기화
                setError(null);
                return fallbackNews;
            } catch (fallbackError) {
                console.error('폴백 뉴스 생성도 실패:', fallbackError);
                setError("뉴스를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
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

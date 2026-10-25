// 뉴스 언어 처리 순수 함수 모음.
// React/브라우저 API에 의존하지 않으므로 Node 스크립트에서도 그대로 import 할 수 있습니다.

// 한글 음절(U+AC00–U+D7A3), 한글 자모(U+1100–U+11FF, U+3130–U+318F)만 판정합니다.
// '|' 같은 정규식 메타 문자는 한글로 취급하지 않습니다.
const HANGUL_PATTERN = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/;

export function containsHangul(text) {
    if (typeof text !== 'string') return false;
    return HANGUL_PATTERN.test(text);
}

// 제목이나 요약이 비어 있거나 한글이 섞여 있으면 영어로 다시 써야 합니다.
export function needsEnglishRewrite(item) {
    if (!item || typeof item !== 'object') return true;

    const { title, summary } = item;
    if (typeof title !== 'string' || !title.trim()) return true;
    if (typeof summary !== 'string' || !summary.trim()) return true;

    return containsHangul(title) || containsHangul(summary);
}

// 기존 summaryPrompt 를 옮긴 프롬프트 빌더.
// sourceLanguage === 'ko' 일 때만 한국어 원문 전용 지시와 "title" 출력 필드를 추가합니다.
// world 뉴스('en' 또는 생략)의 프롬프트 내용·출력 형식은 기존과 동일하게 유지합니다.
export function buildNewsRewritePrompt({
    title,
    text,
    level,
    verbsList,
    sourceLanguage,
    source,
    date,
} = {}) {
    const isKoreanSource = sourceLanguage === 'ko';
    const safeLevel = typeof level === 'string' && level.trim() ? level : 'B1';
    const safeTitle = typeof title === 'string' ? title : '';
    const safeText = typeof text === 'string' ? text : '';
    const safeSource = typeof source === 'string' ? source : '';
    const safeDate = typeof date === 'string' ? date : '';

    let safeVerbsList = '';
    if (typeof verbsList === 'string') {
        safeVerbsList = verbsList;
    } else if (Array.isArray(verbsList)) {
        safeVerbsList = verbsList.join(', ');
    }

    const koreanSourceInstructions = isKoreanSource
        ? `
LANGUAGE REQUIREMENTS (KOREAN SOURCE ARTICLE):
- The original article above is written in Korean. You MUST translate and rewrite it in English.
- Return an additional "title" field in the JSON with an English headline.
- Never write Hangul (한글) in "title" or "summary" — not a single character. English only.
- Write Korean people, place, and organization names in Romanized/English form (e.g., Seoul, Yonhap News Agency).
- Keep the "English expression: Korean meaning" format for key_points and vocabulary_notes (the meaning may be Korean).
`
        : '';

    const jsonTitleLine = isKoreanSource
        ? `
  "title": "An English headline for the article (English only, no Hangul)",`
        : '';

    const koreanImportantNote = isKoreanSource
        ? `
- "title" and "summary" must contain English only; never use Korean (Hangul) characters there`
        : '';

    return `Rewrite this news article in ${safeLevel} level English for language learners. Write it as an actual news article, not as a summary or explanation.

ORIGINAL ARTICLE:
TITLE: ${safeTitle}
CONTENT: ${safeText}
SOURCE: ${safeSource}
DATE: ${safeDate}
${koreanSourceInstructions}
SUGGESTED PHRASAL VERBS:
The following phrasal verbs are suggested for use in this article: ${safeVerbsList}

REQUIREMENTS:
- Write a complete news article (4-5 paragraphs, 300-400 words) in ${safeLevel} level English
- Write it as if you are a journalist reporting the news directly, not describing what the article says
- Use direct reporting style (e.g., "South Korea announced..." not "The article says that South Korea announced...")
- Include specific details, statistics, and examples from the original article
- Make it engaging and educational for English learners
- Use natural journalistic language appropriate for ${safeLevel} level
- **Please prioritize using the SUGGESTED PHRASAL VERBS provided above ONLY IF they fit the context naturally and can replace a standard verb with a similar meaning. Do not force their use if they don't make sense.**
- Extract 6 phrasal verbs from the rewritten article with Korean meanings. Try to include the suggested verbs you successfully prioritized.
- Extract 4-6 important vocabulary words from the rewritten article with Korean meanings

WRITING STYLE EXAMPLES:
❌ WRONG: "This article discusses..." or "The report examines..." or "The article presents..."
✅ CORRECT: "South Korea announced..." or "A new study shows..." or "Scientists discovered..."

Return ONLY this JSON structure:
{${jsonTitleLine}
  "summary": "Write the complete news article here in ${safeLevel} level English. Write it as an actual news article with direct reporting, not as a summary or explanation of the article.",
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
- Use the suggested phrasal verbs where appropriate and natural${koreanImportantNote}`;
}

// "AI 선생님의 문장 강의" 마크다운을 화면 블록으로 바꿉니다.
// AI 응답 형식이 매번 조금씩 달라서, 마크다운 기호(**, *, `, >, #)는 화면에 남기지 않고
// 굵게 표시만 살립니다. React 없이 테스트할 수 있도록 순수 함수로 둡니다.

// "> * **Original Sentence:** "The new game ..."" 처럼 형식이 바뀌어도 라벨과 문장을 분리합니다.
// 문장이 다음 줄에 오면 캡처가 빈 문자열입니다.
const ORIGINAL_SENTENCE_RE = /^[\s>*\-]*\**\s*Original Sentence\s*(?:\([^)]*\))?\s*\**\s*:?\s*\**\s*(.*)$/i;

// 라벨 없이 > "영어 문장" 인용만 쓰는 응답도 있습니다.
const QUOTED_BLOCK_RE = /^\s*>\s*\**\s*["“]/;
const HANGUL_RE = /[ㄱ-ㆎ가-힣]/;

// 따옴표로 감싼 부분만 꺼냅니다. 뒤에 붙은 마침표나 (한국어 해석)은 버립니다.
export const cleanSentence = (text) => {
  const stripped = text.replace(/^[\s>*\-]+/, '').replace(/\*\*/g, '').trim();
  const quoted = stripped.match(/^["“](.+)["”]/);
  return (quoted ? quoted[1] : stripped).trim();
};

// 문장이 빠진 채 다음 라벨(**Structure & Grammar**: 등)이 오면 문장으로 오인하지 않습니다.
const isLabelLine = (line) => /\*\*[^*]+\*\*\s*:|^[\s>*\-]*\**[A-Za-z &]+\([^)]*\)\s*\**\s*:/.test(line);

const quotedEnglishSentence = (line) => {
  if (!QUOTED_BLOCK_RE.test(line)) return '';
  const sentence = cleanSentence(line);
  return /[A-Za-z]/.test(sentence) && !HANGUL_RE.test(sentence) ? sentence : '';
};

// 굵게(**) 밖의 기호를 지웁니다: `코드`, *기울임*, 짝이 안 맞는 **.
const stripMarks = (text) => text
  .replace(/`([^`]*)`/g, '$1')
  .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1$2')
  .replace(/\*\*/g, '')
  .replace(/`/g, '');

// 한 줄을 [{ text, bold }] 조각으로 나눕니다.
export const parseInline = (text) => {
  const segments = [];
  text.split(/(\*\*[^*]+?\*\*)/).forEach((part) => {
    if (!part) return;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const clean = stripMarks(bold ? part.slice(2, -2) : part);
    if (clean) segments.push({ text: clean, bold });
  });
  return segments;
};

const plainText = (text) => parseInline(text).map((segment) => segment.text).join('').trim();

const BULLET_RE = /^(\s*)(?:[-*+•])\s+(.*)$/;

/**
 * 블록 종류:
 * - { type: 'sentence', sentence }  원문 영어 문장 (스피커 버튼)
 * - { type: 'heading', text }
 * - { type: 'hr' }
 * - { type: 'quote', inline }
 * - { type: 'bullet', inline, depth }  depth 0 또는 1
 * - { type: 'paragraph', inline }
 * - { type: 'blank' }
 */
export const parseLectureMarkdown = (markdown) => {
  if (!markdown) return [];

  const blocks = [];
  let awaitingSentence = false;

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    // Original Sentence: 영어 문장 + 스피커 버튼
    const sentenceMatch = line.match(ORIGINAL_SENTENCE_RE);
    if (sentenceMatch) {
      const sentence = cleanSentence(sentenceMatch[1]);
      if (sentence) blocks.push({ type: 'sentence', sentence });
      else awaitingSentence = true; // 문장이 다음 줄에 오는 형식
      return;
    }
    if (awaitingSentence && trimmed) {
      awaitingSentence = false;
      const sentence = isLabelLine(line) ? '' : cleanSentence(line);
      if (sentence) {
        blocks.push({ type: 'sentence', sentence });
        return;
      }
    }
    const quotedSentence = quotedEnglishSentence(line);
    if (quotedSentence) {
      blocks.push({ type: 'sentence', sentence: quotedSentence });
      return;
    }

    if (!trimmed) {
      blocks.push({ type: 'blank' });
      return;
    }

    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: plainText(heading[1]) });
      return;
    }

    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      return;
    }

    // 줄 전체가 굵게: **첫 번째 문장**, **Key Vocabulary:**
    if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
      blocks.push({ type: 'heading', text: plainText(trimmed) });
      return;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      const inner = quote[1].replace(/^[-*+•]\s+/, '');
      if (inner.trim()) blocks.push({ type: 'quote', inline: parseInline(inner) });
      return;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      blocks.push({ type: 'bullet', depth: bullet[1].length >= 2 ? 1 : 0, inline: parseInline(bullet[2]) });
      return;
    }

    blocks.push({ type: 'paragraph', inline: parseInline(trimmed) });
  });

  return blocks;
};

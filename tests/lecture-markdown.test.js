import { describe, it, expect } from 'vitest';
import { parseLectureMarkdown, parseInline, cleanSentence } from '../src/utils/lectureMarkdown';

const one = (line) => parseLectureMarkdown(line)[0];
const textOf = (block) => block.text ?? block.sentence ?? block.inline.map((s) => s.text).join('');
const SYMBOLS = /\*|`|^#|^>/;

const sample = `### 1. **👋 선생님의 한마디 (Greeting & Brief Summary)**
Hello, my wonderful students! 🌟 **GTA 6** 사전 예약 소식이에요.
---
### 2. **🧐 문장별 집중 분석 (Sentence Analysis)**
**첫 번째 문장**
> **Original Sentence:** "The new game has already broken records, selling more than 10 million copies."
* **Structure & Grammar (구조 및 문법):**
    * 이 문장은 **[주어 + 동사 + 목적어]**의 기본 구조 뒤에 **분사구문(v-ing)**이 붙은 형태예요!
    * \`~ing\`로 시작하는 분사구문은 결과를 나타낼 때 쓴답니다.
* **Interpretation (해석):**
    * *(의미 단위로 끊어서 읽으면 훨씬 쉬워요!)*
* **Key Vocabulary (핵심 단어):**
    * **Phase** [페이즈]: 단계, 국면.
### 3. **💡 오늘의 꿀팁 (Teacher's Tip)**
> **이것만은 꼭 기억하세요!** \`have + p.p.\`는 현재완료예요.`;

describe('parseLectureMarkdown', () => {
  it('제목의 ### 와 ** 기호를 제거한다', () => {
    // 스크린샷: "1. **👋 선생님의 한마디 (...)**"
    expect(one('### 1. **👋 선생님의 한마디 (Greeting & Brief Summary)**')).toStrictEqual(
      { type: 'heading', text: '1. 👋 선생님의 한마디 (Greeting & Brief Summary)' },
    );
    // 줄 전체 굵게 + 뒤 공백 / CRLF (스크린샷: "**첫 번째 문장**"이 그대로 보였음)
    expect(one('**첫 번째 문장**  ')).toStrictEqual({ type: 'heading', text: '첫 번째 문장' });
    expect(parseLectureMarkdown('**두 번째 문장**\r\n')[0]).toStrictEqual({ type: 'heading', text: '두 번째 문장' });
    expect(one('### **첫 번째 문장: 분사구문**')).toStrictEqual({ type: 'heading', text: '첫 번째 문장: 분사구문' });
  });

  it('글머리표·들여쓰기·코드·기울임 기호를 정리한다', () => {
    expect(one('* **Structure & Grammar (구조 및 문법):**')).toStrictEqual({
      type: 'bullet', depth: 0, inline: [{ text: 'Structure & Grammar (구조 및 문법):', bold: true }],
    });
    expect(one('    * `~ing`로 시작하는 분사구문은')).toStrictEqual({
      type: 'bullet', depth: 1, inline: [{ text: '~ing로 시작하는 분사구문은', bold: false }],
    });
    expect(one('- 대시 글머리표').type).toBe('bullet');
    expect(textOf(one('- 대시 글머리표'))).toBe('대시 글머리표');

    expect(textOf(one('* *(의미 단위로 끊어서 읽으면 쉬워요!)*'))).toBe('(의미 단위로 끊어서 읽으면 쉬워요!)');
    expect(parseInline('이 문장은 **[주어 + 동사]**의 구조')).toStrictEqual([
      { text: '이 문장은 ', bold: false }, { text: '[주어 + 동사]', bold: true }, { text: '의 구조', bold: false },
    ]);
    expect(textOf(one('끝에 남은 ** 기호'))).toBe('끝에 남은  기호');
    expect(textOf(one('2 * 3 = 6, file_name_here'))).toBe('2 * 3 = 6, file_name_here');
  });

  it('구분선·인용·빈 줄을 처리한다', () => {
    expect(one('---')).toStrictEqual({ type: 'hr' });
    expect(one('***')).toStrictEqual({ type: 'hr' });

    // 한글 인용: 문장 버튼이 아닌 인용 블록, > 기호 없음
    expect(one('> 이것만은 꼭 기억하세요!')).toStrictEqual({
      type: 'quote', inline: [{ text: '이것만은 꼭 기억하세요!', bold: false }],
    });
    expect(parseLectureMarkdown('>')).toHaveLength(0);

    expect(parseLectureMarkdown('가\n\n나')[1]).toStrictEqual({ type: 'blank' });
    expect(parseLectureMarkdown('')).toStrictEqual([]);
    expect(parseLectureMarkdown(null)).toStrictEqual([]);
  });

  it('원문 문장 세 형식을 sentence 블록으로 만든다', () => {
    expect(one('> **Original Sentence:** "The new game has already broken records."')).toStrictEqual(
      { type: 'sentence', sentence: 'The new game has already broken records.' },
    );
    expect(parseLectureMarkdown('* **Original Sentence**:\n> "Players can now pre-load the game."')).toStrictEqual([
      { type: 'sentence', sentence: 'Players can now pre-load the game.' },
    ]);
    expect(one('> "A major exam in South Korea has sparked a serious debate."')).toStrictEqual(
      { type: 'sentence', sentence: 'A major exam in South Korea has sparked a serious debate.' },
    );
    // 라벨 뒤에 문장이 빠지고 다음 라벨이 오면 문장으로 오인하지 않음
    expect(parseLectureMarkdown('**Original Sentence:**\n* **Structure & Grammar (구조 및 문법):**')[0].type).toBe('bullet');
  });

  it('cleanSentence는 번역·마침표를 제거한다', () => {
    expect(cleanSentence('"It said wow today." (오늘 와우라고 말했다)')).toBe('It said wow today.');
    expect(cleanSentence('“Curly quotes work”.')).toBe('Curly quotes work');
  });

  it('실제 응답 형태 전체에서 화면 텍스트에 기호가 남지 않는다', () => {
    const blocks = parseLectureMarkdown(sample).filter((b) => b.type !== 'hr' && b.type !== 'blank');
    for (const block of blocks) {
      expect(textOf(block)).not.toMatch(SYMBOLS);
    }
    expect(blocks.filter((b) => b.type === 'sentence')).toHaveLength(1);
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(4);
  });
});

import assert from 'node:assert/strict';
import { parseLectureMarkdown, parseInline, cleanSentence } from '../src/utils/lectureMarkdown.js';

const one = (line) => parseLectureMarkdown(line)[0];
const textOf = (block) => block.text ?? block.sentence ?? block.inline.map((s) => s.text).join('');
const SYMBOLS = /\*|`|^#|^>/;

// 제목: ### 와 ** 둘 다 지움 (스크린샷: "1. **👋 선생님의 한마디 (...)**")
assert.deepEqual(one('### 1. **👋 선생님의 한마디 (Greeting & Brief Summary)**'),
  { type: 'heading', text: '1. 👋 선생님의 한마디 (Greeting & Brief Summary)' });
// 줄 전체 굵게 + 뒤 공백 / CRLF (스크린샷: "**첫 번째 문장**"이 그대로 보였음)
assert.deepEqual(one('**첫 번째 문장**  '), { type: 'heading', text: '첫 번째 문장' });
assert.deepEqual(parseLectureMarkdown('**두 번째 문장**\r\n')[0], { type: 'heading', text: '두 번째 문장' });
assert.deepEqual(one('### **첫 번째 문장: 분사구문**'), { type: 'heading', text: '첫 번째 문장: 분사구문' });

// * 글머리표 → 불릿, 라벨은 굵게
assert.deepEqual(one('* **Structure & Grammar (구조 및 문법):**'),
  { type: 'bullet', depth: 0, inline: [{ text: 'Structure & Grammar (구조 및 문법):', bold: true }] });
// 들여쓴 하위 글머리표 + `코드` → 기호 없이
assert.deepEqual(one('    * `~ing`로 시작하는 분사구문은'),
  { type: 'bullet', depth: 1, inline: [{ text: '~ing로 시작하는 분사구문은', bold: false }] });
assert.equal(one('- 대시 글머리표').type, 'bullet');
assert.equal(textOf(one('- 대시 글머리표')), '대시 글머리표');

// *기울임* 기호 제거
assert.equal(textOf(one('* *(의미 단위로 끊어서 읽으면 쉬워요!)*')), '(의미 단위로 끊어서 읽으면 쉬워요!)');
// 문단 안 굵게는 살리고 기호만 제거
assert.deepEqual(parseInline('이 문장은 **[주어 + 동사]**의 구조'),
  [{ text: '이 문장은 ', bold: false }, { text: '[주어 + 동사]', bold: true }, { text: '의 구조', bold: false }]);
// 짝이 안 맞는 ** 는 지움
assert.equal(textOf(one('끝에 남은 ** 기호')), '끝에 남은  기호');
// 곱셈처럼 띄어 쓴 * 하나, snake_case 는 건드리지 않음
assert.equal(textOf(one('2 * 3 = 6, file_name_here')), '2 * 3 = 6, file_name_here');

// 구분선
assert.deepEqual(one('---'), { type: 'hr' });
assert.deepEqual(one('***'), { type: 'hr' });

// 한글 인용: 문장 버튼이 아닌 인용 블록, > 기호 없음
assert.deepEqual(one('> 이것만은 꼭 기억하세요!'), { type: 'quote', inline: [{ text: '이것만은 꼭 기억하세요!', bold: false }] });
// 빈 인용 줄은 버림
assert.equal(parseLectureMarkdown('>').length, 0);

// 원문 문장 세 형식 (버튼용 sentence 블록)
assert.deepEqual(one('> **Original Sentence:** "The new game has already broken records."'),
  { type: 'sentence', sentence: 'The new game has already broken records.' });
assert.deepEqual(parseLectureMarkdown('* **Original Sentence**:\n> "Players can now pre-load the game."'),
  [{ type: 'sentence', sentence: 'Players can now pre-load the game.' }]);
assert.deepEqual(one('> "A major exam in South Korea has sparked a serious debate."'),
  { type: 'sentence', sentence: 'A major exam in South Korea has sparked a serious debate.' });
// 라벨 뒤에 문장이 빠지고 다음 라벨이 오면 문장으로 오인하지 않음
assert.equal(parseLectureMarkdown('**Original Sentence:**\n* **Structure & Grammar (구조 및 문법):**')[0].type, 'bullet');
// 문장 뒤 (한국어 해석)·마침표는 버림
assert.equal(cleanSentence('"It said wow today." (오늘 와우라고 말했다)'), 'It said wow today.');
assert.equal(cleanSentence('“Curly quotes work”.'), 'Curly quotes work');

// 빈 줄 / 빈 입력
assert.deepEqual(parseLectureMarkdown('가\n\n나')[1], { type: 'blank' });
assert.deepEqual(parseLectureMarkdown(''), []);
assert.deepEqual(parseLectureMarkdown(null), []);

// 실제 응답 형태 전체에서 화면 텍스트에 기호가 남지 않음
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
const blocks = parseLectureMarkdown(sample).filter((b) => b.type !== 'hr' && b.type !== 'blank');
for (const block of blocks) {
  assert.doesNotMatch(textOf(block), SYMBOLS, `기호가 남음: ${JSON.stringify(block)}`);
}
assert.equal(blocks.filter((b) => b.type === 'sentence').length, 1);
assert.equal(blocks.filter((b) => b.type === 'heading').length, 4);

console.log('lecture markdown tests passed');

// AI 구동사 상세 생성 결과 검증(regExp/sanitize) 회귀 테스트.
import { describe, it, expect } from 'vitest';
import { verbFormRegex, sanitizeEntry } from '../src/utils/verbDetailService';

const validExamples = [
  ['be fed up with', 'I am fed up with the noise.'],
  ['be fed up with', 'She was fed up with his excuses.'],
  ['be fed up with', 'They are fed up with waiting.'],
  ['be fed up with', 'We have been fed up with the delays.'],
  ['see off', 'We saw them off at the station.'],
  ['see off', 'I am seeing them off tomorrow.'],
  ['have on', 'She had on a red coat.'],
  ['deal with', 'I dealt with the issue quickly.'],
  ['eat out', 'We ate out last night.'],
  ['sleep in', 'I slept in on Sunday.'],
  ['get together', 'We got together yesterday.'],
  ['get together', 'We are getting together soon.'],
  ['get together', 'We get together every summer.'],
  ['look into', 'We looked into the problem.'],
  ['write down', 'She wrote down the address.'],
];

const nuance = '갑작스럽고 예상치 못한 부족함과 답답함이 섞인 뉘앙스입니다.';
const usage = '더 이상 참을 수 없을 정도로 지쳤을 때 사용하는 표현입니다.';

describe('verbDetailService', () => {
  it('정상 예문을 기각하지 않는다', () => {
    for (const [verb, example] of validExamples) {
      expect(verbFormRegex(verb).test(example)).toBe(true);
    }
  });

  it('구동사와 무관한 예문은 기각한다', () => {
    expect(verbFormRegex('be fed up with').test('I enjoy the quiet sunshine.')).toBe(false);
  });

  it('sanitizeEntry는 불규칙 활용형 예문 3개를 보존한다', () => {
    const entry = sanitizeEntry({
      nuance,
      usage,
      examples: [
        'I am fed up with the noise.',
        'She was fed up with his excuses.',
        'They are fed up with waiting.',
      ],
    }, 'be fed up with');
    expect(entry).toBeTruthy();
    expect(entry.situations).toHaveLength(3);
  });

  it('sanitizeEntry는 무관한 예문만 있으면 null을 반환한다', () => {
    expect(sanitizeEntry({ nuance, usage, examples: ['I enjoy the sunshine.'] }, 'be fed up with')).toBeNull();
  });
});

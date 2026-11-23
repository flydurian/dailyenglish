import { describe, it, expect } from 'vitest';
import {
  tokenizeTarget,
  normalizeWord,
  isWordMatch,
  scoreSpeech,
} from '../src/utils/speechScoring.ts';

describe('tokenizeTarget', () => {
  it('**구동사** 마크다운을 벗기고 강조 여부를 보존한다', () => {
    expect(tokenizeTarget('I **looked after** the kids.')).toStrictEqual([
      { display: 'I', bold: false },
      { display: 'looked', bold: true },
      { display: 'after', bold: true },
      { display: 'the', bold: false },
      { display: 'kids.', bold: false },
    ]);
  });
});

describe('normalizeWord / isWordMatch', () => {
  it('대소문자와 문장부호를 무시한다', () => {
    expect(normalizeWord('Kids!')).toBe('kids');
    expect(isWordMatch('take', 'Take,')).toBe(true);
    // 음성 인식은 흔히 아포스트로피를 생략하므로 이 정도 차이는 인정합니다.
    expect(isWordMatch("don't", 'DONT')).toBe(true);
  });

  it('긴 단어의 사소한 오타/인식 오차는 인정하되 짧은 단어의 혼동은 인정하지 않는다', () => {
    expect(isWordMatch('beautiful', 'beatiful')).toBe(true);
    expect(isWordMatch('take', 'make')).toBe(false);
    expect(isWordMatch('after', 'after')).toBe(true);
  });
});

describe('scoreSpeech', () => {
  it('완전히 같은 문장은 100점, 전부 정답', () => {
    const result = scoreSpeech('Take off your coat.', 'take off your coat');
    expect(result.accuracy).toBe(100);
    expect(result.correct).toBe(4);
    expect(result.wrong).toBe(0);
    expect(result.missed).toBe(0);
    expect(result.words.every((w) => w.status === 'correct')).toBe(true);
  });

  it('마크다운과 문장부호가 있어도 단어별로 채점한다', () => {
    const result = scoreSpeech('I **looked after** the kids.', 'I looked after the kids');
    expect(result.accuracy).toBe(100);
    expect(result.words.map((w) => w.bold)).toStrictEqual([false, true, true, false, false]);
  });

  it('빠진 단어는 missed, 다르게 인식된 단어는 wrong으로 표시한다', () => {
    const result = scoreSpeech('Please turn off the light', 'please turn of the light');
    expect(result.correct).toBe(4);
    expect(result.wrong).toBe(1);
    expect(result.missed).toBe(0);
    expect(result.words[2].status).toBe('wrong');
    expect(result.words[2].heard).toBe('of');
  });

  it('인식 결과가 없으면 전부 missed', () => {
    const result = scoreSpeech('Take off your coat', '');
    expect(result.accuracy).toBe(0);
    expect(result.total).toBe(4);
    expect(result.words.every((w) => w.status === 'missed')).toBe(true);
  });

  it('인식 결과에만 있는 여분 단어는 점수에 반영하지 않는다', () => {
    const result = scoreSpeech('Take off', 'um take off please');
    expect(result.accuracy).toBe(100);
    expect(result.words).toHaveLength(2);
  });

  it('단어 순서가 바뀌면 정렬을 통해 정답을 최대한 찾는다', () => {
    const result = scoreSpeech('turn the light off', 'turn off the light');
    // 순서를 유지하며 정렬하므로 'turn', 'the', 'light' 3개가 정답이고 마지막 'off'는 놓침 처리됩니다.
    expect(result.correct).toBe(3);
    expect(result.missed).toBe(1);
    expect(result.accuracy).toBe(75);
  });

  it('들린 내용(transcript)을 그대로 보관한다', () => {
    const result = scoreSpeech('Take off', '  take   off  ');
    expect(result.transcript).toBe('take   off');
  });
});

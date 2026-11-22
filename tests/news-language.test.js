import { describe, it, expect } from 'vitest';
import {
  containsHangul,
  needsEnglishRewrite,
  buildNewsRewritePrompt,
} from '../src/utils/newsLanguage.js';

describe('containsHangul', () => {
  it('한글 음절/자모를 감지하고 영어·숫자·기호·비문자열은 감지하지 않는다', () => {
    expect(containsHangul('한국 뉴스')).toBe(true);
    expect(containsHangul('ㄱ')).toBe(true);
    expect(containsHangul('ㅏ')).toBe(true);
    expect(containsHangul('ㅠㅠ')).toBe(true);
    expect(containsHangul('가나다')).toBe(true);
    expect(containsHangul('Hello world')).toBe(false);
    expect(containsHangul('Breaking news 2026')).toBe(false);
    expect(containsHangul('12345 !?')).toBe(false);
    expect(containsHangul('a | b')).toBe(false);
    expect(containsHangul('')).toBe(false);
    expect(containsHangul(null)).toBe(false);
    expect(containsHangul(undefined)).toBe(false);
    expect(containsHangul(123)).toBe(false);
    expect(containsHangul({ title: '한국' })).toBe(false);
    expect(containsHangul(['한국'])).toBe(false);
  });

  it('유니코드 범위 경계값을 구분한다', () => {
    // 음절 U+AC00–U+D7A3, 자모 U+1100–U+11FF / U+3130–U+318F
    expect(containsHangul('\uAC00')).toBe(true);
    expect(containsHangul('\uD7A3')).toBe(true);
    expect(containsHangul('\u1100')).toBe(true);
    expect(containsHangul('\u11FF')).toBe(true);
    expect(containsHangul('\u3130')).toBe(true);
    expect(containsHangul('\u318F')).toBe(true);
    expect(containsHangul('\uD7A4')).toBe(false);
  });
});

describe('needsEnglishRewrite', () => {
  it('한글/빈 값은 재작성 대상, 정상 영어는 대상이 아니다', () => {
    expect(needsEnglishRewrite(null)).toBe(true);
    expect(needsEnglishRewrite(undefined)).toBe(true);
    expect(needsEnglishRewrite({})).toBe(true);
    expect(needsEnglishRewrite({ title: '한국 뉴스 제목', summary: 'English body' })).toBe(true);
    expect(needsEnglishRewrite({ title: 'English title', summary: '한국어 요약' })).toBe(true);
    expect(needsEnglishRewrite({ title: '', summary: 'English body' })).toBe(true);
    expect(needsEnglishRewrite({ title: '   ', summary: 'English body' })).toBe(true);
    expect(needsEnglishRewrite({ title: 'English title', summary: '' })).toBe(true);
    expect(needsEnglishRewrite({ title: 'English title' })).toBe(true);
    expect(needsEnglishRewrite({ summary: 'English body' })).toBe(true);
    expect(needsEnglishRewrite({ title: 'Seoul announces new policy', summary: 'The city said...' })).toBe(false);
  });
});

describe('buildNewsRewritePrompt', () => {
  it('ko 프롬프트에 레벨·title 필드·한글 금지·한국어 원문 지시가 포함된다', () => {
    const koreanPrompt = buildNewsRewritePrompt({
      title: '한국, 새로운 정책 발표',
      text: '한국 정부는 새로운 정책을 발표했다.',
      level: 'B1',
      verbsList: 'take off (이륙하다), look into (조사하다)',
      sourceLanguage: 'ko',
      source: 'Yonhap News Agency',
      date: '2026-10-25',
    });

    expect(koreanPrompt).toContain('B1');
    expect(koreanPrompt).toContain('"title"');
    expect(koreanPrompt).toMatch(/Hangul|한글/);
    expect(koreanPrompt).toMatch(/original article above is written in Korean|Korean source/i);
    expect(koreanPrompt).toContain('Seoul');
    expect(koreanPrompt).toContain('Yonhap News Agency');
    expect(koreanPrompt).toContain('key_points');
    expect(koreanPrompt).toContain('vocabulary_notes');
    expect(koreanPrompt).toContain('Korean meaning');
  });

  it('world 프롬프트는 기존 형식을 유지하고 한국어 전용 지시가 없다', () => {
    const worldPrompt = buildNewsRewritePrompt({
      title: 'Global markets rally on economic data',
      text: 'Markets rose on Tuesday as investors reacted to new data.',
      level: 'B2',
      verbsList: 'take off (depart), look into (investigate)',
      sourceLanguage: 'en',
      source: 'Reuters',
      date: '2026-10-25',
    });

    expect(worldPrompt).toContain('B2');
    expect(worldPrompt.includes('"title"')).toBe(false);
    expect(worldPrompt).not.toMatch(/"title"\s*:/);
    expect(worldPrompt).not.toMatch(/KOREAN SOURCE|written in Korean|한글|Hangul/i);
    expect(worldPrompt).toContain('"summary"');
    expect(worldPrompt).toContain('"key_points"');
    expect(worldPrompt).toContain('"vocabulary_notes"');
  });

  it('sourceLanguage 생략 시 world 프롬프트와 동일하게 동작한다', () => {
    const defaultPrompt = buildNewsRewritePrompt({
      title: 'Global markets rally on economic data',
      text: 'Markets rose on Tuesday.',
      level: 'B2',
      verbsList: 'take off (depart)',
    });
    expect(defaultPrompt).not.toMatch(/"title"\s*:/);
  });
});

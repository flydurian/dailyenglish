import assert from 'node:assert/strict';
import {
    containsHangul,
    needsEnglishRewrite,
    buildNewsRewritePrompt,
} from '../src/utils/newsLanguage.js';

// containsHangul: 한글 음절 / 자모 / 영어 / 숫자 / '|' 문자 / 비문자열
assert.equal(containsHangul('한국 뉴스'), true);
assert.equal(containsHangul('ㄱ'), true);
assert.equal(containsHangul('ㅏ'), true);
assert.equal(containsHangul('ㅠㅠ'), true);
assert.equal(containsHangul('가나다'), true);
assert.equal(containsHangul('Hello world'), false);
assert.equal(containsHangul('Breaking news 2026'), false);
assert.equal(containsHangul('12345 !?'), false);
assert.equal(containsHangul('a | b'), false);
assert.equal(containsHangul(''), false);
assert.equal(containsHangul(null), false);
assert.equal(containsHangul(undefined), false);
assert.equal(containsHangul(123), false);
assert.equal(containsHangul({ title: '한국' }), false);
assert.equal(containsHangul(['한국']), false);

// 범위 경계값 (음절 U+AC00–U+D7A3, 자모 U+1100–U+11FF / U+3130–U+318F)
assert.equal(containsHangul('\uAC00'), true);
assert.equal(containsHangul('\uD7A3'), true);
assert.equal(containsHangul('\u1100'), true);
assert.equal(containsHangul('\u11FF'), true);
assert.equal(containsHangul('\u3130'), true);
assert.equal(containsHangul('\u318F'), true);
assert.equal(containsHangul('\uD7A4'), false);

// needsEnglishRewrite: 한글 title / 한글 summary / 빈 값 / 정상 영어 / null
assert.equal(needsEnglishRewrite(null), true);
assert.equal(needsEnglishRewrite(undefined), true);
assert.equal(needsEnglishRewrite({}), true);
assert.equal(needsEnglishRewrite({ title: '한국 뉴스 제목', summary: 'English body' }), true);
assert.equal(needsEnglishRewrite({ title: 'English title', summary: '한국어 요약' }), true);
assert.equal(needsEnglishRewrite({ title: '', summary: 'English body' }), true);
assert.equal(needsEnglishRewrite({ title: '   ', summary: 'English body' }), true);
assert.equal(needsEnglishRewrite({ title: 'English title', summary: '' }), true);
assert.equal(needsEnglishRewrite({ title: 'English title' }), true);
assert.equal(needsEnglishRewrite({ summary: 'English body' }), true);
assert.equal(needsEnglishRewrite({ title: 'Seoul announces new policy', summary: 'The city said...' }), false);

// buildNewsRewritePrompt('ko'): 레벨, "title" 필드, 한글 금지, 한국어 원문 지시 포함
const koreanPrompt = buildNewsRewritePrompt({
    title: '한국, 새로운 정책 발표',
    text: '한국 정부는 새로운 정책을 발표했다.',
    level: 'B1',
    verbsList: 'take off (이륙하다), look into (조사하다)',
    sourceLanguage: 'ko',
    source: 'Yonhap News Agency',
    date: '2026-10-25',
});

assert.ok(koreanPrompt.includes('B1'), 'ko 프롬프트에 레벨이 포함되어야 합니다.');
assert.ok(koreanPrompt.includes('"title"'), 'ko 프롬프트에 "title" 필드 요구가 있어야 합니다.');
assert.ok(/Hangul|한글/.test(koreanPrompt), 'ko 프롬프트에 한글 금지 지시가 있어야 합니다.');
assert.ok(
    /original article above is written in Korean|Korean source/i.test(koreanPrompt),
    'ko 프롬프트에 한국어 원문이라는 지시가 있어야 합니다.',
);
assert.ok(koreanPrompt.includes('Seoul'), 'ko 프롬프트에 로마자 지명 예시가 있어야 합니다.');
assert.ok(koreanPrompt.includes('Yonhap News Agency'), 'ko 프롬프트에 로마자 기관명 예시가 있어야 합니다.');
assert.ok(koreanPrompt.includes('key_points') && koreanPrompt.includes('vocabulary_notes'));
assert.ok(koreanPrompt.includes('Korean meaning'), '구동사/단어 뜻 형식은 유지되어야 합니다.');

// world 프롬프트: 기존 형식 유지, 한국어 전용 지시 없음
const worldPrompt = buildNewsRewritePrompt({
    title: 'Global markets rally on economic data',
    text: 'Markets rose on Tuesday as investors reacted to new data.',
    level: 'B2',
    verbsList: 'take off (depart), look into (investigate)',
    sourceLanguage: 'en',
    source: 'Reuters',
    date: '2026-10-25',
});

assert.ok(worldPrompt.includes('B2'), 'world 프롬프트에 레벨이 포함되어야 합니다.');
assert.equal(worldPrompt.includes('"title"'), false, 'world 프롬프트에는 title 필드가 없어야 합니다.');
assert.equal(/"title"\s*:/.test(worldPrompt), false);
assert.equal(/KOREAN SOURCE|written in Korean|한글|Hangul/i.test(worldPrompt), false, 'world 프롬프트에는 한국어 전용 지시가 없어야 합니다.');
assert.ok(worldPrompt.includes('"summary"'));
assert.ok(worldPrompt.includes('"key_points"'));
assert.ok(worldPrompt.includes('"vocabulary_notes"'));

// sourceLanguage 생략 시에도 world와 동일하게 동작
const defaultPrompt = buildNewsRewritePrompt({
    title: 'Global markets rally on economic data',
    text: 'Markets rose on Tuesday.',
    level: 'B2',
    verbsList: 'take off (depart)',
});
assert.equal(/"title"\s*:/.test(defaultPrompt), false);

console.log('news language tests passed');

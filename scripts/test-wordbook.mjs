import assert from 'node:assert/strict';
import { sanitizeWordbookItems } from '../src/utils/wordbookUtils.js';
import { toLocalDateKey } from '../src/utils/dateUtils.js';

const isValidIsoString = (value) => (
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

// 배열이 아니면 항상 빈 배열
for (const raw of [undefined, null, {}, 'wordbook', 42]) {
  assert.deepEqual(sanitizeWordbookItems(raw), []);
}

// 객체가 아니거나 term이 유효하지 않은 항목은 제거
assert.deepEqual(sanitizeWordbookItems([
  null,
  42,
  'phrasal:take off',
  [],
  { meaning: 'term 없음' },
  { term: 123 },
  { term: '   ' },
]), []);

// 정상 항목은 값을 보존하고, id/type은 정규화
const [normalized] = sanitizeWordbookItems([{
  id: 'legacy-id',
  type: 'expression',
  term: 'Take Off',
  meaning: '이륙하다',
  example: 'The plane took off.',
  addedAt: '2026-01-02T03:04:05.000Z',
  srs: { box: 3, nextReview: '2030-01-02', reviewCount: 7, lastReviewed: '2029-12-31' },
}]);

assert.deepEqual(normalized, {
  id: 'phrasal:take off',
  type: 'phrasal',
  term: 'Take Off',
  meaning: '이륙하다',
  example: 'The plane took off.',
  addedAt: '2026-01-02T03:04:05.000Z',
  srs: { box: 3, nextReview: '2030-01-02', reviewCount: 7, lastReviewed: '2029-12-31' },
});

// word 타입은 유지, 앞뒤 공백/대소문자는 id에서 정규화
const [wordItem] = sanitizeWordbookItems([{
  type: 'word',
  term: '  LOOK UP  ',
  meaning: '찾아보다',
  example: 'Look it up.',
  addedAt: '2026-02-03T00:00:00.000Z',
  srs: { box: 5, nextReview: '2031-12-31', reviewCount: 0, lastReviewed: '2031-12-30' },
}]);

assert.equal(wordItem.type, 'word');
assert.equal(wordItem.id, 'word:look up');
assert.equal(wordItem.term, '  LOOK UP  ');
assert.deepEqual(wordItem.srs, {
  box: 5,
  nextReview: '2031-12-31',
  reviewCount: 0,
  lastReviewed: '2031-12-30',
});

// 같은 id는 처음 항목만 유지하고 순서는 그대로
const deduped = sanitizeWordbookItems([
  { term: 'Take Off', type: 'phrasal', meaning: '첫 번째' },
  { term: 'take off', type: 'phrasal', meaning: '두 번째' },
  { term: 'look up', type: 'word', meaning: '찾아보다' },
]);

assert.equal(deduped.length, 2);
assert.deepEqual(deduped.map((item) => item.id), ['phrasal:take off', 'word:look up']);
assert.equal(deduped[0].meaning, '첫 번째');

// srs 누락/깨짐/배열은 기본값으로 보정
const brokenSrsItems = sanitizeWordbookItems([
  { term: 'no srs' },
  { term: 'null srs', srs: null },
  { term: 'array srs', srs: [] },
  {
    term: 'broken srs',
    srs: { box: 9, nextReview: '2030-1-2', reviewCount: -1, lastReviewed: 'yesterday' },
  },
]);

assert.equal(brokenSrsItems.length, 4);
for (const item of brokenSrsItems) {
  assert.deepEqual(item.srs, {
    box: 1,
    nextReview: toLocalDateKey(),
    reviewCount: 0,
    lastReviewed: null,
  });
}

// 문자열이 아닌 meaning/example, addedAt 누락도 안전한 기본값으로 보정
const fallbackFields = sanitizeWordbookItems([{
  term: 'fallback',
  type: 'word',
  meaning: 123,
  example: { text: 'nope' },
  addedAt: null,
  srs: {},
}])[0];

assert.equal(fallbackFields.meaning, '');
assert.equal(fallbackFields.example, '');
assert.ok(isValidIsoString(fallbackFields.addedAt));
assert.equal(fallbackFields.srs.box, 1);
assert.equal(fallbackFields.srs.nextReview, toLocalDateKey());
assert.equal(fallbackFields.srs.reviewCount, 0);
assert.equal(fallbackFields.srs.lastReviewed, null);

console.log('wordbook tests passed');

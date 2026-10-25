import assert from 'node:assert/strict';
import {
  BOX_INTERVALS,
  addDays,
  isDue,
  getDueItems,
  gradeItem,
  getNextDueDate,
} from '../src/utils/srs.js';

const TODAY = '2026-10-25';

assert.deepEqual(BOX_INTERVALS, { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });

// addDays: 월/연도/윤년 경계
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(addDays('2026-02-28', 1), '2026-03-01');
assert.equal(addDays('2028-02-28', 1), '2028-02-29');
assert.equal(addDays('2026-10-25', 14), '2026-11-08');
assert.equal(addDays('2026-01-01', -1), '2025-12-31');

// isDue: srs 없음/과거/오늘은 대상, 미래는 제외
assert.equal(isDue({}, TODAY), true);
assert.equal(isDue({ srs: { nextReview: '2026-10-24' } }, TODAY), true);
assert.equal(isDue({ srs: { nextReview: TODAY } }, TODAY), true);
assert.equal(isDue({ srs: { nextReview: '2026-10-26' } }, TODAY), false);

// getDueItems: 필터 + srs 없는 항목 맨 앞 + nextReview 오름차순
const dueSource = [
  { id: 'future', srs: { nextReview: '2026-10-27' } },
  { id: 'today', srs: { nextReview: TODAY } },
  { id: 'none' },
  { id: 'past', srs: { nextReview: '2026-10-20' } },
];
assert.deepEqual(
  getDueItems(dueSource, TODAY).map((item) => item.id),
  ['none', 'past', 'today'],
);
assert.deepEqual(
  dueSource.map((item) => item.id),
  ['future', 'today', 'none', 'past'],
);

// 승급: box 1 -> 2, +2일
const promotionBase = {
  id: 'phrasal:take off',
  term: 'take off',
  srs: { box: 1, nextReview: TODAY, reviewCount: 2, lastReviewed: '2026-10-20' },
};
const promoted = gradeItem(promotionBase, true, TODAY);
assert.deepEqual(promoted, {
  box: 2,
  nextReview: addDays(TODAY, 2),
  reviewCount: 3,
  lastReviewed: TODAY,
});
assert.deepEqual(promotionBase.srs, {
  box: 1,
  nextReview: TODAY,
  reviewCount: 2,
  lastReviewed: '2026-10-20',
});

// 최대 box 5 유지, +14일
const maxed = gradeItem(
  { id: 'max', srs: { box: 5, nextReview: TODAY, reviewCount: 9, lastReviewed: null } },
  true,
  TODAY,
);
assert.deepEqual(maxed, {
  box: 5,
  nextReview: addDays(TODAY, 14),
  reviewCount: 10,
  lastReviewed: TODAY,
});

// 모르면 box 1로 강등, +1일
const demoted = gradeItem(
  { id: 'demote', srs: { box: 4, nextReview: TODAY, reviewCount: 5, lastReviewed: '2026-10-20' } },
  false,
  TODAY,
);
assert.deepEqual(demoted, {
  box: 1,
  nextReview: addDays(TODAY, 1),
  reviewCount: 6,
  lastReviewed: TODAY,
});

// srs 없이 시작: box 1, reviewCount 0에서 출발
assert.deepEqual(gradeItem({ id: 'fresh-known' }, true, TODAY), {
  box: 2,
  nextReview: addDays(TODAY, 2),
  reviewCount: 1,
  lastReviewed: TODAY,
});
assert.deepEqual(gradeItem({ id: 'fresh-again' }, false, TODAY), {
  box: 1,
  nextReview: addDays(TODAY, 1),
  reviewCount: 1,
  lastReviewed: TODAY,
});

// gradeItem은 원본 item을 변경하지 않음 (동결 객체에서도 동작)
const frozenItem = Object.freeze({
  id: 'frozen',
  term: 'look up',
  srs: Object.freeze({
    box: 3,
    nextReview: TODAY,
    reviewCount: 4,
    lastReviewed: '2026-10-20',
  }),
});
assert.doesNotThrow(() => gradeItem(frozenItem, true, TODAY));
assert.deepEqual(frozenItem.srs, {
  box: 3,
  nextReview: TODAY,
  reviewCount: 4,
  lastReviewed: '2026-10-20',
});

// getNextDueDate: 가장 이른 nextReview, 없으면 null
assert.equal(getNextDueDate([
  { srs: { nextReview: '2026-11-02' } },
  { srs: { nextReview: '2026-10-30' } },
  { id: 'none' },
]), '2026-10-30');
assert.equal(getNextDueDate([]), null);
assert.equal(getNextDueDate([{ id: 'none' }]), null);

console.log('srs tests passed');

import { describe, it, expect } from 'vitest';
import {
  BOX_INTERVALS,
  addDays,
  isDue,
  getDueItems,
  gradeItem,
  getNextDueDate,
} from '../src/utils/srs';

const TODAY = '2026-10-25';

describe('srs 기본 계산', () => {
  it('box 간격이 정의되어 있다', () => {
    expect(BOX_INTERVALS).toStrictEqual({ 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });
  });

  it('addDays는 월/연도/윤년 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('isDue / getDueItems', () => {
  it('srs 없음/과거/오늘은 대상, 미래는 제외한다', () => {
    expect(isDue({}, TODAY)).toBe(true);
    expect(isDue({ srs: { nextReview: '2026-10-24' } }, TODAY)).toBe(true);
    expect(isDue({ srs: { nextReview: TODAY } }, TODAY)).toBe(true);
    expect(isDue({ srs: { nextReview: '2026-10-26' } }, TODAY)).toBe(false);
  });

  it('srs 없는 항목 맨 앞 + nextReview 오름차순으로 정렬하고 원본은 유지한다', () => {
    const dueSource = [
      { id: 'future', srs: { nextReview: '2026-10-27' } },
      { id: 'today', srs: { nextReview: TODAY } },
      { id: 'none' },
      { id: 'past', srs: { nextReview: '2026-10-20' } },
    ];
    expect(getDueItems(dueSource, TODAY).map((item) => item.id)).toStrictEqual(['none', 'past', 'today']);
    expect(dueSource.map((item) => item.id)).toStrictEqual(['future', 'today', 'none', 'past']);
  });
});

describe('gradeItem', () => {
  it('정답이면 승급하고 원본은 변경하지 않는다', () => {
    const promotionBase = {
      id: 'phrasal:take off',
      term: 'take off',
      srs: { box: 1, nextReview: TODAY, reviewCount: 2, lastReviewed: '2026-10-20' },
    };
    const promoted = gradeItem(promotionBase, true, TODAY);
    expect(promoted).toStrictEqual({
      box: 2,
      nextReview: addDays(TODAY, 2),
      reviewCount: 3,
      lastReviewed: TODAY,
    });
    expect(promotionBase.srs).toStrictEqual({
      box: 1,
      nextReview: TODAY,
      reviewCount: 2,
      lastReviewed: '2026-10-20',
    });
  });

  it('최대 box 5를 유지한다', () => {
    expect(gradeItem(
      { id: 'max', srs: { box: 5, nextReview: TODAY, reviewCount: 9, lastReviewed: null } },
      true,
      TODAY,
    )).toStrictEqual({
      box: 5,
      nextReview: addDays(TODAY, 14),
      reviewCount: 10,
      lastReviewed: TODAY,
    });
  });

  it('오답이면 box 1로 강등한다', () => {
    expect(gradeItem(
      { id: 'demote', srs: { box: 4, nextReview: TODAY, reviewCount: 5, lastReviewed: '2026-10-20' } },
      false,
      TODAY,
    )).toStrictEqual({
      box: 1,
      nextReview: addDays(TODAY, 1),
      reviewCount: 6,
      lastReviewed: TODAY,
    });
  });

  it('srs 없이 시작하면 box 1, reviewCount 0에서 출발한다', () => {
    expect(gradeItem({ id: 'fresh-known' }, true, TODAY)).toStrictEqual({
      box: 2,
      nextReview: addDays(TODAY, 2),
      reviewCount: 1,
      lastReviewed: TODAY,
    });
    expect(gradeItem({ id: 'fresh-again' }, false, TODAY)).toStrictEqual({
      box: 1,
      nextReview: addDays(TODAY, 1),
      reviewCount: 1,
      lastReviewed: TODAY,
    });
  });

  it('동결된 객체에서도 동작한다', () => {
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
    expect(() => gradeItem(frozenItem, true, TODAY)).not.toThrow();
    expect(frozenItem.srs).toStrictEqual({
      box: 3,
      nextReview: TODAY,
      reviewCount: 4,
      lastReviewed: '2026-10-20',
    });
  });
});

describe('getNextDueDate', () => {
  it('가장 이른 nextReview를 반환하고 없으면 null이다', () => {
    expect(getNextDueDate([
      { srs: { nextReview: '2026-11-02' } },
      { srs: { nextReview: '2026-10-30' } },
      { id: 'none' },
    ])).toBe('2026-10-30');
    expect(getNextDueDate([])).toBeNull();
    expect(getNextDueDate([{ id: 'none' }])).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { sanitizeWordbookItems } from '../src/utils/wordbookUtils';
import { toLocalDateKey } from '../src/utils/dateUtils';

const isValidIsoString = (value) => (
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

describe('sanitizeWordbookItems', () => {
  it('배열이 아니면 항상 빈 배열을 반환한다', () => {
    for (const raw of [undefined, null, {}, 'wordbook', 42]) {
      expect(sanitizeWordbookItems(raw)).toStrictEqual([]);
    }
  });

  it('객체가 아니거나 term이 유효하지 않은 항목은 제거한다', () => {
    expect(sanitizeWordbookItems([
      null,
      42,
      'phrasal:take off',
      [],
      { meaning: 'term 없음' },
      { term: 123 },
      { term: '   ' },
    ])).toStrictEqual([]);
  });

  it('정상 항목은 값을 보존하고 id/type은 정규화한다', () => {
    const [normalized] = sanitizeWordbookItems([{
      id: 'legacy-id',
      type: 'expression',
      term: 'Take Off',
      meaning: '이륙하다',
      example: 'The plane took off.',
      addedAt: '2026-01-02T03:04:05.000Z',
      srs: { box: 3, nextReview: '2030-01-02', reviewCount: 7, lastReviewed: '2029-12-31' },
    }]);

    expect(normalized).toStrictEqual({
      id: 'phrasal:take off',
      type: 'phrasal',
      term: 'Take Off',
      meaning: '이륙하다',
      example: 'The plane took off.',
      addedAt: '2026-01-02T03:04:05.000Z',
      srs: { box: 3, nextReview: '2030-01-02', reviewCount: 7, lastReviewed: '2029-12-31' },
    });
  });

  it('word 타입은 유지하고 앞뒤 공백/대소문자는 id에서 정규화한다', () => {
    const [wordItem] = sanitizeWordbookItems([{
      type: 'word',
      term: '  LOOK UP  ',
      meaning: '찾아보다',
      example: 'Look it up.',
      addedAt: '2026-02-03T00:00:00.000Z',
      srs: { box: 5, nextReview: '2031-12-31', reviewCount: 0, lastReviewed: '2031-12-30' },
    }]);

    expect(wordItem.type).toBe('word');
    expect(wordItem.id).toBe('word:look up');
    expect(wordItem.term).toBe('  LOOK UP  ');
    expect(wordItem.srs).toStrictEqual({
      box: 5,
      nextReview: '2031-12-31',
      reviewCount: 0,
      lastReviewed: '2031-12-30',
    });
  });

  it('같은 id는 처음 항목만 유지하고 순서는 그대로이다', () => {
    const deduped = sanitizeWordbookItems([
      { term: 'Take Off', type: 'phrasal', meaning: '첫 번째' },
      { term: 'take off', type: 'phrasal', meaning: '두 번째' },
      { term: 'look up', type: 'word', meaning: '찾아보다' },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((item) => item.id)).toStrictEqual(['phrasal:take off', 'word:look up']);
    expect(deduped[0].meaning).toBe('첫 번째');
  });

  it('srs 누락/깨짐/배열은 기본값으로 보정한다', () => {
    const brokenSrsItems = sanitizeWordbookItems([
      { term: 'no srs' },
      { term: 'null srs', srs: null },
      { term: 'array srs', srs: [] },
      {
        term: 'broken srs',
        srs: { box: 9, nextReview: '2030-1-2', reviewCount: -1, lastReviewed: 'yesterday' },
      },
    ]);

    expect(brokenSrsItems).toHaveLength(4);
    for (const item of brokenSrsItems) {
      expect(item.srs).toStrictEqual({
        box: 1,
        nextReview: toLocalDateKey(),
        reviewCount: 0,
        lastReviewed: null,
      });
    }
  });

  it('문자열이 아닌 meaning/example, addedAt 누락도 안전한 기본값으로 보정한다', () => {
    const fallbackFields = sanitizeWordbookItems([{
      term: 'fallback',
      type: 'word',
      meaning: 123,
      example: { text: 'nope' },
      addedAt: null,
      srs: {},
    }])[0];

    expect(fallbackFields.meaning).toBe('');
    expect(fallbackFields.example).toBe('');
    expect(isValidIsoString(fallbackFields.addedAt)).toBe(true);
    expect(fallbackFields.srs.box).toBe(1);
    expect(fallbackFields.srs.nextReview).toBe(toLocalDateKey());
    expect(fallbackFields.srs.reviewCount).toBe(0);
    expect(fallbackFields.srs.lastReviewed).toBeNull();
  });
});

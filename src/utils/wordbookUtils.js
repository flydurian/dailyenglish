import { toLocalDateKey } from './dateUtils.js';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isDateKey = (value) => (
  typeof value === 'string' && DATE_KEY_PATTERN.test(value)
);

const isBoxValue = (value) => Number.isInteger(value) && value >= 1 && value <= 5;

const isReviewCount = (value) => Number.isInteger(value) && value >= 0;

const defaultSrs = () => ({
  box: 1,
  nextReview: toLocalDateKey(),
  reviewCount: 0,
  lastReviewed: null,
});

export const makeWordbookId = (type, term) => `${type}:${term.trim().toLowerCase()}`;

export const normalizeType = (type) => (type === 'word' ? 'word' : 'phrasal');

export const createItem = ({ type, term, meaning, example }) => {
  const normalizedType = normalizeType(type);
  return {
    id: makeWordbookId(normalizedType, term),
    type: normalizedType,
    term: term.trim(),
    meaning: meaning || '',
    example: example || '',
    addedAt: new Date().toISOString(),
    srs: defaultSrs(),
  };
};

const sanitizeSrs = (srs) => {
  if (!isPlainObject(srs)) return defaultSrs();

  return {
    box: isBoxValue(srs.box) ? srs.box : 1,
    nextReview: isDateKey(srs.nextReview) ? srs.nextReview : toLocalDateKey(),
    reviewCount: isReviewCount(srs.reviewCount) ? srs.reviewCount : 0,
    lastReviewed: isDateKey(srs.lastReviewed) ? srs.lastReviewed : null,
  };
};

// localStorage 등에서 읽은 신뢰할 수 없는 값을 UI가 바로 쓸 수 있는 형태로 정규화한다.
export function sanitizeWordbookItems(raw) {
  if (!Array.isArray(raw)) return [];

  const seenIds = new Set();
  const items = [];

  raw.forEach((entry) => {
    if (!isPlainObject(entry)) return;
    if (typeof entry.term !== 'string' || !entry.term.trim()) return;

    const type = normalizeType(entry.type);
    const id = makeWordbookId(type, entry.term);
    if (seenIds.has(id)) return;

    seenIds.add(id);
    items.push({
      id,
      type,
      term: entry.term,
      meaning: typeof entry.meaning === 'string' ? entry.meaning : '',
      example: typeof entry.example === 'string' ? entry.example : '',
      addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date().toISOString(),
      srs: sanitizeSrs(entry.srs),
    });
  });

  return items;
}

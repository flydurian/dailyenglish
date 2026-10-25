import { toLocalDateKey } from './dateUtils.js';

export const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

export function addDays(dateKey, n) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const offset = Number(n) || 0;
  return toLocalDateKey(new Date(year, month - 1, day + offset));
}

export function isDue(item, todayKey) {
  if (!item || !item.srs) return true;
  return item.srs.nextReview <= todayKey;
}

export function getDueItems(items, todayKey) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => isDue(item, todayKey))
    .sort((a, b) => {
      if (!a.srs && !b.srs) return 0;
      if (!a.srs) return -1;
      if (!b.srs) return 1;
      if (a.srs.nextReview < b.srs.nextReview) return -1;
      if (a.srs.nextReview > b.srs.nextReview) return 1;
      return 0;
    });
}

export function gradeItem(item, known, todayKey) {
  const currentSrs = item && item.srs ? item.srs : {};
  const currentBox = Number.isInteger(currentSrs.box) && currentSrs.box >= 1 && currentSrs.box <= 5
    ? currentSrs.box
    : 1;
  const currentReviewCount = Number.isInteger(currentSrs.reviewCount) && currentSrs.reviewCount >= 0
    ? currentSrs.reviewCount
    : 0;

  const box = known ? Math.min(currentBox + 1, 5) : 1;

  return {
    box,
    nextReview: addDays(todayKey, BOX_INTERVALS[box]),
    reviewCount: currentReviewCount + 1,
    lastReviewed: todayKey,
  };
}

export function getNextDueDate(items) {
  if (!Array.isArray(items)) return null;

  let nextDate = null;
  items.forEach((item) => {
    const candidate = item && item.srs ? item.srs.nextReview : null;
    if (typeof candidate !== 'string') return;
    if (nextDate === null || candidate < nextDate) nextDate = candidate;
  });

  return nextDate;
}

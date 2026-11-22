import { toLocalDateKey } from './dateUtils';

export const BOX_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

export interface SrsState {
  box: number;
  nextReview: string;
  reviewCount: number;
  lastReviewed: string | null;
}

export interface SrsItem {
  srs?: Partial<SrsState> | null;
  [key: string]: unknown;
}

export function addDays(dateKey: string, n: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const offset = Number(n) || 0;
  return toLocalDateKey(new Date(year, month - 1, day + offset));
}

export function isDue(item: SrsItem | null | undefined, todayKey: string): boolean {
  if (!item?.srs) return true;
  return (item.srs.nextReview ?? '') <= todayKey;
}

export function getDueItems<T extends SrsItem>(items: T[] | null | undefined, todayKey: string): T[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => isDue(item, todayKey))
    .sort((a, b) => {
      if (!a.srs && !b.srs) return 0;
      if (!a.srs) return -1;
      if (!b.srs) return 1;
      const aReview = a.srs.nextReview ?? '';
      const bReview = b.srs.nextReview ?? '';
      if (aReview < bReview) return -1;
      if (aReview > bReview) return 1;
      return 0;
    });
}

export function gradeItem(item: SrsItem | null | undefined, known: boolean, todayKey: string): SrsState {
  const currentSrs = item?.srs ?? {};
  const currentBox = Number.isInteger(currentSrs.box) && (currentSrs.box ?? 0) >= 1 && (currentSrs.box ?? 0) <= 5
    ? (currentSrs.box as number)
    : 1;
  const currentReviewCount = Number.isInteger(currentSrs.reviewCount) && (currentSrs.reviewCount ?? -1) >= 0
    ? (currentSrs.reviewCount as number)
    : 0;

  const box = known ? Math.min(currentBox + 1, 5) : 1;

  return {
    box,
    nextReview: addDays(todayKey, BOX_INTERVALS[box]),
    reviewCount: currentReviewCount + 1,
    lastReviewed: todayKey,
  };
}

export function getNextDueDate(items: SrsItem[] | null | undefined): string | null {
  if (!Array.isArray(items)) return null;

  let nextDate: string | null = null;
  items.forEach((item) => {
    const candidate = item?.srs?.nextReview ?? null;
    if (typeof candidate !== 'string') return;
    if (nextDate === null || candidate < nextDate) nextDate = candidate;
  });

  return nextDate;
}

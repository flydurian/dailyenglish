import { addDays } from './srs';

const ACTIVITY_KINDS = ['viewed', 'saved', 'reviewed'] as const;
type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityCounts {
  viewed: number;
  saved: number;
  reviewed: number;
}

export interface ProgressData {
  days: Record<string, Partial<ActivityCounts>>;
}

const toCount = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

const normalizeData = (data: unknown): ProgressData => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { days: {} };
  }

  const days = (data as { days?: unknown }).days;
  if (!days || typeof days !== 'object' || Array.isArray(days)) {
    return { days: {} };
  }

  return { days: { ...(days as Record<string, Partial<ActivityCounts>>) } };
};

export function recordActivity(data: unknown, kind: string, dateKey: string): ProgressData {
  if (!ACTIVITY_KINDS.includes(kind as ActivityKind)) return data as ProgressData;

  const { days } = normalizeData(data);
  const current = days[dateKey];
  const day = current && typeof current === 'object' && !Array.isArray(current) ? current : {};

  days[dateKey] = {
    viewed: toCount(day.viewed),
    saved: toCount(day.saved),
    reviewed: toCount(day.reviewed),
    [kind]: toCount((day as Record<string, unknown>)[kind]) + 1,
  };

  return { days };
}

export function isActiveDay(day: unknown): boolean {
  if (!day || typeof day !== 'object' || Array.isArray(day)) return false;

  const counts = day as Partial<ActivityCounts>;
  return toCount(counts.viewed) + toCount(counts.saved) + toCount(counts.reviewed) > 0;
}

export function getStreak(data: unknown, todayKey: string): number {
  const { days } = normalizeData(data);
  let cursor = isActiveDay(days[todayKey]) ? todayKey : addDays(todayKey, -1);
  let streak = 0;

  while (isActiveDay(days[cursor])) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export interface DaySummary {
  dateKey: string;
  total: number;
  active: boolean;
}

export function getLastNDays(data: unknown, todayKey: string, n = 7): DaySummary[] {
  const { days } = normalizeData(data);
  if (!Number.isInteger(n) || n <= 0) return [];

  const result: DaySummary[] = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const dateKey = addDays(todayKey, -offset);
    const day = days[dateKey];

    result.push({
      dateKey,
      total: toCount(day?.viewed) + toCount(day?.saved) + toCount(day?.reviewed),
      active: isActiveDay(day),
    });
  }

  return result;
}

export function pruneOld(data: unknown, todayKey: string, keepDays = 120): ProgressData {
  const { days } = normalizeData(data);
  const keep = Number.isInteger(keepDays) && keepDays >= 0 ? keepDays : 120;

  if (keep === 0) return { days: {} };

  // 오늘을 포함해 최근 keepDays일만 유지한다.
  const cutoff = addDays(todayKey, -(keep - 1));
  const pruned: ProgressData['days'] = {};

  Object.keys(days).forEach((dateKey) => {
    if (dateKey >= cutoff) pruned[dateKey] = days[dateKey];
  });

  return { days: pruned };
}

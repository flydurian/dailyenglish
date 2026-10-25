import { addDays } from './srs.js';

const ACTIVITY_KINDS = ['viewed', 'saved', 'reviewed'];

const toCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

const normalizeData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { days: {} };
  }

  const { days } = data;
  if (!days || typeof days !== 'object' || Array.isArray(days)) {
    return { days: {} };
  }

  return { days: { ...days } };
};

export function recordActivity(data, kind, dateKey) {
  if (!ACTIVITY_KINDS.includes(kind)) return data;

  const { days } = normalizeData(data);
  const current = days[dateKey];
  const day = current && typeof current === 'object' && !Array.isArray(current) ? current : {};

  days[dateKey] = {
    viewed: toCount(day.viewed),
    saved: toCount(day.saved),
    reviewed: toCount(day.reviewed),
    [kind]: toCount(day[kind]) + 1,
  };

  return { days };
}

export function isActiveDay(day) {
  if (!day || typeof day !== 'object' || Array.isArray(day)) return false;

  return toCount(day.viewed) + toCount(day.saved) + toCount(day.reviewed) > 0;
}

export function getStreak(data, todayKey) {
  const { days } = normalizeData(data);
  let cursor = isActiveDay(days[todayKey]) ? todayKey : addDays(todayKey, -1);
  let streak = 0;

  while (isActiveDay(days[cursor])) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function getLastNDays(data, todayKey, n = 7) {
  const { days } = normalizeData(data);
  if (!Number.isInteger(n) || n <= 0) return [];

  const result = [];
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

export function pruneOld(data, todayKey, keepDays = 120) {
  const { days } = normalizeData(data);
  const keep = Number.isInteger(keepDays) && keepDays >= 0 ? keepDays : 120;

  if (keep === 0) return { days: {} };

  // 오늘을 포함해 최근 keepDays일만 유지한다.
  const cutoff = addDays(todayKey, -(keep - 1));
  const pruned = {};

  Object.keys(days).forEach((dateKey) => {
    if (dateKey >= cutoff) pruned[dateKey] = days[dateKey];
  });

  return { days: pruned };
}

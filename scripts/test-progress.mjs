import assert from 'node:assert/strict';
import {
  recordActivity,
  isActiveDay,
  getStreak,
  getLastNDays,
  pruneOld,
} from '../src/utils/progress.js';

const TODAY = '2026-10-25';

const day = (viewed = 0, saved = 0, reviewed = 0) => ({ viewed, saved, reviewed });
const dataWith = (entries) => ({ days: Object.fromEntries(entries) });

// recordActivity: 새 객체 반환, 원본 불변
const source = dataWith([
  ['2026-10-24', day(1, 2, 3)],
  [TODAY, day(2, 0, 1)],
]);
const sourceSnapshot = JSON.parse(JSON.stringify(source));
const recorded = recordActivity(source, 'reviewed', TODAY);

assert.notEqual(recorded, source);
assert.notEqual(recorded.days, source.days);
assert.deepEqual(recorded.days[TODAY], day(2, 0, 2));
assert.deepEqual(source, sourceSnapshot);
assert.deepEqual(recorded.days['2026-10-24'], day(1, 2, 3));

// 기록이 없는 날/형식 오류 데이터에서도 안전하게 시작
assert.deepEqual(recordActivity(null, 'viewed', TODAY), {
  days: { [TODAY]: day(1, 0, 0) },
});
assert.deepEqual(recordActivity({ days: [] }, 'saved', TODAY), {
  days: { [TODAY]: day(0, 1, 0) },
});
assert.deepEqual(recordActivity({ days: { [TODAY]: { viewed: '3', saved: -1 } } }, 'saved', TODAY), {
  days: { [TODAY]: day(0, 1, 0) },
});

// 알 수 없는 kind는 받은 데이터를 그대로 반환
assert.equal(recordActivity(source, 'unknown', TODAY), source);

// isActiveDay
assert.equal(isActiveDay(undefined), false);
assert.equal(isActiveDay(null), false);
assert.equal(isActiveDay(day(0, 0, 0)), false);
assert.equal(isActiveDay(day(0, 1, 0)), true);
assert.equal(isActiveDay({ viewed: '1' }), false);

// 연속일: 오늘 포함 3일
assert.equal(getStreak(dataWith([
  ['2026-10-23', day(1, 0, 0)],
  ['2026-10-24', day(0, 1, 0)],
  [TODAY, day(0, 0, 1)],
]), TODAY), 3);

// 오늘은 없고 어제부터 2일
assert.equal(getStreak(dataWith([
  ['2026-10-23', day(1, 0, 0)],
  ['2026-10-24', day(0, 1, 0)],
]), TODAY), 2);

// 중간에 끊기면 오늘 1일
assert.equal(getStreak(dataWith([
  ['2026-10-22', day(1, 0, 0)],
  [TODAY, day(1, 0, 0)],
]), TODAY), 1);

// 활동 없음
assert.equal(getStreak(null, TODAY), 0);
assert.equal(getStreak(dataWith([['2026-10-20', day(1, 0, 0)]]), TODAY), 0);

// 월말 경계: 2/27, 2/28, 3/1 연속
assert.equal(getStreak(dataWith([
  ['2026-02-27', day(1, 0, 0)],
  ['2026-02-28', day(1, 0, 0)],
  ['2026-03-01', day(1, 0, 0)],
]), '2026-03-01'), 3);

// 연말 경계: 12/31, 1/1, 1/2 연속
assert.equal(getStreak(dataWith([
  ['2026-12-31', day(1, 0, 0)],
  ['2027-01-01', day(1, 0, 0)],
  ['2027-01-02', day(1, 0, 0)],
]), '2027-01-02'), 3);

// getLastNDays: 오래된 날 -> 오늘 순, 길이 n
const recent = dataWith([
  ['2026-10-20', day(1, 0, 0)],
  ['2026-10-23', day(0, 0, 2)],
  [TODAY, day(3, 1, 0)],
]);
assert.deepEqual(getLastNDays(recent, TODAY, 4), [
  { dateKey: '2026-10-22', total: 0, active: false },
  { dateKey: '2026-10-23', total: 2, active: true },
  { dateKey: '2026-10-24', total: 0, active: false },
  { dateKey: TODAY, total: 4, active: true },
]);
assert.equal(getLastNDays(recent, TODAY, 7).length, 7);
assert.deepEqual(getLastNDays(recent, TODAY).map((item) => item.dateKey), [
  '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
  '2026-10-23', '2026-10-24', TODAY,
]);
assert.deepEqual(getLastNDays(recent, TODAY, 0), []);

// pruneOld: 오늘 포함 3일 유지, 원본 불변
const pruneSource = dataWith([
  ['2026-10-21', day(1, 0, 0)],
  ['2026-10-22', day(1, 0, 0)],
  ['2026-10-23', day(1, 0, 0)],
  ['2026-10-24', day(1, 0, 0)],
  [TODAY, day(1, 0, 0)],
]);
const pruneSnapshot = JSON.parse(JSON.stringify(pruneSource));
const pruned = pruneOld(pruneSource, TODAY, 3);

assert.notEqual(pruned, pruneSource);
assert.deepEqual(Object.keys(pruned.days).sort(), ['2026-10-23', '2026-10-24', TODAY]);
assert.deepEqual(pruneSource, pruneSnapshot);

// 연말 경계에서도 최근 3일 유지
const prunedYearEnd = pruneOld(dataWith([
  ['2026-12-30', day(1, 0, 0)],
  ['2026-12-31', day(1, 0, 0)],
  ['2027-01-01', day(1, 0, 0)],
  ['2027-01-02', day(1, 0, 0)],
]), '2027-01-02', 3);
assert.deepEqual(Object.keys(prunedYearEnd.days).sort(), [
  '2026-12-31', '2027-01-01', '2027-01-02',
]);

// keepDays=1이면 오늘만 유지, 잘못된 데이터는 빈 구조
assert.deepEqual(Object.keys(pruneOld(pruneSource, TODAY, 1).days), [TODAY]);
assert.deepEqual(pruneOld(null, TODAY), { days: {} });

console.log('progress tests passed');

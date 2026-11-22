import { describe, it, expect } from 'vitest';
import {
  recordActivity,
  isActiveDay,
  getStreak,
  getLastNDays,
  pruneOld,
} from '../src/utils/progress';

const TODAY = '2026-10-25';

const day = (viewed = 0, saved = 0, reviewed = 0) => ({ viewed, saved, reviewed });
const dataWith = (entries) => ({ days: Object.fromEntries(entries) });

describe('recordActivity', () => {
  it('새 객체를 반환하고 원본은 변경하지 않는다', () => {
    const source = dataWith([
      ['2026-10-24', day(1, 2, 3)],
      [TODAY, day(2, 0, 1)],
    ]);
    const sourceSnapshot = JSON.parse(JSON.stringify(source));
    const recorded = recordActivity(source, 'reviewed', TODAY);

    expect(recorded).not.toBe(source);
    expect(recorded.days).not.toBe(source.days);
    expect(recorded.days[TODAY]).toStrictEqual(day(2, 0, 2));
    expect(source).toStrictEqual(sourceSnapshot);
    expect(recorded.days['2026-10-24']).toStrictEqual(day(1, 2, 3));
  });

  it('기록이 없는 날/형식 오류 데이터에서도 안전하게 시작한다', () => {
    expect(recordActivity(null, 'viewed', TODAY)).toStrictEqual({
      days: { [TODAY]: day(1, 0, 0) },
    });
    expect(recordActivity({ days: [] }, 'saved', TODAY)).toStrictEqual({
      days: { [TODAY]: day(0, 1, 0) },
    });
    expect(recordActivity({ days: { [TODAY]: { viewed: '3', saved: -1 } } }, 'saved', TODAY)).toStrictEqual({
      days: { [TODAY]: day(0, 1, 0) },
    });
  });

  it('알 수 없는 kind는 받은 데이터를 그대로 반환한다', () => {
    const source = dataWith([[TODAY, day(2, 0, 1)]]);
    expect(recordActivity(source, 'unknown', TODAY)).toBe(source);
  });
});

describe('isActiveDay', () => {
  it('활동이 기록된 날만 참이다', () => {
    expect(isActiveDay(undefined)).toBe(false);
    expect(isActiveDay(null)).toBe(false);
    expect(isActiveDay(day(0, 0, 0))).toBe(false);
    expect(isActiveDay(day(0, 1, 0))).toBe(true);
    expect(isActiveDay({ viewed: '1' })).toBe(false);
  });
});

describe('getStreak', () => {
  it('오늘 포함 연속일을 센다', () => {
    expect(getStreak(dataWith([
      ['2026-10-23', day(1, 0, 0)],
      ['2026-10-24', day(0, 1, 0)],
      [TODAY, day(0, 0, 1)],
    ]), TODAY)).toBe(3);

    expect(getStreak(dataWith([
      ['2026-10-23', day(1, 0, 0)],
      ['2026-10-24', day(0, 1, 0)],
    ]), TODAY)).toBe(2);

    expect(getStreak(dataWith([
      ['2026-10-22', day(1, 0, 0)],
      [TODAY, day(1, 0, 0)],
    ]), TODAY)).toBe(1);
  });

  it('활동이 없으면 0이다', () => {
    expect(getStreak(null, TODAY)).toBe(0);
    expect(getStreak(dataWith([['2026-10-20', day(1, 0, 0)]]), TODAY)).toBe(0);
  });

  it('월말·연말 경계를 넘어 연속일을 센다', () => {
    expect(getStreak(dataWith([
      ['2026-02-27', day(1, 0, 0)],
      ['2026-02-28', day(1, 0, 0)],
      ['2026-03-01', day(1, 0, 0)],
    ]), '2026-03-01')).toBe(3);

    expect(getStreak(dataWith([
      ['2026-12-31', day(1, 0, 0)],
      ['2027-01-01', day(1, 0, 0)],
      ['2027-01-02', day(1, 0, 0)],
    ]), '2027-01-02')).toBe(3);
  });
});

describe('getLastNDays', () => {
  const recent = dataWith([
    ['2026-10-20', day(1, 0, 0)],
    ['2026-10-23', day(0, 0, 2)],
    [TODAY, day(3, 1, 0)],
  ]);

  it('오래된 날 -> 오늘 순으로 n개를 반환한다', () => {
    expect(getLastNDays(recent, TODAY, 4)).toStrictEqual([
      { dateKey: '2026-10-22', total: 0, active: false },
      { dateKey: '2026-10-23', total: 2, active: true },
      { dateKey: '2026-10-24', total: 0, active: false },
      { dateKey: TODAY, total: 4, active: true },
    ]);
    expect(getLastNDays(recent, TODAY, 7)).toHaveLength(7);
    expect(getLastNDays(recent, TODAY).map((item) => item.dateKey)).toStrictEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', TODAY,
    ]);
    expect(getLastNDays(recent, TODAY, 0)).toStrictEqual([]);
  });
});

describe('pruneOld', () => {
  it('오늘 포함 최근 n일만 유지하고 원본은 변경하지 않는다', () => {
    const pruneSource = dataWith([
      ['2026-10-21', day(1, 0, 0)],
      ['2026-10-22', day(1, 0, 0)],
      ['2026-10-23', day(1, 0, 0)],
      ['2026-10-24', day(1, 0, 0)],
      [TODAY, day(1, 0, 0)],
    ]);
    const pruneSnapshot = JSON.parse(JSON.stringify(pruneSource));
    const pruned = pruneOld(pruneSource, TODAY, 3);

    expect(pruned).not.toBe(pruneSource);
    expect(Object.keys(pruned.days).sort()).toStrictEqual(['2026-10-23', '2026-10-24', TODAY]);
    expect(pruneSource).toStrictEqual(pruneSnapshot);
  });

  it('연말 경계에서도 최근 n일을 유지한다', () => {
    const prunedYearEnd = pruneOld(dataWith([
      ['2026-12-30', day(1, 0, 0)],
      ['2026-12-31', day(1, 0, 0)],
      ['2027-01-01', day(1, 0, 0)],
      ['2027-01-02', day(1, 0, 0)],
    ]), '2027-01-02', 3);
    expect(Object.keys(prunedYearEnd.days).sort()).toStrictEqual([
      '2026-12-31', '2027-01-01', '2027-01-02',
    ]);
  });

  it('keepDays=1이면 오늘만, 잘못된 데이터는 빈 구조를 반환한다', () => {
    const pruneSource = dataWith([
      ['2026-10-21', day(1, 0, 0)],
      [TODAY, day(1, 0, 0)],
    ]);
    expect(Object.keys(pruneOld(pruneSource, TODAY, 1).days)).toStrictEqual([TODAY]);
    expect(pruneOld(null, TODAY)).toStrictEqual({ days: {} });
  });
});

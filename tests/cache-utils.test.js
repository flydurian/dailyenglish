// 날짜 캐시 정리가 로컬 날짜 키(toLocalDateKey)와 같은 기준으로 비교하는지 검증합니다.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { cleanupOldMonthlyData, setCachedData, getCachedData, isCacheValid } from '../src/utils/cacheUtils';
import { toLocalDateKey } from '../src/utils/dateUtils';

const ORIGINAL_TZ = process.env.TZ;

const createStorage = () => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: (key) => (Object.hasOwn(storage, key) ? storage[key] : null) },
    setItem: { value: (key, value) => { storage[key] = String(value); }, writable: true },
    removeItem: { value: (key) => { delete storage[key]; } },
  });
  return storage;
};

describe('cacheUtils', () => {
  let storage;

  beforeAll(() => {
    // UTC 서쪽 타임존(America/Los_Angeles)에서 실행해 타임존 어긋남 회귀를 방지합니다.
    process.env.TZ = 'America/Los_Angeles';
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it('오늘 캐시는 유지하고 오래된 캐시만 삭제한다', () => {
    const todayKey = toLocalDateKey();
    const oldKey = '2020-01-01';

    storage.setItem(`news_${todayKey}`, JSON.stringify({ date: todayKey, data: {} }));
    storage.setItem(`news_${oldKey}`, JSON.stringify({ date: oldKey, data: {} }));
    storage.setItem(`expressions_${todayKey}`, JSON.stringify({ date: todayKey, data: {} }));
    storage.setItem(`expressions_${oldKey}`, JSON.stringify({ date: oldKey, data: {} }));

    cleanupOldMonthlyData();

    expect(storage.getItem(`news_${todayKey}`)).not.toBeNull();
    expect(storage.getItem(`expressions_${todayKey}`)).not.toBeNull();
    expect(storage.getItem(`news_${oldKey}`)).toBeNull();
    expect(storage.getItem(`expressions_${oldKey}`)).toBeNull();
  });

  it('setCachedData가 QuotaExceededError 발생 시 오래된 캐시를 정리하고 재시도한다', () => {
    const today = new Date();
    const oldKey = 'expressions_2020-01-01';
    storage[oldKey] = JSON.stringify({ date: '2020-01-01', data: { B1: [] } });

    let failedOnce = false;
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (!failedOnce) {
        failedOnce = true;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      originalSetItem(key, value);
    };

    expect(() => setCachedData('news', today, { B1: [{ title: 'OK' }] })).not.toThrow();
    storage.setItem = originalSetItem;

    expect(storage.getItem(oldKey)).toBeNull();
    expect(isCacheValid('news', today)).toBe(true);
    expect(getCachedData('news', today)?.data?.B1?.[0]?.title).toBe('OK');
  });
});

// 날짜 캐시 정리가 UTC 기반 캐시 키와 같은 기준으로 비교하는지 검증합니다.
// UTC 서쪽 타임존(America/Los_Angeles)에서 실행하면 기존 toDateString() 비교의 회귀를 잡을 수 있습니다.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { cleanupOldMonthlyData } from '../src/utils/cacheUtils.js';

const ORIGINAL_TZ = process.env.TZ;

const createStorage = () => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: (key) => (Object.hasOwn(storage, key) ? storage[key] : null) },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: (key) => { delete storage[key]; } },
  });
  return storage;
};

describe('cleanupOldMonthlyData', () => {
  let storage;

  beforeAll(() => {
    // 이 파일의 날짜 계산을 UTC 서쪽 타임존에서 수행합니다.
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
    const todayKey = new Date().toISOString().split('T')[0];
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
});

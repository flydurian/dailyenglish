// "매일 다른 3개" 계약과 DST 전환일 날짜 계산을 검증합니다.
// DST 지역(America/New_York)에서 실행하면 회귀를 잡을 수 있습니다.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const ORIGINAL_TZ = process.env.TZ;
// Vitest 변환 환경에서는 import.meta.url이 file: 스킴이 아니므로 프로젝트 루트 기준으로 읽습니다.
const data = JSON.parse(readFileSync('public/data/phrasalVerbs.json', 'utf8'));

let getDailyPhrasalVerbs;

const verbsOf = async (date) => {
  const items = await getDailyPhrasalVerbs(date);
  return items.map((item) => item.verb || item.phrasal_verb);
};

describe('getDailyPhrasalVerbs', () => {
  beforeAll(async () => {
    // 이 파일의 날짜 계산을 DST가 있는 타임존에서 수행합니다.
    process.env.TZ = 'America/New_York';
    vi.stubGlobal('fetch', async () => ({ json: async () => data }));
    ({ getDailyPhrasalVerbs } = await import('../src/data/phrasalVerbsData'));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it('400일 연속으로 하루 3개, 하루 안 중복 없음, 인접한 날 중복 없음', async () => {
    let previous = null;
    for (let i = 0; i < 400; i += 1) {
      const current = await verbsOf(new Date(2026, 0, 1 + i));
      expect(current).toHaveLength(3);
      expect(new Set(current).size).toBe(3);
      if (previous) {
        const overlap = current.filter((verb) => previous.includes(verb));
        expect(overlap).toEqual([]);
      }
      previous = current;
    }
  });

  it('DST 시작/종료일 경계에서도 연속일이 서로 다르다', async () => {
    const dstDays = [
      new Date(2026, 2, 7), new Date(2026, 2, 8), new Date(2026, 2, 9),
      new Date(2026, 9, 31), new Date(2026, 10, 1), new Date(2026, 10, 2),
    ];
    for (let i = 1; i < dstDays.length; i += 1) {
      const a = await verbsOf(dstDays[i - 1]);
      const b = await verbsOf(dstDays[i]);
      const overlap = b.filter((verb) => a.includes(verb));
      expect(overlap).toEqual([]);
    }
  });
});

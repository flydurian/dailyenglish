import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { toLocalDateKey } from '../utils/dateUtils';
import { getLastNDays, getStreak, pruneOld, recordActivity, type ActivityCounts, type DaySummary, type ProgressData } from '../utils/progress';

const STORAGE_KEY = 'dailyenglish.progress.v1';
const KEEP_DAYS = 120;
const ACTIVITY_KINDS = new Set(['viewed', 'saved', 'reviewed']);

const ProgressContext = createContext<ProgressContextValue | null>(null);

interface ProgressContextValue {
  data: ProgressData;
  record: (kind: string) => void;
  streak: number;
  lastDays: DaySummary[];
  today: ActivityCounts;
}

const toCount = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

const loadData = (): ProgressData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: {} };

    return pruneOld(JSON.parse(raw), toLocalDateKey(), KEEP_DAYS);
  } catch {
    return { days: {} };
  }
};

export const useProgress = (): ProgressContextValue => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<ProgressData>(loadData);
  const [todayKey, setTodayKey] = useState(toLocalDateKey);

  // 앱을 자정까지 열어두어도 오늘/연속일이 어제 기준으로 남지 않게 갱신합니다.
  useEffect(() => {
    const refresh = () => setTodayKey(toLocalDateKey());
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    try {
      const pruned = pruneOld(data, toLocalDateKey(), KEEP_DAYS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // 저장 공간 부족/프라이빗 모드 등에서는 조용히 무시한다.
    }
  }, [data]);

  const record = useCallback((kind: string) => {
    if (!ACTIVITY_KINDS.has(kind)) return;

    const dateKey = toLocalDateKey();
    setData((prev) => pruneOld(recordActivity(prev, kind, dateKey), dateKey, KEEP_DAYS));
  }, []);

  const today = useMemo<ActivityCounts>(() => {
    const day = data.days?.[todayKey];
    return {
      viewed: toCount(day?.viewed),
      saved: toCount(day?.saved),
      reviewed: toCount(day?.reviewed),
    };
  }, [data, todayKey]);

  const streak = useMemo(() => getStreak(data, todayKey), [data, todayKey]);
  const lastDays = useMemo(() => getLastNDays(data, todayKey, 7), [data, todayKey]);

  const value = useMemo<ProgressContextValue>(() => ({
    data,
    record,
    streak,
    lastDays,
    today,
  }), [data, record, streak, lastDays, today]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

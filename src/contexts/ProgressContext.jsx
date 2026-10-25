import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { toLocalDateKey } from '../utils/dateUtils';
import { getLastNDays, getStreak, pruneOld, recordActivity } from '../utils/progress';

const STORAGE_KEY = 'dailyenglish.progress.v1';
const KEEP_DAYS = 120;
const ACTIVITY_KINDS = new Set(['viewed', 'saved', 'reviewed']);

const ProgressContext = createContext();

const toCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: {} };

    return pruneOld(JSON.parse(raw), toLocalDateKey(), KEEP_DAYS);
  } catch (error) {
    return { days: {} };
  }
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const [data, setData] = useState(loadData);
  const todayKey = toLocalDateKey();

  useEffect(() => {
    try {
      const pruned = pruneOld(data, toLocalDateKey(), KEEP_DAYS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (error) {
      // 저장 공간 부족/프라이빗 모드 등에서는 조용히 무시한다.
    }
  }, [data]);

  const record = useCallback((kind) => {
    if (!ACTIVITY_KINDS.has(kind)) return;

    const dateKey = toLocalDateKey();
    setData((prev) => pruneOld(recordActivity(prev, kind, dateKey), dateKey, KEEP_DAYS));
  }, []);

  const today = useMemo(() => {
    const day = data.days?.[todayKey];
    return {
      viewed: toCount(day?.viewed),
      saved: toCount(day?.saved),
      reviewed: toCount(day?.reviewed),
    };
  }, [data, todayKey]);

  const streak = useMemo(() => getStreak(data, todayKey), [data, todayKey]);
  const lastDays = useMemo(() => getLastNDays(data, todayKey, 7), [data, todayKey]);

  const value = useMemo(() => ({
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

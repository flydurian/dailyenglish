import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';

const STORAGE_KEY = 'dailyenglish.fontSize.v1';
const MIN_FONT_SIZE = 0.7;
const MAX_FONT_SIZE = 1.5;

const roundScale = (value: number): number => Math.round(value * 10) / 10;

const loadFontSize = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 1;
    return roundScale(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed)));
  } catch {
    return 1;
  }
};

interface FontSizeValue {
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

const FontSizeContext = createContext<FontSizeValue | null>(null);

export const useFontSize = (): FontSizeValue => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [fontSize, setFontSize] = useState<number>(loadFontSize); // 기본값 1 (100%)
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(fontSize));
    } catch {
      // 프라이빗 모드 등 저장 불가 환경에서는 조용히 무시
    }
  }, [fontSize]);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => roundScale(Math.min(prev + 0.1, MAX_FONT_SIZE))); // 최대 150%
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => roundScale(Math.max(prev - 0.1, MIN_FONT_SIZE))); // 최소 70%
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(1); // 기본값으로 리셋
  }, []);

  const value = useMemo<FontSizeValue>(() => ({
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  }), [fontSize, increaseFontSize, decreaseFontSize, resetFontSize]);

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
  const [fontSize, setFontSize] = useState(1); // 기본값 1 (100%)

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 0.1, 1.5)); // 최대 150%
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 0.1, 0.7)); // 최소 70%
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(1); // 기본값으로 리셋
  }, []);

  const value: FontSizeValue = {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};

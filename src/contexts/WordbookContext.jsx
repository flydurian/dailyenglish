import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  makeWordbookId,
  normalizeType,
  createItem,
  sanitizeWordbookItems,
} from '../utils/wordbookUtils';
import { useProgress } from './ProgressContext';

export { makeWordbookId } from '../utils/wordbookUtils';

const STORAGE_KEY = 'dailyenglish.wordbook.v1';

const WordbookContext = createContext();

const loadItems = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return sanitizeWordbookItems(parsed);
  } catch (error) {
    return [];
  }
};

export const useWordbook = () => {
  const context = useContext(WordbookContext);
  if (!context) {
    throw new Error('useWordbook must be used within a WordbookProvider');
  }
  return context;
};

export const WordbookProvider = ({ children }) => {
  const [items, setItems] = useState(loadItems);
  const { record } = useProgress();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      // 저장 공간 부족/프라이빗 모드 등에서는 조용히 무시한다.
    }
  }, [items]);

  // 학습 기록은 실제로 추가된 항목 수만큼만 남깁니다. 클로저의 items로 판단하면
  // 같은 렌더에서 연속 클릭했을 때 토글 결과와 기록이 어긋납니다.
  const previousItems = useRef(items);
  useEffect(() => {
    const previousIds = new Set(previousItems.current.map((item) => item.id));
    const added = items.filter((item) => !previousIds.has(item.id));
    previousItems.current = items;
    added.forEach(() => record('saved'));
  }, [items, record]);

  const isSaved = useCallback((id) => items.some((item) => item.id === id), [items]);

  const addItem = useCallback(({ type, term, meaning, example }) => {
    if (typeof term !== 'string' || !term.trim()) return;

    const id = makeWordbookId(normalizeType(type), term);
    if (items.some((item) => item.id === id)) return;

    setItems((prev) => {
      if (prev.some((item) => item.id === id)) return prev;
      return [createItem({ type, term, meaning, example }), ...prev];
    });
  }, [items]);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleItem = useCallback(({ type, term, meaning, example }) => {
    if (typeof term !== 'string' || !term.trim()) return;

    const id = makeWordbookId(normalizeType(type), term);

    setItems((prev) => {
      if (prev.some((item) => item.id === id)) {
        return prev.filter((item) => item.id !== id);
      }
      return [createItem({ type, term, meaning, example }), ...prev];
    });
  }, [items]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  }, []);

  const value = useMemo(() => ({
    items,
    isSaved,
    addItem,
    removeItem,
    toggleItem,
    updateItem,
  }), [items, isSaved, addItem, removeItem, toggleItem, updateItem]);

  return (
    <WordbookContext.Provider value={value}>
      {children}
    </WordbookContext.Provider>
  );
};

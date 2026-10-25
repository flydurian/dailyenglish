import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  makeWordbookId,
  normalizeType,
  createItem,
  sanitizeWordbookItems,
} from '../utils/wordbookUtils';

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      // 저장 공간 부족/프라이빗 모드 등에서는 조용히 무시한다.
    }
  }, [items]);

  const isSaved = useCallback((id) => items.some((item) => item.id === id), [items]);

  const addItem = useCallback(({ type, term, meaning, example }) => {
    if (typeof term !== 'string' || !term.trim()) return;

    setItems((prev) => {
      const id = makeWordbookId(normalizeType(type), term);
      if (prev.some((item) => item.id === id)) return prev;
      return [createItem({ type, term, meaning, example }), ...prev];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleItem = useCallback(({ type, term, meaning, example }) => {
    if (typeof term !== 'string' || !term.trim()) return;

    setItems((prev) => {
      const id = makeWordbookId(normalizeType(type), term);
      if (prev.some((item) => item.id === id)) {
        return prev.filter((item) => item.id !== id);
      }
      return [createItem({ type, term, meaning, example }), ...prev];
    });
  }, []);

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

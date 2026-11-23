// 오늘 생성된 표현·뉴스 자료에서 중요한 단어만 뽑아 한데 모으는 순수 로직.
// React/브라우저 API에 의존하지 않아 Node 테스트에서도 그대로 쓸 수 있습니다.
import type { ExpressionItem, NewsItemData } from '../types';

export type WordSource = 'expression' | 'news';
export type CollectedType = 'phrasal' | 'word';

export interface CollectedWord {
  word: string;
  meaning: string;
  type: CollectedType;
  sources: WordSource[];
}

export interface TodayWordGroups {
  phrasal: CollectedWord[];
  words: CollectedWord[];
  // 중복 제거 전, 각 자료에서 뽑힌 항목 수 (생성 여부 표시에 사용)
  counts: { expression: number; news: number };
}

// "get up: 일어나다" / "**comprehensive**: 포괄적인" 형태를 단어와 뜻으로 분리합니다.
export function parseWordLabel(label: string): { word: string; meaning: string } {
  const cleaned = label
    .replace(/\*\*/g, '')
    .replace(/^[*-]\s+/, '')
    .trim();

  const separator = cleaned.indexOf(':');
  if (separator === -1) return { word: cleaned, meaning: '' };

  const word = cleaned.slice(0, separator).trim();
  const meaning = cleaned.slice(separator + 1).trim();
  if (!meaning) return { word: word || cleaned, meaning: '' };
  return { word, meaning };
}

const wordKey = (word: string) => word.toLowerCase().replace(/\s+/g, ' ').trim();

export function collectTodayWords(
  expressions?: ExpressionItem[] | null,
  news?: NewsItemData[] | null
): TodayWordGroups {
  const byKey = new Map<string, CollectedWord>();
  const counts = { expression: 0, news: 0 };

  const add = (word: string, meaning: string, type: CollectedType, source: WordSource) => {
    const key = wordKey(word);
    if (!key) return;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { word, meaning, type, sources: [source] });
      return;
    }

    // 같은 단어가 표현과 뉴스에서 모두 나오면 한 행으로 합칩니다.
    if (!existing.meaning && meaning) existing.meaning = meaning;
    if (existing.type === 'word' && type === 'phrasal') existing.type = 'phrasal';
    if (!existing.sources.includes(source)) existing.sources.push(source);
  };

  if (Array.isArray(expressions)) {
    for (const item of expressions) {
      if (!item || typeof item !== 'object') continue;

      if (typeof item.phrasal_verb === 'string' && item.phrasal_verb.trim()) {
        const parsed = parseWordLabel(item.phrasal_verb);
        if (parsed.word) {
          add(parsed.word, parsed.meaning, 'phrasal', 'expression');
          counts.expression += 1;
        }
      }

      if (Array.isArray(item.other_words)) {
        for (const other of item.other_words) {
          if (!other || typeof other.word !== 'string' || !other.word.trim()) continue;
          const parsed = parseWordLabel(other.word);
          const meaning = typeof other.meaning === 'string' && other.meaning.trim()
            ? other.meaning.trim()
            : parsed.meaning;
          add(parsed.word, meaning, 'word', 'expression');
          counts.expression += 1;
        }
      }
    }
  }

  if (Array.isArray(news)) {
    for (const item of news) {
      if (!item || typeof item !== 'object') continue;

      for (const label of Array.isArray(item.key_points) ? item.key_points : []) {
        if (typeof label !== 'string') continue;
        const parsed = parseWordLabel(label);
        if (parsed.word) {
          add(parsed.word, parsed.meaning, 'phrasal', 'news');
          counts.news += 1;
        }
      }

      for (const label of Array.isArray(item.vocabulary_notes) ? item.vocabulary_notes : []) {
        if (typeof label !== 'string') continue;
        const parsed = parseWordLabel(label);
        if (parsed.word) {
          add(parsed.word, parsed.meaning, 'word', 'news');
          counts.news += 1;
        }
      }
    }
  }

  const all = Array.from(byKey.values());
  return {
    phrasal: all.filter((entry) => entry.type === 'phrasal'),
    words: all.filter((entry) => entry.type === 'word'),
    counts,
  };
}

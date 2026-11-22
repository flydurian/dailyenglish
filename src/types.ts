// 여러 컴포넌트/훅에서 공유하는 타입 모음.
// 런타임 동작에는 영향이 없는 타입 표기만 모아 둡니다.

export type Accent = 'us' | 'gb';
export type AudioState = 'loading' | 'playing' | 'idle';
export type AudioStates = Record<string, AudioState>;
export type PlayAudio = (sentence: string, accent?: Accent) => void | Promise<boolean>;
export type Translate = (text: string) => Promise<string>;

export interface OtherWord {
  word: string;
  meaning: string;
  example?: string;
  [key: string]: unknown;
}

// API/캐시에서 오는 항목은 필드가 일부 없을 수 있어 느슨하게 둡니다.
export interface ExpressionItem {
  sentence: string;
  phrasal_verb: string;
  meaning?: string;
  situation?: string;
  nuance?: string;
  examples?: string[];
  other_words?: OtherWord[];
  [key: string]: unknown;
}

export interface NewsItemData {
  title: string;
  summary?: string;
  full_text?: string;
  key_points?: string[];
  vocabulary_notes?: string[];
  category?: string;
  source?: string;
  date?: string;
  [key: string]: unknown;
}

export interface TranslationEntry {
  translation?: string;
  summary?: string;
  examples?: string[];
  explanation?: string;
  timestamp?: number;
}
export type Translations = Record<string, TranslationEntry>;

export interface WordDetailInfo {
  type?: string;
  frequency?: string;
  [key: string]: string | string[] | undefined;
}

export type WordClickHandler = (
  word: string,
  meaning: string,
  example: string,
  detailedInfo: WordDetailInfo
) => void;
export type OnToggle = (index: number) => void;

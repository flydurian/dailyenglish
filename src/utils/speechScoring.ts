// 음성 인식 결과를 문장의 단어별 정답/오답으로 채점하는 순수 로직입니다.
// 스픽처럼 "어느 단어를 잘 말했는지"를 보여주기 위해, 목표 문장과 인식된 문장을
// 단어 단위로 정렬(alignment)한 뒤 각 단어에 상태를 붙입니다.

export type WordStatus = 'correct' | 'wrong' | 'missed';

export interface ScoredWord {
  /** 화면에 보여줄 원문 단어 (문장부호 유지) */
  display: string;
  /** **구동사** 안의 단어인지 여부 */
  bold: boolean;
  status: WordStatus;
  /** 이 단어와 비교된 인식 결과 ( wrong/missed일 때 힌트 ) */
  heard?: string;
}

export interface SpeechScore {
  words: ScoredWord[];
  correct: number;
  wrong: number;
  missed: number;
  total: number;
  accuracy: number; // 0~100
  transcript: string;
}

interface Token {
  display: string;
  bold: boolean;
}

// **마크다운**을 제거하면서 각 단어가 강조(구동사) 안에 있는지도 기억합니다.
export const tokenizeTarget = (text: string): Token[] => {
  const tokens: Token[] = [];
  if (typeof text !== 'string') return tokens;

  let bold = false;
  for (const part of text.split(/(\*\*)/)) {
    if (part === '**') {
      bold = !bold;
      continue;
    }
    for (const word of part.split(/\s+/)) {
      if (word) tokens.push({ display: word, bold });
    }
  }
  return tokens;
};

// 비교용 정규화: 소문자 + 앞뒤 문장부호 제거 + 연속 공백/구두점 정리.
export const normalizeWord = (word: string): string => (
  word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
    .trim()
);

const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
};

// 음성 인식이 비슷한 단어를 내놓은 경우도 인정합니다. 단, 짧은 단어에서
// "take" vs "make" 같은 오인식을 정답으로 처리하지 않도록 보수적으로 둡니다.
export const isWordMatch = (target: string, heard: string): boolean => {
  const a = normalizeWord(target);
  const b = normalizeWord(heard);
  if (!a || !b) return false;
  if (a === b) return true;

  const allowed = a.length >= 8 ? 2 : a.length >= 5 ? 1 : 0;
  return allowed > 0 && editDistance(a, b) <= allowed;
};

type Move = 'match' | 'substitute' | 'skipTarget' | 'skipHeard';

/**
 * 목표 문장의 각 단어를 인식 결과에 정렬해 채점합니다.
 * - 정확/유사 일치 → correct
 * - 다른 단어가 인식됨 → wrong
 * - 인식 결과에 아예 없음 → missed
 * 인식 결과에만 있는 여분의 단어(군더더기)는 점수에 반영하지 않습니다.
 */
export const scoreSpeech = (target: string, transcript: string): SpeechScore => {
  const tokens = tokenizeTarget(target);
  const heardWords = typeof transcript === 'string' ? transcript.split(/\s+/).filter(Boolean) : [];
  const n = tokens.length;
  const m = heardWords.length;

  // dp[i][j] = target[i..], heard[j..] 를 정렬했을 때의 최대 점수
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const move: Move[][] = Array.from({ length: n + 1 }, () => new Array<Move>(m + 1).fill('skipHeard'));

  for (let i = n - 1; i >= 0; i -= 1) {
    dp[i][m] = 0;
    move[i][m] = 'skipTarget';
    for (let j = m - 1; j >= 0; j -= 1) {
      let best = dp[i + 1][j];
      let bestMove: Move = 'skipTarget';

      // 여분의 인식 단어는 건너뜁니다 (0점).
      const skipHeard = dp[i][j + 1];
      if (skipHeard > best) {
        best = skipHeard;
        bestMove = 'skipHeard';
      }

      // 매칭되면 +3, 다른 단어로 인식되면 +1. 단순히 둘 다 건너뛰면(0점)
      // '놓침'으로만 표시되어 '다르게 들림'을 구분할 수 없기 때문에, 같은
      // 자리의 단어는 오답으로 연결하는 편을 조금 우선합니다.
      const matched = isWordMatch(tokens[i].display, heardWords[j]);
      const pair = dp[i + 1][j + 1] + (matched ? 3 : 1);
      if (pair > best) {
        best = pair;
        bestMove = matched ? 'match' : 'substitute';
      }

      dp[i][j] = best;
      move[i][j] = bestMove;
    }
  }

  const words: ScoredWord[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const current = move[i][j];
    if (current === 'match' || current === 'substitute') {
      words.push({
        ...tokens[i],
        status: current === 'match' ? 'correct' : 'wrong',
        heard: normalizeWord(heardWords[j]),
      });
      i += 1;
      j += 1;
    } else if (current === 'skipTarget') {
      words.push({ ...tokens[i], status: 'missed' });
      i += 1;
    } else {
      // 인식 결과에만 있는 여분 단어는 표시하지 않습니다.
      j += 1;
    }
  }
  while (i < n) {
    words.push({ ...tokens[i], status: 'missed' });
    i += 1;
  }

  const correct = words.filter((word) => word.status === 'correct').length;
  const wrong = words.filter((word) => word.status === 'wrong').length;
  const missed = words.filter((word) => word.status === 'missed').length;
  const total = words.length;

  return {
    words,
    correct,
    wrong,
    missed,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    transcript: transcript.trim(),
  };
};

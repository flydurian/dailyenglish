// 구동사 데이터 관리 시스템
import {
  markPhrasalVerbAsUsed
} from '../utils/usageTracker';

// JSON 데이터에서 읽어오는 구동사 항목
export interface PhrasalVerbData {
  verb: string;
  meaning: string;
  [key: string]: any;
}

// 셔플 순서는 날짜와 무관하게 고정합니다. 날마다 새 시드로 섞으면 인덱스만 3씩 옮겨도
// 인접한 날에 같은 구동사가 다시 나와 "매일 다른 3개" 계약이 깨집니다.
const SHUFFLE_SEED = 20260101;

let cachedPhrasalVerbs: PhrasalVerbData[] | null = null;
let inFlightLoad: Promise<PhrasalVerbData[]> | null = null;
let cachedShuffledVerbs: PhrasalVerbData[] | null = null;

// 시드 기반 랜덤 함수
function seededRandom(seed: number) {
  let state = seed;
  return function () {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// 구동사 데이터 로드 (메모리 캐시 + 동시 요청 공유)
export const loadPhrasalVerbsData = async (): Promise<PhrasalVerbData[]> => {
  if (cachedPhrasalVerbs) return cachedPhrasalVerbs;
  if (inFlightLoad) return inFlightLoad;

  inFlightLoad = (async () => {
    try {
      const response = await fetch('/data/phrasalVerbs.json');
      if (response && 'ok' in response && response.ok === false) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const verbs = Array.isArray(data?.phrasalVerbs) ? (data.phrasalVerbs as PhrasalVerbData[]) : [];
      if (verbs.length > 0) {
        cachedPhrasalVerbs = verbs;
      }
      return verbs;
    } catch (error) {
      console.error('구동사 데이터 로드 실패:', error);
      return [];
    } finally {
      inFlightLoad = null;
    }
  })();

  return inFlightLoad;
};

const getShuffledPhrasalVerbs = async (): Promise<PhrasalVerbData[]> => {
  if (cachedShuffledVerbs) return cachedShuffledVerbs;
  const phrasalVerbsData = await loadPhrasalVerbsData();
  if (phrasalVerbsData.length === 0) return [];

  const random = seededRandom(SHUFFLE_SEED);
  const shuffled = [...phrasalVerbsData];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  cachedShuffledVerbs = shuffled;
  return shuffled;
};

// 하루에 3개씩 겹치지 않게 랜덤 선택
export const getDailyPhrasalVerbs = async (date = new Date()) => {
  const shuffled = await getShuffledPhrasalVerbs();
  if (shuffled.length === 0) return [];

  // 날짜에 따라 3개씩 선택
  // 매일 다른 3개를 선택하기 위해 날짜를 인덱스로 사용
  // 전체 리스트를 순환하도록 함
  // DST 전환일에는 로컬 자정 기준 ms 차이가 23/25시간이 되어 이틀이 같은 값이 될 수 있으므로
  // 연/월/일 필드를 UTC로 계산합니다. 연도 기준 대신 epoch 일수를 써서 연말에도 인덱스가
  // 뒤로 튀지 않게 합니다.
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
  const totalVerbs = shuffled.length;
  const startIndex = (dayNumber * 3) % totalVerbs;

  const selected: PhrasalVerbData[] = [];
  for (let i = 0; i < 3; i++) {
    selected.push(shuffled[(startIndex + i) % totalVerbs]);
  }

  return selected;
};

// 뉴스 요약용 구동사를 날짜 기준으로 결정적으로 선택 (오늘의 표현 3개와 겹치지 않도록 +3 오프셋).
// 모든 방문자가 같은 날 같은 프롬프트를 보내 서버 공용 캐시(Upstash Redis) 히트율을 극대화합니다.
export const getDailyNewsPhrasalVerbs = async (date = new Date(), count = 8) => {
  const shuffled = await getShuffledPhrasalVerbs();
  if (shuffled.length === 0) return [];

  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
  const totalVerbs = shuffled.length;
  const startIndex = (dayNumber * 3 + 3) % totalVerbs;
  const limit = Math.min(count, totalVerbs);

  const selected: PhrasalVerbData[] = [];
  for (let i = 0; i < limit; i++) {
    selected.push(shuffled[(startIndex + i) % totalVerbs]);
  }
  return selected;
};

// 랜덤하게 n개의 구동사 선택 (부분 Fisher-Yates)
export const getRandomPhrasalVerbs = async (count = 5) => {
  const phrasalVerbsData = await loadPhrasalVerbsData();
  if (phrasalVerbsData.length === 0) return [];

  const limit = Math.min(count, phrasalVerbsData.length);
  const copy = [...phrasalVerbsData];
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
};

// 구동사 사용 기록 추가
export const markPhrasalVerbUsage = async (phrasalVerb: string, date: Date = new Date()) => {
  return await markPhrasalVerbAsUsed(phrasalVerb, date);
};

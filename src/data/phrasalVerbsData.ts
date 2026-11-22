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

// 구동사 데이터 로드
export const loadPhrasalVerbsData = async () => {
  try {
    const response = await fetch('/data/phrasalVerbs.json');
    const data = await response.json();
    return data.phrasalVerbs as PhrasalVerbData[];
  } catch (error) {
    console.error('구동사 데이터 로드 실패:', error);
    return [];
  }
};

// 날짜 기반 시드 생성
export const getDateSeed = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return year * 10000 + month * 100 + day;
};

// 시드 기반 랜덤 함수
function seededRandom(seed: number) {
  let state = seed;
  return function () {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// 하루에 3개씩 겹치지 않게 랜덤 선택
export const getDailyPhrasalVerbs = async (date = new Date()) => {
  const phrasalVerbsData = await loadPhrasalVerbsData();
  if (phrasalVerbsData.length === 0) return [];

  const random = seededRandom(SHUFFLE_SEED);

  // 전체 리스트를 셔플 (고정 시드 기반)
  const shuffled = [...phrasalVerbsData];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

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

// 랜덤하게 n개의 구동사 선택 (뉴스 생성용)
export const getRandomPhrasalVerbs = async (count = 5) => {
  const phrasalVerbsData = await loadPhrasalVerbsData();
  if (phrasalVerbsData.length === 0) return [];

  // 전체 리스트를 셔플 (순수 랜덤)
  const shuffled = [...phrasalVerbsData];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 앞에서부터 count개 선택
  return shuffled.slice(0, count);
};

// 구동사 사용 기록 추가
export const markPhrasalVerbUsage = async (phrasalVerb: string, date: Date = new Date()) => {
  return await markPhrasalVerbAsUsed(phrasalVerb, date);
};

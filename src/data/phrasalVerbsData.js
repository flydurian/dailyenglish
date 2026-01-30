// 구동사 데이터 관리 시스템
import {
  markPhrasalVerbAsUsed
} from '../utils/usageTracker';

// 구동사 데이터 로드
export const loadPhrasalVerbsData = async () => {
  try {
    const response = await fetch('/data/phrasalVerbs.json');
    const data = await response.json();
    return data.phrasalVerbs;
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
function seededRandom(seed) {
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

  // 날짜 기반 시드 생성 (년-월-일)
  const seed = getDateSeed(date);
  const random = seededRandom(seed);

  // 전체 리스트를 셔플 (시드 기반)
  const shuffled = [...phrasalVerbsData];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 날짜에 따라 3개씩 선택
  // 매일 다른 3개를 선택하기 위해 날짜를 인덱스로 사용
  // 전체 리스트를 순환하도록 함
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const totalVerbs = shuffled.length;
  const startIndex = (dayOfYear * 3) % totalVerbs;

  const selected = [];
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
export const markPhrasalVerbUsage = async (phrasalVerb, date = new Date()) => {
  return await markPhrasalVerbAsUsed(phrasalVerb, date);
};

// 구동사 데이터 관리 시스템
import { 
  markPhrasalVerbAsUsed, 
  getUsedPhrasalVerbsInPeriod 
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
  return function() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// 하루에 3개씩 겹치지 않게 랜덤 선택
export const getDailyPhrasalVerbs = async (date = new Date()) => {
  const phrasalVerbsData = await loadPhrasalVerbsData();
  if (phrasalVerbsData.length === 0) return [];
  
  // 최근 30일 사용된 구동사 제외
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - 30);
  const recentlyUsedVerbs = await getUsedPhrasalVerbsInPeriod(startDate, date);
  
  const availableVerbs = phrasalVerbsData.filter(verb => 
    !recentlyUsedVerbs.includes(verb.verb)
  );
  
  const sourceVerbs = availableVerbs.length >= 3 ? availableVerbs : phrasalVerbsData;
  
  const seed = getDateSeed(date);
  const random = seededRandom(seed);
  
  const selected = [];
  const used = new Set();
  
  while (selected.length < 3 && selected.length < sourceVerbs.length) {
    const index = Math.floor(random() * sourceVerbs.length);
    if (!used.has(index)) {
      used.add(index);
      selected.push(sourceVerbs[index]);
    }
  }
  
  return selected;
};

// 구동사 사용 기록 추가
export const markPhrasalVerbUsage = async (phrasalVerb, date = new Date()) => {
  return await markPhrasalVerbAsUsed(phrasalVerb, date);
};

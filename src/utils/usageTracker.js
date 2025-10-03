// 구동사 사용 여부 추적 시스템

const USAGE_STORAGE_KEY = 'phrasal_verb_usage';
const MAX_STORAGE_DAYS = 30; // 30일간 사용 기록 보관

// 사용된 구동사 기록 저장
export const markPhrasalVerbAsUsed = (phrasalVerb, date = new Date()) => {
  try {
    const dateKey = formatDateKey(date);
    const usageData = getUsageData();
    
    if (!usageData[dateKey]) {
      usageData[dateKey] = [];
    }
    
    // 이미 사용된 구동사인지 확인
    if (!usageData[dateKey].includes(phrasalVerb)) {
      usageData[dateKey].push(phrasalVerb);
      saveUsageData(usageData);
    }
    
    return true;
  } catch (error) {
    console.error('구동사 사용 기록 저장 실패:', error);
    return false;
  }
};

// 특정 구동사가 사용되었는지 확인
export const isPhrasalVerbUsed = (phrasalVerb, date = new Date()) => {
  try {
    const dateKey = formatDateKey(date);
    const usageData = getUsageData();
    
    return usageData[dateKey]?.includes(phrasalVerb) || false;
  } catch (error) {
    console.error('구동사 사용 여부 확인 실패:', error);
    return false;
  }
};

// 특정 기간 동안 사용된 구동사 목록 가져오기
export const getUsedPhrasalVerbsInPeriod = (startDate, endDate) => {
  try {
    const usageData = getUsageData();
    const usedVerbs = new Set();
    
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      const dateKey = formatDateKey(currentDate);
      const dayVerbs = usageData[dateKey] || [];
      dayVerbs.forEach(verb => usedVerbs.add(verb));
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return Array.from(usedVerbs);
  } catch (error) {
    console.error('기간별 사용된 구동사 목록 가져오기 실패:', error);
    return [];
  }
};

// 헬퍼 함수들
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUsageData() {
  try {
    const data = localStorage.getItem(USAGE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('사용 기록 데이터 파싱 실패:', error);
    return {};
  }
}

function saveUsageData(data) {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('사용 기록 데이터 저장 실패:', error);
    return false;
  }
}

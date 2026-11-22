// 캐시 관리 유틸리티 함수들
export const getCacheKey = (type, date) => {
    // Date 객체 유효성 검사
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
        console.error('Invalid date provided to getCacheKey:', date);
        return `${type}_${new Date().toISOString().split('T')[0]}`;
    }
    return `${type}_${dateObj.toISOString().split('T')[0]}`;
};

export const getCachedData = (type, date) => {
    const cacheKey = getCacheKey(type, date);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            console.error(`캐시된 ${type} 파싱 실패:`, e);
            return null;
        }
    }
    return null;
};

export const setCachedData = (type, date, data) => {
    const cacheKey = getCacheKey(type, date);
    // Date 객체 유효성 검사
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
        console.error('Invalid date provided to setCachedData:', date);
        return;
    }
    localStorage.setItem(cacheKey, JSON.stringify({
        data: data,
        timestamp: Date.now(),
        date: dateObj.toISOString().split('T')[0]
    }));
};

export const isCacheValid = (type, date) => {
    const cached = getCachedData(type, date);
    if (!cached) return false;
    
    // Date 객체 유효성 검사
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
        console.error('Invalid date provided to isCacheValid:', date);
        return false;
    }
    
    const requestedDate = dateObj.toISOString().split('T')[0];
    const cacheDate = cached.date;
    
    if (type === 'news') {
        // 뉴스는 오늘 날짜의 캐시만 유효
        const today = new Date().toISOString().split('T')[0];
        return cacheDate === today;
    } else {
        // 표현은 요청한 날짜와 캐시 날짜가 같으면 유효
        return cacheDate === requestedDate;
    }
};

export const cleanupOldMonthlyData = () => {
    // 캐시 키와 cached.date는 getCacheKey/setCachedData와 같은 UTC 기반 YYYY-MM-DD 입니다.
    // new Date(문자열).toDateString()으로 비교하면 UTC 서쪽 타임존에서 하루 전으로 밀려
    // 오늘 캐시까지 삭제되므로 문자열 키끼리 비교합니다.
    const todayKey = new Date().toISOString().split('T')[0];
    const oneWeekAgoKey = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('expressions_') || key.startsWith('news_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                if (cached && cached.date) {
                    if (key.startsWith('news_')) {
                        // 뉴스: 오늘 이외의 모든 데이터 삭제
                        if (cached.date !== todayKey) {
                            localStorage.removeItem(key);
                        }
                    } else if (key.startsWith('expressions_')) {
                        // 표현: 일주일 이전 데이터 삭제 (ISO 문자열은 사전순 비교가 날짜순과 같음)
                        if (cached.date < oneWeekAgoKey) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            } catch (e) {
                // 파싱 실패한 데이터 삭제
                localStorage.removeItem(key);
            }
        }
    });
};

export const getAvailableDates = () => {
    const availableDates = new Set();
    
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('expressions_') || key.startsWith('news_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                if (cached && cached.date) {
                    availableDates.add(cached.date);
                }
            } catch (e) {
                // 파싱 실패한 데이터 무시
            }
        }
    });
    
    return Array.from(availableDates);
};

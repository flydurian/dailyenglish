// 캐시 관리 유틸리티 함수들
export const getCacheKey = (type, date) => {
    return `${type}_${date.toISOString().split('T')[0]}`;
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
    localStorage.setItem(cacheKey, JSON.stringify({
        data: data,
        timestamp: Date.now(),
        date: date.toISOString().split('T')[0]
    }));
};

export const isCacheValid = (type, date) => {
    const cached = getCachedData(type, date);
    if (!cached) return false;
    
    const requestedDate = date.toISOString().split('T')[0];
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
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('expressions_') || key.startsWith('news_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                if (cached && cached.date) {
                    const cacheDate = new Date(cached.date);
                    
                    if (key.startsWith('news_')) {
                        // 뉴스: 오늘 이외의 모든 데이터 삭제
                        if (cacheDate.toDateString() !== today.toDateString()) {
                            localStorage.removeItem(key);
                        }
                    } else if (key.startsWith('expressions_')) {
                        // 표현: 일주일 이전 데이터 삭제
                        if (cacheDate < oneWeekAgo) {
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

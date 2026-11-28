// 캐시 관리 유틸리티 함수들
import { toLocalDateKey } from './dateUtils';

const toValidDate = (date: Date | string): Date | null => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj;
};

export const getCacheKey = (type: string, date: Date | string) => {
    const dateObj = toValidDate(date);
    if (!dateObj) {
        console.error('Invalid date provided to getCacheKey:', date);
        return `${type}_${toLocalDateKey()}`;
    }
    return `${type}_${toLocalDateKey(dateObj)}`;
};

export const getCachedData = (type: string, date: Date | string) => {
    const cacheKey = getCacheKey(type, date);
    let cached: string | null = null;
    try {
        cached = localStorage.getItem(cacheKey);
    } catch {
        return null;
    }
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

export const setCachedData = (type: string, date: Date | string, data: unknown) => {
    const dateObj = toValidDate(date);
    if (!dateObj) {
        console.error('Invalid date provided to setCachedData:', date);
        return;
    }
    const cacheKey = `${type}_${toLocalDateKey(dateObj)}`;
    const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
        date: toLocalDateKey(dateObj)
    });

    try {
        localStorage.setItem(cacheKey, payload);
    } catch (error) {
        // 용량 초과(QuotaExceededError) 시 오래된 캐시를 정리하고 한 번만 재시도합니다.
        try {
            cleanupOldMonthlyData();
            localStorage.setItem(cacheKey, payload);
        } catch (retryError) {
            console.warn(`캐시 저장 실패(${cacheKey}):`, retryError || error);
        }
    }
};

export const isCacheValid = (type: string, date: Date | string) => {
    const cached = getCachedData(type, date);
    if (!cached) return false;

    const dateObj = toValidDate(date);
    if (!dateObj) {
        console.error('Invalid date provided to isCacheValid:', date);
        return false;
    }

    const requestedDate = toLocalDateKey(dateObj);
    const cacheDate = cached.date;

    if (type === 'news') {
        // 뉴스는 로컬 기준 오늘 날짜의 캐시만 유효
        return cacheDate === toLocalDateKey();
    }
    // 표현은 요청한 날짜와 캐시 날짜가 같으면 유효
    return cacheDate === requestedDate;
};

export const cleanupOldMonthlyData = () => {
    // 캐시 키와 cached.date는 모두 로컬 기준 YYYY-MM-DD (toLocalDateKey) 문자열입니다.
    // YYYY-MM-DD 문자열 사전순 비교는 날짜순과 동일하므로 타임존 오차가 발생하지 않습니다.
    const todayKey = toLocalDateKey();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoKey = toLocalDateKey(oneWeekAgo);

    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('expressions_') || key.startsWith('news_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key) || '{}');
                if (cached && cached.date) {
                    if (key.startsWith('news_')) {
                        // 뉴스: 오늘 이외의 모든 데이터 삭제
                        if (cached.date !== todayKey) {
                            localStorage.removeItem(key);
                        }
                    } else if (key.startsWith('expressions_')) {
                        // 표현: 일주일 이전 데이터 삭제
                        if (cached.date < oneWeekAgoKey) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            } catch {
                // 파싱 실패한 데이터 삭제
                localStorage.removeItem(key);
            }
        }
    });
};

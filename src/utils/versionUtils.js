// 앱 해시 기반 업데이트 체크 및 캐시 무효화 유틸리티

const CACHE_KEY = 'app_hash';

// 해시 체크 함수
export const checkForUpdates = async () => {
    try {
        const currentHash = localStorage.getItem(CACHE_KEY);
        
        const response = await fetch(`/hash.json?t=${Date.now()}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        if (response.ok) {
            const { hash: latestHash } = await response.json();
            
            if (currentHash !== latestHash) {
                console.log(`새 빌드 발견: ${currentHash?.substring(0, 8) || '없음'} → ${latestHash.substring(0, 8)}`);
                
                localStorage.setItem(CACHE_KEY, latestHash);
                
                if (window.confirm('새로운 업데이트가 있습니다. 지금 새로고침하시겠습니까?')) {
                    clearAllCaches();
                    window.location.reload(true);
                }
                
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('해시 체크 실패:', error);
        return false;
    }
};

// 모든 캐시 무효화 함수
export const clearAllCaches = () => {
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.clear();
};

// 강제 새로고침 함수
export const forceRefresh = () => {
    clearAllCaches();
    window.location.reload(true);
};

// 앱 시작 시 해시 체크
export const detectHotReload = () => {
    if (process.env.NODE_ENV === 'development') {
        return;
    }
    
    checkForUpdates();
};

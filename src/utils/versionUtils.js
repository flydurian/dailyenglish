// 앱 해시 기반 업데이트 체크 및 캐시 무효화 유틸리티

const CACHE_KEY = 'app_hash';

// 해시 체크 함수
export const checkForUpdates = async () => {
    try {
        const currentHash = localStorage.getItem(CACHE_KEY);
        const lastCheckTime = localStorage.getItem('last_update_check');
        const now = Date.now();
        
        // 5분 이내에 체크했다면 다시 체크하지 않음
        if (lastCheckTime && (now - parseInt(lastCheckTime)) < 5 * 60 * 1000) {
            console.log('최근에 업데이트를 체크했으므로 건너뜁니다.');
            return false;
        }
        
        // 마지막 체크 시간 업데이트
        localStorage.setItem('last_update_check', now.toString());
        
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
                console.log('자동으로 최신 버전을 가져옵니다...');
                
                localStorage.setItem(CACHE_KEY, latestHash);
                
                // 자동으로 캐시를 지우고 새로고침
                clearAllCaches();
                window.location.reload(true);
                
                return true;
            } else {
                console.log('최신 버전입니다.');
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

// 앱 시작 시 해시 체크 (한 번만 실행)
let hasCheckedForUpdates = false;

export const detectHotReload = () => {
    if (process.env.NODE_ENV === 'development') {
        return;
    }
    
    // 이미 체크했다면 다시 체크하지 않음
    if (hasCheckedForUpdates) {
        return;
    }
    
    hasCheckedForUpdates = true;
    checkForUpdates();
};

// 앱 해시 기반 업데이트 체크 및 캐시 무효화 유틸리티

const CACHE_KEY = 'app_hash';

// 해시 체크 함수 (새로고침 시에만 실행)
export const checkForUpdates = async () => {
    try {
        const currentHash = localStorage.getItem(CACHE_KEY);
        const lastCheckTime = localStorage.getItem('last_update_check');
        const now = Date.now();
        
        // 5분 이내에 체크했다면 스킵 (무한 루프 방지)
        if (lastCheckTime && (now - parseInt(lastCheckTime)) < 5 * 60 * 1000) {
            console.log('최근에 업데이트를 체크했습니다. 스킵합니다.');
            return false;
        }
        
        console.log('업데이트 체크 중...');
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
                console.log('새로운 버전이 있습니다. 업데이트를 적용합니다...');
                
                localStorage.setItem(CACHE_KEY, latestHash);
                
                // 자동으로 캐시를 지우고 새로고침
                clearAllCaches();
                
                // 약간의 지연 후 새로고침 (무한 루프 방지)
                setTimeout(() => {
                    window.location.reload(true);
                }, 100);
                
                return true;
            } else {
                console.log('이미 최신 버전입니다.');
            }
        } else {
            console.log('업데이트 정보를 가져올 수 없습니다.');
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

// 사용자 새로고침 시에만 업데이트 체크
export const detectHotReload = () => {
    if (process.env.NODE_ENV === 'development') {
        return;
    }
    
    // 이미 체크했다면 스킵 (무한 루프 방지)
    const hasChecked = sessionStorage.getItem('update_checked');
    if (hasChecked) {
        console.log('이미 업데이트를 체크했습니다. 스킵합니다.');
        return;
    }
    
    // 페이지 로드 시에만 업데이트 체크 (새로고침 감지)
    const isPageRefresh = performance.navigation.type === 1 || 
                         performance.getEntriesByType('navigation')[0]?.type === 'reload';
    
    if (isPageRefresh) {
        console.log('사용자 새로고침 감지 - 업데이트 체크 시작');
        sessionStorage.setItem('update_checked', 'true');
        checkForUpdates();
    }
};

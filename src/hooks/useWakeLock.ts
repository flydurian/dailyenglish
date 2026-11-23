import { useCallback, useEffect, useRef, useState } from 'react';

// 화면 잠금 방지(Screen Wake Lock) 상태를 관리합니다.
// - 토글 버튼 같은 명시적 사용자 동작에서만 켜야 iOS Safari에서 동작합니다.
// - 탭이 가려지면 브라우저가 락을 자동 해제하므로, 다시 보일 때 재요청합니다.
const isWakeLockSupported = (): boolean => (
  typeof navigator !== 'undefined' && 'wakeLock' in navigator
);

const describeError = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') {
    return '브라우저가 화면 잠금 방지를 허용하지 않았어요. 저전력 모드를 확인해 주세요.';
  }
  return '화면 잠금 방지를 켜지 못했어요. 다시 눌러 주세요.';
};

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  disable: () => Promise<void>;
}

export const useWakeLock = (): UseWakeLockResult => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const wantedRef = useRef(false); // 사용자가 켜기를 원하는지 (브라우저가 해제해도 유지)
  const supported = isWakeLockSupported();

  const acquire = useCallback(async (): Promise<boolean> => {
    if (!isWakeLockSupported() || typeof document === 'undefined') return false;
    if (document.visibilityState !== 'visible') return false;

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);
      setError(null);

      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        setIsActive(false);
      }, { once: true });
      return true;
    } catch (requestError) {
      sentinelRef.current = null;
      setIsActive(false);
      setError(describeError(requestError));
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setIsActive(false);
    if (sentinel) {
      try { await sentinel.release(); } catch { /* 이미 해제된 경우 무시 */ }
    }
  }, []);

  const toggle = useCallback(async () => {
    if (wantedRef.current) {
      wantedRef.current = false;
      await release();
      return;
    }

    wantedRef.current = true;
    const acquired = await acquire();
    if (!acquired) wantedRef.current = false;
  }, [acquire, release]);

  const disable = useCallback(async () => {
    wantedRef.current = false;
    await release();
  }, [release]);

  // 탭을 다시 보게 되면 브라우저가 해제한 락을 다시 요청합니다.
  useEffect(() => {
    if (!supported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [supported, acquire]);

  useEffect(() => () => {
    wantedRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) {
      try { void sentinel.release(); } catch { /* ignore */ }
    }
  }, []);

  return { isSupported: supported, isActive, error, toggle, disable };
};

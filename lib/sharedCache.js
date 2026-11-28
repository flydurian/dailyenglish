// 서버리스 인스턴스 간 공유 텍스트 캐시 (Upstash Redis REST).
// - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN이 설정된 프로덕션에서만 동작합니다.
// - 미설정(로컬 개발·테스트) 또는 장애 시 조용히 null을 반환해 인메모리 캐시/업스트림으로 이어집니다.

const KEY_PREFIX = 'dailyenglish:text:';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24시간 (일일 콘텐츠 공유)
const READ_TIMEOUT_MS = 1_500;
const WRITE_TIMEOUT_MS = 2_000;
const MAX_CACHED_BYTES = 200_000;

const getConfig = () => ({
    restUrl: process.env.UPSTASH_REDIS_REST_URL,
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const isSharedCacheConfigured = () => {
    const { restUrl, restToken } = getConfig();
    return Boolean(restUrl && restToken);
};

const runUpstash = async (command, timeoutMs) => {
    const { restUrl, restToken } = getConfig();
    if (!restUrl || !restToken) return null;

    const response = await fetch(restUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${restToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
};

export const getSharedTextCache = async (key) => {
    if (!key || !isSharedCacheConfigured()) return null;
    try {
        const raw = await runUpstash(['GET', `${KEY_PREFIX}${key}`], READ_TIMEOUT_MS);
        if (typeof raw !== 'string' || !raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const setSharedTextCache = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
    if (!key || value === undefined || !isSharedCacheConfigured()) return false;
    try {
        const serialized = JSON.stringify(value);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_CACHED_BYTES) return false;
        await runUpstash(
            ['SET', `${KEY_PREFIX}${key}`, serialized, 'EX', String(ttlSeconds)],
            WRITE_TIMEOUT_MS
        );
        return true;
    } catch {
        return false;
    }
};

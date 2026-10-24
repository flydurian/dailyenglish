// API 공통 보안 유틸리티
// - 허용된 origin만 CORS 응답
// - 브라우저 same-origin 요청 확인
// - IP 기반/전역 메모리 rate limit (서버리스 인스턴스 단위 best-effort)
// - 클라이언트 IP 추출

const PRODUCTION_ORIGIN = 'https://dailyenglish-flybarams-projects.vercel.app';
const PREVIEW_ORIGIN = /^https:\/\/dailyenglish-[a-z0-9-]+-flybarams-projects\.vercel\.app$/;
const DEFAULT_ORIGINS = new Set([
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3000',
]);

const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([...DEFAULT_ORIGINS, PRODUCTION_ORIGIN, ...configuredOrigins]);

export const isAllowedOrigin = (origin) => {
    if (!origin || typeof origin !== 'string') return false;
    if (allowedOrigins.has(origin)) return true;
    return PREVIEW_ORIGIN.test(origin);
};

// CORS는 허용된 origin에만 내려줍니다. (와일드카드 금지)
export const setCorsHeaders = (req, res, methods = 'POST, OPTIONS') => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) return false;

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    return true;
};

const getRefererOrigin = (referer) => {
    if (!referer) return null;
    try {
        return new URL(referer).origin;
    } catch {
        return null;
    }
};

// 브라우저에서 온 same-origin 요청인지 확인합니다.
// Origin이 없더라도 Referer 또는 Sec-Fetch-Site가 same-origin이면 허용합니다.
export const isTrustedRequest = (req) => {
    const origin = req.headers.origin;
    if (origin) return isAllowedOrigin(origin);

    const refererOrigin = getRefererOrigin(req.headers.referer);
    if (refererOrigin) return isAllowedOrigin(refererOrigin);

    return req.headers['sec-fetch-site'] === 'same-origin';
};

export const getClientIp = (req) => {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

    const forwarded = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return (value || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || 'unknown';
};

const buckets = new Map();
const MAX_BUCKETS = 5000;

// 인스턴스 메모리 기반 제한입니다. 서버리스 인스턴스가 여러 개면 합산되지 않습니다.
export const checkRateLimit = (key, limit, windowMs = 60_000) => {
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
        bucket = { start: now, count: 0 };
        buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (buckets.size > MAX_BUCKETS) {
        for (const [bucketKey, value] of buckets) {
            if (now - value.start >= windowMs) buckets.delete(bucketKey);
        }
    }

    return {
        allowed: bucket.count <= limit,
        retryAfter: Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000)),
    };
};

export const setApiSecurityHeaders = (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
};

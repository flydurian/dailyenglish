import assert from 'node:assert/strict';
import {
    isAllowedOrigin,
    isTrustedRequest,
    setCorsHeaders,
} from '../lib/security.js';

// 허용: 공개 프로덕션 도메인, Vercel 프로덕션 도메인, 프리뷰, 로컬 개발
for (const origin of [
    'https://mydailyenglish.vercel.app',
    'https://dailyenglish-flybarams-projects.vercel.app',
    'https://dailyenglish-abc123-flybarams-projects.vercel.app',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3000',
]) {
    assert.equal(isAllowedOrigin(origin), true, `허용되어야 합니다: ${origin}`);
}

// 거부: 다른 도메인, 접두사/서브도메인 사칭, http, trailing slash, 비문자열
for (const origin of [
    'https://evil.com',
    'https://mydailyenglish.vercel.app.evil.com',
    'https://dailyenglish-abc123-flybarams-projects.vercel.app.evil.com',
    'http://mydailyenglish.vercel.app',
    'https://mydailyenglish.vercel.app/',
    'https://MYDAILYENGLISH.vercel.app',
    'https://mydailyenglish.vercel.app@evil.com',
    undefined,
    '',
]) {
    assert.equal(isAllowedOrigin(origin), false, `거부되어야 합니다: ${String(origin)}`);
}
assert.equal(isAllowedOrigin(null), false);

// 기존 same-origin/CORS 판정 로직 유지 확인
assert.equal(isTrustedRequest({ headers: { origin: 'https://mydailyenglish.vercel.app' } }), true);
assert.equal(isTrustedRequest({ headers: { origin: 'https://evil.com' } }), false);
assert.equal(isTrustedRequest({ headers: { referer: 'https://mydailyenglish.vercel.app/news' } }), true);
assert.equal(isTrustedRequest({ headers: { 'sec-fetch-site': 'same-origin' } }), true);
assert.equal(isTrustedRequest({ headers: {} }), false);

const corsHeaders = new Map();
const res = { setHeader: (key, value) => corsHeaders.set(key, value) };
assert.equal(setCorsHeaders({ headers: { origin: 'https://evil.com' } }, res), false);
assert.equal(corsHeaders.size, 0);
assert.equal(setCorsHeaders({ headers: { origin: 'https://mydailyenglish.vercel.app' } }, res), true);
assert.equal(corsHeaders.get('Access-Control-Allow-Origin'), 'https://mydailyenglish.vercel.app');

// VERCEL_PROJECT_PRODUCTION_URL: 쿼리스트링 동적 import 로 새 모듈 인스턴스를 로드합니다.
process.env.VERCEL_PROJECT_PRODUCTION_URL = 'custom-domain.example';
const envModule = await import('../lib/security.js?env=1');
assert.equal(envModule.isAllowedOrigin('https://custom-domain.example'), true);
assert.equal(envModule.isAllowedOrigin('http://custom-domain.example'), false);
assert.equal(envModule.isAllowedOrigin('https://custom-domain.example.evil.com'), false);
assert.equal(envModule.isAllowedOrigin('custom-domain.example'), false);

// 이미 https:// 로 시작하는 값은 그대로 사용
process.env.VERCEL_PROJECT_PRODUCTION_URL = 'https://already-https.example';
const httpsModule = await import('../lib/security.js?env=2');
assert.equal(httpsModule.isAllowedOrigin('https://already-https.example'), true);

// 값이 없으면 추가 허용 없음
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
const emptyModule = await import('../lib/security.js?env=3');
assert.equal(emptyModule.isAllowedOrigin('https://custom-domain.example'), false);

console.log('security tests passed');

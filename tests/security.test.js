import { describe, it, expect } from 'vitest';
import {
  isAllowedOrigin,
  isTrustedRequest,
  setCorsHeaders,
} from '../lib/security.js';

describe('isAllowedOrigin', () => {
  // 허용: 공개 프로덕션 도메인, Vercel 프로덕션 도메인, 프리뷰, 로컬 개발
  it('허용된 origin은 통과시킨다', () => {
    for (const origin of [
      'https://mydailyenglish.vercel.app',
      'https://dailyenglish-flybarams-projects.vercel.app',
      'https://dailyenglish-abc123-flybarams-projects.vercel.app',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3000',
    ]) {
      expect(isAllowedOrigin(origin)).toBe(true);
    }
  });

  // 거부: 다른 도메인, 접두사/서브도메인 사칭, http, trailing slash, 비문자열
  it('사칭/비정상 origin은 거부한다', () => {
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
      expect(isAllowedOrigin(origin)).toBe(false);
    }
    expect(isAllowedOrigin(null)).toBe(false);
  });
});

describe('isTrustedRequest', () => {
  // Origin만 신뢰합니다. Referer/Sec-Fetch-Site는 위조 가능하므로 단독 통과시키지 않습니다.
  it('Origin 헤더만 신뢰한다', () => {
    expect(isTrustedRequest({ headers: { origin: 'https://mydailyenglish.vercel.app' } })).toBe(true);
    expect(isTrustedRequest({ headers: { origin: 'https://evil.com' } })).toBe(false);
    expect(isTrustedRequest({ headers: { referer: 'https://mydailyenglish.vercel.app/news' } })).toBe(false);
    expect(isTrustedRequest({ headers: { 'sec-fetch-site': 'same-origin' } })).toBe(false);
    expect(isTrustedRequest({ headers: {} })).toBe(false);
  });
});

describe('setCorsHeaders', () => {
  it('허용된 origin에만 CORS 헤더를 설정한다', () => {
    const corsHeaders = new Map();
    const res = { setHeader: (key, value) => corsHeaders.set(key, value) };
    expect(setCorsHeaders({ headers: { origin: 'https://evil.com' } }, res)).toBe(false);
    expect(corsHeaders.size).toBe(0);
    expect(setCorsHeaders({ headers: { origin: 'https://mydailyenglish.vercel.app' } }, res)).toBe(true);
    expect(corsHeaders.get('Access-Control-Allow-Origin')).toBe('https://mydailyenglish.vercel.app');
  });
});

describe('VERCEL_PROJECT_PRODUCTION_URL 환경 변수', () => {
  // 쿼리스트링 동적 import 로 새 모듈 인스턴스를 로드합니다.
  it('호스트명 값을 https origin으로 정규화한다', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'custom-domain.example';
    const envModule = await import('../lib/security.js?env=1');
    expect(envModule.isAllowedOrigin('https://custom-domain.example')).toBe(true);
    expect(envModule.isAllowedOrigin('http://custom-domain.example')).toBe(false);
    expect(envModule.isAllowedOrigin('https://custom-domain.example.evil.com')).toBe(false);
    expect(envModule.isAllowedOrigin('custom-domain.example')).toBe(false);
  });

  it('이미 https:// 로 시작하는 값은 그대로 사용한다', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'https://already-https.example';
    const httpsModule = await import('../lib/security.js?env=2');
    expect(httpsModule.isAllowedOrigin('https://already-https.example')).toBe(true);
  });

  it('값이 없으면 추가 허용 없음', async () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const emptyModule = await import('../lib/security.js?env=3');
    expect(emptyModule.isAllowedOrigin('https://custom-domain.example')).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isGoogleTtsConfigured,
  getUsageKey,
  reserveGoogleQuota,
  getGoogleUsage,
  tryGoogleTts,
} from '../lib/googleTts.js';

const ENV_KEYS = [
  'GOOGLE_TTS_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'GOOGLE_TTS_MONTHLY_LIMIT', 'GOOGLE_TTS_VOICE',
];
const savedEnv = {};

const configure = () => {
  process.env.GOOGLE_TTS_API_KEY = 'test-google-key';
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.GOOGLE_TTS_MONTHLY_LIMIT = '900000';
};

// Upstash EVAL 결과를 돌려주고, 구글 합성은 base64 오디오를 돌려주는 fetch 모의
const stubFetch = (evalResult = 10, googleOk = true) => {
  const fetchMock = vi.fn(async (url) => {
    if (url === 'https://upstash.test') {
      return { ok: true, json: async () => ({ result: evalResult }) };
    }
    if (String(url).includes('texttospeech.googleapis.com')) {
      if (!googleOk) return { ok: false, status: 429, text: async () => 'quota' };
      return { ok: true, json: async () => ({ audioContent: Buffer.from('mp3bytes').toString('base64') }) };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('googleTts', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it('설정이 없으면 활성화되지 않고fail-closed 한다', async () => {
    expect(isGoogleTtsConfigured()).toBe(false);
    expect(await reserveGoogleQuota(100)).toBe(false);
    expect(await tryGoogleTts('Take off')).toBeNull();
  });

  it('월 키는 UTC 기준 YYYY-MM 형식이다', () => {
    expect(getUsageKey(new Date('2026-11-23T19:00:00Z'))).toBe('tts:google:2026-11');
    expect(getUsageKey(new Date('2026-12-01T00:30:00Z'))).toBe('tts:google:2026-12');
  });

  it('카운터가 한도 이내면 예약하고 원자적 EVAL을 호출한다', async () => {
    configure();
    const fetchMock = stubFetch(25);
    expect(await reserveGoogleQuota(25)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://upstash.test');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const command = JSON.parse(init.body);
    expect(command[0]).toBe('EVAL');
    expect(command[3]).toBe(getUsageKey());
    expect(command[4]).toBe('900000'); // 앱 캡
    expect(command[5]).toBe('25');
    expect(command[1]).toContain('INCRBY');
    expect(command[1]).toContain('EXPIREAT');
  });

  it('카운터가 -1(한도 초과)을 반환하면 예약하지 않는다', async () => {
    configure();
    stubFetch(-1);
    expect(await reserveGoogleQuota(100)).toBe(false);
  });

  it('Upstash 장애 시 과금 위험을 피하기 위해 예약하지 않는다', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await reserveGoogleQuota(100)).toBe(false);
  });

  it('한도 내에서는 구글 TTS 오디오를 반환한다', async () => {
    configure();
    const fetchMock = stubFetch(10);
    const audio = await tryGoogleTts('Take off your coat.');

    expect(audio.mimeType).toBe('audio/mpeg');
    expect(Buffer.from(audio.bytes).toString()).toBe('mp3bytes');
    const googleCall = fetchMock.mock.calls.find(([url]) => String(url).includes('texttospeech'));
    const body = JSON.parse(googleCall[1].body);
    expect(body.voice.languageCode).toBe('en-GB');
    expect(body.voice.name).toBe('en-GB-Chirp3-HD-Charon');
    expect(body.input.text).toBe('Take off your coat.');
  });

  it('한도 초과 시 구글 API를 아예 호출하지 않는다', async () => {
    configure();
    const fetchMock = stubFetch(-1);
    expect(await tryGoogleTts('Take off')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('texttospeech'))).toBe(false);
  });

  it('구글 API 오류 시 null을 반환한다', async () => {
    configure();
    stubFetch(10, false);
    expect(await tryGoogleTts('Take off')).toBeNull();
  });

  it('사용량 조회는 현재 값을 정수로 반환한다', async () => {
    configure();
    stubFetch(412800);
    // GET은 result를 문자열로 주므로 그대로 숫자 변환되는지 확인
    expect(await getGoogleUsage()).toBe(412800);
  });
});

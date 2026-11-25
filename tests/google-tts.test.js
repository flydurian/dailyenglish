import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isGoogleTtsConfigured,
  getUsageKey,
  getIpUsageKey,
  reserveGoogleQuota,
  releaseGoogleQuota,
  getGoogleUsage,
  tryGoogleTts,
} from '../lib/googleTts.js';

const ENV_KEYS = [
  'GOOGLE_TTS_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'GOOGLE_TTS_MONTHLY_LIMIT', 'GOOGLE_TTS_IP_MONTHLY_LIMIT',
  'GOOGLE_TTS_VOICE', 'GOOGLE_TTS_VOICE_US',
];
const savedEnv = {};
const NOW = new Date('2026-11-25T12:00:00Z');

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

const lastCommand = (fetchMock) => JSON.parse(fetchMock.mock.calls.at(-1)[1].body);

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

  it('설정이 없으면 활성화되지 않고 fail-closed 한다', async () => {
    expect(isGoogleTtsConfigured()).toBe(false);
    expect(await reserveGoogleQuota(100)).toBe(false);
    expect(await tryGoogleTts('Take off')).toBeNull();
  });

  it('월 키는 결제 기준과 같은 태평양 시간의 YYYY-MM 형식이다', () => {
    expect(getUsageKey(new Date('2026-11-23T19:00:00Z'))).toBe('tts:google:2026-11');
    // UTC로는 12월 1일이지만 태평양 시간으로는 아직 11월 30일입니다 (GCP 청구 월과 일치).
    expect(getUsageKey(new Date('2026-12-01T00:30:00Z'))).toBe('tts:google:2026-11');
    expect(getUsageKey(new Date('2026-12-01T08:30:00Z'))).toBe('tts:google:2026-12');
  });

  it('IP 키는 원본 IP를 저장하지 않고 해시만 쓴다', () => {
    configure();
    const key = getIpUsageKey('203.0.113.7', NOW);
    expect(key).toMatch(/^tts:google:ip:[0-9a-f]{16}:2026-11$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('카운터가 한도 이내면 전역+IP 키를 원자적으로 예약한다', async () => {
    configure();
    const fetchMock = stubFetch(25);
    expect(await reserveGoogleQuota(25, NOW, '1.2.3.4')).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://upstash.test');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const command = JSON.parse(init.body);
    expect(command[0]).toBe('EVAL');
    expect(command[2]).toBe('2'); // 키 2개
    expect(command[3]).toBe(getUsageKey(NOW));
    expect(command[4]).toBe(getIpUsageKey('1.2.3.4', NOW));
    expect(command[5]).toBe('900000'); // 앱 캡
    expect(command[6]).toBe('100000'); // IP 캡
    expect(command[7]).toBe('25');
    expect(command[1]).toContain('INCRBY');
    expect(command[1]).toContain('EXPIRE');
    expect(Number(command[8])).toBeGreaterThan(30 * 24 * 60 * 60);
  });

  it('IP 캡을 0으로 두면 IP 제한 없이 전역만 센다', async () => {
    configure();
    process.env.GOOGLE_TTS_IP_MONTHLY_LIMIT = '0';
    const fetchMock = stubFetch(25);
    expect(await reserveGoogleQuota(25, NOW, '1.2.3.4')).toBe(true);
    expect(lastCommand(fetchMock)[6]).toBe('0');
  });

  it('전역 한도를 넘는 설정은 무료 한도(100만 자)로 잘라 쓴다', async () => {
    configure();
    process.env.GOOGLE_TTS_MONTHLY_LIMIT = '2000000';
    const fetchMock = stubFetch(25);
    expect(await reserveGoogleQuota(25, NOW)).toBe(true);
    expect(lastCommand(fetchMock)[5]).toBe('1000000');
  });

  it('카운터가 -1(전역 한도 초과)을 반환하면 예약하지 않는다', async () => {
    configure();
    stubFetch(-1);
    expect(await reserveGoogleQuota(100, NOW, '1.2.3.4')).toBe(false);
  });

  it('카운터가 -2(IP 한도 초과)를 반환하면 예약하지 않는다', async () => {
    configure();
    stubFetch(-2);
    expect(await reserveGoogleQuota(100, NOW, '1.2.3.4')).toBe(false);
  });

  it('Upstash 장애 시 과금 위험을 피하기 위해 예약하지 않는다', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await reserveGoogleQuota(100, NOW, '1.2.3.4')).toBe(false);
  });

  it('영국 발음은 en-GB 여성 보이스로 요청한다', async () => {
    configure();
    const fetchMock = stubFetch(10);
    const audio = await tryGoogleTts('Take off your coat.');

    expect(audio.mimeType).toBe('audio/mpeg');
    expect(audio.accent).toBe('gb');
    expect(Buffer.from(audio.bytes).toString()).toBe('mp3bytes');
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.voice.languageCode).toBe('en-GB');
    expect(body.voice.name).toBe('en-GB-Chirp3-HD-Achernar');
    expect(body.input.text).toBe('Take off your coat.');
  });

  it('미국 발음은 en-US 보이스로 요청한다', async () => {
    configure();
    const fetchMock = stubFetch(10);
    const audio = await tryGoogleTts('Take off your coat.', { accent: 'us' });

    expect(audio.accent).toBe('us');
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.voice.languageCode).toBe('en-US');
    expect(body.voice.name).toBe('en-US-Chirp3-HD-Kore');
  });

  it('환경변수로 발음별 보이스를 바꿀 수 있다', async () => {
    configure();
    process.env.GOOGLE_TTS_VOICE = 'en-GB-Chirp3-HD-Kore';
    process.env.GOOGLE_TTS_VOICE_US = 'en-US-Chirp3-HD-Achernar';
    const fetchMock = stubFetch(10);

    await tryGoogleTts('Hello', { accent: 'gb' });
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body).voice.name).toBe('en-GB-Chirp3-HD-Kore');

    await tryGoogleTts('Hello', { accent: 'us' });
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body).voice.name).toBe('en-US-Chirp3-HD-Achernar');
  });

  it('한도 초과 시 구글 API를 아예 호출하지 않는다', async () => {
    configure();
    const fetchMock = stubFetch(-1);
    expect(await tryGoogleTts('Take off', { clientIp: '1.2.3.4' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('texttospeech'))).toBe(false);
  });

  it('IP 한도 초과 시에도 구글 API를 호출하지 않는다', async () => {
    configure();
    const fetchMock = stubFetch(-2);
    expect(await tryGoogleTts('Take off', { clientIp: '1.2.3.4' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('texttospeech'))).toBe(false);
  });

  it('구글 API 오류 시 null을 반환하고 예약한 한도를 되돌린다', async () => {
    configure();
    const fetchMock = stubFetch(10, false);
    expect(await tryGoogleTts('Take off')).toBeNull();

    // 예약(EVAL) 1회 + 반환(EVAL) 1회 = Upstash 호출 2회, 반환 스크립트는 DECRBY를 씁니다.
    const upstashCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://upstash.test');
    expect(upstashCalls).toHaveLength(2);
    const releaseCommand = JSON.parse(upstashCalls[1][1].body);
    expect(releaseCommand[0]).toBe('EVAL');
    expect(releaseCommand[1]).toContain('DECRBY');
    expect(releaseCommand[5]).toBe(String('Take off'.length));
    expect(releaseCommand[6]).toBe('0'); // IP 없이 호출 → IP 키는 되돌리지 않음
  });

  it('IP가 있으면 반환할 때 IP 사용량도 함께 되돌린다', async () => {
    configure();
    const fetchMock = stubFetch(0);
    await releaseGoogleQuota(120, NOW, '1.2.3.4');
    const command = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(command[1]).toContain('DECRBY');
    expect(command[1]).toContain('SET'); // 0 밑으로 내려가지 않게
    expect(command[4]).toBe(getIpUsageKey('1.2.3.4', NOW));
    expect(command[5]).toBe('120');
    expect(command[6]).toBe('1');
  });

  it('사용량 조회는 현재 값을 정수로 반환한다', async () => {
    configure();
    stubFetch(412800);
    // GET은 result를 문자열로 주므로 그대로 숫자 변환되는지 확인
    expect(await getGoogleUsage()).toBe(412800);
  });
});

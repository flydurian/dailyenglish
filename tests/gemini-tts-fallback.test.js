import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 핸들러가 실제로 발음/클라이언트 IP를 구글 TTS에 넘기고, 오디오를 그대로 내려주는지 확인합니다.
const mocks = vi.hoisted(() => ({
  runModelChain: vi.fn(),
  tryGoogleTts: vi.fn(),
}));

vi.mock('../lib/modelChains.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runModelChain: mocks.runModelChain };
});
vi.mock('../lib/googleTts.js', () => ({ tryGoogleTts: mocks.tryGoogleTts }));

import handler from '../api/gemini.js';

const savedKey = process.env.GEMINI_API_KEY;

const createRes = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(data) { this.body = data; return this; },
  end(data) { this.body = data; return this; },
});

const createReq = ({ accent, tier = 'tts', ip = '203.0.113.9' }) => ({
  method: 'POST',
  headers: {
    origin: 'http://localhost:3002',
    'content-type': 'application/json',
    'x-real-ip': ip,
  },
  body: {
    model: `tier:${tier}`,
    ...(accent ? { accent } : {}),
    ...(tier === 'tts'
      ? {
          format: 'webm',
          payload: {
            contents: [{ parts: [{ text: 'Take off your coat.' }] }],
            generationConfig: { responseModalities: ['AUDIO'] },
          },
        }
      : {
          payload: {
            contents: [{ parts: [{ text: 'Translate this.' }] }],
            generationConfig: {},
          },
        }),
  },
});

describe('api/gemini TTS → Google 서브', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    mocks.runModelChain.mockReset();
    mocks.tryGoogleTts.mockReset();
    // Gemini TTS 후보가 전부 일일 한도에 걸린 상황
    mocks.runModelChain.mockResolvedValue({ ok: false, status: 429, retryAfterSec: 60, tried: [] });
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  });

  it('기본(미국) 발음 실패 시 en-US 구글 오디오를 내려준다', async () => {
    mocks.tryGoogleTts.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      accent: 'us',
    });
    const res = createRes();

    await handler(createReq({ ip: '203.0.113.10' }), res);

    expect(mocks.tryGoogleTts).toHaveBeenCalledWith('Take off your coat.', {
      accent: 'us',
      clientIp: '203.0.113.10',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    expect(res.headers['X-TTS-Provider']).toBe('google-cloud');
    expect(res.headers['X-TTS-Accent']).toBe('us');
    expect(Buffer.from(res.body)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('영국 발음 실패 시 en-GB 구글 오디오를 내려준다', async () => {
    mocks.tryGoogleTts.mockResolvedValue({
      bytes: new Uint8Array([4, 5]),
      mimeType: 'audio/mpeg',
      accent: 'gb',
    });
    const res = createRes();

    await handler(createReq({ accent: 'gb', ip: '203.0.113.11' }), res);

    expect(mocks.tryGoogleTts).toHaveBeenCalledWith('Take off your coat.', {
      accent: 'gb',
      clientIp: '203.0.113.11',
    });
    expect(res.headers['X-TTS-Accent']).toBe('gb');
    expect(res.statusCode).toBe(200);
  });

  it('구글도 한도/미설정이면 기존처럼 429를 돌려준다', async () => {
    mocks.tryGoogleTts.mockResolvedValue(null);
    const res = createRes();

    await handler(createReq({ accent: 'gb', ip: '203.0.113.12' }), res);

    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('60');
    expect(res.headers['X-TTS-Provider']).toBeUndefined();
  });

  it('텍스트 요청 실패에는 구글 TTS를 호출하지 않는다', async () => {
    const res = createRes();

    await handler(createReq({ tier: 'fast', ip: '203.0.113.13' }), res);

    expect(mocks.tryGoogleTts).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });
});

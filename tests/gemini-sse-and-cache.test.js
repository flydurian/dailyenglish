import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchGeminiStream: vi.fn(),
  getSharedTextCache: vi.fn(),
  setSharedTextCache: vi.fn(),
}));

vi.mock('../lib/geminiStream.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchGeminiStream: mocks.fetchGeminiStream };
});

vi.mock('../lib/sharedCache.js', () => ({
  getSharedTextCache: mocks.getSharedTextCache,
  setSharedTextCache: mocks.setSharedTextCache,
}));

import handler from '../api/gemini.js';

const savedKey = process.env.GEMINI_API_KEY;

const createStreamRes = () => {
  const writes = [];
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    writes,
    ended: false,
    setHeader(key, value) { this.headers[key] = value; },
    flushHeaders() {},
    status(code) { this.statusCode = code; return this; },
    write(chunk) { writes.push(chunk); return true; },
    json(data) { this.body = data; this.ended = true; return this; },
    end(data) {
      if (data !== undefined) writes.push(data);
      this.ended = true;
      return this;
    },
  };
};

const createTextReq = ({ text, stream = false, ip }) => ({
  method: 'POST',
  headers: {
    origin: 'http://localhost:3002',
    'content-type': 'application/json',
    'x-real-ip': ip,
  },
  body: {
    model: 'tier:generate',
    ...(stream ? { stream: true } : {}),
    payload: {
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseMimeType: 'text/plain', temperature: 0.2 },
    },
  },
});

describe('api/gemini SSE 스트리밍 및 공유 캐시', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    mocks.fetchGeminiStream.mockReset();
    mocks.getSharedTextCache.mockReset();
    mocks.setSharedTextCache.mockReset();
    mocks.getSharedTextCache.mockResolvedValue(null);
    mocks.setSharedTextCache.mockResolvedValue(true);
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  });

  it('stream: true 요청 시 SSE 델타와 [DONE]을 순서대로 전송하고 캐시에 저장한다', async () => {
    mocks.fetchGeminiStream.mockImplementation(async ({ onTextDelta }) => {
      onTextDelta?.('첫 번째 ');
      onTextDelta?.('강의 문장');
      return {
        ok: true,
        firstChunkAfterMs: 120,
        data: {
          candidates: [{ content: { role: 'model', parts: [{ text: '첫 번째 강의 문장' }] } }],
        },
      };
    });

    const res = createStreamRes();
    await handler(createTextReq({ text: 'Stream lecture unique 1', stream: true, ip: '198.51.100.1' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(res.writes).toEqual([
      'data: {"text":"첫 번째 "}\n\n',
      'data: {"text":"강의 문장"}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(res.ended).toBe(true);
    expect(mocks.setSharedTextCache).toHaveBeenCalledTimes(1);
  });

  it('첫 모델이 첫 조각 전에 429로 실패해도 다음 모델로 SSE 폴백한다', async () => {
    mocks.fetchGeminiStream
      .mockResolvedValueOnce({ ok: false, status: 429, errorText: 'quota' })
      .mockImplementationOnce(async ({ onTextDelta }) => {
        onTextDelta?.('폴백 성공');
        return {
          ok: true,
          firstChunkAfterMs: 80,
          data: {
            candidates: [{ content: { role: 'model', parts: [{ text: '폴백 성공' }] } }],
          },
        };
      });

    const res = createStreamRes();
    await handler(createTextReq({ text: 'Stream fallback unique 2', stream: true, ip: '198.51.100.2' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(res.writes).toEqual([
      'data: {"text":"폴백 성공"}\n\n',
      'data: [DONE]\n\n',
    ]);
  });

  it('Upstash 공유 캐시 HIT 시 Gemini를 호출하지 않고 HIT-SHARED 헤더로 즉시 응답한다', async () => {
    const cachedValue = {
      candidates: [{ content: { role: 'model', parts: [{ text: '공유 캐시 응답' }] } }],
    };
    mocks.getSharedTextCache.mockResolvedValue(cachedValue);

    const res = createStreamRes();
    await handler(createTextReq({ text: 'Shared cache unique 3', stream: true, ip: '198.51.100.3' }), res);

    expect(mocks.fetchGeminiStream).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Gemini-Cache']).toBe('HIT-SHARED');
    expect(res.body).toEqual(cachedValue);
  });
});

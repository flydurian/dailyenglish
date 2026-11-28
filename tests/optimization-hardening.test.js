import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchGeminiStream } from '../lib/geminiStream.js';
import { isSharedCacheConfigured, getSharedTextCache, setSharedTextCache } from '../lib/sharedCache.js';
import { checkRateLimit } from '../lib/security.js';
import { parseWavChunks } from '../lib/audioTranscode.js';
import { decodeHtmlEntities } from '../api/news.js';
import { getDailyPhrasalVerbs, getDailyNewsPhrasalVerbs } from '../src/data/phrasalVerbsData';

const encoder = new TextEncoder();

const sseResponse = (chunks) => ({
  ok: true,
  status: 200,
  body: new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }),
});

describe('lib/geminiStream onTextDelta', () => {
  it('thought 파트는 무시하고 본문 텍스트 델타만 순서대로 전달한다', async () => {
    const deltas = [];
    const result = await fetchGeminiStream({
      url: 'https://example.test/stream',
      init: { method: 'POST' },
      firstChunkMs: 1000,
      idleMs: 1000,
      totalMs: 2000,
      onTextDelta: (delta) => deltas.push(delta),
      fetchImpl: async () => sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"생각 중","thought":true}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"안녕"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"하세요!"}]}}]}\n\n',
      ]),
    });

    expect(result.ok).toBe(true);
    expect(deltas).toEqual(['안녕', '하세요!']);
    expect(result.data.candidates[0].content.parts[0].text).toBe('안녕하세요!');
  });
});

describe('lib/sharedCache', () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const savedFetch = globalThis.fetch;

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    globalThis.fetch = savedFetch;
  });

  it('Upstash 미설정 시 네트워크 호출 없이 null/false를 반환한다', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    expect(isSharedCacheConfigured()).toBe(false);
    expect(await getSharedTextCache('abc')).toBeNull();
    expect(await setSharedTextCache('abc', { ok: true })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Upstash 설정 시 JSON을 조회하고 저장한다', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-token';

    const store = new Map();
    globalThis.fetch = vi.fn(async (_url, init) => {
      const cmd = JSON.parse(init.body);
      if (cmd[0] === 'SET') {
        store.set(cmd[1], cmd[2]);
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      if (cmd[0] === 'GET') {
        return { ok: true, json: async () => ({ result: store.get(cmd[1]) ?? null }) };
      }
      return { ok: false, status: 400 };
    });

    expect(isSharedCacheConfigured()).toBe(true);
    expect(await setSharedTextCache('daily-1', { text: 'hello' }, 3600)).toBe(true);
    expect(await getSharedTextCache('daily-1')).toEqual({ text: 'hello' });
  });
});

describe('lib/security checkRateLimit', () => {
  it('지정 한도까지는 허용하고 초과 시 차단한다', () => {
    const key = `test:limit:${Date.now()}:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe('lib/audioTranscode parseWavChunks', () => {
  it('홀수 byteOffset을 가진 버퍼 슬라이스도 정상 파싱한다', () => {
    const raw = new Uint8Array(45);
    const wav = raw.subarray(1); // byteOffset === 1 (odd)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    wav.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    view.setUint32(4, 36, true);
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    wav.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt 
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, 24000, true); // sampleRate
    view.setUint16(34, 16, true); // bitsPerSample
    wav.set([0x64, 0x61, 0x74, 0x61], 36); // data
    view.setUint32(40, 0, true);

    const parsed = parseWavChunks(wav);
    expect(parsed).not.toBeNull();
    expect(parsed.fmt.sampleRate).toBe(24000);
    expect(parsed.data.byteOffset % 2).toBe(1);
  });
});

describe('api/news decodeHtmlEntities', () => {
  it('이름/숫자/16진수 HTML 엔티티를 정상 디코딩한다', () => {
    expect(decodeHtmlEntities('Apple &amp; Google&#39;s &quot;AI&quot; &#x2014; &lt;new&gt;'))
      .toBe('Apple & Google\'s "AI" — <new>');
  });
});

describe('getDailyNewsPhrasalVerbs', () => {
  const savedFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  it('같은 날짜에는 결정적으로 동일한 8개 구동사를 반환하며 오늘의 표현 3개와 겹치지 않는다', async () => {
    const sample = Array.from({ length: 30 }, (_, i) => ({
      verb: `verb-${i}`,
      meaning: `뜻-${i}`,
    }));
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ phrasalVerbs: sample }),
    }));

    const date = new Date(2026, 10, 28);
    const exprVerbs = await getDailyPhrasalVerbs(date);
    const newsVerbs1 = await getDailyNewsPhrasalVerbs(date, 8);
    const newsVerbs2 = await getDailyNewsPhrasalVerbs(date, 8);

    expect(newsVerbs1).toEqual(newsVerbs2);
    expect(newsVerbs1).toHaveLength(8);
    const exprSet = new Set(exprVerbs.map((v) => v.verb));
    for (const nv of newsVerbs1) {
      expect(exprSet.has(nv.verb)).toBe(false);
    }
  });
});

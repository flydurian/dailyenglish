import { describe, it, expect } from 'vitest';
import {
  AUDIO_CACHE_DB_NAME,
  LEGACY_AUDIO_CACHE_DB_NAMES,
} from '../src/utils/audioCache.ts';

describe('audioCache DB 정리 목록', () => {
  // 회귀 방지: 예전에 현재 캐시 DB까지 시작할 때 지워서 방문마다 TTS를 다시 생성했습니다.
  it('현재 쓰는 캐시 DB는 레거시 삭제 목록에 없다', () => {
    expect(LEGACY_AUDIO_CACHE_DB_NAMES).not.toContain(AUDIO_CACHE_DB_NAME);
  });

  it('예전 DB 이름만 정리 대상으로 둔다', () => {
    expect(LEGACY_AUDIO_CACHE_DB_NAMES).toContain('dailyenglish-audio');
    expect(LEGACY_AUDIO_CACHE_DB_NAMES.every((name) => name !== AUDIO_CACHE_DB_NAME)).toBe(true);
  });
});

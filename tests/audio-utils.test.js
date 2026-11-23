import { describe, it, expect } from 'vitest';
import { isDirectPlayableAudio } from '../src/utils/audioUtils.ts';

describe('isDirectPlayableAudio', () => {
  it('이미 재생 가능한 포맷은 그대로 통과시킨다', () => {
    for (const type of ['audio/wav', 'audio/webm', 'audio/webm; codecs="opus"', 'audio/mpeg', 'audio/mp3']) {
      expect(isDirectPlayableAudio(type)).toBe(true);
    }
  });

  it('raw PCM은 WAV 변환이 필요하므로 제외한다', () => {
    expect(isDirectPlayableAudio('audio/l16; rate=24000')).toBe(false);
    expect(isDirectPlayableAudio('')).toBe(false);
  });
});

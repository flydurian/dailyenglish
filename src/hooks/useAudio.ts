import { useState, useCallback, useEffect, useRef } from 'react';
import { requestTtsAudio, supportsOpusWebm } from '../utils/apiUtils';
import { pcmToWav } from '../utils/audioUtils';
import { getCachedAudio, setCachedAudio, clearAudioCache } from '../utils/audioCache';

// TTS 전용 모델 체인(3.8 Flash TTS → 예비 TTS 모델들, lib/modelChains.js)을 씁니다.
const TTS_MODEL = 'tier:tts';

// 서버(api/gemini.js)의 MAX_TTS_TEXT_CHARS 와 일치시킵니다.
const TTS_MAX_CHARS = 1600;

type AudioState = 'loading' | 'playing' | 'idle';
type AudioStates = Record<string, AudioState>;
type Accent = 'us' | 'gb';

// 너무 긴 텍스트는 문장 경계에서 잘라 400 오류 대신 대부분을 읽어주도록 합니다.
const trimForTts = (text: string): string => {
    const clean = typeof text === 'string' ? text.replace(/\*\*(.*?)\*\*/g, '$1').trim() : '';
    if (clean.length <= TTS_MAX_CHARS) return clean;

    const sliced = clean.slice(0, TTS_MAX_CHARS);
    const lastStop = Math.max(
        sliced.lastIndexOf('. '),
        sliced.lastIndexOf('! '),
        sliced.lastIndexOf('? ')
    );
    return lastStop > TTS_MAX_CHARS * 0.5 ? sliced.slice(0, lastStop + 1) : sliced;
};

// 실패 이유를 사용자에게 보여줄 짧은 문구로 바꿉니다.
export const describeAudioError = (error: { code?: string; retryAfterSec?: number | null; name?: string } | null | undefined): string => {
    if (error?.code === 'RATE_LIMIT') {
        const sec = error.retryAfterSec;
        const wait = sec && sec <= 120 ? `약 ${sec}초 뒤` : '잠시 후';
        return `음성 생성 한도에 걸렸어요. ${wait} 다시 눌러 주세요.`;
    }
    // iOS Safari는 음성을 만드는 동안 시간이 지나면 자동 재생을 맙니다.
    if (error?.name === 'NotAllowedError') {
        return '음성이 준비됐어요. 스피커를 한 번 더 눌러 주세요.';
    }
    return '음성을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
};

const NOTICE_MS = 4500;

interface AudioNotice {
  id: number;
  message: string;
}

export interface UseAudioResult {
  audioStates: AudioStates;
  playAudio: (sentence: string, accent?: Accent) => Promise<boolean>;
  clearAllAudioCache: () => Promise<void>;
  audioNotice: AudioNotice | null;
  dismissAudioNotice: () => void;
}

export const useAudio = (): UseAudioResult => {
    const [audioStates, setAudioStates] = useState<AudioStates>({});
    const [audioNotice, setAudioNotice] = useState<AudioNotice | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const audioElements = useRef(new Map<string, HTMLAudioElement>());
    const objectUrls = useRef(new Map<string, string>());

    const updateState = useCallback((text: string, state: AudioState) => {
        setAudioStates((prev) => (prev[text] === state ? prev : { ...prev, [text]: state }));
    }, []);

    const dismissAudioNotice = useCallback(() => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        setAudioNotice(null);
    }, []);

    const showAudioNotice = useCallback((message: string) => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        setAudioNotice({ id: Date.now(), message });
        noticeTimer.current = setTimeout(() => setAudioNotice(null), NOTICE_MS);
    }, []);

    const playBlob = useCallback(async (stateKey: string, cacheKey: string, blob: Blob) => {
        const previousUrl = objectUrls.current.get(cacheKey);
        if (previousUrl) URL.revokeObjectURL(previousUrl);

        const url = URL.createObjectURL(blob);
        objectUrls.current.set(cacheKey, url);

        const audio = new Audio(url);
        audio.preload = 'auto';
        audioElements.current.set(cacheKey, audio);

        audio.onplay = () => updateState(stateKey, 'playing');
        audio.onended = () => updateState(stateKey, 'idle');
        audio.onerror = () => {
            updateState(stateKey, 'idle');
            audioElements.current.delete(cacheKey);
        };

        await audio.play();
    }, [updateState]);

    // accent('us' | 'gb')가 오면 그 억양으로 생성하고 캐시 키에도 포함해 서로 섞이지 않게 합니다.
    const playAudio = useCallback(async (sentence: string, accent?: Accent): Promise<boolean> => {
        if (!sentence) return false;
        if (audioStates[sentence] === 'loading') return false;

        const cacheKey = accent ? `${accent}:${sentence}` : sentence;
        const existing = audioElements.current.get(cacheKey);
        if (existing) {
            try {
                existing.currentTime = 0;
                updateState(sentence, 'playing');
                await existing.play();
                return true;
            } catch {
                audioElements.current.delete(cacheKey);
                updateState(sentence, 'idle');
            }
        }

        updateState(sentence, 'loading');

        try {
            // 1) IndexedDB 캐시 → 2) Gemini TTS 순서로 확인합니다.
            let blob = await getCachedAudio(cacheKey);

            if (!blob) {
                const ttsText = trimForTts(sentence);

                if (!ttsText) {
                    throw new Error('읽을 텍스트가 없습니다.');
                }

                const audioBlob = await requestTtsAudio(ttsText, TTS_MODEL, supportsOpusWebm ? 'webm' : 'wav', accent);

                if (/audio\/(wav|wave|x-wav|webm)/i.test(audioBlob.type)) {
                    blob = audioBlob;
                } else {
                    const sampleRate = parseInt(audioBlob.type.match(/rate=(\d+)/)?.[1] || '24000', 10);
                    const pcm16 = new Int16Array(await audioBlob.arrayBuffer());

                    if (pcm16.length === 0) {
                        throw new Error('유효하지 않은 PCM 데이터');
                    }

                    blob = pcmToWav(pcm16, sampleRate);
                }

                if (!blob || blob.size === 0) {
                    throw new Error('유효하지 않은 오디오 데이터');
                }

                await setCachedAudio(cacheKey, blob);
            }

            await playBlob(sentence, cacheKey, blob);
            return true;
        } catch (error) {
            console.error('음성을 재생하는 데 실패했습니다:', error);
            updateState(sentence, 'idle');
            showAudioNotice(describeAudioError(error as { name?: string }));
            return false;
        }
    }, [audioStates, playBlob, updateState, showAudioNotice]);

    const clearAllAudioCache = useCallback(async () => {
        objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.current.clear();
        audioElements.current.clear();
        setAudioStates({});
        await clearAudioCache();
    }, []);

    useEffect(() => {
        // 이전 버전의 localStorage 오디오 캐시와 구 모델 IndexedDB 캐시를 정리합니다.
        try { localStorage.removeItem('tts_audio_cache'); } catch { /* ignore */ }
        try { indexedDB.deleteDatabase('dailyenglish-audio'); } catch { /* ignore */ }

        const urls = objectUrls.current;
        const timer = noticeTimer;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    return {
        audioStates,
        playAudio,
        clearAllAudioCache,
        audioNotice,
        dismissAudioNotice,
    };
};

import { useState, useCallback, useEffect, useRef } from 'react';
import { requestTtsAudio, supportsOpusWebm } from '../utils/apiUtils';
import { isDirectPlayableAudio, pcmToWav } from '../utils/audioUtils';
import { LEGACY_AUDIO_CACHE_DB_NAMES, getCachedAudio, setCachedAudio, clearAudioCache } from '../utils/audioCache';

// TTS 전용 모델 체인(3.8 Flash TTS → 예비 TTS 모델들, lib/modelChains.js)을 씁니다.
const TTS_MODEL = 'tier:tts';

// 서버(api/gemini.js)의 MAX_TTS_TEXT_CHARS 와 일치시킵니다.
const TTS_MAX_CHARS = 1600;

// 왕실 영국 발음 목소리로 바꾸면서 예전에 캐시된(미국식일 수 있는) 오디오를 다시 만들도록
// 캐시 키에 버전을 넣습니다. 버전을 올리면 이전 캐시는 자연스럽게 TTL로 정리됩니다.
const CACHE_VERSION = 'v3';

// 마지막 후보: 서버 TTS가 모두 실패(한도·오류)하면 브라우저 내장 음성 합성으로 읽습니다.
// API 할당량과 무관하고 en-GB 음성을 지원하므로 영국 발음이 완전히 끊기지 않습니다.
const playWithBrowserTts = (text: string, accent?: Accent): Promise<boolean> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve(false);

    return new Promise((resolve) => {
        try {
            const synth = window.speechSynthesis;
            synth.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const lang = accent === 'gb' ? 'en-GB' : 'en-US';

            const voices = synth.getVoices();
            const preferred = voices.find((voice) => voice.lang.toLowerCase().replace('_', '-') === lang.toLowerCase())
                || voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
            if (preferred) utterance.voice = preferred;
            utterance.lang = lang;
            utterance.rate = 0.95;

            let settled = false;
            let started = false;
            let safetyTimer: ReturnType<typeof setTimeout> | null = null;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                if (safetyTimer) clearTimeout(safetyTimer);
                resolve(ok);
            };
            utterance.onstart = () => { started = true; };
            utterance.onend = () => finish(true);
            utterance.onerror = () => finish(false);
            synth.speak(utterance);
            // 일부 브라우저는 ended 이벤트를 놓치므로 문장 길이에 맞춰 안전 타임아웃을 둡니다.
            // 이미 재생이 시작됐다면 실패로 처리하지 않습니다 (재생 중에 오류 안내가 뜨는 것 방지).
            safetyTimer = setTimeout(() => finish(started), Math.max(6000, text.length * 120));
        } catch {
            resolve(false);
        }
    });
};

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
const MAX_AUDIO_CACHE_ITEMS = 12;

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

const isNotAllowedError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'NotAllowedError');

export const useAudio = (): UseAudioResult => {
    const [audioStates, setAudioStates] = useState<AudioStates>({});
    const [audioNotice, setAudioNotice] = useState<AudioNotice | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const audioElements = useRef(new Map<string, HTMLAudioElement>());
    const objectUrls = useRef(new Map<string, string>());
    const loadingKeysRef = useRef(new Set<string>());
    const playbackGenRef = useRef(0);
    const activePlaybackRef = useRef<{
        audio: HTMLAudioElement | null;
        stateKey: string | null;
        cacheKey: string | null;
    }>({ audio: null, stateKey: null, cacheKey: null });

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

    const stopCurrentPlayback = useCallback(() => {
        const active = activePlaybackRef.current;
        if (active.audio) {
            try {
                active.audio.pause();
                active.audio.currentTime = 0;
            } catch { /* ignore */ }
        }
        if (active.stateKey) {
            updateState(active.stateKey, 'idle');
        }
        activePlaybackRef.current = { audio: null, stateKey: null, cacheKey: null };
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
        }
    }, [updateState]);

    const evictOldAudioElements = useCallback((protectedKey: string) => {
        const elements = audioElements.current;
        const urls = objectUrls.current;
        while (elements.size > MAX_AUDIO_CACHE_ITEMS) {
            const oldestKey = elements.keys().next().value as string | undefined;
            if (!oldestKey || oldestKey === protectedKey || oldestKey === activePlaybackRef.current.cacheKey) {
                break;
            }
            const oldAudio = elements.get(oldestKey);
            if (oldAudio) {
                try { oldAudio.pause(); } catch { /* ignore */ }
            }
            elements.delete(oldestKey);
            const oldUrl = urls.get(oldestKey);
            if (oldUrl) {
                URL.revokeObjectURL(oldUrl);
                urls.delete(oldestKey);
            }
        }
    }, []);

    const playBlob = useCallback(async (stateKey: string, cacheKey: string, blob: Blob, gen: number) => {
        const previousUrl = objectUrls.current.get(cacheKey);
        if (previousUrl) URL.revokeObjectURL(previousUrl);

        const url = URL.createObjectURL(blob);
        objectUrls.current.delete(cacheKey);
        objectUrls.current.set(cacheKey, url);

        const audio = new Audio(url);
        audio.preload = 'auto';
        audioElements.current.delete(cacheKey);
        audioElements.current.set(cacheKey, audio);
        evictOldAudioElements(cacheKey);

        audio.onplay = () => {
            if (playbackGenRef.current === gen) {
                updateState(stateKey, 'playing');
            }
        };
        audio.onended = () => {
            if (activePlaybackRef.current.audio === audio) {
                activePlaybackRef.current = { audio: null, stateKey: null, cacheKey: null };
            }
            updateState(stateKey, 'idle');
        };
        audio.onerror = () => {
            if (activePlaybackRef.current.audio === audio) {
                activePlaybackRef.current = { audio: null, stateKey: null, cacheKey: null };
            }
            updateState(stateKey, 'idle');
            audioElements.current.delete(cacheKey);
        };

        activePlaybackRef.current = { audio, stateKey, cacheKey };
        await audio.play();
    }, [evictOldAudioElements, updateState]);

    // accent('us' | 'gb')가 오면 그 억양으로 생성하고 캐시 키에도 포함해 서로 섞이지 않게 합니다.
    const playAudio = useCallback(async (sentence: string, accent?: Accent): Promise<boolean> => {
        if (!sentence) return false;

        const cacheKey = `${CACHE_VERSION}:${accent ?? 'default'}:${sentence}`;
        if (loadingKeysRef.current.has(cacheKey)) return false;

        stopCurrentPlayback();
        const gen = ++playbackGenRef.current;

        const existing = audioElements.current.get(cacheKey);
        if (existing) {
            try {
                // 최근 사용 항목으로 갱신
                audioElements.current.delete(cacheKey);
                audioElements.current.set(cacheKey, existing);
                existing.currentTime = 0;
                activePlaybackRef.current = { audio: existing, stateKey: sentence, cacheKey };
                updateState(sentence, 'playing');
                await existing.play();
                return true;
            } catch (playError) {
                activePlaybackRef.current = { audio: null, stateKey: null, cacheKey: null };
                updateState(sentence, 'idle');
                if (isNotAllowedError(playError)) {
                    showAudioNotice(describeAudioError(playError as { name?: string }));
                    return false;
                }
                audioElements.current.delete(cacheKey);
            }
        }

        loadingKeysRef.current.add(cacheKey);
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

                // 구글 TTS의 audio/mpeg(mp3)도 그대로 재생해야 합니다. PCM 변환 대상은 아닙니다.
                if (isDirectPlayableAudio(audioBlob.type)) {
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

            // 대기하는 동안 다른 음성이 요청됐다면 캐시 저장만 끝내고 재생은 건너뜁니다.
            if (playbackGenRef.current !== gen) {
                updateState(sentence, 'idle');
                return false;
            }

            await playBlob(sentence, cacheKey, blob, gen);
            return true;
        } catch (error) {
            console.error('음성을 재생하는 데 실패했습니다:', error);

            // iOS Safari 자동재생 제한(NotAllowedError): 이미 고품질 오디오가 캐시돼 있으므로
            // 브라우저 로봇 음성으로 덮어쓰지 않고 한 번 더 탭하도록 안내합니다.
            if (isNotAllowedError(error)) {
                updateState(sentence, 'idle');
                showAudioNotice(describeAudioError(error as { name?: string }));
                return false;
            }

            if (playbackGenRef.current !== gen) {
                updateState(sentence, 'idle');
                return false;
            }

            // 서버 TTS 후보가 모두 막히면 브라우저 음성(en-GB / en-US)으로 대신 읽습니다.
            activePlaybackRef.current = { audio: null, stateKey: sentence, cacheKey };
            updateState(sentence, 'playing');
            const playedLocally = await playWithBrowserTts(trimForTts(sentence), accent);
            if (playbackGenRef.current === gen) {
                activePlaybackRef.current = { audio: null, stateKey: null, cacheKey: null };
                updateState(sentence, 'idle');
            }
            if (playedLocally) return true;

            showAudioNotice(describeAudioError(error as { name?: string }));
            return false;
        } finally {
            loadingKeysRef.current.delete(cacheKey);
        }
    }, [playBlob, showAudioNotice, stopCurrentPlayback, updateState]);

    const clearAllAudioCache = useCallback(async () => {
        stopCurrentPlayback();
        objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.current.clear();
        audioElements.current.clear();
        setAudioStates({});
        await clearAudioCache();
    }, [stopCurrentPlayback]);

    useEffect(() => {
        // 이전 버전의 localStorage 오디오 캐시와 구 모델 IndexedDB 캐시를 정리합니다.
        // 주의: 지금 쓰는 DB는 여기서 지우지 않습니다. 지우면 방문할 때마다 캐시가 비어
        // 매번 TTS를 다시 생성해 무료 한도를 낭비합니다. (캐시 무효화는 CACHE_VERSION이 담당)
        try { localStorage.removeItem('tts_audio_cache'); } catch { /* ignore */ }
        for (const dbName of LEGACY_AUDIO_CACHE_DB_NAMES) {
            try { indexedDB.deleteDatabase(dbName); } catch { /* ignore */ }
        }

        const urls = objectUrls.current;
        const elements = audioElements.current;
        const timer = noticeTimer;
        return () => {
            elements.forEach((audio) => {
                try { audio.pause(); } catch { /* ignore */ }
            });
            elements.clear();
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

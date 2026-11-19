import { useState, useCallback, useEffect, useRef } from 'react';
import { requestTtsAudio, supportsOpusWebm } from '../utils/apiUtils';
import { pcmToWav } from '../utils/audioUtils';
import { getCachedAudio, setCachedAudio, clearAudioCache } from '../utils/audioCache';

// TTS 전용 모델 체인(3.8 Flash TTS → 예비 TTS 모델들, lib/modelChains.js)을 씁니다.
const TTS_MODEL = 'tier:tts';

// 서버(api/gemini.js)의 MAX_TTS_TEXT_CHARS 와 일치시킵니다.
const TTS_MAX_CHARS = 1600;

// 너무 긴 텍스트는 문장 경계에서 잘라 400 오류 대신 대부분을 읽어주도록 합니다.
const trimForTts = (text) => {
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

// 실패 이유를 사용자에게 보여줄 짧은 문구로 바꿉니다. 빠른 실패(한도 초과 등)는 스피너가
// 0.3초만 깜빡이고 사라져 "되고 있는 건가?" 싶었으므로 꼭 알려줍니다.
export const describeAudioError = (error) => {
    if (error?.code === 'RATE_LIMIT') {
        const sec = error.retryAfterSec;
        const wait = sec && sec <= 120 ? `약 ${sec}초 뒤` : '잠시 후';
        return `음성 생성 한도에 걸렸어요. ${wait} 다시 눌러 주세요.`;
    }
    // iOS Safari는 음성을 만드는 동안 시간이 지나면 자동 재생을 막습니다. 오디오는 준비돼 있어 다시 누르면 바로 재생됩니다.
    if (error?.name === 'NotAllowedError') {
        return '음성이 준비됐어요. 스피커를 한 번 더 눌러 주세요.';
    }
    return '음성을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
};

const NOTICE_MS = 4500;

export const useAudio = () => {
    const [audioStates, setAudioStates] = useState({});
    const [audioNotice, setAudioNotice] = useState(null);
    const noticeTimer = useRef(null);
    const audioElements = useRef(new Map());
    const objectUrls = useRef(new Map());

    const updateState = useCallback((text, state) => {
        setAudioStates((prev) => (prev[text] === state ? prev : { ...prev, [text]: state }));
    }, []);

    const dismissAudioNotice = useCallback(() => {
        clearTimeout(noticeTimer.current);
        setAudioNotice(null);
    }, []);

    const showAudioNotice = useCallback((message) => {
        clearTimeout(noticeTimer.current);
        setAudioNotice({ id: Date.now(), message });
        noticeTimer.current = setTimeout(() => setAudioNotice(null), NOTICE_MS);
    }, []);

    const playBlob = useCallback(async (stateKey, cacheKey, blob) => {
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
    // 화면 로딩 상태는 텍스트 기준이라 기존 컴포넌트는 그대로 동작합니다.
    const playAudio = useCallback(async (sentence, accent) => {
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
            } catch (error) {
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

                // TTS는 중복 과금/요청을 막기 위해 클라이언트 자동 재시도를 하지 않습니다.
                // 서버가 트랜스코딩한 작은 Opus/WebM을 기본으로 받고, 미지원 브라우저는
                // WAV로 요청합니다. 서버 트랜스코딩 실패 시에도 WAV로 내려오므로 둘 다 재생 가능.
                const audioBlob = await requestTtsAudio(ttsText, TTS_MODEL, supportsOpusWebm ? 'webm' : 'wav', accent);

                if (/audio\/(wav|wave|x-wav|webm)/i.test(audioBlob.type)) {
                    // 서버가 완성된 WebM(Opus) 또는 WAV를 반환합니다.
                    blob = audioBlob;
                } else {
                    // 이전 모델은 raw PCM(L16)을 반환하므로 WAV로 감쌉니다.
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
            showAudioNotice(describeAudioError(error));
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
        try { localStorage.removeItem('tts_audio_cache'); } catch (error) { /* ignore */ }
        try { indexedDB.deleteDatabase('dailyenglish-audio'); } catch (error) { /* ignore */ }

        const urls = objectUrls.current;
        const timer = noticeTimer;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
            clearTimeout(timer.current);
        };
    }, []);

    return {
        audioStates,
        playAudio,
        clearAllAudioCache,
        audioNotice,
        dismissAudioNotice
    };
};

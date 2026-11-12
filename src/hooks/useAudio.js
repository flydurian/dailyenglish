import { useState, useCallback, useEffect, useRef } from 'react';
import { requestTtsAudio } from '../utils/apiUtils';
import { pcmToWav } from '../utils/audioUtils';
import { getCachedAudio, setCachedAudio, clearAudioCache } from '../utils/audioCache';

// 텍스트 생성(3.5 Flash Lite)과 달리 TTS는 오디오 품질을 위해 별도 모델을 사용합니다.
const TTS_MODEL = 'gemini-3.8-flash-tts';

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

export const useAudio = () => {
    const [audioStates, setAudioStates] = useState({});
    const audioElements = useRef(new Map());
    const objectUrls = useRef(new Map());

    const updateState = useCallback((text, state) => {
        setAudioStates((prev) => (prev[text] === state ? prev : { ...prev, [text]: state }));
    }, []);

    const playBlob = useCallback(async (text, blob) => {
        const previousUrl = objectUrls.current.get(text);
        if (previousUrl) URL.revokeObjectURL(previousUrl);

        const url = URL.createObjectURL(blob);
        objectUrls.current.set(text, url);

        const audio = new Audio(url);
        audio.preload = 'auto';
        audioElements.current.set(text, audio);

        audio.onplay = () => updateState(text, 'playing');
        audio.onended = () => updateState(text, 'idle');
        audio.onerror = () => {
            updateState(text, 'idle');
            audioElements.current.delete(text);
        };

        await audio.play();
    }, [updateState]);

    const playAudio = useCallback(async (sentence) => {
        if (!sentence) return;
        if (audioStates[sentence] === 'loading') return;

        const existing = audioElements.current.get(sentence);
        if (existing) {
            try {
                existing.currentTime = 0;
                updateState(sentence, 'playing');
                await existing.play();
                return;
            } catch (error) {
                audioElements.current.delete(sentence);
                updateState(sentence, 'idle');
            }
        }

        updateState(sentence, 'loading');

        try {
            // 1) IndexedDB 캐시 → 2) Gemini TTS 순서로 확인합니다.
            let blob = await getCachedAudio(sentence);

            if (!blob) {
                const ttsText = trimForTts(sentence);

                if (!ttsText) {
                    throw new Error('읽을 텍스트가 없습니다.');
                }

                // TTS는 중복 과금/요청을 막기 위해 클라이언트 자동 재시도를 하지 않습니다.
                const audioBlob = await requestTtsAudio(ttsText, TTS_MODEL);

                if (/audio\/(wav|wave|x-wav)/i.test(audioBlob.type)) {
                    // 3.8 TTS는 완성된 WAV를 반환합니다.
                    blob = new Blob([audioBlob], { type: 'audio/wav' });
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

                await setCachedAudio(sentence, blob);
            }

            await playBlob(sentence, blob);
        } catch (error) {
            console.error('음성을 재생하는 데 실패했습니다:', error);
            updateState(sentence, 'idle');
            throw error;
        }
    }, [audioStates, playBlob, updateState]);

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
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);

    return {
        audioStates,
        playAudio,
        clearAllAudioCache
    };
};

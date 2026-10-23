import { useState, useCallback, useEffect, useRef } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';
import { base64ToArrayBuffer, pcmToWav } from '../utils/audioUtils';
import { getCachedAudio, setCachedAudio, clearAudioCache } from '../utils/audioCache';

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

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
                const payload = {
                    contents: [{ parts: [{ text: sentence }] }],
                    generationConfig: { responseModalities: ['AUDIO'] },
                    model: TTS_MODEL
                };

                const result = await callGeminiAPI(payload, TTS_MODEL, 2);
                const part = result?.candidates?.[0]?.content?.parts?.[0];
                const audioData = part?.inlineData?.data;
                const mimeType = part?.inlineData?.mimeType;

                if (!audioData || !mimeType?.startsWith('audio/')) {
                    throw new Error('유효한 오디오 데이터를 받지 못했습니다.');
                }

                const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000', 10);
                const pcmData = base64ToArrayBuffer(audioData);
                const pcm16 = new Int16Array(pcmData);

                if (pcm16.length === 0) {
                    throw new Error('유효하지 않은 PCM 데이터');
                }

                blob = pcmToWav(pcm16, sampleRate);
                if (!blob || blob.size === 0) {
                    throw new Error('유효하지 않은 WAV 데이터');
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
        // 이전 버전의 localStorage 오디오 캐시는 더 이상 사용하지 않으므로 정리합니다.
        try { localStorage.removeItem('tts_audio_cache'); } catch (error) { /* ignore */ }

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

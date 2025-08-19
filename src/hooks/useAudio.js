import { useState, useCallback } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';
import { base64ToArrayBuffer, pcmToWav } from '../utils/audioUtils';

export const useAudio = () => {
    const [audioStates, setAudioStates] = useState({});
    const [audioCache, setAudioCache] = useState({});

    const playAudio = useCallback(async (sentence) => {
        if (audioStates[sentence] === 'loading') return;
        
        // 캐시된 오디오가 있는지 확인
        if (audioCache[sentence]) {
            const cachedAudio = audioCache[sentence];
            setAudioStates(prev => ({ ...prev, [sentence]: 'playing' }));
            
            try {
                await cachedAudio.play();
                cachedAudio.onended = () => {
                    setAudioStates(prev => ({ ...prev, [sentence]: 'idle' }));
                };
                cachedAudio.onerror = () => {
                    setAudioStates(prev => ({ ...prev, [sentence]: 'idle' }));
                };
                return;
            } catch (e) {
                console.error("캐시된 음성 재생 실패:", e);
                // 캐시된 음성 재생에 실패하면 새로 불러오기
                delete audioCache[sentence];
            }
        }
        
        setAudioStates(prev => ({ ...prev, [sentence]: 'loading' }));
        
        try {
            const payload = {
                contents: [{ parts: [{ text: sentence }] }],
                generationConfig: { responseModalities: ["AUDIO"] },
                model: "gemini-2.5-flash-preview-tts"
            };
            
            const result = await callGeminiAPI(payload, 'gemini-2.5-flash-preview-tts');
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;
            
            if (audioData && mimeType?.startsWith("audio/")) {
                const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10);
                const pcmData = base64ToArrayBuffer(audioData);
                const pcm16 = new Int16Array(pcmData);
                const wavBlob = pcmToWav(pcm16, sampleRate);
                const audioUrl = URL.createObjectURL(wavBlob);
                const audio = new Audio(audioUrl);
                
                // 오디오를 캐시에 저장
                setAudioCache(prev => ({ ...prev, [sentence]: audio }));
                
                audio.onplay = () => setAudioStates(prev => ({ ...prev, [sentence]: 'playing' }));
                audio.onended = () => {
                    setAudioStates(prev => ({ ...prev, [sentence]: 'idle' }));
                };
                audio.onerror = () => {
                    setAudioStates(prev => ({ ...prev, [sentence]: 'idle' }));
                    // 에러 발생 시 캐시에서 제거
                    setAudioCache(prev => {
                        const newCache = { ...prev };
                        delete newCache[sentence];
                        return newCache;
                    });
                };
                
                await audio.play();
            } else {
                throw new Error("유효한 오디오 데이터를 받지 못했습니다.");
            }
        } catch (e) {
            console.error("음성을 재생하는 데 실패했습니다:", e);
            setAudioStates(prev => ({ ...prev, [sentence]: 'idle' }));
            throw e;
        }
    }, [audioStates, audioCache]);

    // 뉴스 관련 음성 캐시 삭제
    const clearNewsAudioCache = useCallback(() => {
        setAudioCache(prev => {
            const newCache = { ...prev };
            // 뉴스 관련 텍스트들을 식별하여 캐시에서 제거
            Object.keys(newCache).forEach(key => {
                // 뉴스 제목이나 본문으로 보이는 긴 텍스트들을 제거
                if (key.length > 50 || key.includes('news') || key.includes('article')) {
                    delete newCache[key];
                }
            });
            return newCache;
        });
        
        // 뉴스 관련 오디오 상태도 초기화
        setAudioStates(prev => {
            const newStates = { ...prev };
            Object.keys(newStates).forEach(key => {
                if (key.length > 50 || key.includes('news') || key.includes('article')) {
                    delete newStates[key];
                }
            });
            return newStates;
        });
    }, []);

    // 1주일 전 표현 관련 음성 캐시 삭제
    const clearOldExpressionsAudioCache = useCallback(() => {
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        setAudioCache(prev => {
            const newCache = { ...prev };
            // 표현 관련 텍스트들을 식별하여 캐시에서 제거
            Object.keys(newCache).forEach(key => {
                // 표현 문장으로 보이는 중간 길이 텍스트들을 제거 (뉴스보다 짧고, 단어보다 긴)
                if (key.length > 20 && key.length < 100 && !key.includes('news') && !key.includes('article')) {
                    delete newCache[key];
                }
            });
            return newCache;
        });
        
        // 표현 관련 오디오 상태도 초기화
        setAudioStates(prev => {
            const newStates = { ...prev };
            Object.keys(newStates).forEach(key => {
                if (key.length > 20 && key.length < 100 && !key.includes('news') && !key.includes('article')) {
                    delete newStates[key];
                }
            });
            return newStates;
        });
    }, []);

    return { audioStates, playAudio, clearNewsAudioCache, clearOldExpressionsAudioCache };
};

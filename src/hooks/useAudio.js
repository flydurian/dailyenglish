import { useState, useCallback, useEffect } from 'react';
import { callGeminiAPI } from '../utils/apiUtils';
import { base64ToArrayBuffer, pcmToWav } from '../utils/audioUtils';

// TTS 캐시 관리 유틸리티
const TTS_CACHE_KEY = 'tts_audio_cache';
const MAX_CACHE_SIZE = 50; // 최대 50개 오디오 캐시
const CACHE_EXPIRY_DAYS = 7; // 7일 후 캐시 만료

// 로컬 스토리지에서 캐시 로드
const loadAudioCache = () => {
    try {
        const cached = localStorage.getItem(TTS_CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const validCache = {};
            
            // 만료된 캐시 제거
            Object.keys(cacheData).forEach(key => {
                if (cacheData[key].timestamp && (now - cacheData[key].timestamp) < (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)) {
                    validCache[key] = cacheData[key];
                }
            });
            
            return validCache;
        }
    } catch (error) {
        console.error('TTS 캐시 로드 실패:', error);
    }
    return {};
};

// 로컬 스토리지에 캐시 저장
const saveAudioCache = (cache) => {
    try {
        localStorage.setItem(TTS_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('TTS 캐시 저장 실패:', error);
    }
};

export const useAudio = () => {
    const [audioStates, setAudioStates] = useState({});
    const [audioCache, setAudioCache] = useState({});
    const [persistentCache, setPersistentCache] = useState({});

    // 컴포넌트 마운트 시 영구 캐시 로드
    useEffect(() => {
        const loadedCache = loadAudioCache();
        setPersistentCache(loadedCache);
        
        // 메모리 캐시에 영구 캐시 데이터 로드
        const memoryCache = {};
        Object.keys(loadedCache).forEach(key => {
            if (loadedCache[key].audioUrl) {
                const audio = new Audio(loadedCache[key].audioUrl);
                audio.preload = 'auto';
                memoryCache[key] = audio;
            }
        });
        setAudioCache(memoryCache);
    }, []);

    const playAudio = useCallback(async (sentence) => {
        if (audioStates[sentence] === 'loading') return;
        
        // 메모리 캐시에서 먼저 확인
        if (audioCache[sentence]) {
            const cachedAudio = audioCache[sentence];
            setAudioStates(prev => ({ ...prev, [sentence]: 'playing' }));
            
            try {
                // blob URL이 유효한지 확인하고 재생
                if (cachedAudio.src && cachedAudio.src.startsWith('blob:')) {
                    await cachedAudio.play();
                } else {
                    throw new Error('Invalid audio source');
                }
                
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
                setAudioCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[sentence];
                    return newCache;
                });
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
                
                // 오디오를 메모리 캐시에 저장
                setAudioCache(prev => ({ ...prev, [sentence]: audio }));
                
                // 영구 캐시에 저장 (blob 데이터 직접 저장)
                const cacheEntry = {
                    blobData: Array.from(new Uint8Array(await wavBlob.arrayBuffer())),
                    timestamp: Date.now(),
                    text: sentence,
                    mimeType: 'audio/wav'
                };
                
                setPersistentCache(prev => {
                    const newCache = { ...prev, [sentence]: cacheEntry };
                    
                    // 캐시 크기 제한
                    const keys = Object.keys(newCache);
                    if (keys.length > MAX_CACHE_SIZE) {
                        // 가장 오래된 항목 제거
                        const sortedKeys = keys.sort((a, b) => 
                            newCache[a].timestamp - newCache[b].timestamp
                        );
                        delete newCache[sortedKeys[0]];
                    }
                    
                    saveAudioCache(newCache);
                    return newCache;
                });
                
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
            Object.keys(newCache).forEach(key => {
                if (key.length > 50 || key.includes('news') || key.includes('article')) {
                    delete newCache[key];
                }
            });
            return newCache;
        });
        
        setAudioStates(prev => {
            const newStates = { ...prev };
            Object.keys(newStates).forEach(key => {
                if (key.length > 50 || key.includes('news') || key.includes('article')) {
                    delete newStates[key];
                }
            });
            return newStates;
        });
        
        // 영구 캐시에서도 제거
        setPersistentCache(prev => {
            const newCache = { ...prev };
            Object.keys(newCache).forEach(key => {
                if (key.length > 50 || key.includes('news') || key.includes('article')) {
                    delete newCache[key];
                }
            });
            saveAudioCache(newCache);
            return newCache;
        });
    }, []);

    // 오래된 음성 캐시 정리
    const clearOldAudioCache = useCallback(() => {
        const now = Date.now();
        const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        
        setAudioCache(prev => {
            const newCache = { ...prev };
            const cacheData = JSON.parse(localStorage.getItem(TTS_CACHE_KEY) || '{}');
            Object.keys(newCache).forEach(key => {
                if (cacheData[key] && (now - cacheData[key].timestamp) > expiryTime) {
                    delete newCache[key];
                }
            });
            return newCache;
        });
        
        setPersistentCache(prev => {
            const newCache = {};
            Object.keys(prev).forEach(key => {
                if (prev[key].timestamp && (now - prev[key].timestamp) <= expiryTime) {
                    newCache[key] = prev[key];
                }
            });
            saveAudioCache(newCache);
            return newCache;
        });
    }, []);

    // 모든 캐시 삭제
    const clearAllAudioCache = useCallback(() => {
        setAudioCache({});
        setAudioStates({});
        setPersistentCache({});
        localStorage.removeItem(TTS_CACHE_KEY);
    }, []);

    return { 
        audioStates, 
        playAudio, 
        clearNewsAudioCache, 
        clearOldAudioCache,
        clearAllAudioCache
    };
};

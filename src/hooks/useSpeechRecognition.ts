import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API(SpeechRecognition)는 TS DOM lib에 정식 선언이 없어 최소 타입만 정의합니다.
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
  length: number;
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface RecognitionErrorEvent {
  error: string;
  message?: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

export type SpeechStatus = 'idle' | 'listening' | 'error';

const getRecognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
};

export const isSpeechRecognitionSupported = (): boolean => Boolean(getRecognitionCtor());

const describeError = (code?: string): string => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '마이크 권한이 필요해요. 브라우저에서 마이크 사용을 허용해 주세요.';
    case 'no-speech':
      return '목소리가 감지되지 않았어요. 조금 더 크게 읽어 주세요.';
    case 'audio-capture':
      return '마이크를 찾을 수 없어요. 마이크가 연결되어 있는지 확인해 주세요.';
    case 'network':
      return '음성 인식 서비스에 연결하지 못했어요. 네트워크를 확인해 주세요.';
    case 'aborted':
      return '';
    default:
      return '음성을 인식하지 못했어요. 다시 시도해 주세요.';
  }
};

export interface UseSpeechRecognitionResult {
  status: SpeechStatus;
  transcript: string;
  interim: string;
  error: string | null;
  start: (lang?: string) => boolean;
  stop: () => void;
  reset: () => void;
}

export const useSpeechRecognition = (): UseSpeechRecognitionResult => {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  const release = useCallback(() => {
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      try { current.abort(); } catch { /* 이미 종료된 경우 무시 */ }
    }
  }, []);

  const stop = useCallback(() => {
    const current = recognitionRef.current;
    if (current) {
      try { current.stop(); } catch { /* 이미 종료된 경우 무시 */ }
    }
    setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const reset = useCallback(() => {
    release();
    setTranscript('');
    setInterim('');
    setError(null);
    setStatus('idle');
  }, [release]);

  // TTS가 영국 왕실 발음(RP)이므로 음성 인식도 영국 영어로 듣습니다.
  const start = useCallback((lang = 'en-GB') => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('이 브라우저에서는 음성 인식을 지원하지 않아요. Chrome 또는 Safari에서 이용해 주세요.');
      setStatus('error');
      return false;
    }

    release();
    setTranscript('');
    setInterim('');
    setError(null);

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText.trim()) {
        setTranscript((prev) => (prev ? `${prev} ${finalText.trim()}` : finalText.trim()));
      }
      setInterim(interimText.trim());
    };

    recognition.onerror = (event) => {
      const message = describeError(event?.error);
      if (message) {
        setError(message);
        setStatus('error');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim('');
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
    };

    recognitionRef.current = recognition;
    setStatus('listening');

    try {
      recognition.start();
      return true;
    } catch {
      setError('음성 인식을 시작하지 못했어요. 다시 눌러 주세요.');
      setStatus('error');
      return false;
    }
  }, [release]);

  useEffect(() => () => release(), [release]);

  return { status, transcript, interim, error, start, stop, reset };
};

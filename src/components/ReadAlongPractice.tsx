import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { MicIcon, StopIcon, RetryIcon, CloseIcon } from './Icons';
import { isSpeechRecognitionSupported, useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { scoreSpeech, type WordStatus } from '../utils/speechScoring';

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(224, 122, 95, 0.35); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(224, 122, 95, 0); }
`;

const PracticeBox = styled.div<{ $compact?: boolean }>`
  margin-top: ${({ $compact }) => ($compact ? '10px' : '14px')};
  padding: ${({ $compact }) => ($compact ? '11px 12px' : '14px')};
  border: 1px dashed var(--coral);
  border-radius: 14px;
  background: #fffaf1;
  animation: practice-in 220ms ease both;

  @keyframes practice-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
`;

const Title = styled.span`
  color: var(--coral);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const IconButton = styled.button`
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--card-paper);
  color: var(--muted);
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg { width: 13px !important; height: 13px !important; }
  &:hover { border-color: var(--ink); color: var(--ink); }
  &:active { transform: scale(0.94); }
`;

const Prompt = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
`;

const Hint = styled.p`
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: keep-all;
`;

const Listening = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px 10px;
  text-align: center;
`;

const PulseMic = styled.div`
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--coral);
  color: #fff;
  animation: ${pulse} 1.4s ease-in-out infinite;

  svg { width: 24px !important; height: 24px !important; }
`;

const ListeningText = styled.span`
  color: var(--forest);
  font-size: 13px;
  font-weight: 650;
`;

const InterimText = styled.span`
  min-height: 18px;
  color: var(--muted);
  font-size: 12px;
  font-style: italic;
`;

const ResultRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
`;

const Accuracy = styled.strong<{ $good: boolean }>`
  color: ${({ $good }) => ($good ? 'var(--forest)' : 'var(--coral)')};
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1;
`;

const Counts = styled.span`
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
`;

const wordColors: Record<WordStatus, string> = {
  correct: '#2f7d58',
  wrong: '#c1502f',
  missed: '#9a9286',
};

const wordBackgrounds: Record<WordStatus, string> = {
  correct: '#e4f2e9',
  wrong: '#fbe7de',
  missed: '#f0ede7',
};

const Word = styled.span<{ $status: WordStatus; $bold: boolean }>`
  display: inline-block;
  margin: 0 4px 6px 0;
  padding: 3px 7px;
  border-radius: 7px;
  background: ${({ $status }) => wordBackgrounds[$status]};
  color: ${({ $status }) => wordColors[$status]};
  font-size: 14px;
  font-weight: ${({ $bold }) => ($bold ? 700 : 600)};
  line-height: 1.4;
  border-bottom: 2px solid ${({ $status }) => wordColors[$status]};

  ${({ $status }) => $status === 'missed' && css`
    border-bottom-style: dashed;
    opacity: 0.85;
  `}
`;

const WordList = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 2px;

  span {
    color: var(--muted);
    font-size: 10px;
  }
  i {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 4px;
    border-radius: 2px;
  }
`;

const HeardBox = styled.div`
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 9px;
  background: var(--paper-deep, #f3ecdf);

  small {
    display: block;
    margin-bottom: 3px;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: #5f574a;
    font-size: 12.5px;
    line-height: 1.5;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 11px;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 5px 11px;
  border: 1px solid ${({ $primary }) => ($primary ? 'var(--coral)' : 'var(--line)')};
  border-radius: 9px;
  background: ${({ $primary }) => ($primary ? 'var(--coral)' : 'var(--card-paper)')};
  color: ${({ $primary }) => ($primary ? '#fff' : 'var(--ink)')};
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg { width: 13px !important; height: 13px !important; }
  &:hover { filter: brightness(0.96); }
  &:active { transform: scale(0.96); }
`;

const ErrorText = styled.p`
  margin: 0 0 10px;
  color: var(--coral);
  font-size: 12.5px;
  line-height: 1.6;
  word-break: keep-all;
`;

interface ReadAlongPracticeProps {
  /** 마크다운(**)을 포함할 수 있는 목표 문장 */
  text: string;
  onClose?: () => void;
  compact?: boolean;
  autoStart?: boolean;
}

const ReadAlongPractice = ({ text, onClose, compact = false, autoStart = false }: ReadAlongPracticeProps) => {
  const { status, transcript, interim, error, start, stop, reset } = useSpeechRecognition();
  const autoStarted = useRef(false);

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [autoStart, start]);

  const handleClose = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    reset();
    onClose?.();
  }, [reset, onClose]);

  const handleStart = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    reset();
    start();
  }, [reset, start]);

  const handleStop = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    stop();
  }, [stop]);

  const score = useMemo(
    () => (transcript ? scoreSpeech(text, transcript) : null),
    [text, transcript]
  );

  const supported = isSpeechRecognitionSupported();
  const listening = status === 'listening';

  return (
    <PracticeBox $compact={compact} onClick={(event) => event.stopPropagation()}>
      <Header>
        <Title>Shadowing · 따라 읽기</Title>
        <IconButton type="button" onClick={handleClose} aria-label="따라 읽기 닫기">
          <CloseIcon />
        </IconButton>
      </Header>

      {!supported ? (
        <ErrorText>
          이 브라우저에서는 음성 인식을 지원하지 않아요. Chrome 또는 Safari에서 따라 읽기를 이용해 주세요.
        </ErrorText>
      ) : listening ? (
        <Listening>
          <PulseMic><MicIcon /></PulseMic>
          <ListeningText>듣고 있어요... 문장을 소리 내어 읽어 주세요.</ListeningText>
          <InterimText>{interim || '　'}</InterimText>
          <ActionButton type="button" onClick={handleStop}>
            <StopIcon /> <span>그만두기</span>
          </ActionButton>
        </Listening>
      ) : error ? (
        <>
          <ErrorText>{error}</ErrorText>
          <Actions>
            <ActionButton type="button" $primary onClick={handleStart}>
              <RetryIcon /> <span>다시 시도</span>
            </ActionButton>
          </Actions>
        </>
      ) : score ? (
        <>
          <ResultRow>
            <Accuracy $good={score.accuracy >= 80}>{score.accuracy}%</Accuracy>
            <Counts>
              {score.correct}/{score.total} 단어 인식 · 놓침 {score.missed} · 다름 {score.wrong}
            </Counts>
          </ResultRow>

          <WordList>
            {score.words.map((word, index) => (
              <Word key={`${index}-${word.display}`} $status={word.status} $bold={word.bold}>
                {word.display}
              </Word>
            ))}
          </WordList>

          <Legend>
            <span><i style={{ background: wordBackgrounds.correct }} />인식됨</span>
            <span><i style={{ background: wordBackgrounds.wrong }} />다르게 들림</span>
            <span><i style={{ background: wordBackgrounds.missed }} />놓침</span>
          </Legend>

          <HeardBox>
            <small>들린 내용</small>
            <p>{score.transcript || '—'}</p>
          </HeardBox>

          <Actions>
            <ActionButton type="button" $primary onClick={handleStart}>
              <RetryIcon /> <span>다시 읽기</span>
            </ActionButton>
            <ActionButton type="button" onClick={handleClose}>닫기</ActionButton>
          </Actions>
        </>
      ) : (
        <>
          <Prompt>아래 버튼을 누르고 문장을 소리 내어 읽어 보세요.</Prompt>
          <Hint>말한 단어가 초록색으로, 놓친 단어가 주황·회색으로 표시돼요.</Hint>
          <Actions>
            <ActionButton type="button" $primary onClick={handleStart}>
              <MicIcon /> <span>읽기 시작</span>
            </ActionButton>
          </Actions>
        </>
      )}
    </PracticeBox>
  );
};

export default React.memo(ReadAlongPractice);

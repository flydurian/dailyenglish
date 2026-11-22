import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, LoaderIcon } from './Icons';
import AccentFlags from './AccentFlags';
import { useWordbook } from '../contexts/WordbookContext';
import { useProgress } from '../contexts/ProgressContext';
import { toLocalDateKey } from '../utils/dateUtils';
import { getDueItems, getNextDueDate, gradeItem } from '../utils/srs';
import type { WordbookItem } from '../utils/wordbookUtils';
import type { Accent, AudioStates, PlayAudio } from '../types';

interface ReviewViewProps {
  onPlayAudio: PlayAudio;
  audioStates?: AudioStates;
}

const shuffle = (list: WordbookItem[]) => {
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const isTypingTarget = (target: unknown) => {
  const el = target as { tagName?: unknown; getAttribute?: (name: string) => string | null; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || tag === 'BUTTON' || tag === 'A' || el.getAttribute?.('role') === 'button'
    || el.isContentEditable;
};

const getDueItemIds = (items: WordbookItem[], todayKey: string): string[] => (
  getDueItems(items, todayKey).map((item) => item.id)
);

const Wrapper = styled.section`
  width: 100%;
`;

const SessionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 10px;
`;

const Progress = styled.span`
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  white-space: nowrap;
`;

const ModeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--coral);
  border-radius: 999px;
  color: var(--coral);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
`;

const KeyboardHint = styled.span`
  margin-left: auto;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.04em;
  white-space: nowrap;

  @media (max-width: 480px) {
    display: none;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  min-height: 270px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--card-paper);
  animation: review-card-in 260ms cubic-bezier(0.2, 0.7, 0.2, 1) both;

  @keyframes review-card-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 480px) {
    min-height: 250px;
    padding: 18px;
    border-radius: 18px;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const Term = styled.h2`
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(32px, 10vw, 44px);
  font-style: italic;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
`;

const AudioButton = styled.button`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg {
    width: 17px;
    height: 17px;
  }

  &:hover,
  &.on {
    border-color: var(--coral);
    color: var(--coral);
  }

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const FrontActions = styled.div`
  margin-top: auto;
  padding-top: 22px;
`;

const Back = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
  animation: review-fade-in 180ms ease both;

  @keyframes review-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Meaning = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.65;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
`;

const ExampleBox = styled.div`
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
`;

const ExampleText = styled.p`
  margin: 0;
  color: var(--muted);
  font-family: var(--font-display);
  font-size: 14px;
  font-style: italic;
  line-height: 1.6;
  overflow-wrap: anywhere;
`;

const ExampleAction = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease;
  touch-action: manipulation;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover,
  &.on {
    color: var(--coral);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 0 18px;
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  &:hover {
    border-color: var(--coral);
    background: var(--coral);
  }

  &:active {
    transform: scale(0.985);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
`;

const GradeRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 18px;
`;

const GradeButton = styled(PrimaryButton)`
  flex: 1 1 0;
  width: auto;
  min-width: 0;
  padding: 0 10px;
`;

const AgainButton = styled(GradeButton)`
  border-color: var(--line);
  background: transparent;
  color: var(--ink);

  &:hover {
    border-color: var(--ink);
    background: transparent;
    color: var(--ink);
  }
`;

const KnownButton = styled(GradeButton)`
  border-color: var(--coral);
  background: var(--coral);
  color: var(--paper);

  &:hover {
    border-color: var(--ink);
    background: var(--ink);
  }
`;

const SecondaryButton = styled(PrimaryButton)`
  border-color: var(--line);
  background: transparent;
  color: var(--ink);

  &:hover {
    border-color: var(--ink);
    background: transparent;
    color: var(--ink);
  }
`;

const Panel = styled.div`
  padding: 34px 22px;
  border: 1px dashed var(--line);
  border-radius: 20px;
  background: var(--card-paper);
  text-align: center;

  @media (max-width: 480px) {
    padding: 28px 18px;
    border-radius: 18px;
  }
`;

const PanelTitle = styled.h3`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-style: italic;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.025em;
  text-wrap: pretty;
`;

const PanelText = styled.p`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 15px;
  font-style: italic;
  line-height: 1.7;
  text-wrap: pretty;
`;

const PanelHint = styled.p`
  margin: 9px 0 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  line-height: 1.6;
`;

const EndSummary = styled.p`
  margin: 12px 0 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
`;

const PanelActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
`;

const EndBadge = styled.div`
  margin-bottom: 10px;
`;

const ReviewView = ({ onPlayAudio, audioStates = {} }: ReviewViewProps) => {
  const { items, updateItem } = useWordbook();
  const { record } = useProgress();
  const [todayKey] = useState(() => toLocalDateKey());
  const [mode, setMode] = useState('review');
  const [sessionIds, setSessionIds] = useState(() => getDueItemIds(items, todayKey));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const itemsById = useMemo(() => (
    new Map(items.map((item) => [item.id, item]))
  ), [items]);

  const sessionItems = useMemo(() => (
    sessionIds.map((id) => itemsById.get(id)).filter(Boolean)
  ), [sessionIds, itemsById]);

  const total = sessionItems.length;
  const currentItem = sessionItems[index];
  const canPlay = typeof onPlayAudio === 'function';

  const handleGrade = useCallback((known: boolean) => {
    if (!currentItem || !revealed || finished) return;

    record('reviewed');

    if (mode === 'review' && currentItem.srs?.lastReviewed !== todayKey) {
      updateItem(currentItem.id, { srs: gradeItem(currentItem, known, todayKey) });
    }

    if (known) setKnownCount((count) => count + 1);
    else setAgainCount((count) => count + 1);

    setRevealed(false);
    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex((current) => current + 1);
    }
  }, [currentItem, finished, index, mode, record, revealed, todayKey, total, updateItem]);

  const handleReveal = useCallback(() => {
    if (!currentItem || finished) return;
    setRevealed(true);
  }, [currentItem, finished]);

  const resetSessionState = useCallback(() => {
    setIndex(0);
    setRevealed(false);
    setKnownCount(0);
    setAgainCount(0);
    setFinished(false);
  }, []);

  const startReview = useCallback(() => {
    setMode('review');
    setSessionIds(getDueItemIds(items, todayKey));
    resetSessionState();
  }, [items, todayKey, resetSessionState]);

  const startPractice = useCallback(() => {
    setMode('practice');
    setSessionIds(shuffle(items).map((item) => item.id));
    resetSessionState();
  }, [items, resetSessionState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (!currentItem || finished) return;

      if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }

      if (!revealed) return;

      if (event.key === 'ArrowLeft' || event.key === 'Left' || event.key === '1') {
        event.preventDefault();
        handleGrade(false);
      } else if (event.key === 'ArrowRight' || event.key === 'Right' || event.key === '2') {
        event.preventDefault();
        handleGrade(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, finished, revealed, handleGrade]);

  const play = (text: string, accent?: Accent) => {
    if (canPlay) onPlayAudio(text, accent);
  };

  if (items.length === 0) {
    return (
      <Panel>
        <PanelText>단어장에 표현을 저장하면 여기서 복습할 수 있어요.</PanelText>
      </Panel>
    );
  }

  if (!finished && mode !== 'practice' && total === 0) {
    const nextDueDate = getNextDueDate(items);

    return (
      <Panel>
        <PanelTitle>오늘 복습할 카드가 없어요</PanelTitle>
        <PanelHint>
          {nextDueDate ? `다음 복습일: ${nextDueDate}` : '다음 복습일이 아직 없어요.'}
        </PanelHint>
        <PanelActions>
          <PrimaryButton type="button" onClick={startPractice}>
            전체 연습하기
          </PrimaryButton>
        </PanelActions>
      </Panel>
    );
  }

  if (finished) {
    return (
      <Panel>
        {mode === 'practice' && (
          <EndBadge>
            <ModeBadge>연습 모드</ModeBadge>
          </EndBadge>
        )}
        <PanelTitle>복습 완료</PanelTitle>
        <EndSummary>{`알아요 ${knownCount} · 다시 ${againCount}`}</EndSummary>
        <PanelActions>
          {mode === 'practice' ? (
            <>
              <PrimaryButton type="button" onClick={startPractice}>
                다시 섞어서 연습
              </PrimaryButton>
              <SecondaryButton type="button" onClick={startReview}>
                복습으로 돌아가기
              </SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton type="button" onClick={startReview}>
                처음으로
              </PrimaryButton>
              <SecondaryButton type="button" onClick={startPractice}>
                전체 연습하기
              </SecondaryButton>
            </>
          )}
        </PanelActions>
      </Panel>
    );
  }

  if (!currentItem) return null;

  const termAudioState = audioStates[currentItem.term];
  const exampleAudioState = currentItem.example ? audioStates[currentItem.example] : null;

  return (
    <Wrapper>
      <SessionMeta>
        <Progress>{`${index + 1} / ${total}`}</Progress>
        {mode === 'practice' && <ModeBadge>연습 모드</ModeBadge>}
        <KeyboardHint>SPACE · ← / →</KeyboardHint>
      </SessionMeta>

      <Card>
        <CardTop>
          <Term>{currentItem.term}</Term>
          <AudioButton
            type="button"
            onClick={() => play(currentItem.term)}
            disabled={!canPlay || termAudioState === 'loading'}
            className={termAudioState === 'playing' ? 'on' : ''}
            aria-label="듣기"
          >
            {termAudioState === 'loading' ? <LoaderIcon size="h-4 w-4" /> : <Volume2Icon />}
          </AudioButton>
          <AccentFlags
            text={currentItem.term}
            onPlayAudio={play}
            audioState={termAudioState}
            size={24}
          />
        </CardTop>

        {!revealed ? (
          <FrontActions>
            <PrimaryButton type="button" onClick={handleReveal}>
              뜻 보기
            </PrimaryButton>
          </FrontActions>
        ) : (
          <Back>
            {currentItem.meaning && <Meaning>{currentItem.meaning}</Meaning>}

            {currentItem.example && (
              <ExampleBox>
                <ExampleText>{currentItem.example}</ExampleText>
                <ExampleAction
                  type="button"
                  onClick={() => play(currentItem.example)}
                  disabled={!canPlay || exampleAudioState === 'loading'}
                  className={exampleAudioState === 'playing' ? 'on' : ''}
                  aria-label="예문 듣기"
                >
                  {exampleAudioState === 'loading' ? (
                    <LoaderIcon size="h-3.5 w-3.5" />
                  ) : (
                    <Volume2Icon />
                  )}
                  예문 듣기
                </ExampleAction>
                <AccentFlags
                  text={currentItem.example}
                  onPlayAudio={play}
                  audioState={exampleAudioState as string | undefined}
                  size={22}
                />
              </ExampleBox>
            )}

            <GradeRow>
              <AgainButton type="button" onClick={() => handleGrade(false)}>
                다시 볼래요
              </AgainButton>
              <KnownButton type="button" onClick={() => handleGrade(true)}>
                알아요
              </KnownButton>
            </GradeRow>
          </Back>
        )}
      </Card>
    </Wrapper>
  );
};

export default ReviewView;

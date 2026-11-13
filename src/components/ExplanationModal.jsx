import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import { CloseIcon, BookOpenIcon, LoaderIcon, Volume2Icon } from './Icons';
import { parseLectureMarkdown } from '../utils/lectureMarkdown';

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  background: rgba(23, 20, 15, 0.5);
  backdrop-filter: blur(7px);
  animation: fadeIn 200ms ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (min-width: 640px) {
    align-items: center;
    padding: 20px;
  }
`;

const ModalContent = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 580px;
  max-height: 88dvh;
  border: 1px solid var(--line);
  border-radius: 28px 28px 0 0;
  background: var(--card-paper);
  color: var(--ink);
  box-shadow: 0 -24px 60px rgba(23, 20, 15, 0.28);
  animation: sheetUp 300ms cubic-bezier(0.2, 0.8, 0.2, 1);

  @keyframes sheetUp {
    from { transform: translateY(36px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (min-width: 640px) {
    border-radius: 24px;
    animation: popIn 240ms ease-out;
  }

  @keyframes popIn {
    from { transform: translateY(10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line);
`;

const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px;
  border-radius: 10px;
  background: rgba(239, 83, 46, 0.1);
  color: var(--coral);

  svg { width: 18px; height: 18px; }
`;

const Title = styled.h2`
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.02em;
`;

const CloseButton = styled.button`
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: 150ms ease;

  svg { width: 15px; height: 15px; }

  &:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px calc(22px + env(safe-area-inset-bottom));
  color: #4f4a40;
  font-size: 13px;
  line-height: 1.75;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(23, 20, 15, 0.2); border-radius: 4px; }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 52px 0;
  color: var(--coral);

  p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
`;

const MarkdownContent = styled.div`
  h3 {
    margin: 22px 0 10px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--line);
    color: var(--ink);
    font-size: 14px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  h3:first-of-type {
    margin-top: 0;
  }

  p {
    margin-bottom: 14px;
  }

  ul, ol {
    margin-bottom: 14px;
    padding-left: 20px;
  }

  li {
    margin-bottom: 6px;
  }

  strong {
    color: var(--coral);
    font-weight: 650;
  }

  blockquote {
    margin: 14px 0;
    padding: 11px 14px;
    border-left: 2px solid var(--coral);
    border-radius: 0 8px 8px 0;
    background: #f8f3e8;
  }
`;

const SentenceQuote = styled.blockquote`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const SentenceText = styled.div`
  flex: 1;
  min-width: 0;
`;

const SentenceLabel = styled.span`
  display: block;
  color: var(--coral);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
`;

const SentenceBody = styled.span`
  color: var(--ink);
  font-size: 14px;
`;

const SpeakButton = styled.button`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--card-paper);
  color: var(--coral);
  cursor: pointer;
  transition: 150ms ease;

  svg { width: 17px; height: 17px; }

  &:hover:not(:disabled) {
    border-color: var(--coral);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
`;

const ExplanationModal = ({ isOpen, onClose, explanation, isLoading, audioStates = {}, onPlayAudio }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleSpeak = (e, sentence) => {
    // 모달은 포털이지만 React 이벤트는 NewsCard(카드 토글)까지 버블링되므로 막습니다.
    e.stopPropagation();
    if (!onPlayAudio) return;
    Promise.resolve(onPlayAudio(sentence)).catch(() => { /* useAudio가 이미 로그를 남깁니다 */ });
  };

  const renderSentence = (sentence, key) => {
    const isAudioLoading = audioStates[sentence] === 'loading';
    return (
      <SentenceQuote key={key}>
        <SentenceText>
          <SentenceLabel>Original Sentence</SentenceLabel>
          <SentenceBody>"{sentence}"</SentenceBody>
        </SentenceText>
        {onPlayAudio && (
          <SpeakButton
            type="button"
            onClick={(e) => handleSpeak(e, sentence)}
            disabled={isAudioLoading}
            aria-label="문장 음성 재생"
            title="문장 듣기"
          >
            {isAudioLoading ? <LoaderIcon size="h-4 w-4" /> : <Volume2Icon />}
          </SpeakButton>
        )}
      </SentenceQuote>
    );
  };

  const renderInline = (segments) => segments.map((segment, i) =>
    segment.bold ? <strong key={i}>{segment.text}</strong> : <React.Fragment key={i}>{segment.text}</React.Fragment>
  );

  const renderMarkdown = (text) => parseLectureMarkdown(text).map((block, index) => {
    switch (block.type) {
      case 'sentence':
        return renderSentence(block.sentence, index);
      case 'heading':
        return <h3 key={index}>{block.text}</h3>;
      case 'hr':
        return <hr key={index} style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />;
      case 'quote':
        return <blockquote key={index}>{renderInline(block.inline)}</blockquote>;
      case 'bullet':
        return (
          <li key={index} style={{ listStyle: 'none', position: 'relative', paddingLeft: '16px', marginLeft: block.depth ? '16px' : 0 }}>
            <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>{block.depth ? '◦' : '•'}</span>
            {renderInline(block.inline)}
          </li>
        );
      case 'blank':
        return <p key={index} />;
      default:
        return <p key={index}>{renderInline(block.inline)}</p>;
    }
  });

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent ref={modalRef}>
        <Header>
          <TitleWrapper>
            <IconWrapper>
              <BookOpenIcon />
            </IconWrapper>
            <Title>AI 선생님의 문장 강의</Title>
          </TitleWrapper>
          <CloseButton onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </CloseButton>
        </Header>

        <ScrollArea>
          {isLoading ? (
            <LoadingContainer>
              <LoaderIcon size="h-10 w-10" />
              <p>선생님이 문장을 분석하고 있어요...</p>
              <p style={{ fontSize: '11px', color: 'var(--muted)' }}>잠시만 기다려주세요</p>
            </LoadingContainer>
          ) : (
            <MarkdownContent>
              {renderMarkdown(explanation)}
            </MarkdownContent>
          )}
        </ScrollArea>
      </ModalContent>
    </ModalOverlay>,
    document.body
  );
};

export default ExplanationModal;

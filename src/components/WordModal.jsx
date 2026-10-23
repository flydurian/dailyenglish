import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, LoaderIcon, CloseIcon } from './Icons';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(23, 20, 15, 0.5);
  backdrop-filter: blur(7px);
  animation: fade-in 200ms ease;

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (min-width: 640px) {
    align-items: center;
    padding: 20px;
  }
`;

const Sheet = styled.div`
  width: 100%;
  max-width: 540px;
  max-height: 88dvh;
  overflow-y: auto;
  padding: 18px 18px calc(20px + env(safe-area-inset-bottom));
  border: 1px solid var(--line);
  border-radius: 28px 28px 0 0;
  background: var(--card-paper);
  color: var(--ink);
  box-shadow: 0 -24px 60px rgba(23, 20, 15, 0.28);
  animation: sheet-up 300ms cubic-bezier(0.2, 0.8, 0.2, 1);

  @keyframes sheet-up {
    from { transform: translateY(36px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (min-width: 640px) {
    padding: 24px;
    border-radius: 24px;
    animation: pop-in 240ms ease-out;
  }

  @keyframes pop-in {
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
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
`;

const Title = styled.h3`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-style: italic;
  font-weight: 500;
  letter-spacing: -0.02em;
`;

const CloseButton = styled.button`
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: 150ms ease;

  svg { width: 16px; height: 16px; }

  &:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
`;

const WordRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const WordTitle = styled.h4`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-style: italic;
  font-weight: 500;
  letter-spacing: -0.035em;
`;

const AudioButton = styled.button`
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--forest);
  cursor: pointer;
  transition: 150ms ease;

  svg { width: 15px; height: 15px; }

  &:hover {
    border-color: var(--ink);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Meaning = styled.p`
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
`;

const InfoBox = styled.div`
  display: grid;
  gap: 5px;
  margin-top: 15px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f8f3e8;
`;

const InfoTitle = styled.h5`
  margin: 0 0 3px;
  color: var(--forest);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const InfoRow = styled.div`
  color: #4f4a40;
  font-size: 11.5px;
  line-height: 1.55;

  strong {
    margin-right: 6px;
    color: var(--muted);
    font-weight: 500;
  }
`;

const SectionLabel = styled.h5`
  margin: 18px 0 2px;
  color: var(--coral);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const ExampleCard = styled.div`
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8f3e8;
`;

const ExampleText = styled.p`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 14px;
  font-style: italic;
  line-height: 1.6;
`;

const ExampleAudio = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--forest);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;

  svg { width: 12px; height: 12px; }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const LoadingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
  color: var(--muted);
  font-size: 11.5px;
`;

const EmptyText = styled.p`
  margin: 8px 0 0;
  color: var(--muted);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-style: italic;
`;

const WordModal = ({ isOpen, word, meaning, example, detailedInfo, onClose, onPlayAudio, audioStates = {}, onGenerateExamples }) => {
    const [examples, setExamples] = useState([]);
    const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);

    useEffect(() => {
        if (isOpen && word && meaning && typeof onGenerateExamples === 'function') {
            const generateWordExamples = async () => {
                setIsGeneratingExamples(true);
                try {
                    const generatedExamples = await onGenerateExamples(word, meaning);
                    setExamples(generatedExamples);
                } catch (error) {
                    console.error('예문 생성 실패:', error);
                    setExamples([]);
                } finally {
                    setIsGeneratingExamples(false);
                }
            };
            generateWordExamples();
        } else {
            setExamples([]);
            setIsGeneratingExamples(false);
        }
    }, [isOpen, word, meaning, onGenerateExamples]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const playAudio = (text) => {
        if (typeof onPlayAudio === 'function') onPlayAudio(text);
    };

    const detailLabels = {
        type: '유형',
        usage: '사용법',
        context: '맥락',
        formality: '격식',
        frequency: '빈도',
        synonyms: '동의어',
        grammar: '문법',
    };

    return (
        <Overlay onClick={handleBackdropClick} role="presentation">
            <Sheet role="dialog" aria-modal="true" aria-label="단어 상세 정보">
                <Header>
                    <Title>단어 상세 정보</Title>
                    <CloseButton onClick={onClose} aria-label="닫기">
                        <CloseIcon />
                    </CloseButton>
                </Header>

                <WordRow>
                    <WordTitle>{word}</WordTitle>
                    <AudioButton
                        onClick={() => playAudio(word)}
                        disabled={audioStates[word] === 'loading' || typeof onPlayAudio !== 'function'}
                        aria-label="단어 음성 재생"
                    >
                        {audioStates[word] === 'loading' ? (
                            <LoaderIcon size="h-4 w-4" />
                        ) : (
                            <Volume2Icon />
                        )}
                    </AudioButton>
                </WordRow>
                <Meaning>{meaning}</Meaning>

                {detailedInfo && (
                    <InfoBox>
                        <InfoTitle>상세 정보</InfoTitle>
                        {Object.entries(detailLabels).map(([key, label]) => {
                            if (!detailedInfo[key]) return null;
                            const value = key === 'type'
                                ? detailedInfo.type === 'phrasal_verb' ? '구동사' : detailedInfo.type === 'expression' ? '표현' : '단어'
                                : Array.isArray(detailedInfo[key]) ? detailedInfo[key].join(', ') : detailedInfo[key];
                            return (
                                <InfoRow key={key}>
                                    <strong>{label}</strong>
                                    {value}
                                </InfoRow>
                            );
                        })}
                    </InfoBox>
                )}

                <SectionLabel>예문</SectionLabel>
                {isGeneratingExamples ? (
                    <LoadingRow>
                        <LoaderIcon size="h-4 w-4" />
                        예문 생성 중...
                    </LoadingRow>
                ) : examples.length > 0 ? (
                    examples.map((item, index) => (
                        <ExampleCard key={index}>
                            <ExampleText>“{item}”</ExampleText>
                            <ExampleAudio
                                onClick={() => playAudio(item)}
                                disabled={audioStates[item] === 'loading' || typeof onPlayAudio !== 'function'}
                            >
                                {audioStates[item] === 'loading' ? (
                                    <LoaderIcon size="h-3 w-3" />
                                ) : (
                                    <Volume2Icon />
                                )}
                                듣기
                            </ExampleAudio>
                        </ExampleCard>
                    ))
                ) : (
                    <EmptyText>예문을 생성할 수 없습니다.</EmptyText>
                )}
            </Sheet>
        </Overlay>
    );
};

export default WordModal;

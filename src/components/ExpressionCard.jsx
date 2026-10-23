import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, TranslateIcon, LoaderIcon, ChevronDownIcon } from './Icons';
import { markPhrasalVerbUsage } from '../data/phrasalVerbsData';
import { useFontSize } from '../contexts/FontSizeContext';
import { phrasalVerbDetails } from '../data/phrasalVerbDetails';
import { css } from '@emotion/react';

const CardContainer = styled.article`
  position: relative;
  width: 100%;
  padding: 18px;
  background: var(--card-paper);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 16px 30px rgba(63, 46, 22, 0.07);
  animation: card-rise 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms);

  @keyframes card-rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 480px) {
    padding: 17px;
    border-radius: 18px;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
`;

const CardNumber = styled.span`
  color: var(--coral);
  font-family: var(--font-display);
  font-size: 27px;
  line-height: 0.9;
`;

const CardLabel = styled.span`
  padding-top: 4px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const ExampleSection = styled.div`
  margin: 0;
`;

const ExampleCard = styled.div`
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  cursor: pointer;
  transition: opacity 150ms ease;
  touch-action: manipulation;

  &:active {
    opacity: 0.86;
  }
`;

const ExampleText = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: clamp(17px, 4.6vw, 21px);
  font-weight: 600;
  line-height: 1.52;
  letter-spacing: -0.024em;
  text-wrap: pretty;

  em {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 500;
    letter-spacing: -0.01em;
    border-bottom: 1.5px solid var(--coral);
    padding-bottom: 1px;
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    font-size: clamp(17px, 4.8vw, 19px);
  }
`;

const TranslationSection = styled.div`
  margin-top: 12px;
  padding: 2px 0 2px 12px;
  border-left: 2px solid var(--coral);
  animation: fade-in 200ms ease both;

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const TranslationText = styled.p`
  margin: 0;
  color: #5f574a;
  font-size: 12.5px;
  line-height: 1.7;
  letter-spacing: -0.01em;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
`;

const PhrasalVerbHeader = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-align: left;
`;

const PhrasalVerbTitle = styled.button`
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-family: inherit;
  font-size: 12px;
  font-weight: 720;
  letter-spacing: -0.01em;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;

  &:hover {
    color: var(--coral);
  }
`;

const PhrasalVerbMeaning = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 13px;
  flex: 0 0 auto;

  @media (max-width: 480px) {
    gap: 10px;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 38px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease;
  touch-action: manipulation;

  svg {
    width: 14px !important;
    height: 14px !important;
  }

  &:hover,
  &.on {
    color: var(--coral);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 360px) {
    span { display: none; }
  }
`;

const ExpandedSection = styled.div`
  overflow: hidden;
  transition: max-height 450ms ease, opacity 300ms ease, padding 300ms ease;

  ${props => props.isActive ? css`
    max-height: 2400px;
    opacity: 1;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--line);
  ` : css`
    max-height: 0;
    opacity: 0;
    margin-top: 0;
    padding-top: 0;
    border-top: 1px dashed transparent;
  `}
`;

const PhrasalVerbDetailSection = styled.div`
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  animation: fade-in 220ms ease both;
`;

const DetailTitle = styled.h3`
  margin: 0 0 6px;
  color: var(--forest);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;

  &:not(:first-of-type) {
    margin-top: 14px;
  }
`;

const DetailContent = styled.div`
  margin-bottom: 10px;
  color: #5b5348;
  font-size: 12.5px;
  line-height: 1.68;

  strong {
    color: var(--forest);
    font-weight: 650;
  }
`;

const UsageExample = styled.div`
  margin: 8px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f8f3e8;
`;

const DetailExampleText = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.01em;
`;

const UsageExampleActions = styled.div`
  display: flex;
  gap: 6px;
  margin: 0 0 0 12px;
  justify-content: flex-end;
  flex: 0 0 auto;
`;

const SmallActionButton = styled.button`
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--card-paper);
  color: var(--forest);
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg {
    width: 12px !important;
    height: 12px !important;
  }

  &:hover {
    border-color: var(--ink);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ExampleTranslation = styled.p`
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
`;

const KeyWordsSection = styled.div`
  margin-top: 14px;
`;

const KeyWordsTitle = styled.h3`
  margin: 0 0 8px;
  color: var(--coral);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: left;
`;

const KeyWordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
  }
`;

const KeyWordCard = styled.button`
  display: block;
  width: 100%;
  min-height: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f8f3e8;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  &:hover {
    border-color: var(--coral);
  }

  &:active {
    background: var(--paper-deep);
  }
`;

const KeyWordTitle = styled.div`
  margin-bottom: 2px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
`;

const KeyWordMeaning = styled.div`
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
`;

const renderSentence = (sentence) => {
  return sentence.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <em key={i}>{part.slice(2, -2)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const ExpressionCard = ({ expression, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, level, translations, handleTranslationClick }) => {
  const { fontSize } = useFontSize();
  const [showTranslation, setShowTranslation] = useState(false);
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // expression이 변경될 때 번역 상태 초기화
  useEffect(() => {
    setShowTranslation(false);
    setTranslation('');
    setIsTranslating(false);
  }, [expression.sentence]);

  const handleCardClick = useCallback(() => {
    onToggle(index);
  }, [onToggle, index]);

  const handleDetailsClick = useCallback((e) => {
    e.stopPropagation();
    onToggle(index);
  }, [onToggle, index]);

  const handleAudioClick = useCallback((e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    onPlayAudio(expression.sentence);
  }, [onPlayAudio, expression.sentence]);

  const handleExampleAudioClick = useCallback((e, text) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    onPlayAudio(text);
  }, [onPlayAudio]);

  const handleTranslateClick = useCallback(async (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (!translation) {
      setIsTranslating(true);
      const cleanSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');
      const result = await onTranslate(cleanSentence);
      setTranslation(result);
      setIsTranslating(false);
    }

    setShowTranslation(true);
  }, [showTranslation, translation, onTranslate, expression.sentence]);

  const handleWordClick = useCallback((e, word, meaning, example, detailedInfo) => {
    e.stopPropagation();
    onWordClick(word, meaning, example, detailedInfo);
  }, [onWordClick]);

  const handlePhrasalVerbClick = useCallback(async (e) => {
    e.stopPropagation();

    if (expression.phrasal_verb) {
      await markPhrasalVerbUsage(expression.phrasal_verb);
    }

    onToggle(index);
  }, [onToggle, index, expression.phrasal_verb]);

  // 레벨별 단어 필터링 함수
  const getFilteredWords = useCallback(() => {
    if (!expression.other_words) return [];

    const levelLimits = {
      'A1': 2,
      'A2': 3,
      'B1': 4,
      'B2': 5,
      'C1': 6,
      'C2': 8
    };

    const limit = levelLimits[level] || 4;
    return expression.other_words.slice(0, limit);
  }, [expression.other_words, level]);

  // 구동사 상세 정보 생성 함수
  const getPhrasalVerbDetails = useCallback(() => {
    const phrasalVerb = expression.phrasal_verb;
    const currentSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');
    const phrasalVerbName = phrasalVerb.split(':')[0].trim().toLowerCase();
    const defaultDetails = phrasalVerbDetails[phrasalVerbName];

    const getUniqueExamples = (examples) => {
      if (!examples) return [];
      return examples.filter(example =>
        example.toLowerCase() !== currentSentence.toLowerCase()
      ).slice(0, 2);
    };

    if (expression.situation || expression.nuance) {
      return {
        nuance: expression.nuance || (defaultDetails ? defaultDetails.nuance : `이 구동사는 "${expression.meaning}"라는 의미를 가지며, 문맥에 따라 다양한 뉘앙스로 사용됩니다.`),
        usage: expression.situation || (defaultDetails ? defaultDetails.usage : '다양한 상황에서 사용될 수 있습니다.'),
        situations: expression.examples || (defaultDetails ? getUniqueExamples(defaultDetails.situations) : getUniqueExamples([
          `Can you ${phrasalVerb} the answer?`,
          `I need to ${phrasalVerb} this problem.`,
          `Let's ${phrasalVerb} together.`
        ]))
      };
    }

    if (defaultDetails) {
      return {
        ...defaultDetails,
        situations: getUniqueExamples(defaultDetails.situations)
      };
    }

    const fallbackExamples = [
      `Can you ${phrasalVerb} the answer?`,
      `I need to ${phrasalVerb} this problem.`,
      `Let's ${phrasalVerb} together.`,
      `She will ${phrasalVerb} tomorrow.`
    ];

    return {
      nuance: `이 구동사는 "${expression.meaning}"라는 의미를 가지며, 특별한 뉘앙스와 사용 맥락이 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.`,
      usage: '이 구동사는 다양한 상황에서 사용될 수 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.',
      situations: getUniqueExamples(fallbackExamples)
    };
  }, [expression.phrasal_verb, expression.meaning, expression.sentence, expression.examples, expression.nuance, expression.situation]);

  const details = getPhrasalVerbDetails();
  const phrasalVerbName = expression.phrasal_verb.split(':')[0].trim();
  const phrasalVerbMeaning = expression.meaning || expression.phrasal_verb.split(':').slice(1).join(':').trim();

  return (
    <CardContainer style={{ '--i': index }}>
      <CardTop>
        <CardNumber>{String(index + 1).padStart(2, '0')}</CardNumber>
        <CardLabel>Phrasal verb</CardLabel>
      </CardTop>

      <ExampleSection>
        <ExampleCard onClick={handleCardClick}>
          <ExampleText style={{ fontSize: `calc(${fontSize} * 18.5px)` }}>
            {renderSentence(expression.sentence)}
          </ExampleText>

          {showTranslation && (
            <TranslationSection>
              <TranslationText style={{ fontSize: `calc(${fontSize} * 12.5px)` }}>
                {translation || '번역을 불러오는 중...'}
              </TranslationText>
            </TranslationSection>
          )}

          <CardFooter>
            <PhrasalVerbHeader>
              <PhrasalVerbTitle
                type="button"
                onClick={handlePhrasalVerbClick}
                aria-expanded={isActive}
              >
                {phrasalVerbName}
              </PhrasalVerbTitle>
              <PhrasalVerbMeaning>{phrasalVerbMeaning}</PhrasalVerbMeaning>
            </PhrasalVerbHeader>

            <ActionButtons>
              <ActionButton
                onClick={handleAudioClick}
                disabled={audioStates[expression.sentence] === 'loading'}
                className={audioStates[expression.sentence] === 'playing' ? 'on' : ''}
                aria-label="음성 재생"
              >
                {audioStates[expression.sentence] === 'loading' ? (
                  <LoaderIcon size="h-2.5 w-2.5" />
                ) : (
                  <Volume2Icon />
                )}
                <span>듣기</span>
              </ActionButton>

              <ActionButton
                onClick={handleTranslateClick}
                disabled={isTranslating}
                className={showTranslation ? 'on' : ''}
                aria-label="번역 보기"
                aria-expanded={showTranslation}
              >
                {isTranslating ? (
                  <LoaderIcon size="h-2.5 w-2.5" />
                ) : (
                  <TranslateIcon />
                )}
                <span>번역</span>
              </ActionButton>

              <ActionButton
                onClick={handleDetailsClick}
                className={isActive ? 'on' : ''}
                aria-label="상세 보기"
                aria-expanded={isActive}
              >
                <ChevronDownIcon />
                <span>더보기</span>
              </ActionButton>
            </ActionButtons>
          </CardFooter>
        </ExampleCard>
      </ExampleSection>

      <ExpandedSection isActive={isActive}>
        <PhrasalVerbDetailSection>
          <DetailTitle>Nuance</DetailTitle>
          <DetailContent>{details.nuance}</DetailContent>

          <DetailTitle>Usage</DetailTitle>
          <DetailContent>{details.usage}</DetailContent>

          <DetailTitle>Examples</DetailTitle>
          {details.situations.map((situation, idx) => (
            <UsageExample key={idx}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <DetailExampleText style={{ fontSize: `calc(${fontSize} * 13.5px)` }}>
                    {situation}
                  </DetailExampleText>
                  {translations[situation]?.translation && (
                    <ExampleTranslation>
                      {translations[situation].translation}
                    </ExampleTranslation>
                  )}
                </div>
                <UsageExampleActions>
                  <SmallActionButton
                    onClick={(e) => {
                      handleExampleAudioClick(e, situation);
                    }}
                    disabled={audioStates[situation] === 'loading'}
                    aria-label="음성 재생"
                  >
                    {audioStates[situation] === 'loading' ? (
                      <LoaderIcon size="h-1.5 w-1.5" />
                    ) : (
                      <Volume2Icon />
                    )}
                  </SmallActionButton>
                  <SmallActionButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTranslationClick(situation);
                    }}
                    disabled={translations[situation]?.loading}
                    aria-label="번역"
                  >
                    {translations[situation]?.loading ? (
                      <LoaderIcon size="h-1.5 w-1.5" />
                    ) : (
                      <TranslateIcon />
                    )}
                  </SmallActionButton>
                </UsageExampleActions>
              </div>
            </UsageExample>
          ))}
        </PhrasalVerbDetailSection>

        {expression.other_words && expression.other_words.length > 0 && (
          <KeyWordsSection>
            <KeyWordsTitle>Key words</KeyWordsTitle>
            <KeyWordsGrid>
              {getFilteredWords().map((word, i) => (
                <KeyWordCard
                  key={i}
                  onClick={(e) => handleWordClick(e, word.word, word.meaning, word.example || expression.sentence, {
                    type: 'vocabulary',
                    frequency: 'high'
                  })}
                >
                  <KeyWordTitle>{word.word}</KeyWordTitle>
                  <KeyWordMeaning style={{ fontSize: `calc(${fontSize} * 11px)` }}>
                    {word.meaning}
                  </KeyWordMeaning>
                </KeyWordCard>
              ))}
            </KeyWordsGrid>
          </KeyWordsSection>
        )}
      </ExpandedSection>
    </CardContainer>
  );
};

export default React.memo(ExpressionCard);
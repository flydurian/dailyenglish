import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Volume2Icon, TranslateIcon, LoaderIcon } from './Icons';
import { markPhrasalVerbUsage } from '../data/phrasalVerbsData';

// 최신 CSS Grid와 Flexbox를 활용한 스타일드 컴포넌트들
const CardContainer = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 24px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 212, 255, 0.1);
  margin: 0 auto 8px;
  max-width: 600px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 24px 48px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 212, 255, 0.2);
  }
  
  @media (max-width: 768px) {
    padding: 20px;
    margin: 0 auto 6px;
    border-radius: 20px;
  }
  
  @media (max-width: 480px) {
    padding: 16px;
    margin: 0 auto 4px;
    border-radius: 16px;
  }
`;

const ExampleSection = styled.div`
  margin-bottom: 16px;
`;

const ExampleCard = styled.div`
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  border: 2px solid #444;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: manipulation;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    border-radius: 12px;
  }
`;

const ExampleContent = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: start;
  
  @media (max-width: 768px) {
    gap: 12px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
  }
`;

const ExampleText = styled.p`
  color: #ffffff;
  font-size: clamp(18px, 4vw, 24px);
  font-weight: 500;
  line-height: 1.6;
  margin: 0;
  
  @media (max-width: 768px) {
    font-size: clamp(16px, 3.5vw, 22px);
  }
  
  @media (max-width: 640px) {
    font-size: clamp(14px, 3vw, 20px);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(12px, 2.5vw, 18px);
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  
  @media (max-width: 768px) {
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const ActionButton = styled.button`
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  border: 1px solid #00d4ff;
  border-radius: 50%;
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  touch-action: manipulation;
  min-width: 40px;
  min-height: 40px;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 768px) {
    padding: 6px;
    min-width: 36px;
    min-height: 36px;
  }
  
  @media (max-width: 480px) {
    padding: 4px;
    min-width: 32px;
    min-height: 32px;
  }
`;

const ExpandedSection = styled.div`
  overflow: hidden;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  border-top: 1px solid #444;
  padding-top: 16px;
  
  ${props => props.isActive ? css`
    max-height: 800px;
    opacity: 1;
  ` : css`
    max-height: 0;
    opacity: 0;
  `}
`;

const PhrasalVerbHeader = styled.div`
  text-align: center;
  margin-bottom: 16px;
`;

const PhrasalVerbTitle = styled.h2`
  background: linear-gradient(135deg, #00d4ff 0%, #ffffff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: clamp(20px, 5vw, 28px);
  font-weight: 700;
  margin: 0 0 8px 0;
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 8px 12px;
  border-radius: 12px;
  touch-action: manipulation;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 6px 10px;
    font-size: clamp(18px, 4.5vw, 26px);
  }
  
  @media (max-width: 480px) {
    padding: 4px 8px;
    font-size: clamp(16px, 4vw, 24px);
  }
`;

const PhrasalVerbMeaning = styled.p`
  color: #ffffff;
  font-size: clamp(16px, 3vw, 20px);
  font-weight: 500;
  margin: 0;
`;

const KeyWordsSection = styled.div`
  margin-top: 20px;
`;

const KeyWordsTitle = styled.h3`
  color: #00d4ff;
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 16px;
    margin: 0 0 14px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin: 0 0 12px 0;
  }
`;

const KeyWordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  @media (max-width: 480px) {
    gap: 6px;
  }
`;

const KeyWordCard = styled.button`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 16px;
  color: #ffffff;
  cursor: pointer;
  padding: 16px;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(0, 212, 255, 0.05);
  touch-action: manipulation;
  min-height: 70px;
  
  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 12px 32px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
  }
  
  &:active {
    background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
    border-color: #00d4ff;
    color: #000000;
    box-shadow: 
      0 12px 32px rgba(0, 212, 255, 0.4),
      0 0 0 1px rgba(0, 212, 255, 0.3);
    transform: translateY(0) scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 14px;
    min-height: 66px;
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    min-height: 62px;
    border-radius: 12px;
  }
`;

const KeyWordTitle = styled.div`
  color: #00d4ff;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const KeyWordMeaning = styled.div`
  color: #cccccc;
  font-size: 12px;
  line-height: 1.4;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
  }
`;

const TranslationSection = styled.div`
  border-top: 1px solid #444;
  margin-top: 12px;
  padding-top: 12px;
`;

const TranslationText = styled.p`
  color: #cccccc;
  font-size: 16px;
  margin: 0;
`;

const PhrasalVerbDetailSection = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 24px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 212, 255, 0.1);
  margin-top: 16px;
  padding: 24px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideDown 0.4s ease-out;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
      max-height: 0;
    }
    to {
      opacity: 1;
      transform: translateY(0);
      max-height: 1000px;
    }
  }
  
  &:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 
      0 24px 48px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 212, 255, 0.2);
  }
  
  @media (max-width: 768px) {
    padding: 20px;
    margin-top: 12px;
    border-radius: 20px;
  }
  
  @media (max-width: 480px) {
    padding: 16px;
    margin-top: 8px;
    border-radius: 16px;
  }
`;

const DetailTitle = styled.h3`
  color: #00d4ff;
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px 0;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const DetailContent = styled.div`
  color: #ffffff;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const UsageExample = styled.div`
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  border: 2px solid #444;
  padding: 16px;
  margin: 12px 0;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    border-color: #00d4ff;
  }
  
  @media (max-width: 768px) {
    padding: 14px;
    margin: 10px 0;
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    margin: 8px 0;
    border-radius: 12px;
  }
`;

const DetailExampleText = styled.p`
  color: #ffffff;
  font-weight: 500;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const UsageExampleActions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
`;

const SmallActionButton = styled.button`
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  border: 1px solid #00d4ff;
  border-radius: 50%;
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  touch-action: manipulation;
  min-width: 14px;
  min-height: 14px;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 480px) {
    min-width: 12px;
    min-height: 12px;
    padding: 1px;
  }
`;

const ExampleTranslation = styled.p`
  color: #cccccc;
  margin: 0;
  font-size: 13px;
  
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

const ExpressionCard = ({ expression, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, level, translations, handleTranslationClick }) => {
    const [showTranslation, setShowTranslation] = useState(false);
    const [translation, setTranslation] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [showPhrasalVerbDetail, setShowPhrasalVerbDetail] = useState(false);
    
    // expression이 변경될 때 번역 상태 초기화
    useEffect(() => {
        setShowTranslation(false);
        setTranslation('');
        setIsTranslating(false);
        setShowPhrasalVerbDetail(false);
    }, [expression.sentence]);
    
    const handleCardClick = useCallback(() => {
        onToggle(index);
    }, [onToggle, index]);

    const handleAudioClick = useCallback((e) => {
        e.stopPropagation();
        onPlayAudio(expression.sentence);
    }, [onPlayAudio, expression.sentence]);

    const handleTranslateClick = useCallback(async (e) => {
        e.stopPropagation();
        if (!showTranslation && !translation) {
            setIsTranslating(true);
            // 문장에서 마크다운 형식 제거 후 번역
            const cleanSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');
            const result = await onTranslate(cleanSentence);
            setTranslation(result);
            setIsTranslating(false);
        }
        setShowTranslation(!showTranslation);
    }, [showTranslation, translation, onTranslate, expression.sentence]);

    const handleWordClick = useCallback((e, word, meaning, example, detailedInfo) => {
        e.stopPropagation();
        onWordClick(word, meaning, example, detailedInfo);
    }, [onWordClick]);

    const handlePhrasalVerbClick = useCallback(async (e) => {
        e.stopPropagation();
        
        // 구동사 사용 기록 저장
        if (expression.phrasal_verb) {
            await markPhrasalVerbUsage(expression.phrasal_verb);
        }
        
        setShowPhrasalVerbDetail(!showPhrasalVerbDetail);
    }, [showPhrasalVerbDetail, expression.phrasal_verb]);

    // 레벨별 단어 필터링 함수
    const getFilteredWords = useCallback(() => {
        if (!expression.other_words) return [];
        
        const levelLimits = {
            'A1': 2,  // 초급: 2개 단어
            'A2': 3,  // 초급+: 3개 단어
            'B1': 4,  // 중급: 4개 단어
            'B2': 5,  // 중급+: 5개 단어
            'C1': 6,  // 고급: 6개 단어
            'C2': 8   // 고급+: 8개 단어
        };
        
        const limit = levelLimits[level] || 4;
        return expression.other_words.slice(0, limit);
    }, [expression.other_words, level]);

    // 구동사 상세 정보 생성 함수
    const getPhrasalVerbDetails = useCallback(() => {
        const phrasalVerb = expression.phrasal_verb;
        
        const details = {
            'figure out': {
                nuance: '생각과 분석을 통해 결론에 도달하는 과정을 강조하는 뉘앙스. 단순히 아는 것이 아니라 "파악하고 이해하는" 능동적인 과정을 나타냅니다.',
                usage: '어려운 문제를 해결하거나, 복잡한 상황을 이해하려고 할 때 사용합니다. 수학 문제, 사람의 의도, 비용 계산 등 "알아내야 하는" 상황에서 자주 쓰입니다.',
                situations: [
                    '"I can\'t figure out this math problem."',
                    '"Can you figure out what he means?"'
                ]
            },
            'look into': {
                nuance: '신중하고 체계적인 조사를 의미하는 뉘앙스. 단순히 "보다"가 아니라 "깊이 살펴보고 조사하는" 전문적이고 신중한 태도를 나타냅니다.',
                usage: '문제나 사건을 조사하거나, 불만사항을 검토할 때 사용합니다. 경찰이 사건을 조사하거나, 회사에서 고객 불만을 처리할 때 자주 쓰입니다.',
                situations: [
                    '"The police will look into the matter."',
                    '"I\'ll look into your complaint."'
                ]
            },
            'come up with': {
                nuance: '창의적이고 즉흥적인 아이디어 생성의 뉘앙스. "나타나다, 생겨나다"는 의미에서 "새로운 것을 만들어내는" 창조적 과정을 강조합니다.',
                usage: '회의에서 새로운 아이디어를 제안하거나, 문제 해결책을 찾을 때 사용합니다. 브레인스토밍이나 창의적 사고가 필요한 상황에서 자주 쓰입니다.',
                situations: [
                    '"Can you come up with a better plan?"',
                    '"We need to come up with a solution."'
                ]
            },
            'put up with': {
                nuance: '불만스럽지만 어쩔 수 없이 참고 견디는 뉘앙스. "올려놓고 견디다"는 의미에서 "불쾌한 것을 감내하는" 부정적이지만 인내심 있는 태도를 나타냅니다.',
                usage: '시끄러운 소음, 어려운 사람, 불편한 상황을 참고 견딜 때 사용합니다. 불만이 있지만 어쩔 수 없이 받아들여야 하는 상황에서 자주 쓰입니다.',
                situations: [
                    '"I can\'t put up with this noise anymore."',
                    '"How do you put up with him?"'
                ]
            },
            'get over': {
                nuance: '시간이 지나면서 자연스럽게 극복되는 과정의 뉘앙스. "넘어서다"라는 의미에서 "어려움을 뒤로 하고 앞으로 나아가는" 회복과 성장의 과정을 나타냅니다.',
                usage: '이별, 질병, 실망 같은 어려운 상황에서 회복할 때 사용합니다. 시간이 지나면서 자연스럽게 극복되는 과정을 나타냅니다.',
                situations: [
                    '"It took time to get over the breakup."',
                    '"I finally got over the flu."'
                ]
            },
            'run out of': {
                nuance: '갑작스럽고 예상치 못한 부족함의 뉘앙스. "달려나가서 떠나다"는 의미에서 "갑자기 없어져버리는" 놀라움과 당황스러움을 동시에 나타냅니다.',
                usage: '우유, 시간, 빵 같은 것들이 갑자기 떨어졌을 때 사용합니다. 예상치 못하게 부족해진 상황에서 자주 쓰입니다.',
                situations: [
                    '"We\'ve run out of milk."',
                    '"I\'m running out of time."'
                ]
            }
        };

        return details[phrasalVerb] || {
            nuance: `이 구동사는 "${expression.meaning}"라는 의미를 가지며, 특별한 뉘앙스와 사용 맥락이 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.`,
            usage: '이 구동사는 다양한 상황에서 사용될 수 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.',
            situations: [
                `"${expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1')}"`,
                `"Can you ${phrasalVerb} the answer?"`
            ]
        };
    }, [expression.phrasal_verb, expression.meaning, expression.sentence]);

    return (
        <CardContainer>
            {/* 예문 섹션 - 기본 표시 (닫혀진 상태) */}
            <ExampleSection>
                <ExampleCard onClick={handleCardClick}>
                    <ExampleContent>
                        <ExampleText>
                            "{expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1')}"
                        </ExampleText>
                        <ActionButtons>
                            <ActionButton 
                                onClick={handleAudioClick}
                                disabled={audioStates[expression.sentence] === 'loading'}
                                aria-label="음성 재생"
                            >
                                {audioStates[expression.sentence] === 'loading' ? (
                                    <LoaderIcon size="h-2.5 w-2.5" />
                                ) : (
                                    <Volume2Icon className="h-2.5 w-2.5" />
                                )}
                            </ActionButton>
                            <ActionButton 
                                onClick={handleTranslateClick}
                                disabled={isTranslating}
                                aria-label="번역 보기"
                            >
                                {isTranslating ? (
                                    <LoaderIcon size="h-2.5 w-2.5" />
                                ) : (
                                    <TranslateIcon className="h-2.5 w-2.5" />
                                )}
                            </ActionButton>
                        </ActionButtons>
                    </ExampleContent>
                    {showTranslation && (
                        <TranslationSection>
                            <TranslationText>
                                {translation || '번역을 불러오는 중...'}
                            </TranslationText>
                        </TranslationSection>
                    )}
                </ExampleCard>
            </ExampleSection>

            {/* 구동사 정보 - 터치 시 펼쳐지는 섹션 (기본적으로 닫혀진 상태) */}
            <ExpandedSection isActive={isActive}>
                <PhrasalVerbHeader>
                    <PhrasalVerbTitle onClick={handlePhrasalVerbClick}>
                        {expression.phrasal_verb}
                    </PhrasalVerbTitle>
                    <PhrasalVerbMeaning>
                        {expression.meaning}
                    </PhrasalVerbMeaning>
                </PhrasalVerbHeader>

                {/* 구동사 상세 정보 섹션 */}
                {showPhrasalVerbDetail && (
                    <PhrasalVerbDetailSection>
                        {(() => {
                            const details = getPhrasalVerbDetails();
                            return (
                                <>
                                    <DetailTitle>구동사 상세 설명</DetailTitle>
                                    <DetailContent>
                                        <strong>뉘앙스:</strong> {details.nuance}
                                    </DetailContent>
                                    <DetailContent>
                                        <strong>사용법:</strong> {details.usage}
                                    </DetailContent>
                                    <DetailTitle>사용 상황 예시</DetailTitle>
                                    {details.situations.map((situation, idx) => (
                                        <UsageExample key={idx}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <div style={{ flex: 1 }}>
                                                    <DetailExampleText>{situation}</DetailExampleText>
                                                    {translations[situation]?.translation && (
                                                        <ExampleTranslation>
                                                            {translations[situation].translation}
                                                        </ExampleTranslation>
                                                    )}
                                                </div>
                                                <UsageExampleActions style={{ marginTop: 0, marginLeft: '12px' }}>
                                                    <SmallActionButton 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAudioClick(situation);
                                                        }}
                                                        disabled={audioStates[situation] === 'loading'}
                                                        aria-label="음성 재생"
                                                    >
                                                        {audioStates[situation] === 'loading' ? (
                                                            <LoaderIcon size="h-1.5 w-1.5" />
                                                        ) : (
                                                            <Volume2Icon className="h-1.5 w-1.5" />
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
                                                        <TranslateIcon className="h-1.5 w-1.5" />
                                                    </SmallActionButton>
                                                </UsageExampleActions>
                                            </div>
                                        </UsageExample>
                                    ))}
                                </>
                            );
                        })()}
                    </PhrasalVerbDetailSection>
                )}

                {/* 주요 단어 섹션 */}
                {expression.other_words && expression.other_words.length > 0 && (
                    <KeyWordsSection>
                        <KeyWordsTitle>
                            주요 단어
                        </KeyWordsTitle>
                        <KeyWordsGrid>
                            {getFilteredWords().map((word, i) => (
                                <KeyWordCard 
                                    key={i}
                                    onClick={(e) => handleWordClick(e, word.word, word.meaning, word.example || expression.sentence, {
                                        type: 'vocabulary',
                                        frequency: 'high'
                                    })}
                                >
                                    <KeyWordTitle>
                                        {word.word}
                                    </KeyWordTitle>
                                    <KeyWordMeaning>
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

export default ExpressionCard;
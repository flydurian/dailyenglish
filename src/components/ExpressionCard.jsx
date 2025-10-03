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
  font-size: clamp(20px, 4.5vw, 28px);
  font-weight: 700;
  line-height: 1.4;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  
  @media (max-width: 768px) {
    font-size: clamp(20px, 4.5vw, 26px);
  }
  
  @media (max-width: 640px) {
    font-size: clamp(18px, 4vw, 24px);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(16px, 3.5vw, 22px);
  }
  
  @media (max-width: 360px) {
    font-size: clamp(15px, 3.2vw, 20px);
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
  padding: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  touch-action: manipulation;
  min-width: 32px;
  min-height: 32px;
  
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
    padding: 3px;
    min-width: 28px;
    min-height: 28px;
  }
  
  @media (max-width: 480px) {
    padding: 2px;
    min-width: 24px;
    min-height: 24px;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }
  
  @media (max-width: 360px) {
    grid-template-columns: 1fr;
    gap: 4px;
  }
`;

const KeyWordCard = styled.button`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 16px;
  color: #ffffff;
  cursor: pointer;
  padding: 12px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(0, 212, 255, 0.05);
  touch-action: manipulation;
  min-height: 60px;
  
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
    padding: 10px;
    min-height: 55px;
    border-radius: 12px;
  }
  
  @media (max-width: 640px) {
    padding: 8px;
    min-height: 50px;
    border-radius: 10px;
  }
  
  @media (max-width: 480px) {
    padding: 6px;
    min-height: 45px;
    border-radius: 8px;
  }
  
  @media (max-width: 360px) {
    padding: 8px;
    min-height: 50px;
    border-radius: 10px;
  }
`;

const KeyWordTitle = styled.div`
  color: #00d4ff;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
  
  @media (max-width: 768px) {
    font-size: 14px;
    margin-bottom: 3px;
  }
  
  @media (max-width: 640px) {
    font-size: 13px;
    margin-bottom: 2px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
    margin-bottom: 2px;
  }
  
  @media (max-width: 360px) {
    font-size: 13px;
    margin-bottom: 3px;
  }
`;

const KeyWordMeaning = styled.div`
  color: #cccccc;
  font-size: 14px;
  line-height: 1.4;
  
  @media (max-width: 768px) {
    font-size: 12px;
    line-height: 1.3;
  }
  
  @media (max-width: 640px) {
    font-size: 11px;
    line-height: 1.2;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    line-height: 1.2;
  }
  
  @media (max-width: 360px) {
    font-size: 11px;
    line-height: 1.3;
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
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    font-size: 13px;
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
  font-weight: 700;
  margin: 0;
  font-size: clamp(16px, 3.5vw, 22px);
  line-height: 1.4;
  
  @media (max-width: 768px) {
    font-size: clamp(14px, 3vw, 18px);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(12px, 2.5vw, 16px);
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
  padding: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  touch-action: manipulation;
  min-width: 20px;
  min-height: 20px;
  
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
  
  @media (max-width: 768px) {
    min-width: 18px;
    min-height: 18px;
    padding: 4px;
  }
  
  @media (max-width: 480px) {
    min-width: 16px;
    min-height: 16px;
    padding: 3px;
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
        
        // 이미 번역이 표시 중이면 토글로 숨기기
        if (showTranslation) {
            setShowTranslation(false);
            return;
        }
        
        // 번역이 없으면 번역 요청
        if (!translation) {
            setIsTranslating(true);
            // 문장에서 마크다운 형식 제거 후 번역
            const cleanSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');
            const result = await onTranslate(cleanSentence);
            setTranslation(result);
            setIsTranslating(false);
        }
        
        // 번역 표시
        setShowTranslation(true);
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
                nuance: '생각과 분석을 통해 결론에 도달하는 과정을 강조하는 뉘앙스입니다. 단순히 "알다"가 아니라 "파악하고 이해하는" 능동적이고 체계적인 사고 과정을 나타냅니다. 이 구동사는 문제 해결의 과정에서 논리적 추론과 분석을 거쳐 답을 찾아내는 뇌의 활동을 강조합니다. 특히 복잡하거나 어려운 문제를 해결할 때 사용되며, 단순한 암기나 기억이 아닌 능동적인 사고 과정을 의미합니다.',
                usage: '어려운 문제를 해결하거나, 복잡한 상황을 이해하려고 할 때 사용합니다. 수학 문제, 사람의 의도 파악, 비용 계산, 기술적 문제 해결 등 "알아내야 하는" 상황에서 자주 쓰입니다. 또한 추상적인 개념을 이해하거나, 복잡한 시스템의 작동 원리를 파악할 때도 사용됩니다. 이 구동사는 문제 해결 과정에서의 인지적 노력과 사고 과정을 강조하므로, 단순한 정보 전달보다는 깊이 있는 이해가 필요한 상황에서 사용됩니다.',
                situations: [
                    'I can\'t figure out this math problem.',
                    'Can you figure out what he means?'
                ]
            },
            'look into': {
                nuance: '신중하고 체계적인 조사를 의미하는 뉘앙스입니다. 단순히 "보다"가 아니라 "깊이 살펴보고 조사하는" 전문적이고 신중한 태도를 나타냅니다. 이 구동사는 표면적인 관찰을 넘어서 내부적인 원인과 배경을 파악하려는 의도를 담고 있습니다. 특히 문제나 사건의 근본 원인을 찾기 위한 체계적인 접근 방식을 의미하며, 단순한 확인이 아닌 철저한 검토와 분석을 포함합니다.',
                usage: '문제나 사건을 조사하거나, 불만사항을 검토할 때 사용합니다. 경찰이 사건을 조사하거나, 회사에서 고객 불만을 처리할 때, 연구자가 특정 현상을 분석할 때 자주 쓰입니다. 또한 개인적인 문제나 상황에 대해 더 깊이 알아보고 싶을 때도 사용됩니다. 이 구동사는 조사의 목적과 의도를 명확히 하며, 단순한 확인이 아닌 체계적인 검토 과정을 강조합니다.',
                situations: [
                    'The police will look into the matter.',
                    'I\'ll look into your complaint.'
                ]
            },
            'come up with': {
                nuance: '창의적이고 즉흥적인 아이디어 생성의 뉘앙스입니다. "나타나다, 생겨나다"는 의미에서 "새로운 것을 만들어내는" 창조적 과정을 강조합니다. 이 구동사는 기존에 없던 새로운 것을 만들어내는 능동적이고 창의적인 사고 과정을 나타냅니다. 특히 문제 해결을 위한 새로운 접근법이나 혁신적인 아이디어를 제시할 때 사용되며, 단순한 모방이나 복사가 아닌 독창적인 창조 과정을 의미합니다.',
                usage: '회의에서 새로운 아이디어를 제안하거나, 문제 해결책을 찾을 때 사용합니다. 브레인스토밍이나 창의적 사고가 필요한 상황에서 자주 쓰입니다. 또한 예술 작품을 만들거나, 새로운 비즈니스 모델을 개발할 때도 사용됩니다. 이 구동사는 창의성과 혁신을 강조하므로, 기존의 방법으로는 해결할 수 없는 문제에 대한 새로운 접근법을 제시할 때 사용됩니다.',
                situations: [
                    'Can you come up with a better plan?',
                    'We need to come up with a solution.'
                ]
            },
            'put up with': {
                nuance: '불만스럽지만 어쩔 수 없이 참고 견디는 뉘앙스입니다. "올려놓고 견디다"는 의미에서 "불쾌한 것을 감내하는" 부정적이지만 인내심 있는 태도를 나타냅니다. 이 구동사는 개인의 의지와는 상관없이 주어진 상황을 받아들이고 견뎌내는 과정을 강조합니다. 특히 선택의 여지가 없거나 피할 수 없는 상황에서의 인내와 관용을 의미하며, 단순한 참는 것이 아닌 적극적인 수용과 적응의 과정을 포함합니다.',
                usage: '시끄러운 소음, 어려운 사람, 불편한 상황을 참고 견딜 때 사용합니다. 불만이 있지만 어쩔 수 없이 받아들여야 하는 상황에서 자주 쓰입니다. 또한 가족이나 동료와의 갈등 상황에서, 또는 사회적 제약이나 규칙을 받아들일 때도 사용됩니다. 이 구동사는 개인의 감정과 의지보다는 현실적인 필요나 상황에 따른 선택을 강조하므로, 이상적이지 않지만 현실적으로 받아들여야 하는 상황에서 사용됩니다.',
                situations: [
                    'I can\'t put up with this noise anymore.',
                    'How do you put up with him?'
                ]
            },
            'get over': {
                nuance: '시간이 지나면서 자연스럽게 극복되는 과정의 뉘앙스입니다. "넘어서다"라는 의미에서 "어려움을 뒤로 하고 앞으로 나아가는" 회복과 성장의 과정을 나타냅니다. 이 구동사는 개인의 내적 성장과 회복력을 강조하며, 단순한 시간의 경과가 아닌 적극적인 극복과 성장의 과정을 의미합니다. 특히 감정적 상처나 어려운 경험을 통해 더 강해지고 성숙해지는 과정을 나타냅니다.',
                usage: '이별, 질병, 실망 같은 어려운 상황에서 회복할 때 사용합니다. 시간이 지나면서 자연스럽게 극복되는 과정을 나타내며, 개인의 내적 성장과 회복력을 강조합니다. 또한 과거의 트라우마나 상처를 극복하고 새로운 시작을 할 때도 사용됩니다. 이 구동사는 단순한 시간의 경과가 아닌 적극적인 극복과 성장의 과정을 강조하므로, 개인의 의지와 노력이 필요한 상황에서 사용됩니다.',
                situations: [
                    'It took time to get over the breakup.',
                    'I finally got over the flu.'
                ]
            },
            'run out of': {
                nuance: '갑작스럽고 예상치 못한 부족함의 뉘앙스입니다. "달려나가서 떠나다"는 의미에서 "갑자기 없어져버리는" 놀라움과 당황스러움을 동시에 나타냅니다. 이 구동사는 예상치 못한 상황의 급작스러운 변화를 강조하며, 단순한 부족함이 아닌 갑작스러운 결핍 상태를 의미합니다. 특히 일상적인 흐름이 갑자기 중단되는 상황에서의 당황과 긴급함을 나타냅니다.',
                usage: '우유, 시간, 빵 같은 것들이 갑자기 떨어졌을 때 사용합니다. 예상치 못하게 부족해진 상황에서 자주 쓰이며, 특히 일상적인 흐름이 갑자기 중단되는 상황에서 사용됩니다. 또한 에너지, 인내심, 아이디어 등 추상적인 것들이 갑자기 부족해질 때도 사용됩니다. 이 구동사는 갑작스러운 변화와 긴급함을 강조하므로, 예상치 못한 상황에서의 당황과 대응의 필요성을 나타낼 때 사용됩니다.',
                situations: [
                    'We\'ve run out of milk.',
                    'I\'m running out of time.'
                ]
            }
        };

        return details[phrasalVerb] || {
            nuance: `이 구동사는 "${expression.meaning}"라는 의미를 가지며, 특별한 뉘앙스와 사용 맥락이 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.`,
            usage: '이 구동사는 다양한 상황에서 사용될 수 있습니다. 문맥에 따라 의미가 달라질 수 있으니 주의 깊게 학습하세요.',
            situations: [
                `${expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1')}`,
                `Can you ${phrasalVerb} the answer?`
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
                            {expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1')}
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
                                                        {translations[situation]?.loading ? (
                                                            <LoaderIcon size="h-1.5 w-1.5" />
                                                        ) : (
                                                            <TranslateIcon className="h-1.5 w-1.5" />
                                                        )}
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
import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Volume2Icon, TranslateIcon, LoaderIcon } from './Icons';
import { markPhrasalVerbUsage } from '../data/phrasalVerbsData';
import { useFontSize } from '../contexts/FontSizeContext';

const CardContainer = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 24px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 212, 255, 0.1);
  margin: 0 auto 8px;
  width: 100%;
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
    font-size: clamp(18px, 4vw, 24px);
  }
  
  @media (max-width: 640px) {
    font-size: clamp(16px, 3.5vw, 22px);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(14px, 3vw, 20px);
  }
  
  @media (max-width: 360px) {
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
  const { fontSize } = useFontSize();
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
    const currentSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');

    const details = {
      'figure out': {
        nuance: '단순히 "알다"를 넘어 "이해하고 파악하는" 지적인 노력이 강조되는 뉘앙스입니다. 혼란스러운 상태에서 질서 있는 이해의 상태로 나아가는 "해결"의 느낌이 강하며, 능동적인 사고 과정을 거쳤다는 뿌듯함이나 성취감이 묻어납니다.',
        usage: '해결책이 보이지 않는 복잡한 문제에 직면했을 때 사용합니다. 수학 문제 풀이, 고장 난 기계 원인 찾기, 엉킨 실타래 풀기, 또는 상대방의 알 수 없는 의도를 파악하려고 애쓸 때 주로 쓰입니다.'
      },
      'look into': {
        nuance: '겉만 훑어보는 것이 아니라 안쪽까지 "들여다보는" 신중하고 깊이 있는 태도가 느껴집니다. 전문가답고 책임감 있는 태도로, 문제를 가볍게 넘기지 않겠다는 "진지함"과 "신뢰"의 어조를 가집니다.',
        usage: '민원, 불만 사항, 사건, 혹은 제안된 아이디어에 대해 공식적으로 검토가 필요할 때 사용합니다. 경찰이 사건을 수사하거나, 담당자가 고객의 불만 사항을 접수하고 확인하겠다고 말할 때 전형적으로 쓰입니다.'
      },
      'come up with': {
        nuance: '무(無)에서 유(有)를 만들어내는 "창의적 산고"의 느낌과, 마침내 무언가를 등작시킨다는 "제시"의 뉘앙스가 있습니다. 번뜩이는 아이디어나 기발한 해결책을 내놓았을 때의 "놀라움"이나 "감탄"의 어조가 담길 수 있습니다.',
        usage: '회의 시간에 아이디어를 낼 때, 막다른 골목에서 해결책을 제시할 때, 혹은 핑계거리를 급조해낼 때 사용합니다. 브레인스토밍 상황이나 기획 단계에서 무언가 새로운 것을 제안해야 하는 타이밍에 적합합니다.'
      },
      'put up with': {
        nuance: '마음에 들지 않지만 꾹 눌러 "참아내는" 인내와 고역의 느낌입니다. 단순히 기다리는 것이 아니라, 불쾌함이나 고통을 감수하며 "견디고 있는" 무거운 상태를 나타냅니다.',
        usage: '지속적인 소음, 무례한 사람, 불편한 환경 등 바꾸기 힘들어서 어쩔 수 없이 감내해야 하는 상황에서 씁니다. 불평을 터뜨리기 직전의 한계 상황이나, 더 이상은 못 참겠다고 선언할 때 자주 사용됩니다.'
      },
      'get over': {
        nuance: '장애물이나 높은 벽을 "넘어서는" 극복과 회복의 이미지를 가집니다. 과거의 아픔이나 실패를 딛고 일어서는 "성장"과 "해방"의 긍정적인 뉘앙스, 혹은 이제는 괜찮아졌다는 "안도감"을 줍니다.',
        usage: '이별의 아픔, 질병, 실패의 충격, 혹은 무대 공포증 같은 트라우마에서 벗어날 때 사용합니다. 시간이 지나 마음이 정리되었거나, 병이 다 나았을 때, 혹은 충격적인 소식을 듣고 진정되었을 때 씁니다.'
      },
      'run out of': {
        nuance: '잔량이 바닥을 드러내는 "소진"과 "결핍"의 다급한 느낌입니다. 예기치 않게 뚝 끊긴 흐름이나, 더 이상 공급받을 수 없는 막막함, 혹은 "큰일 났다"는 당혹감을 동반합니다.',
        usage: '요리 중에 재료가 떨어졌을 때, 운전 중 기름이 떨어졌을 때, 혹은 끈기나 아이디어가 바닥났을 때 사용합니다. 무언가를 계속 진행해야 하는데 필수적인 자원이 고갈되어 멈춰야 하는 상황에 적합합니다.'
      },
    };

    // 기본 예시와 중복되지 않는 예시들을 선택하는 함수
    const getUniqueExamples = (examples) => {
      return examples.filter(example =>
        example.toLowerCase() !== currentSentence.toLowerCase()
      ).slice(0, 2); // 최대 2개의 고유한 예시만 반환
    };

    const defaultDetails = details[phrasalVerb];

    // API에서 받아온 동적 데이터가 있으면 그것을 우선 사용
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

    // 기본 구동사 정보가 없는 경우
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

  return (
    <CardContainer>
      {/* 예문 섹션 - 기본 표시 (닫혀진 상태) */}
      <ExampleSection>
        <ExampleCard onClick={handleCardClick}>
          <ExampleContent>
            <ExampleText style={{ fontSize: `${fontSize}em` }}>
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
              <TranslationText style={{ fontSize: `${fontSize}em` }}>
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
          <PhrasalVerbMeaning style={{ fontSize: `${fontSize}em` }}>
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
                          <DetailExampleText style={{ fontSize: `${fontSize}em` }}>{situation}</DetailExampleText>
                          {translations[situation]?.translation && (
                            <ExampleTranslation>
                              {translations[situation].translation}
                            </ExampleTranslation>
                          )}
                        </div>
                        <UsageExampleActions style={{ marginTop: 0, marginLeft: '12px' }}>
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
                  <KeyWordMeaning style={{ fontSize: `${fontSize}em` }}>
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
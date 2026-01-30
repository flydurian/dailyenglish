import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, TranslateIcon, LoaderIcon, BookOpenIcon } from './Icons';
import { useFontSize } from '../contexts/FontSizeContext';
import ExplanationModal from './ExplanationModal';

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
  min-height: auto;
  
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

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    margin-bottom: 12px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 10px;
  }
`;

const NewsTitle = styled.h3`
  color: #ffffff;
  font-size: clamp(18px, 4vw, 24px);
  font-weight: 700;
  margin: 0;
  line-height: 1.4;
  flex: 1;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    color: #00d4ff;
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    font-size: clamp(16px, 4vw, 20px);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(14px, 4vw, 18px);
  }
`;

const NewsSource = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  border-radius: 12px;
  border: 1px solid #444;
  
  @media (max-width: 768px) {
    margin-bottom: 10px;
    padding: 6px 10px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 8px;
    padding: 4px 8px;
  }
`;

const SourceBadge = styled.span`
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  color: #000;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  @media (max-width: 768px) {
    font-size: 11px;
    padding: 3px 6px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    padding: 2px 5px;
  }
`;

const NewsDate = styled.span`
  color: #cccccc;
  font-size: 12px;
  font-weight: 500;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
  }
`;

const TitleActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  
  @media (max-width: 768px) {
    gap: 4px;
    margin-left: 6px;
  }
  
  @media (max-width: 480px) {
    gap: 3px;
    margin-left: 4px;
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
  min-width: 36px;
  min-height: 36px;
  
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
    min-width: 32px;
    min-height: 32px;
  }
  
  @media (max-width: 480px) {
    padding: 4px;
    min-width: 28px;
    min-height: 28px;
  }
`;

const ExpandedSection = styled.div`
    max-height: ${props => props.isActive ? 'none' : '0'};
    opacity: ${props => props.isActive ? '1' : '0'};
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
`;

const SummarySection = styled.div`
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  border: 2px solid #444;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  padding: 20px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    padding: 16px;
    margin-bottom: 12px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    margin-bottom: 10px;
  }
`;

const SectionTitle = styled.h4`
  color: #00d4ff;
  font-size: clamp(16px, 3vw, 20px);
  font-weight: 600;
  margin: 0 0 16px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: clamp(14px, 3vw, 18px);
    margin: 0 0 12px 0;
  }
  
  @media (max-width: 480px) {
    font-size: clamp(12px, 3vw, 16px);
    margin: 0 0 10px 0;
  }
`;

const SummaryText = styled.p`
    color: #ffffff;
    font-size: clamp(16px, 3.5vw, 18px);
    line-height: 1.6;
    margin: 0 0 16px 0;
    text-align: left;
    
    @media (max-width: 768px) {
        font-size: clamp(15px, 3.5vw, 17px);
        margin: 0 0 14px 0;
    }
    
    @media (max-width: 480px) {
        font-size: clamp(14px, 3.5vw, 16px);
        margin: 0 0 12px 0;
    }
`;

const KeyPointCard = styled.div`
  background: linear-gradient(135deg, #333 0%, #444 100%);
  border: 1px solid #555;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    margin-bottom: 10px;
  }
  
  @media (max-width: 480px) {
    padding: 10px;
    margin-bottom: 8px;
  }
`;

const KeyPointText = styled.span`
  color: #ffffff;
  font-size: clamp(13px, 3vw, 15px);
  line-height: 1.5;
  flex: 1;
  padding-right: 12px;
  
  @media (max-width: 768px) {
    font-size: clamp(12px, 3vw, 14px);
    padding-right: 10px;
  }
  
  @media (max-width: 480px) {
    font-size: clamp(11px, 3vw, 13px);
    padding-right: 8px;
  }
`;


const TranslationText = styled.div`
    color: #00d4ff;
    font-size: clamp(14px, 3vw, 18px);
    line-height: 1.4;
    margin-top: 8px;
    padding-left: 8px;
    border-left: 2px solid #00d4ff;
    
    @media (max-width: 768px) {
        font-size: clamp(13px, 2.8vw, 16px);
        margin-top: 6px;
    }
    
    @media (max-width: 480px) {
        font-size: clamp(12px, 2.5vw, 14px);
        margin-top: 4px;
    }
`;



const NewsCard = ({ newsItem, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, onSummarize, onExplain, translations, handleTranslationClick }) => {
    const { fontSize } = useFontSize();
    const [showTitleTranslation, setShowTitleTranslation] = useState(false);
    const [showArticleTranslation, setShowArticleTranslation] = useState(false);
    const [titleTranslation, setTitleTranslation] = useState('');
    const [articleTranslation, setArticleTranslation] = useState('');
    const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
    const [isTranslatingArticle, setIsTranslatingArticle] = useState(false);
    const [selectedPhrasalVerb, setSelectedPhrasalVerb] = useState(null);
    const [exampleTranslations, setExampleTranslations] = useState({});
    const [showExplanation, setShowExplanation] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);

    // 정리된 텍스트들
    const cleanTitle = newsItem?.title?.replace(/\*\*(.*?)\*\*/g, '$1') || '';
    const textToRead = newsItem?.summary || newsItem?.full_text?.replace(/\*\*(.*?)\*\*/g, '$1') || '';

    const handleCardClick = useCallback(() => {
        onToggle(index);
    }, [onToggle, index]);

    const handleAudioClick = useCallback((e, text) => {
        e.stopPropagation();
        onPlayAudio(text);
    }, [onPlayAudio]);

    const handleTitleTranslateClick = useCallback(async (e) => {
        e.stopPropagation();

        // 이미 번역이 표시 중이면 토글로 숨기기
        if (showTitleTranslation) {
            setShowTitleTranslation(false);
            return;
        }

        // 번역이 없으면 번역 요청
        if (!titleTranslation) {
            setIsTranslatingTitle(true);
            const result = await onTranslate(cleanTitle);
            setTitleTranslation(result);
            setIsTranslatingTitle(false);
        }

        // 번역 표시
        setShowTitleTranslation(true);
    }, [showTitleTranslation, titleTranslation, onTranslate, cleanTitle]);

    const handleArticleTranslateClick = useCallback(async (e) => {
        e.stopPropagation();

        // 이미 번역이 표시 중이면 토글로 숨기기
        if (showArticleTranslation) {
            setShowArticleTranslation(false);
            return;
        }

        // 번역이 없으면 번역 요청
        if (!articleTranslation) {
            setIsTranslatingArticle(true);
            const result = await onTranslate(textToRead);
            setArticleTranslation(result);
            setIsTranslatingArticle(false);
        }

        // 번역 표시
        setShowArticleTranslation(true);
    }, [showArticleTranslation, articleTranslation, onTranslate, textToRead]);

    const handleExplainClick = useCallback(async (e) => {
        e.stopPropagation();

        if (showExplanation) {
            setShowExplanation(false);
            return;
        }

        setShowExplanation(true);

        if (!explanation) {
            setIsExplaining(true);
            const result = await onExplain(textToRead);
            setExplanation(result);
            setIsExplaining(false);
        }
    }, [showExplanation, explanation, onExplain, textToRead]);


    // news가 변경될 때 번역 상태 초기화
    useEffect(() => {
        setShowTitleTranslation(false);
        setShowArticleTranslation(false);
        setTitleTranslation('');
        setArticleTranslation('');
        setIsTranslatingTitle(false);
        setIsTranslatingArticle(false);
    }, [newsItem?.title, newsItem?.full_text]);



    // 구동사 클릭 핸들러
    const handlePhrasalVerbClick = useCallback((phrasalVerb) => {
        setSelectedPhrasalVerb(phrasalVerb);
    }, []);

    const handleExampleTranslation = useCallback(async (exampleText) => {
        if (exampleTranslations[exampleText]) {
            return; // 이미 번역된 경우
        }

        // 로딩 상태 설정
        setExampleTranslations(prev => ({
            ...prev,
            [exampleText]: { loading: true }
        }));

        try {
            const translation = await handleTranslationClick(exampleText);
            if (translation) {
                setExampleTranslations(prev => ({
                    ...prev,
                    [exampleText]: translation
                }));
            }
        } catch (error) {
            console.error('예시 번역 실패:', error);
            // 에러 발생 시 로딩 상태 제거
            setExampleTranslations(prev => {
                const newState = { ...prev };
                delete newState[exampleText];
                return newState;
            });
        }
    }, [exampleTranslations, handleTranslationClick]);

    // 구동사 상세 정보 가져오기
    const getPhrasalVerbDetails = useCallback((phrasalVerb) => {
        const details = {
            "come up with: 생각해내다, 제안하다": {
                nuance: '창의적이고 즉흥적인 아이디어 생성의 뉘앙스입니다. "나타나다, 생겨나다"는 의미에서 "새로운 것을 만들어내는" 창조적 과정을 강조합니다. 이 구동사는 기존에 없던 새로운 것을 만들어내는 능동적이고 창의적인 사고 과정을 나타냅니다. 특히 문제 해결을 위한 새로운 접근법이나 혁신적인 아이디어를 제시할 때 사용되며, 단순한 모방이나 복사가 아닌 독창적인 창조 과정을 의미합니다.',
                usage: '회의에서 새로운 아이디어를 제안하거나, 문제 해결책을 찾을 때 사용합니다. 브레인스토밍이나 창의적 사고가 필요한 상황에서 자주 쓰입니다. 또한 예술 작품을 만들거나, 새로운 비즈니스 모델을 개발할 때도 사용됩니다. 이 구동사는 창의성과 혁신을 강조하므로, 기존의 방법으로는 해결할 수 없는 문제에 대한 새로운 접근법을 제시할 때 사용됩니다.',
                'grammar': 'separable (분리 가능) - 목적어가 대명사일 경우 동사와 부사 사이에 위치해야 합니다. (This plan? I came up with it. - O / I came up it with. - X)',
                situations: [
                    '"Can you come up with a better plan for the project?"',
                    '"We need to come up with a creative solution to this problem."',
                    '"The team came up with an innovative marketing strategy."',
                    '"She always comes up with great ideas for the presentation."'
                ]
            },
            "look into: 조사하다, 살펴보다": {
                nuance: '신중하고 체계적인 조사를 의미하는 뉘앙스입니다. 단순히 "보다"가 아니라 "깊이 살펴보고 조사하는" 전문적이고 신중한 태도를 나타냅니다. 이 구동사는 표면적인 관찰이 아닌 근본적인 원인이나 진실을 파악하려는 의도적인 노력을 강조합니다. 특히 복잡한 문제나 사건을 체계적으로 분석하고 이해하려는 전문적이고 신중한 접근 방식을 나타냅니다.',
                usage: '문제나 사건을 조사하거나, 불만사항을 검토할 때 사용합니다. 경찰이 사건을 조사하거나, 회사에서 고객 불만을 처리할 때 자주 쓰입니다. 또한 연구나 조사가 필요한 학술적, 전문적 상황에서도 사용됩니다. 이 구동사는 신중하고 체계적인 접근을 강조하므로, 성급한 결론을 내리기 전에 충분한 조사와 분석이 필요한 상황에서 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 목적어는 항상 전치사 뒤에 위치해야 합니다. look into something 형태로 사용됩니다.',
                situations: [
                    '"The police will look into the matter thoroughly."',
                    '"I\'ll look into your complaint and get back to you."',
                    '"The committee decided to look into the allegations."',
                    '"We need to look into the cause of the problem."'
                ]
            },
            "put up with: 참다, 견디다": {
                nuance: '불만스럽지만 어쩔 수 없이 참고 견디는 뉘앙스입니다. "올려놓고 견디다"는 의미에서 "불쾌한 것을 감내하는" 부정적이지만 인내심 있는 태도를 나타냅니다. 이 구동사는 개인의 의지와는 상관없이 주어진 상황을 받아들이고 견뎌내는 과정을 강조합니다. 특히 선택의 여지가 없거나 피할 수 없는 상황에서의 인내와 관용을 의미하며, 단순한 참는 것이 아닌 적극적인 수용과 적응의 과정을 포함합니다.',
                usage: '시끄러운 소음, 어려운 사람, 불편한 상황을 참고 견딜 때 사용합니다. 불만이 있지만 어쩔 수 없이 받아들여야 하는 상황에서 자주 쓰입니다. 또한 가족이나 동료와의 갈등 상황에서, 또는 사회적 제약이나 규칙을 받아들일 때도 사용됩니다. 이 구동사는 개인의 감정과 의지보다는 현실적인 필요나 상황에 따른 선택을 강조하므로, 이상적이지 않지만 현실적으로 받아들여야 하는 상황에서 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 3단어 구동사(동사+부사+전치사)로, 목적어는 항상 마지막 전치사 뒤에 옵니다.',
                situations: [
                    '"I can\'t put up with this noise anymore."',
                    '"How do you put up with such difficult customers?"',
                    '"The neighbors have to put up with construction noise."',
                    '"Students must put up with strict school rules."'
                ]
            },
            "work together: 함께 일하다, 협력하다": {
                nuance: '상호 협력과 팀워크를 강조하는 뉘앙스입니다. "함께 일하다"는 의미에서 "서로 도우며 협력하는" 긍정적이고 건설적인 관계를 나타냅니다. 이 구동사는 개인의 능력보다는 집단의 시너지와 협력을 통한 성과 창출을 강조합니다. 특히 서로 다른 배경과 전문성을 가진 사람들이 공통의 목표를 달성하기 위해 조화롭게 협력하는 과정을 의미하며, 경쟁보다는 협력을 통한 상호 이익을 추구하는 건설적인 태도를 나타냅니다.',
                usage: '팀 프로젝트, 공동 작업, 협력이 필요한 상황에서 사용합니다. 서로 다른 배경의 사람들이 목표를 달성하기 위해 함께 노력할 때 자주 쓰입니다. 또한 국제 협력, 기업 간 파트너십, 지역 사회 협력 등 다양한 수준의 협력 상황에서 사용됩니다. 이 구동사는 개인의 성과보다는 집단의 성과를 강조하므로, 상호 보완적인 관계를 통한 시너지 창출이 중요한 상황에서 사용됩니다.',
                'grammar': 'intransitive (자동사) - 목적어 없이 사용되거나, 전치사 with/on 등과 함께 사용됩니다.',
                situations: [
                    '"We need to work together to solve this problem."',
                    '"The two companies work together on this project."',
                    '"Different departments must work together for success."',
                    '"Countries should work together to address global issues."'
                ]
            },
            "fight against: ~에 맞서 싸우다": {
                nuance: '강한 의지와 결단력을 보여주는 뉘앙스입니다. "싸우다"는 의미에서 "어려운 상황에 맞서 적극적으로 대응하는" 용기와 의지를 나타냅니다. 이 구동사는 수동적인 수용이 아닌 능동적인 저항과 대응을 강조합니다. 특히 불의나 부정적인 상황에 맞서 정의와 진실을 위해 투쟁하는 과정을 의미하며, 개인의 안전이나 편안함보다는 더 큰 가치를 위해 위험을 감수하는 용기 있는 태도를 나타냅니다.',
                usage: '불의나 부정적인 상황에 맞서 싸울 때 사용합니다. 사회적 문제, 불공정한 정책, 환경 문제 등에 대항할 때 자주 쓰입니다. 또한 개인적인 어려움이나 질병에 맞서 투쟁할 때도 사용됩니다. 이 구동사는 적극적인 저항과 대응을 강조하므로, 수동적으로 받아들이기보다는 능동적으로 변화를 추구하는 상황에서 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 목적어는 항상 전치사 against 뒤에 위치해야 합니다.',
                situations: [
                    '"We must fight against climate change together."',
                    '"They fought against the new policy that was unfair."',
                    '"The community fought against the construction project."',
                    '"She fought against her illness with great courage."'
                ]
            },
            "set up: 설립하다, 설치하다": {
                nuance: '체계적이고 계획적인 준비 과정의 뉘앙스입니다. "설치하다"는 의미에서 "새로운 것을 체계적으로 준비하고 시작하는" 신중하고 계획적인 태도를 나타냅니다. 이 구동사는 무작정 시작하는 것이 아닌 체계적인 계획과 준비를 통한 신중한 시작을 강조합니다. 특히 새로운 조직이나 시스템을 구축할 때 필요한 모든 요소들을 체계적으로 준비하고 정비하는 과정을 의미하며, 성공적인 운영을 위한 기반을 마련하는 신중한 접근 방식을 나타냅니다.',
                usage: '새로운 조직, 시스템, 이벤트를 준비할 때 사용합니다. 사업을 시작하거나, 회의를 준비하거나, 시스템을 구축할 때 자주 쓰입니다. 또한 실험 환경을 조성하거나, 네트워크를 구축할 때도 사용됩니다. 이 구동사는 체계적인 준비와 계획을 강조하므로, 성급한 시작보다는 신중한 준비가 필요한 상황에서 사용됩니다.',
                'grammar': 'separable (분리 가능) - 목적어가 대명사일 경우 동사와 부사 사이에 위치해야 합니다. (Set it up - O / Set up it - X)',
                situations: [
                    '"They set up a new company last year."',
                    '"We need to set up a meeting for next week."',
                    '"The IT team set up the new computer system."',
                    '"She set up a charity organization to help children."'
                ]
            },
            "take over: 인수하다, 이어받다": {
                nuance: '권한과 책임의 이전을 강조하는 뉘앙스입니다. "인수하다"는 의미에서 "기존의 것을 넘겨받아 새로운 책임을 맡는" 전환과 변화의 과정을 나타냅니다. 이 구동사는 단순한 소유권 이전이 아닌 책임과 권한의 완전한 이전을 강조합니다. 특히 기존의 역할이나 기능을 완전히 대체하고 새로운 방향으로 이끌어가는 과정을 의미하며, 변화와 혁신을 통한 새로운 시작을 나타냅니다.',
                usage: '직책이나 프로젝트를 인수할 때 사용합니다. 새로운 리더가 기존 업무를 이어받거나, 회사가 다른 회사를 인수할 때 자주 쓰입니다. 또한 기술이나 시스템이 기존의 것을 대체할 때도 사용됩니다. 이 구동사는 완전한 이전과 대체를 강조하므로, 부분적인 참여보다는 전체적인 책임과 권한의 이전이 필요한 상황에서 사용됩니다.',
                'grammar': 'separable (분리 가능) - 목적어가 대명사일 경우 동사와 부사 사이에 위치해야 합니다. (Take it over - O / Take over it - X)',
                situations: [
                    '"The new CEO will take over next month."',
                    '"They took over the project from us."',
                    '"The new system will take over the old one."',
                    '"She took over the family business after her father retired."'
                ]
            },
            "break through: 돌파하다, 성과를 내다": {
                nuance: '혁신과 돌파를 강조하는 뉘앙스입니다. "돌파하다"는 의미에서 "기존의 한계를 뛰어넘어 새로운 성과를 이루는" 혁신적이고 도전적인 과정을 나타냅니다. 이 구동사는 기존의 장벽이나 한계를 극복하고 새로운 영역으로 나아가는 혁신적인 성과를 강조합니다. 특히 오랫동안 해결되지 않았던 문제나 도전적인 과제를 해결하는 획기적인 성과를 의미하며, 변화와 혁신을 통한 새로운 가능성을 열어가는 과정을 나타냅니다.',
                usage: '연구나 개발에서 중요한 성과를 낼 때 사용합니다. 과학 연구, 기술 개발, 스포츠 등에서 획기적인 성과를 낼 때 자주 쓰입니다. 또한 개인적인 성장이나 발전에서 중요한 전환점을 이룰 때도 사용됩니다. 이 구동사는 혁신과 돌파를 강조하므로, 기존의 방법으로는 해결할 수 없는 문제에 대한 새로운 접근법이나 해결책을 찾는 상황에서 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 목적어는 항상 전치사 through 뒤에 옵니다. 자동사로도 사용됩니다.',
                situations: [
                    '"Scientists made a breakthrough in cancer research."',
                    '"The team finally broke through the defense."',
                    '"The company broke through the market barriers."',
                    '"She broke through her fear of public speaking."'
                ]
            },
            "cut down: 줄이다, 감소시키다": {
                nuance: '의도적이고 계획적인 감소의 뉘앙스입니다. "자르다"는 의미에서 "불필요한 것을 제거하고 효율성을 높이는" 신중하고 계획적인 접근을 나타냅니다. 이 구동사는 단순한 감소가 아닌 전략적이고 의도적인 최적화 과정을 강조합니다. 특히 비효율적인 요소들을 제거하고 핵심적인 부분에 집중하는 과정을 의미하며, 품질을 유지하면서도 효율성을 높이는 신중한 접근 방식을 나타냅니다.',
                usage: '비용, 시간, 자원을 줄일 때 사용합니다. 예산 절약, 시간 관리, 효율성 향상이 필요한 상황에서 자주 쓰입니다. 또한 건강이나 환경을 위해 소비를 줄일 때도 사용됩니다. 이 구동사는 전략적인 감소를 강조하므로, 무작정 줄이는 것이 아닌 목적을 가지고 신중하게 최적화하는 상황에서 사용됩니다.',
                'grammar': 'separable (분리 가능) - cut something down 형태로 쓰이거나, 자동사로 쓰일 때는 전치사 on과 함께 쓰입니다 (cut down on).',
                situations: [
                    '"We need to cut down on our expenses this year."',
                    '"The company cut down its workforce by 10%."',
                    '"I\'m trying to cut down on sugar for my health."',
                    '"The government cut down on unnecessary regulations."'
                ]
            },
            "phase out: 단계적으로 폐지하다": {
                nuance: '신중하고 점진적인 변화의 뉘앙스입니다. "단계적으로"라는 의미에서 "급작스럽지 않고 신중하게 변화를 추진하는" 계획적이고 안전한 접근을 나타냅니다. 이 구동사는 급격한 변화로 인한 혼란을 피하고 안정적인 전환을 추구하는 신중한 접근 방식을 강조합니다. 특히 기존 시스템이나 제도를 완전히 중단하기 전에 충분한 준비와 대안을 마련하는 과정을 의미하며, 변화의 부작용을 최소화하면서 점진적으로 새로운 방향으로 나아가는 과정을 나타냅니다.',
                usage: '기존 시스템이나 제도를 점진적으로 중단할 때 사용합니다. 정책 변경, 기술 교체, 제품 단계적 중단 등에서 자주 쓰입니다. 또한 오래된 관행이나 제도를 현대적인 것으로 대체할 때도 사용됩니다. 이 구동사는 점진적이고 신중한 변화를 강조하므로, 급격한 변화보다는 안정적인 전환이 필요한 상황에서 사용됩니다.',
                'grammar': 'separable (분리 가능) - 목적어가 대명사일 경우 동사와 부사 사이에 위치해야 합니다. (Phase it out - O / Phase out it - X)',
                situations: [
                    '"The old system will be phased out gradually."',
                    '"They plan to phase out fossil fuels by 2050."',
                    '"The company is phasing out the old product line."',
                    '"The government phased out the outdated policy."'
                ]
            },
            "step up: 강화하다, 증대시키다": {
                nuance: '적극적이고 능동적인 강화의 뉘앙스입니다. "단계를 올리다"는 의미에서 "기존의 수준을 넘어서 더 강력하고 효과적으로 만드는" 적극적이고 능동적인 태도를 나타냅니다. 이 구동사는 수동적인 유지가 아닌 능동적인 발전과 강화를 강조합니다. 특히 현재의 노력이나 활동이 충분하지 않을 때 더 강력하고 효과적인 대응이 필요한 상황을 의미하며, 위기나 도전에 대한 적극적이고 능동적인 대응을 나타냅니다.',
                usage: '노력이나 활동을 더 강화할 때 사용합니다. 보안 강화, 노력 증대, 활동 확대가 필요한 상황에서 자주 쓰입니다. 또한 위기 상황에서 더 강력한 대응이 필요할 때도 사용됩니다. 이 구동사는 적극적이고 능동적인 강화를 강조하므로, 현재의 수준으로는 부족한 상황에서 더 강력한 대응이 필요한 상황에서 사용됩니다.',
                'grammar': 'separable (분리 가능) - 목적어가 대명사일 경우 동사와 부사 사이에 위치해야 합니다. (Step it up - O / Step up it - X)',
                situations: [
                    '"The government stepped up security measures."',
                    '"We need to step up our efforts to meet the deadline."',
                    '"The company stepped up its marketing campaign."',
                    '"She stepped up her training for the competition."'
                ]
            },
            "look for: 찾다, 모색하다": {
                nuance: '능동적으로 무언가를 찾으려는 노력의 뉘앙스입니다. "찾아보다"는 의미에서 "잃어버린 것을 발견하려는" 적극적인 탐색 과정을 강조합니다. 이 구동사는 단순히 시선을 돌리는 것이 아니라, 목적을 가지고 대상을 찾아내기 위한 의도적인 행동을 나타냅니다. 특히 물건을 잃어버렸거나, 정보를 탐색하거나, 기회를 모색할 때 사용되며, 적극적인 탐색과 발견의 과정을 강조합니다.',
                usage: '잃어버린 물건을 찾거나, 정보를 검색하거나, 기회를 모색할 때 사용합니다. 능동적인 탐색 과정을 강조하며, 단순히 시선을 돌리는 것이 아닌 목적을 가진 행동을 나타냅니다. 또한 새로운 직업을 찾거나, 해결책을 모색할 때도 사용됩니다. 이 구동사는 적극적인 탐색과 발견의 과정을 강조하므로, 목표 지향적인 행동을 나타낼 때 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 목적어는 항상 전치사 for 뒤에 와야 합니다.',
                situations: [
                    '"I need to look for my keys before I leave."',
                    '"She is looking for a new job opportunity."',
                    '"We should look for a solution to this problem."',
                    '"The detective is looking for clues at the crime scene."'
                ]
            },
            "get over: 극복하다, 회복하다": {
                nuance: '시간이 지나면서 자연스럽게 극복되는 과정의 뉘앙스입니다. "넘어서다"라는 의미에서 "어려움을 뒤로 하고 앞으로 나아가는" 회복과 성장의 과정을 나타냅니다. 이 구동사는 개인의 내적 성장과 회복력을 강조하며, 단순한 시간의 경과가 아닌 적극적인 극복과 성장의 과정을 의미합니다. 특히 감정적 상처나 어려운 경험을 통해 더 강해지고 성숙해지는 과정을 나타냅니다.',
                usage: '이별, 질병, 실망 같은 어려운 상황에서 회복할 때 사용합니다. 시간이 지나면서 자연스럽게 극복되는 과정을 나타내며, 개인의 내적 성장과 회복력을 강조합니다. 또한 과거의 트라우마나 상처를 극복하고 새로운 시작을 할 때도 사용됩니다. 이 구동사는 단순한 시간의 경과가 아닌 적극적인 극복과 성장의 과정을 강조하므로, 개인의 의지와 노력이 필요한 상황에서 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 목적어는 항상 전치사 over 뒤에 와야 합니다.',
                situations: [
                    '"It took months to get over the loss of her pet."',
                    '"The athlete got over his injury and returned to training."',
                    '"She finally got over her fear of public speaking."',
                    '"The company got over the financial crisis successfully."'
                ]
            },
            "run out of: ~이 떨어지다, 바닥나다": {
                nuance: '갑작스럽고 예상치 못한 부족함의 뉘앙스입니다. "달려나가서 떠나다"는 의미에서 "갑자기 없어져버리는" 놀라움과 당황스러움을 동시에 나타냅니다. 이 구동사는 예상치 못한 상황의 급작스러운 변화를 강조하며, 단순한 부족함이 아닌 갑작스러운 결핍 상태를 의미합니다. 특히 일상적인 흐름이 갑자기 중단되는 상황에서의 당황과 긴급함을 나타냅니다.',
                usage: '우유, 시간, 빵 같은 것들이 갑자기 떨어졌을 때 사용합니다. 예상치 못하게 부족해진 상황에서 자주 쓰이며, 특히 일상적인 흐름이 갑자기 중단되는 상황에서 사용됩니다. 또한 에너지, 인내심, 아이디어 등 추상적인 것들이 갑자기 부족해질 때도 사용됩니다. 이 구동사는 갑작스러운 변화와 긴급함을 강조하므로, 예상치 못한 상황에서의 당황과 대응의 필요성을 나타낼 때 사용됩니다.',
                'grammar': 'inseparable (분리 불가) - 3단어 구동사로 목적어는 항상 전치사 of 뒤에 와야 합니다.',
                situations: [
                    '"We\'ve run out of milk, so I need to go shopping."',
                    '"The restaurant ran out of ingredients for the special dish."',
                    '"The library ran out of copies of the popular book."',
                    '"The team ran out of energy in the final minutes."'
                ]
            }
        };
        // 구동사 이름만 추출하여 매칭 (예: "come up with: 생각해내다" -> "come up with")
        const phrasalVerbName = phrasalVerb.split(':')[0].trim();
        const matchingKey = Object.keys(details).find(key => key.startsWith(phrasalVerbName));

        return details[matchingKey] || {
            nuance: "이 구동사는 다양한 상황에서 사용될 수 있는 중요한 표현입니다. 문맥에 따라 여러 의미로 해석될 수 있으며, 일상 대화나 글에서 자주 접할 수 있습니다. 구동사의 의미를 정확히 이해하고 적절한 상황에서 사용할 수 있도록 다양한 예시를 통해 학습하는 것이 중요합니다.",
            usage: "이 구동사는 일상 대화나 글에서 자주 사용되는 표현입니다. 문맥에 따라 다양한 의미로 해석될 수 있으며, 적절한 상황에서 사용하면 더 자연스러운 영어 표현이 됩니다. 구동사의 의미와 사용법을 정확히 이해하고 다양한 상황에서 연습해보는 것이 중요합니다.",
            grammar: "문법 정보가 준비 중입니다.",
            situations: [
                `"Can you ${phrasalVerb.split(':')[0]} the answer?"`,
                `"We need to ${phrasalVerb.split(':')[0]} a solution."`,
                `"I'll ${phrasalVerb.split(':')[0]} more information about this."`,
                `"They decided to ${phrasalVerb.split(':')[0]} the project."`
            ]
        };
    }, []);

    // newsItem이 없으면 빈 객체 반환
    if (!newsItem) {
        return null;
    }

    return (
        <CardContainer onClick={handleCardClick}>
            <NewsSource>
                <SourceBadge>
                    {newsItem?.source || 'News Source'}
                </SourceBadge>
                <NewsDate>
                    {newsItem?.date ? new Date(newsItem.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : new Date().toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </NewsDate>
            </NewsSource>
            <TitleContainer>
                <NewsTitle onClick={handleCardClick}>
                    {newsItem?.title?.replace(/\*\*(.*?)\*\*/g, '$1') || ''}
                </NewsTitle>
                <TitleActionButtons>
                    <ActionButton
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAudioClick(e, cleanTitle);
                        }}
                        disabled={audioStates[cleanTitle] === 'loading'}
                        aria-label="제목 음성 재생"
                    >
                        {audioStates[cleanTitle] === 'loading' ? (
                            <LoaderIcon size="h-6 w-6" />
                        ) : (
                            <Volume2Icon />
                        )}
                    </ActionButton>
                    <ActionButton
                        onClick={(e) => {
                            e.stopPropagation();
                            handleTitleTranslateClick(e);
                        }}
                        disabled={isTranslatingTitle}
                        aria-label="제목 번역 보기"
                    >
                        {isTranslatingTitle ? (
                            <LoaderIcon size="h-6 w-6" />
                        ) : (
                            <TranslateIcon />
                        )}
                    </ActionButton>
                    <ActionButton
                        onClick={handleExplainClick}
                        aria-label="선생님 설명 듣기"
                    >
                        <BookOpenIcon />
                    </ActionButton>
                </TitleActionButtons>
            </TitleContainer>

            {showTitleTranslation && (
                <TranslationText>
                    {titleTranslation || '번역을 불러오는 중...'}
                </TranslationText>
            )}

            <ExpandedSection isActive={isActive}>
                <SummarySection>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', position: 'relative' }}>
                        <SectionTitle style={{ margin: 0, textAlign: 'center' }}>
                            {newsItem?.category === 'korean' ? '한국 뉴스 요약' : '세계 뉴스 요약'}
                        </SectionTitle>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', right: '0' }}>
                            <ActionButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAudioClick(e, textToRead);
                                }}
                                disabled={audioStates[textToRead] === 'loading'}
                                aria-label="기사 음성 재생"
                                style={{ minWidth: '20px', minHeight: '20px', padding: '3px' }}
                            >
                                {audioStates[textToRead] === 'loading' ? (
                                    <LoaderIcon size="h-2 w-2" />
                                ) : (
                                    <Volume2Icon className="h-2 w-2" />
                                )}
                            </ActionButton>
                            <ActionButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArticleTranslateClick(e);
                                }}
                                disabled={isTranslatingArticle}
                                aria-label="기사 번역 보기"
                                style={{ minWidth: '20px', minHeight: '20px', padding: '3px' }}
                            >
                                {isTranslatingArticle ? (
                                    <LoaderIcon size="h-2 w-2" />
                                ) : (
                                    <TranslateIcon className="h-2 w-2" />
                                )}
                            </ActionButton>
                        </div>
                    </div>

                    <SummaryText style={{ fontSize: `${fontSize}em`, lineHeight: '1.6', marginBottom: '16px' }}>
                        {newsItem?.summary || (
                            <span style={{ color: '#888', fontStyle: 'italic' }}>
                                {newsItem?.category === 'korean' ? '한국 뉴스 요약을 생성하고 있습니다...' : '세계 뉴스 요약을 생성하고 있습니다...'}
                            </span>
                        )}
                    </SummaryText>

                    {/* 기사 번역 표시 */}
                    {showArticleTranslation && (
                        <div style={{
                            background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)',
                            border: '1px solid #555',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '16px'
                        }}>
                            <h4 style={{
                                color: '#00d4ff',
                                fontSize: '14px',
                                fontWeight: '600',
                                margin: '0 0 12px 0',
                                textAlign: 'center'
                            }}>
                                기사 번역
                            </h4>
                            <p style={{
                                color: '#ffffff',
                                fontSize: '16px',
                                lineHeight: '1.6',
                                margin: '0',
                                textAlign: 'left'
                            }}>
                                {articleTranslation || '번역을 불러오는 중...'}
                            </p>
                        </div>
                    )}

                    {/* 핵심 포인트와 어휘 노트를 한 줄에 배치 */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        {/* 구동사 */}
                        <div style={{ flex: 1 }}>
                            {newsItem?.key_points && newsItem.key_points.length > 0 ? (
                                <>
                                    <SectionTitle style={{ fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>구동사</SectionTitle>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {newsItem?.key_points?.map((point, index) => (
                                            <KeyPointCard
                                                key={index}
                                                style={{ padding: '8px', marginBottom: '4px', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePhrasalVerbClick(point);
                                                }}
                                            >
                                                <KeyPointText style={{ fontSize: '11px', lineHeight: '1.3' }}>{point}</KeyPointText>
                                            </KeyPointCard>
                                        ))}
                                    </div>
                                </>
                            ) : newsItem?.summary && (
                                <div style={{ color: '#888', fontSize: '12px', fontStyle: 'italic', textAlign: 'center' }}>
                                    구동사를 생성하고 있습니다...
                                </div>
                            )}
                        </div>

                        {/* 주요 단어 */}
                        <div style={{ flex: 1 }}>
                            {newsItem?.vocabulary_notes && newsItem.vocabulary_notes.length > 0 ? (
                                <>
                                    <SectionTitle style={{ fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>주요 단어</SectionTitle>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {newsItem?.vocabulary_notes?.map((note, index) => (
                                            <KeyPointCard key={index} style={{ padding: '8px', marginBottom: '4px' }}>
                                                <KeyPointText style={{ fontSize: '11px', lineHeight: '1.3' }}>{note}</KeyPointText>
                                            </KeyPointCard>
                                        ))}
                                    </div>
                                </>
                            ) : newsItem?.summary && (
                                <div style={{ color: '#888', fontSize: '12px', fontStyle: 'italic', textAlign: 'center' }}>
                                    주요 단어를 생성하고 있습니다...
                                </div>
                            )}
                        </div>
                    </div>

                </SummarySection>

            </ExpandedSection>

            {/* 구동사 상세 정보 팝업 모달 */}
            {selectedPhrasalVerb && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }} onClick={() => setSelectedPhrasalVerb(null)}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                        border: '2px solid #333',
                        borderRadius: '20px',
                        padding: '24px',
                        maxWidth: '500px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                        minHeight: 'auto'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{
                            color: '#00d4ff',
                            fontSize: '18px',
                            fontWeight: '700',
                            margin: '0 0 8px 0',
                            textAlign: 'center'
                        }}>
                            구동사 상세 설명
                        </h3>

                        <div style={{
                            textAlign: 'center',
                            marginBottom: '20px'
                        }}>
                            <h4 style={{
                                color: '#ffffff',
                                fontSize: '16px',
                                fontWeight: '600',
                                margin: '0 0 4px 0'
                            }}>
                                {selectedPhrasalVerb}
                            </h4>
                        </div>

                        {(() => {
                            const details = getPhrasalVerbDetails(selectedPhrasalVerb);
                            return (
                                <>
                                    <div style={{ marginBottom: '20px' }}>
                                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>뉘앙스:</strong>
                                        <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.5', margin: '8px 0 0 0' }}>
                                            {details.nuance}
                                        </p>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>사용법:</strong>
                                        <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.5', margin: '8px 0 0 0' }}>
                                            {details.usage}
                                        </p>
                                    </div>

                                    <div>
                                        <h4 style={{ color: '#00d4ff', fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0' }}>
                                            사용 상황 예시
                                        </h4>
                                        {details.situations.map((situation, index) => (
                                            <div key={index} style={{
                                                background: 'linear-gradient(135deg, #333 0%, #444 100%)',
                                                border: '1px solid #555',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '8px'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: exampleTranslations[situation] ? '8px' : '0'
                                                }}>
                                                    <p style={{
                                                        color: '#ffffff',
                                                        fontSize: '13px',
                                                        lineHeight: '1.4',
                                                        margin: '0',
                                                        fontWeight: '500',
                                                        flex: 1
                                                    }}>
                                                        {situation}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                                                        <button style={{
                                                            background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }} onClick={(e) => {
                                                            e.stopPropagation();
                                                            onPlayAudio(situation);
                                                        }}>
                                                            <Volume2Icon className="h-3 w-3" style={{ color: '#000' }} />
                                                        </button>
                                                        <button style={{
                                                            background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }} onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExampleTranslation(situation);
                                                        }}>
                                                            {exampleTranslations[situation]?.loading ? (
                                                                <LoaderIcon size="h-3 w-3" />
                                                            ) : (
                                                                <TranslateIcon className="h-3 w-3" style={{ color: '#000' }} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                {exampleTranslations[situation] && !exampleTranslations[situation]?.loading && (
                                                    <div style={{
                                                        paddingTop: '8px',
                                                        borderTop: '1px solid #555',
                                                        marginTop: '8px'
                                                    }}>
                                                        <p style={{
                                                            color: '#00d4ff',
                                                            fontSize: '12px',
                                                            lineHeight: '1.4',
                                                            margin: '0',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            {exampleTranslations[situation]}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button style={{
                                        background: 'linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%)',
                                        border: '1px solid #00d4ff',
                                        borderRadius: '8px',
                                        color: '#000',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        padding: '12px 24px',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        width: '100%',
                                        marginTop: '16px'
                                    }} onClick={() => setSelectedPhrasalVerb(null)}>
                                        닫기
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            <ExplanationModal
                isOpen={showExplanation}
                onClose={() => setShowExplanation(false)}
                explanation={explanation}
                isLoading={isExplaining}
            />
        </CardContainer>
    );
};

export default NewsCard;

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Volume2Icon, TranslateIcon, LoaderIcon } from './Icons';

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

const TitleActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  
  @media (max-width: 768px) {
    gap: 6px;
    margin-left: 10px;
  }
  
  @media (max-width: 480px) {
    gap: 4px;
    margin-left: 8px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    gap: 10px;
    margin-bottom: 16px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 12px;
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
  padding: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  touch-action: manipulation;
  min-width: 48px;
  min-height: 48px;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 10px;
    min-width: 44px;
    min-height: 44px;
  }
  
  @media (max-width: 480px) {
    padding: 8px;
    min-width: 40px;
    min-height: 40px;
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

const TranslationText = styled.div`
    color: #00d4ff;
    font-size: clamp(11px, 2.5vw, 13px);
    line-height: 1.4;
    margin-top: 8px;
    padding-left: 8px;
    border-left: 2px solid #00d4ff;
    
    @media (max-width: 768px) {
        font-size: clamp(10px, 2.5vw, 12px);
        margin-top: 6px;
    }
    
    @media (max-width: 480px) {
        font-size: clamp(9px, 2.5vw, 11px);
        margin-top: 4px;
    }
`;



const NewsCard = ({ newsItem, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, onSummarize, translations, handleTranslationClick }) => {
    const [showTitleTranslation, setShowTitleTranslation] = useState(false);
    const [showArticleTranslation, setShowArticleTranslation] = useState(false);
    const [titleTranslation, setTitleTranslation] = useState('');
    const [articleTranslation, setArticleTranslation] = useState('');
    const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
    const [isTranslatingArticle, setIsTranslatingArticle] = useState(false);
    const [selectedPhrasalVerb, setSelectedPhrasalVerb] = useState(null);
    const [exampleTranslations, setExampleTranslations] = useState({});
    
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
        if (!showTitleTranslation && !titleTranslation) {
            setIsTranslatingTitle(true);
            const result = await onTranslate(cleanTitle);
            setTitleTranslation(result);
            setIsTranslatingTitle(false);
        }
        setShowTitleTranslation(!showTitleTranslation);
    }, [showTitleTranslation, titleTranslation, onTranslate, cleanTitle]);

    const handleArticleTranslateClick = useCallback(async (e) => {
        e.stopPropagation();
        if (!showArticleTranslation && !articleTranslation) {
            setIsTranslatingArticle(true);
            const result = await onTranslate(textToRead);
            setArticleTranslation(result);
            setIsTranslatingArticle(false);
        }
        setShowArticleTranslation(!showArticleTranslation);
    }, [showArticleTranslation, articleTranslation, onTranslate, textToRead]);


    // news가 변경될 때 번역 상태 초기화
    useEffect(() => {
        setShowTitleTranslation(false);
        setShowArticleTranslation(false);
        setTitleTranslation('');
        setArticleTranslation('');
        setIsTranslatingTitle(false);
        setIsTranslatingArticle(false);
    }, [newsItem?.title, newsItem?.full_text]);


    const handleWordClick = useCallback((e, word, meaning, example, detailedInfo) => {
        e.stopPropagation();
        onWordClick(word, meaning, example, detailedInfo);
    }, [onWordClick]);

    // 구동사 클릭 핸들러
    const handlePhrasalVerbClick = useCallback((phrasalVerb) => {
        setSelectedPhrasalVerb(phrasalVerb);
    }, []);

    const handleExampleTranslation = useCallback(async (exampleText) => {
        if (exampleTranslations[exampleText]) {
            return; // 이미 번역된 경우
        }

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
        }
    }, [exampleTranslations, handleTranslationClick]);

    // 구동사 상세 정보 가져오기
    const getPhrasalVerbDetails = useCallback((phrasalVerb) => {
        const details = {
            "come up with: 생각해내다, 제안하다": {
                nuance: '창의적이고 즉흥적인 아이디어 생성의 뉘앙스. "나타나다, 생겨나다"는 의미에서 "새로운 것을 만들어내는" 창조적 과정을 강조합니다.',
                usage: '회의에서 새로운 아이디어를 제안하거나, 문제 해결책을 찾을 때 사용합니다. 브레인스토밍이나 창의적 사고가 필요한 상황에서 자주 쓰입니다.',
                situations: [
                    '"Can you come up with a better plan?"',
                    '"We need to come up with a solution."'
                ]
            },
            "look into: 조사하다, 살펴보다": {
                nuance: '신중하고 체계적인 조사를 의미하는 뉘앙스. 단순히 "보다"가 아니라 "깊이 살펴보고 조사하는" 전문적이고 신중한 태도를 나타냅니다.',
                usage: '문제나 사건을 조사하거나, 불만사항을 검토할 때 사용합니다. 경찰이 사건을 조사하거나, 회사에서 고객 불만을 처리할 때 자주 쓰입니다.',
                situations: [
                    '"The police will look into the matter."',
                    '"I\'ll look into your complaint."'
                ]
            },
            "put up with: 참다, 견디다": {
                nuance: '불만스럽지만 어쩔 수 없이 참고 견디는 뉘앙스. "올려놓고 견디다"는 의미에서 "불쾌한 것을 감내하는" 부정적이지만 인내심 있는 태도를 나타냅니다.',
                usage: '시끄러운 소음, 어려운 사람, 불편한 상황을 참고 견딜 때 사용합니다. 불만이 있지만 어쩔 수 없이 받아들여야 하는 상황에서 자주 쓰입니다.',
                situations: [
                    '"I can\'t put up with this noise anymore."',
                    '"How do you put up with him?"'
                ]
            },
            "work together: 함께 일하다, 협력하다": {
                nuance: '상호 협력과 팀워크를 강조하는 뉘앙스. "함께 일하다"는 의미에서 "서로 도우며 협력하는" 긍정적이고 건설적인 관계를 나타냅니다.',
                usage: '팀 프로젝트, 공동 작업, 협력이 필요한 상황에서 사용합니다. 서로 다른 배경의 사람들이 목표를 달성하기 위해 함께 노력할 때 자주 쓰입니다.',
                situations: [
                    '"We need to work together to solve this problem."',
                    '"The two companies work together on this project."'
                ]
            },
            "fight against: ~에 맞서 싸우다": {
                nuance: '강한 의지와 결단력을 보여주는 뉘앙스. "싸우다"는 의미에서 "어려운 상황에 맞서 적극적으로 대응하는" 용기와 의지를 나타냅니다.',
                usage: '불의나 부정적인 상황에 맞서 싸울 때 사용합니다. 사회적 문제, 불공정한 정책, 환경 문제 등에 대항할 때 자주 쓰입니다.',
                situations: [
                    '"We must fight against climate change."',
                    '"They fought against the new policy."'
                ]
            },
            "set up: 설립하다, 설치하다": {
                nuance: '체계적이고 계획적인 준비 과정의 뉘앙스. "설치하다"는 의미에서 "새로운 것을 체계적으로 준비하고 시작하는" 신중하고 계획적인 태도를 나타냅니다.',
                usage: '새로운 조직, 시스템, 이벤트를 준비할 때 사용합니다. 사업을 시작하거나, 회의를 준비하거나, 시스템을 구축할 때 자주 쓰입니다.',
                situations: [
                    '"They set up a new company last year."',
                    '"We need to set up a meeting for next week."'
                ]
            },
            "take over: 인수하다, 이어받다": {
                nuance: '권한과 책임의 이전을 강조하는 뉘앙스. "인수하다"는 의미에서 "기존의 것을 넘겨받아 새로운 책임을 맡는" 전환과 변화의 과정을 나타냅니다.',
                usage: '직책이나 프로젝트를 인수할 때 사용합니다. 새로운 리더가 기존 업무를 이어받거나, 회사가 다른 회사를 인수할 때 자주 쓰입니다.',
                situations: [
                    '"The new CEO will take over next month."',
                    '"They took over the project from us."'
                ]
            },
            "break through: 돌파하다, 성과를 내다": {
                nuance: '혁신과 돌파를 강조하는 뉘앙스. "돌파하다"는 의미에서 "기존의 한계를 뛰어넘어 새로운 성과를 이루는" 혁신적이고 도전적인 과정을 나타냅니다.',
                usage: '연구나 개발에서 중요한 성과를 낼 때 사용합니다. 과학 연구, 기술 개발, 스포츠 등에서 획기적인 성과를 낼 때 자주 쓰입니다.',
                situations: [
                    '"Scientists made a breakthrough in cancer research."',
                    '"The team finally broke through the defense."'
                ]
            },
            "cut down: 줄이다, 감소시키다": {
                nuance: '의도적이고 계획적인 감소의 뉘앙스. "자르다"는 의미에서 "불필요한 것을 제거하고 효율성을 높이는" 신중하고 계획적인 접근을 나타냅니다.',
                usage: '비용, 시간, 자원을 줄일 때 사용합니다. 예산 절약, 시간 관리, 효율성 향상이 필요한 상황에서 자주 쓰입니다.',
                situations: [
                    '"We need to cut down on our expenses."',
                    '"The company cut down its workforce."'
                ]
            },
            "phase out: 단계적으로 폐지하다": {
                nuance: '신중하고 점진적인 변화의 뉘앙스. "단계적으로"라는 의미에서 "급작스럽지 않고 신중하게 변화를 추진하는" 계획적이고 안전한 접근을 나타냅니다.',
                usage: '기존 시스템이나 제도를 점진적으로 중단할 때 사용합니다. 정책 변경, 기술 교체, 제품 단계적 중단 등에서 자주 쓰입니다.',
                situations: [
                    '"The old system will be phased out gradually."',
                    '"They plan to phase out fossil fuels."'
                ]
            },
            "step up: 강화하다, 증대시키다": {
                nuance: '적극적이고 능동적인 강화의 뉘앙스. "단계를 올리다"는 의미에서 "기존의 수준을 넘어서 더 강력하고 효과적으로 만드는" 적극적이고 능동적인 태도를 나타냅니다.',
                usage: '노력이나 활동을 더 강화할 때 사용합니다. 보안 강화, 노력 증대, 활동 확대가 필요한 상황에서 자주 쓰입니다.',
                situations: [
                    '"The government stepped up security measures."',
                    '"We need to step up our efforts."'
                ]
            }
        };
        return details[phrasalVerb] || {
            nuance: "이 구동사의 상세한 뉘앙스와 사용법을 학습해보세요.",
            usage: "이 구동사는 다양한 상황에서 사용될 수 있습니다.",
            situations: [
                `"Can you ${phrasalVerb.split(':')[0]} the answer?"`,
                `"We need to ${phrasalVerb.split(':')[0]} a solution."`
            ]
        };
    }, []);

    // newsItem이 없으면 빈 객체 반환
    if (!newsItem) {
        return null;
    }

    return (
        <CardContainer onClick={handleCardClick}>
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
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'absolute', right: '0' }}>
                            <ActionButton 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAudioClick(e, textToRead);
                                }}
                                    disabled={audioStates[textToRead] === 'loading'}
                                    aria-label="기사 음성 재생"
                                style={{ minWidth: '24px', minHeight: '24px', padding: '6px' }}
                                >
                                    {audioStates[textToRead] === 'loading' ? (
                                    <LoaderIcon size="h-3 w-3" />
                                ) : (
                                    <Volume2Icon className="h-3 w-3" />
                                )}
                            </ActionButton>
                            <ActionButton 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArticleTranslateClick(e);
                                }}
                                disabled={isTranslatingArticle}
                                aria-label="기사 번역 보기"
                                style={{ minWidth: '24px', minHeight: '24px', padding: '6px' }}
                            >
                                {isTranslatingArticle ? (
                                    <LoaderIcon size="h-3 w-3" />
                                ) : (
                                    <TranslateIcon className="h-3 w-3" />
                                )}
                            </ActionButton>
                        </div>
                    </div>
                    
                    <SummaryText style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '16px' }}>
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
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
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
                                                            <TranslateIcon className="h-3 w-3" style={{ color: '#000' }} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {exampleTranslations[situation] && (
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
        </CardContainer>
    );
};

export default NewsCard;

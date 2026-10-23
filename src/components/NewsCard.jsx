import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, TranslateIcon, LoaderIcon, BookOpenIcon } from './Icons';
import { useFontSize } from '../contexts/FontSizeContext';
import ExplanationModal from './ExplanationModal';
import { phrasalVerbDetails } from '../data/phrasalVerbDetails';

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
        // 구동사 이름만 추출하여 매칭 (예: "come up with: 생각해내다" -> "come up with")
        const phrasalVerbName = phrasalVerb.split(':')[0].trim().toLowerCase();
        const details = phrasalVerbDetails[phrasalVerbName];

        return details || {
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

export default React.memo(NewsCard);

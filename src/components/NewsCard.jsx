import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, TranslateIcon, LoaderIcon, BookOpenIcon, CloseIcon } from './Icons';
import { useFontSize } from '../contexts/FontSizeContext';
import ExplanationModal from './ExplanationModal';
import { phrasalVerbDetails } from '../data/phrasalVerbDetails';

// 최신 CSS Grid와 Flexbox를 활용한 스타일드 컴포넌트들
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 20px;
  background: var(--ink);
  border: 1px solid var(--ink);
  border-radius: 20px;
  color: #f2ede2;
  box-shadow: 0 18px 34px rgba(23, 20, 15, 0.18);
  transition: box-shadow 200ms ease;

  @media (max-width: 480px) {
    padding: 18px;
    border-radius: 18px;
  }
`;

const TitleContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 0;
`;

const NewsTitle = styled.h3`
  flex: 1 1 100%;
  margin: 0;
  color: #f2ede2;
  font-size: clamp(20px, 4.8vw, 24px);
  font-weight: 650;
  line-height: 1.36;
  letter-spacing: -0.03em;
  text-align: left;
  cursor: pointer;
  transition: color 160ms ease;

  &:hover {
    color: var(--coral);
  }

  &:active {
    opacity: 0.8;
  }
`;

const NewsSource = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding: 0;
  background: transparent;
  border: 0;
`;

const SourceBadge = styled.span`
  padding: 4px 8px;
  border: 1px solid rgba(242, 237, 226, 0.26);
  border-radius: 999px;
  color: #f2ede2;
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const NewsDate = styled.span`
  color: rgba(242, 237, 226, 0.52);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.03em;
`;

const TitleActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  margin-left: auto;
`;


const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 6px;
  border: 1px solid rgba(242, 237, 226, 0.22);
  border-radius: 50%;
  background: transparent;
  color: #f2ede2;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg {
    width: 14px !important;
    height: 14px !important;
  }

  &:hover {
    border-color: var(--coral);
    color: var(--coral);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
`;

const ExpandedSection = styled.div`
  max-height: ${props => props.isActive ? 'none' : '0'};
  opacity: ${props => props.isActive ? '1' : '0'};
  overflow: hidden;
  margin-top: ${props => props.isActive ? '16px' : '0'};
  padding-top: ${props => props.isActive ? '14px' : '0'};
  border-top: ${props => props.isActive ? '1px solid rgba(242, 237, 226, 0.14)' : '0 solid transparent'};
  transition: opacity 300ms ease;
`;

const SummarySection = styled.div`
  padding: 15px;
  border: 1px solid rgba(242, 237, 226, 0.1);
  border-radius: 14px;
  background: rgba(242, 237, 226, 0.06);
  box-shadow: none;
  margin-bottom: 0;
`;

const SectionTitle = styled.h4`
  margin: 0 0 10px;
  color: #ff8b6d;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: left;
`;

const SummaryText = styled.p`
  margin: 0 0 14px;
  color: rgba(242, 237, 226, 0.82);
  font-size: clamp(14px, 3.6vw, 16px);
  line-height: 1.7;
  text-align: left;
`;

const KeyPointCard = styled.div`
  margin-bottom: 4px;
  padding: 10px;
  border: 1px solid rgba(242, 237, 226, 0.1);
  border-radius: 10px;
  background: rgba(242, 237, 226, 0.05);
  transition: border-color 150ms ease;

  &:hover {
    border-color: rgba(239, 83, 46, 0.55);
  }
`;

const KeyPointText = styled.span`
  flex: 1;
  padding-right: 8px;
  color: rgba(242, 237, 226, 0.78);
  font-size: 11px;
  line-height: 1.45;
`;


const TranslationText = styled.div`
  margin-top: 8px;
  padding-left: 10px;
  border-left: 2px solid var(--coral);
  color: #ffab93;
  font-size: 12.5px;
  line-height: 1.65;
`;



const ArticleTranslationBox = styled.div`
  margin: 12px 0;
  padding: 12px 14px;
  border-left: 2px solid var(--coral);
  border-radius: 0 10px 10px 0;
  background: rgba(242, 237, 226, 0.06);

  h4 {
    margin: 0 0 6px;
    color: #ff8b6d;
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    color: rgba(242, 237, 226, 0.8);
    font-size: 12.5px;
    line-height: 1.7;
  }
`;

const PvOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(23, 20, 15, 0.5);
  backdrop-filter: blur(7px);

  @media (min-width: 640px) {
    align-items: center;
    padding: 20px;
  }
`;

const PvSheet = styled.div`
  width: 100%;
  max-width: 520px;
  max-height: 88dvh;
  overflow-y: auto;
  padding: 18px 18px calc(20px + env(safe-area-inset-bottom));
  border: 1px solid var(--line);
  border-radius: 28px 28px 0 0;
  background: var(--card-paper);
  color: var(--ink);
  box-shadow: 0 -24px 60px rgba(23, 20, 15, 0.28);

  @media (min-width: 640px) {
    padding: 24px;
    border-radius: 24px;
  }
`;

const PvHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
`;

const PvTitle = styled.h3`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-style: italic;
  font-weight: 500;
  letter-spacing: -0.03em;
`;

const PvCloseButton = styled.button`
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  svg { width: 15px; height: 15px; }

  &:hover { border-color: var(--ink); color: var(--ink); }
`;

const PvLabel = styled.h4`
  margin: 14px 0 4px;
  color: var(--coral);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const PvText = styled.p`
  margin: 0;
  color: #4f4a40;
  font-size: 12.5px;
  line-height: 1.7;
`;

const PvExample = styled.div`
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8f3e8;
`;

const PvExampleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const PvExampleText = styled.p`
  flex: 1;
  margin: 0;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
`;

const PvActions = styled.div`
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
`;

const PvIconButton = styled.button`
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

  svg { width: 12px; height: 12px; }

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PvTranslation = styled.p`
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
`;

const PvDoneButton = styled.button`
  width: 100%;
  height: 44px;
  margin-top: 18px;
  border: 0;
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;

  &:active { opacity: 0.85; }
`;

const parseVocabularyNote = (note) => {
    const raw = String(note || '').trim();
    const separator = raw.indexOf(':');
    if (separator === -1) return { word: raw, meaning: '' };
    return {
        word: raw.slice(0, separator).trim(),
        meaning: raw.slice(separator + 1).trim(),
    };
};

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

    useEffect(() => {
        if (!selectedPhrasalVerb) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [selectedPhrasalVerb]);

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



    const findVocabularyExample = useCallback((word) => {
        const text = (newsItem?.summary || newsItem?.full_text || newsItem?.title || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text || !word) return '';

        const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
        const matched = sentences.find((sentence) =>
            sentence.toLowerCase().includes(word.toLowerCase())
        );
        return (matched || sentences[0] || text).trim();
    }, [newsItem?.summary, newsItem?.full_text, newsItem?.title]);

    const handleVocabularyClick = useCallback((event, note) => {
        event.stopPropagation();

        if (typeof onWordClick !== 'function') return;

        const { word, meaning } = parseVocabularyNote(note);
        if (!word) return;

        onWordClick(
            word,
            meaning,
            findVocabularyExample(word),
            { type: 'vocabulary', frequency: 'high' }
        );
    }, [onWordClick, findVocabularyExample]);

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', position: 'relative' }}>
                        <SectionTitle style={{ margin: 0, textAlign: 'left' }}>
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

                            >
                                {isTranslatingArticle ? (
                                    <LoaderIcon size="h-2 w-2" />
                                ) : (
                                    <TranslateIcon className="h-2 w-2" />
                                )}
                            </ActionButton>
                        </div>
                    </div>

                    <SummaryText style={{ fontSize: `calc(${fontSize} * 14.5px)`, lineHeight: '1.7', marginBottom: '14px' }}>
                        {newsItem?.summary || (
                            <span style={{ color: 'rgba(242, 237, 226, 0.6)', fontStyle: 'italic' }}>
                                {newsItem?.category === 'korean' ? '한국 뉴스 요약을 생성하고 있습니다...' : '세계 뉴스 요약을 생성하고 있습니다...'}
                            </span>
                        )}
                    </SummaryText>

                    {/* 기사 번역 표시 */}
                    {showArticleTranslation && (
                        <ArticleTranslationBox>
                            <h4>기사 번역</h4>
                            <p>{articleTranslation || '번역을 불러오는 중...'}</p>
                        </ArticleTranslationBox>
                    )}

                    {/* 핵심 포인트와 어휘 노트를 한 줄에 배치 */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        {/* 구동사 */}
                        <div style={{ flex: 1 }}>
                            {newsItem?.key_points && newsItem.key_points.length > 0 ? (
                                <>
                                    <SectionTitle style={{ fontSize: '12px', marginBottom: '8px', textAlign: 'left' }}>구동사</SectionTitle>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {newsItem?.key_points?.map((point, index) => (
                                            <KeyPointCard
                                                key={index}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`구동사 상세: ${point}`}
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
                                    <SectionTitle style={{ fontSize: '12px', marginBottom: '8px', textAlign: 'left' }}>주요 단어</SectionTitle>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {newsItem?.vocabulary_notes?.map((note, index) => (
                                            <KeyPointCard
                                                as="button"
                                                type="button"
                                                key={index}
                                                onClick={(event) => handleVocabularyClick(event, note)}
                                                aria-label={`단어 상세: ${note}`}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    marginBottom: '4px',
                                                    color: 'inherit',
                                                    font: 'inherit',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    appearance: 'none',
                                                }}
                                            >
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
            {selectedPhrasalVerb && (() => {
                const details = getPhrasalVerbDetails(selectedPhrasalVerb);
                return (
                    <PvOverlay onClick={() => setSelectedPhrasalVerb(null)}>
                        <PvSheet
                            role="dialog"
                            aria-modal="true"
                            aria-label="구동사 상세 설명"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <PvHeader>
                                <PvTitle>{selectedPhrasalVerb}</PvTitle>
                                <PvCloseButton onClick={() => setSelectedPhrasalVerb(null)} aria-label="닫기">
                                    <CloseIcon />
                                </PvCloseButton>
                            </PvHeader>

                            <PvLabel>Nuance</PvLabel>
                            <PvText>{details.nuance}</PvText>

                            <PvLabel>Usage</PvLabel>
                            <PvText>{details.usage}</PvText>

                            <PvLabel>Examples</PvLabel>
                            {details.situations.map((situation, index) => (
                                <PvExample key={index}>
                                    <PvExampleRow>
                                        <PvExampleText>{situation}</PvExampleText>
                                        <PvActions>
                                            <PvIconButton
                                                onClick={() => onPlayAudio(situation)}
                                                aria-label="예문 음성 재생"
                                            >
                                                <Volume2Icon />
                                            </PvIconButton>
                                            <PvIconButton
                                                onClick={() => handleExampleTranslation(situation)}
                                                aria-label="예문 번역"
                                            >
                                                {exampleTranslations[situation]?.loading ? (
                                                    <LoaderIcon size="h-3 w-3" />
                                                ) : (
                                                    <TranslateIcon />
                                                )}
                                            </PvIconButton>
                                        </PvActions>
                                    </PvExampleRow>
                                    {exampleTranslations[situation] && !exampleTranslations[situation]?.loading && (
                                        <PvTranslation>{exampleTranslations[situation]}</PvTranslation>
                                    )}
                                </PvExample>
                            ))}

                            <PvDoneButton onClick={() => setSelectedPhrasalVerb(null)}>
                                닫기
                            </PvDoneButton>
                        </PvSheet>
                    </PvOverlay>
                );
            })()}
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

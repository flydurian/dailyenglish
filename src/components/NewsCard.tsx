import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, TranslateIcon, LoaderIcon, BookOpenIcon, CloseIcon } from './Icons';
import { useFontSize } from '../contexts/FontSizeContext';
import ExplanationModal from './ExplanationModal';
import { phrasalVerbDetails } from '../data/phrasalVerbDetails';
import { getPhrasalVerbDetail, getCachedVerbDetail, type AiDetailState } from '../utils/verbDetailService';
import TranslationStatus from './TranslationStatus';
import AccentFlags from './AccentFlags';

// 최신 CSS Grid와 Flexbox를 활용한 스타일드 컴포넌트들
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 20px;
  background: var(--card-paper);
  border: 1px solid var(--line);
  border-top: 3px solid var(--ink);
  border-radius: 20px;
  color: var(--ink);
  box-shadow: 0 12px 28px rgba(23, 20, 15, 0.07);
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
  color: var(--ink);
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
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const NewsDate = styled.span`
  color: var(--muted);
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
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
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

const ExpandedSection = styled.div<{ isActive?: boolean }>`
  max-height: ${props => props.isActive ? 'none' : '0'};
  opacity: ${props => props.isActive ? '1' : '0'};
  overflow: hidden;
  margin-top: ${props => props.isActive ? '16px' : '0'};
  padding-top: ${props => props.isActive ? '14px' : '0'};
  border-top: ${props => props.isActive ? '1px solid var(--line)' : '0 solid transparent'};
  transition: opacity 300ms ease;
`;

const SummarySection = styled.div`
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #f8f3e8;
  box-shadow: none;
  margin-bottom: 0;
`;

const SectionTitle = styled.h4`
  margin: 0 0 10px;
  color: var(--coral);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: left;
`;

const SummaryText = styled.p`
  margin: 0 0 14px;
  color: #4f4a40;
  font-size: clamp(14px, 3.6vw, 16px);
  line-height: 1.7;
  text-align: left;
`;

const KeyPointCard = styled.div<{ type?: string }>`
  margin-bottom: 4px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card-paper);
  transition: border-color 150ms ease;

  &:hover {
    border-color: rgba(239, 83, 46, 0.55);
  }
`;

const KeyPointText = styled.span`
  flex: 1;
  padding-right: 8px;
  color: #5f574a;
  font-size: 11px;
  line-height: 1.45;
`;


const TranslationText = styled.div`
  margin-top: 8px;
  padding-left: 10px;
  border-left: 2px solid var(--coral);
  color: var(--coral);
  font-size: 12.5px;
  line-height: 1.65;
`;



const ArticleTranslationBox = styled.div`
  margin: 12px 0;
  padding: 12px 14px;
  border-left: 2px solid var(--coral);
  border-radius: 0 10px 10px 0;
  background: #f8f3e8;

  h4 {
    margin: 0 0 6px;
    color: var(--coral);
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    color: #4f4a40;
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

const NewsCard = ({ newsItem, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, onSummarize, onGenerateExamples, onExplain, translations, handleTranslationClick }) => {
    const { fontSize } = useFontSize();
    const [showTitleTranslation, setShowTitleTranslation] = useState(false);
    const [showArticleTranslation, setShowArticleTranslation] = useState(false);
    const [titleTranslation, setTitleTranslation] = useState('');
    const [articleTranslation, setArticleTranslation] = useState('');
    const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
    const [isTranslatingArticle, setIsTranslatingArticle] = useState(false);
    const [selectedPhrasalVerb, setSelectedPhrasalVerb] = useState<string | null>(null);
    // 사전에 없는 구동사의 상세 정보: AI 생성 상태(loading/ready/error)
    const [aiDetail, setAiDetail] = useState<AiDetailState>({ verb: null, status: 'idle', data: null });
    const [exampleTranslations, setExampleTranslations] = useState({});
    const [showExplanation, setShowExplanation] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);

    // 정리된 텍스트들
    const cleanTitle = newsItem?.title?.replace(/\*\*(.*?)\*\*/g, '$1') || '';
    // 한국 뉴스는 summary 가 없을 때 한글 원문(full_text)으로 대체하지 않습니다.
    const isKoreanNews = newsItem?.category === 'korean';
    const textToReadSource = isKoreanNews
        ? (newsItem?.summary || newsItem?.title || '')
        : (newsItem?.summary || newsItem?.full_text || '');
    const textToRead = typeof textToReadSource === 'string'
        ? textToReadSource.replace(/\*\*(.*?)\*\*/g, '$1')
        : '';

    useEffect(() => {
        if (!selectedPhrasalVerb) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [selectedPhrasalVerb]);

    useEffect(() => {
        if (!selectedPhrasalVerb) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSelectedPhrasalVerb(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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
            setShowTitleTranslation(true);
            setIsTranslatingTitle(true);
            try {
                const result = await onTranslate(cleanTitle);
                setTitleTranslation(result);
            } catch (error) {
                console.error('제목 번역 실패:', error);
                setTitleTranslation('번역을 불러오는 데 실패했습니다.');
            } finally {
                setIsTranslatingTitle(false);
            }
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
            setShowArticleTranslation(true);
            setIsTranslatingArticle(true);
            try {
                const result = await onTranslate(textToRead);
                setArticleTranslation(result);
            } catch (error) {
                console.error('기사 번역 실패:', error);
                setArticleTranslation('번역을 불러오는 데 실패했습니다.');
            } finally {
                setIsTranslatingArticle(false);
            }
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
        // 한국 뉴스는 한글 원문으로 대체하지 않고 영어 summary/title 안에서만 예문을 찾습니다.
        const source = isKoreanNews
            ? (newsItem?.summary || newsItem?.title || '')
            : (newsItem?.summary || newsItem?.full_text || newsItem?.title || '');
        const text = (typeof source === 'string' ? source : '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text || !word) return '';

        const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
        const matched = sentences.find((sentence) =>
            sentence.toLowerCase().includes(word.toLowerCase())
        );
        return (matched || sentences[0] || text).trim();
    }, [isKoreanNews, newsItem?.summary, newsItem?.full_text, newsItem?.title]);

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
        const verbName = phrasalVerb.split(':')[0].trim().toLowerCase();
        setSelectedPhrasalVerb(phrasalVerb);

        // 사전 데이터가 있으면 그대로 사용하고, 없으면 캐시 → AI 생성 순서로 확인합니다.
        if (phrasalVerbDetails[verbName]) {
            setAiDetail({ verb: verbName, status: 'idle', data: null });
            return;
        }

        const cached = getCachedVerbDetail(verbName);
        if (cached) {
            setAiDetail({ verb: verbName, status: 'ready', data: cached });
            return;
        }

        setAiDetail({ verb: verbName, status: 'loading', data: null });
        const meaning = phrasalVerb.split(':').slice(1).join(':').trim();
        const context = (newsItem?.summary || '').replace(/\*\*(.*?)\*\*/g, '$1');
        getPhrasalVerbDetail(verbName, meaning, context).then((data) => {
            setAiDetail((prev) => (prev.verb === verbName
                ? { verb: verbName, status: data ? 'ready' : 'error', data }
                : prev));
        });
    }, [newsItem]);

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
    // 사전 데이터(phrasalVerbDetails)에 등록된 구동사만 반환합니다. 없는 구동사는
    // handlePhrasalVerbClick에서 AI 생성(getPhrasalVerbDetail)으로 처리하며,
    // 여기서 틀린 문장을 만들어내는 템플릿 폴백은 사용하지 않습니다.
    const getPhrasalVerbDetails = useCallback((phrasalVerb) => {
        // 구동사 이름만 추출하여 매칭 (예: "come up with: 생각해내다" -> "come up with")
        const phrasalVerbName = phrasalVerb.split(':')[0].trim().toLowerCase();
        return phrasalVerbDetails[phrasalVerbName] || null;
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
                    <AccentFlags
                      text={cleanTitle}
                      onPlayAudio={onPlayAudio}
                      audioState={audioStates[cleanTitle]}
                      size={24}
                    />
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
                    {isTranslatingTitle ? <TranslationStatus /> : (titleTranslation || '번역을 불러오는 중...')}
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
                            <AccentFlags
                              text={textToRead}
                              onPlayAudio={onPlayAudio}
                              audioState={audioStates[textToRead]}
                              size={22}
                            />
                        </div>
                    </div>

                    <SummaryText style={{ fontSize: `calc(${fontSize} * 14.5px)`, lineHeight: '1.7', marginBottom: '14px' }}>
                        {newsItem?.summary || (
                            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                {newsItem?.category === 'korean' ? '한국 뉴스 요약을 생성하고 있습니다...' : '세계 뉴스 요약을 생성하고 있습니다...'}
                            </span>
                        )}
                    </SummaryText>

                    {/* 기사 번역 표시 */}
                    {showArticleTranslation && (
                        <ArticleTranslationBox>
                            <h4>기사 번역</h4>
                            <p>
                                {isTranslatingArticle ? <TranslationStatus /> : (articleTranslation || '번역을 불러오는 중...')}
                            </p>
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
                                                onKeyDown={(e) => {
                                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                                    e.preventDefault();
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
                const verbName = selectedPhrasalVerb.split(':')[0].trim().toLowerCase();
                const details = getPhrasalVerbDetails(selectedPhrasalVerb);
                const aiReady = aiDetail.verb === verbName && aiDetail.status === 'ready' && aiDetail.data;
                const isLoading = !details && aiDetail.verb === verbName && aiDetail.status === 'loading';
                const isError = !details && !aiReady && !isLoading;
                const shown = details || (aiReady ? aiDetail.data : null);

                return (
                    <PvOverlay onClick={(e) => { e.stopPropagation(); setSelectedPhrasalVerb(null); }}>
                        <PvSheet
                            role="dialog"
                            aria-modal="true"
                            aria-label="구동사 상세 설명"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <PvHeader>
                                <PvTitle>{selectedPhrasalVerb}</PvTitle>
                                <PvCloseButton onClick={(e) => { e.stopPropagation(); setSelectedPhrasalVerb(null); }} aria-label="닫기">
                                    <CloseIcon />
                                </PvCloseButton>
                            </PvHeader>

                            {isLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '36px 0' }}>
                                    <LoaderIcon size="h-6 w-6" />
                                    <span style={{ color: '#888', fontSize: '13px' }}>
                                        AI가 이 구동사에 맞는 설명과 예문을 생성하고 있습니다...
                                    </span>
                                </div>
                            ) : isError ? (
                                <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '36px 0' }}>
                                    설명을 생성하지 못했습니다. 모달을 닫았다가 다시 눌러주세요.
                                </div>
                            ) : (
                                <>
                                    <PvLabel>Nuance</PvLabel>
                                    <PvText>{shown.nuance}</PvText>

                                    <PvLabel>Usage</PvLabel>
                                    <PvText>{shown.usage}</PvText>

                                    {shown.situations.length > 0 && (
                                        <>
                                            <PvLabel>Examples</PvLabel>
                                            {shown.situations.map((situation, index) => (
                                                <PvExample key={index}>
                                                    <PvExampleRow>
                                                        <PvExampleText>{situation}</PvExampleText>
                                                        <PvActions>
                                                            <PvIconButton
                                                                onClick={() => onPlayAudio(situation)}
                                                                disabled={audioStates[situation] === 'loading'}
                                                                aria-label="예문 음성 재생"
                                                            >
                                                                {audioStates[situation] === 'loading' ? (
                                                                    <LoaderIcon size="h-3 w-3" />
                                                                ) : (
                                                                    <Volume2Icon />
                                                                )}
                                                            </PvIconButton>
                                                            <AccentFlags
                                                              text={situation}
                                                              onPlayAudio={onPlayAudio}
                                                              audioState={audioStates[situation]}
                                                              size={24}
                                                            />
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
                                                    {exampleTranslations[situation]?.loading ? (
                                                        <PvTranslation><TranslationStatus /></PvTranslation>
                                                    ) : exampleTranslations[situation] ? (
                                                        <PvTranslation>{exampleTranslations[situation]}</PvTranslation>
                                                    ) : null}
                                                </PvExample>
                                            ))}
                                        </>
                                    )}
                                </>
                            )}

                            <PvDoneButton onClick={(e) => { e.stopPropagation(); setSelectedPhrasalVerb(null); }}>
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
                audioStates={audioStates}
                onPlayAudio={onPlayAudio}
            />
        </CardContainer>
    );
};

export default React.memo(NewsCard);

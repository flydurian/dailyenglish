import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { ArrowUpIcon } from './components/Icons';
import WordModal from './components/WordModal';
import ExpressionCard from './components/ExpressionCard';
import NewsCard from './components/NewsCard';
import FontSizeControl from './components/FontSizeControl';
import { useAudio } from './hooks/useAudio';
import { useTranslation } from './hooks/useTranslation';
import { useDataFetching } from './hooks/useDataFetching';
import { FontSizeProvider } from './contexts/FontSizeContext';
import { levelDescriptions } from './utils/apiUtils';
import { detectHotReload } from './utils/versionUtils';

// Editorial Paper 디자인 시스템
const AppContainer = styled.div`
  min-height: 100dvh;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-ui);
  padding-top: env(safe-area-inset-top);
  position: relative;
  z-index: 1;
`;

const MainContainer = styled.div`
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  padding: 0 21px calc(44px + env(safe-area-inset-bottom));
  text-align: left;

  @media (max-width: 480px) {
    padding: 0 18px calc(38px + env(safe-area-inset-bottom));
  }
`;

const Header = styled.header`
  width: 100%;
  padding: 24px 0 0;
`;

const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const Kicker = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  margin-top: 17px;
`;

const TitleBlock = styled.div`
  min-width: 0;
`;

const Title = styled.h1`
  margin: 0;
  color: var(--ink);
  font-size: clamp(2.6rem, 10vw, 4rem);
  font-weight: 730;
  line-height: 0.9;
  letter-spacing: -0.055em;

  em {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 400;
    letter-spacing: -0.04em;
  }

  @media (max-width: 480px) {
    font-size: clamp(2.5rem, 12vw, 3.4rem);
  }
`;

const Subtitle = styled.p`
  margin: 11px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
  letter-spacing: -0.01em;
`;

const FontControlWrapper = styled.div`
  flex: 0 0 auto;
  padding-bottom: 2px;
`;

const TabNavigation = styled.div`
  display: flex;
  gap: 26px;
  width: 100%;
  margin-top: 18px;
  border-bottom: 1px solid var(--line);

  @media (max-width: 480px) {
    gap: 22px;
  }
`;

const TabButton = styled.button`
  position: relative;
  margin-bottom: -1px;
  padding: 2px 0 10px;
  border: 0;
  border-bottom: 2px solid ${props => props.isActive ? 'var(--coral)' : 'transparent'};
  background: none;
  color: ${props => props.isActive ? 'var(--ink)' : 'var(--muted)'};
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease;
  touch-action: manipulation;

  &:active {
    opacity: 0.7;
  }
`;

const LevelSelection = styled.div`
  width: 100%;
  margin: 0;
`;

const LevelGrid = styled.div`
  display: flex;
  gap: 7px;
  margin: 13px -21px 0;
  padding: 2px 21px 4px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 480px) {
    margin-left: -18px;
    margin-right: -18px;
    padding-left: 18px;
    padding-right: 18px;
  }
`;

const LevelButton = styled.button`
  flex: 0 0 auto;
  min-width: 44px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid ${props => props.isActive ? 'var(--ink)' : 'var(--line)'};
  border-radius: 999px;
  background: ${props => props.isActive ? 'var(--ink)' : 'transparent'};
  color: ${props => props.isActive ? '#f8f3e6' : 'var(--muted)'};
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  &:active {
    transform: scale(0.95);
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 25px 0 12px;
`;

const Eyebrow = styled.p`
  margin: 0;
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--coral);
`;

const SectionTitle = styled.h2`
  margin: 5px 0 0;
  color: var(--ink);
  font-size: 17px;
  font-weight: 720;
  letter-spacing: -0.03em;

  span {
    color: var(--muted);
    font-weight: 500;
  }
`;

const SectionMeta = styled.span`
  padding-bottom: 2px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  white-space: nowrap;
`;

const MainContent = styled.main`
  width: 100%;
  position: relative;
`;

const ContentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 11px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 28px 0;
  text-align: center;
`;

const Spinner = styled.div`
  width: 30px;
  height: 30px;
  margin: 0 auto;
  border: 2px solid rgba(23, 20, 15, 0.14);
  border-top-color: var(--coral);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.div`
  margin-top: 14px;

  h3 {
    margin: 0 0 7px;
    color: var(--ink);
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 11.5px;
    line-height: 1.6;
  }
`;

const ErrorContainer = styled.div`
  padding: 18px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--coral);
  border-radius: 0 14px 14px 0;
  background: var(--card-paper);
  text-align: left;

  h3 {
    margin: 0 0 6px;
    color: var(--ink);
    font-size: 14px;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }
`;

const ScrollToTopButton = styled.button`
  position: fixed;
  right: 18px;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--ink);
  border-radius: 50%;
  background: var(--card-paper);
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(23, 20, 15, 0.16);
  transition: 160ms ease;
  touch-action: manipulation;

  &:hover {
    background: var(--ink);
    color: var(--paper);
  }

  &:active {
    transform: scale(0.94);
  }
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 28px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  p {
    margin: 0;
    color: inherit;
    font-size: inherit;
  }
`;

export default function App() {
  const [currentDate] = useState(new Date());
  const [level, setLevel] = useState('B1');
  const [activeTab, setActiveTab] = useState('expressions');
  const [expressions, setExpressions] = useState([]);
  const [news, setNews] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(null);
  const [activeNewsIndex, setActiveNewsIndex] = useState(null);
  const [wordModal, setWordModal] = useState({ isOpen: false, word: '', meaning: '', example: '', detailedInfo: null });

  const openWordModal = useCallback((word, meaning, example, detailedInfo) => {
    setWordModal({ isOpen: true, word, meaning, example, detailedInfo });
  }, []);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // 커스텀 훅 사용
  const { audioStates, playAudio } = useAudio();
  const { translateText, summarizeText, generateExamples, explainArticle, translations } = useTranslation();
  const { loading, error, fetchExpressions, fetchNews, initializeData } = useDataFetching();

  const levels = useMemo(() => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], []);

  const formattedDate = useMemo(() => {
    const d = currentDate;
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
  }, [currentDate]);


  // 데이터 가져오기
  const loadData = useCallback(async () => {
    try {
      if (activeTab === 'expressions') {
        const data = await fetchExpressions(currentDate, level);
        setExpressions(data);
        setActiveCardIndex(null);
      } else if (activeTab === 'news') {
        // 뉴스학습은 항상 오늘 날짜 사용
        const today = new Date();
        const data = await fetchNews(today, level);
        setNews(data);
        setActiveNewsIndex(null);
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    }
  }, [activeTab, currentDate, level, fetchExpressions, fetchNews]);

  // 스크롤 이벤트 처리
  useEffect(() => {
    let scrollTimeout;

    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);

      // 스크롤 중일 때 클래스 추가
      document.body.classList.add('scrolling');
      document.documentElement.classList.add('scrolling');

      // 스크롤이 멈춘 후 클래스 제거
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.body.classList.remove('scrolling');
        document.documentElement.classList.remove('scrolling');
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // 스크롤 to top
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // 버전 체크 및 핫 리로드 감지
  useEffect(() => {
    detectHotReload();
  }, []);

  // 탭이나 레벨 변경 시 데이터 로딩
  useEffect(() => {
    loadData();
  }, [loadData]);


  return (
    <FontSizeProvider>
      <AppContainer>
        <WordModal
          isOpen={wordModal.isOpen}
          word={wordModal.word}
          meaning={wordModal.meaning}
          example={wordModal.example}
          detailedInfo={wordModal.detailedInfo}
          onPlayAudio={playAudio}
          audioStates={audioStates}
          onGenerateExamples={generateExamples}
          onTranslate={translateText}
          onClose={() => setWordModal({ ...wordModal, isOpen: false })}
        />

        {showScrollToTop && (
          <ScrollToTopButton
            onClick={scrollToTop}
            aria-label="맨 위로 스크롤"
          >
            <ArrowUpIcon className="h-6 w-6" />
          </ScrollToTopButton>
        )}

        <MainContainer>
          <Header>
            <HeaderContent>
              <Kicker>
                <span>Daily practice</span>
                <span>{formattedDate}</span>
              </Kicker>

              <TitleRow>
                <TitleBlock>
                  <Title>
                    Daily<br /><em>English</em>
                  </Title>
                  <Subtitle>
                    매일 세 개의 표현으로<br />영어의 결을 익히세요.
                  </Subtitle>
                </TitleBlock>
                <FontControlWrapper>
                  <FontSizeControl />
                </FontControlWrapper>
              </TitleRow>

              <TabNavigation role="tablist" aria-label="학습 모드">
                <TabButton
                  isActive={activeTab === 'expressions'}
                  role="tab"
                  aria-selected={activeTab === 'expressions'}
                  onClick={() => setActiveTab('expressions')}
                >
                  오늘의 표현
                </TabButton>
                <TabButton
                  isActive={activeTab === 'news'}
                  role="tab"
                  aria-selected={activeTab === 'news'}
                  onClick={() => setActiveTab('news')}
                >
                  뉴스 학습
                </TabButton>
              </TabNavigation>
            </HeaderContent>
          </Header>


          {/* 레벨 선택 */}
          <LevelSelection>
            <LevelGrid role="group" aria-label="난이도">
              {levels.map(l => (
                <LevelButton
                  key={l}
                  isActive={level === l}
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </LevelButton>
              ))}
            </LevelGrid>
          </LevelSelection>

          <SectionHead>
            <div>
              <Eyebrow>{activeTab === 'expressions' ? "Today's selection" : 'News briefing'}</Eyebrow>
              <SectionTitle>
                {activeTab === 'expressions' ? <>오늘의 표현 <span>· 3</span></> : '뉴스로 배우기'}
              </SectionTitle>
            </div>
            <SectionMeta>{activeTab === 'expressions' ? '3 MIN READ' : 'AI SUMMARY'}</SectionMeta>
          </SectionHead>

          {/* 메인 컨텐츠 */}
          <MainContent>
            {loading ? (
              <LoadingContainer>
                <div>
                  <Spinner />
                  <LoadingText>
                    <h3>
                      {activeTab === 'expressions'
                        ? `${levelDescriptions[level]} 레벨 표현을 만들고 있어요...`
                        : `${levelDescriptions[level]} 레벨 뉴스를 만들고 있어요...`
                      }
                    </h3>
                    <p>AI가 최적화된 학습 콘텐츠를 생성하고 있습니다</p>
                  </LoadingText>
                </div>
              </LoadingContainer>
            ) : error ? (
              <ErrorContainer>
                <h3>데이터를 불러오는 데 실패했습니다.</h3>
                <p>잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.</p>
              </ErrorContainer>
            ) : (
              <ContentList>
                {activeTab === 'expressions' && (
                  expressions.map((expression, index) => (
                    <ExpressionCard
                      key={index}
                      expression={expression}
                      index={index}
                      isActive={activeCardIndex === index}
                      onToggle={(index) => {
                        setActiveCardIndex(activeCardIndex === index ? null : index);
                      }}
                      audioStates={audioStates}
                      onPlayAudio={playAudio}
                      onWordClick={openWordModal}
                      onTranslate={translateText}
                      level={level}
                      translations={translations}
                      handleTranslationClick={translateText}
                    />
                  ))
                )}
                {activeTab === 'news' && (
                  news.length > 0 ? news.map((newsItem, index) => (
                    <NewsCard
                      key={index}
                      newsItem={newsItem}
                      index={index}
                      isActive={activeNewsIndex === index}
                      onToggle={(index) => {
                        setActiveNewsIndex(activeNewsIndex === index ? null : index);
                      }}
                      audioStates={audioStates}
                      onPlayAudio={playAudio}
                      onWordClick={openWordModal}
                      onTranslate={translateText}
                      onSummarize={summarizeText}
                      onGenerateExamples={generateExamples}
                      onExplain={explainArticle}
                      translations={translations}
                      handleTranslationClick={translateText}
                    />
                  )) : (
                    <LoadingContainer>
                      <div>
                        <Spinner />
                        <LoadingText>
                          <h3>뉴스를 불러오는 중...</h3>
                          <p>AI가 최신 뉴스를 분석하고 있습니다</p>
                        </LoadingText>
                      </div>
                    </LoadingContainer>
                  )
                )}
              </ContentList>
            )}
          </MainContent>

          <Footer>
            <p>Powered by Gemini AI</p>
            <p>Seoul · 2026</p>
          </Footer>
        </MainContainer>
      </AppContainer>
    </FontSizeProvider>
  );
}
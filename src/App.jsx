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

// 최신 CSS Grid와 Flexbox를 활용한 스타일드 컴포넌트들
const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  
  @media (max-width: 768px) {
    padding: 0 12px;
  }
  
  @media (max-width: 480px) {
    padding: 0 8px;
  }
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 32px 0;
  position: relative;
  
  @media (max-width: 768px) {
    padding: 20px 0;
  }
  
  @media (max-width: 480px) {
    padding: 16px 0;
  }
`;

const HeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  padding: 0 20px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    padding: 0 16px;
    margin-bottom: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 0 12px;
    margin-bottom: 12px;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
  position: relative;
  
  @media (max-width: 768px) {
    margin-bottom: 16px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 12px;
  }
`;

const FontControlWrapper = styled.div`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
`;

const Title = styled.h1`
  background: linear-gradient(135deg, #00d4ff 0%, #ffffff 50%, #00d4ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: 800;
  margin: 0;
  text-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
  letter-spacing: -0.02em;
  
  @media (max-width: 768px) {
    font-size: clamp(1.8rem, 5vw, 2.5rem);
  }
  
  @media (max-width: 480px) {
    font-size: clamp(1.5rem, 4vw, 2rem);
  }
`;

const TabNavigation = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 8px;
  
  @media (max-width: 768px) {
    gap: 10px;
    margin-bottom: 6px;
  }
  
  @media (max-width: 640px) {
    gap: 8px;
    margin-bottom: 4px;
  }
  
  @media (max-width: 480px) {
    gap: 6px;
    margin-bottom: 4px;
  }
`;

const TabButton = styled.button`
  background: ${props => props.isActive 
    ? 'linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%)'
    : 'linear-gradient(135deg, #2a2a2a 0%, rgba(0, 212, 255, 0.05) 100%)'
  };
  border: 2px solid ${props => props.isActive ? '#00d4ff' : '#444'};
  border-radius: 16px;
  color: ${props => props.isActive ? '#000000' : '#ffffff'};
  cursor: pointer;
  font-size: clamp(14px, 3vw, 16px);
  font-weight: 700;
  min-height: 44px;
  padding: 8px 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${props => props.isActive 
    ? '0 8px 32px rgba(0, 212, 255, 0.3)'
    : '0 4px 16px rgba(0, 0, 0, 0.1)'
  };
  touch-action: manipulation;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: ${props => props.isActive 
      ? '0 12px 40px rgba(0, 212, 255, 0.4)'
      : '0 6px 20px rgba(0, 0, 0, 0.2)'
    };
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 8px 16px;
    min-height: 40px;
    font-size: 15px;
  }
  
  @media (max-width: 640px) {
    padding: 6px 12px;
    min-height: 36px;
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 6px 10px;
    min-height: 32px;
    font-size: 13px;
  }
`;


const LevelSelection = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #333;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  margin: 0 auto 8px;
  padding: 20px;
  width: 100%;
  max-width: 600px;
  
  @media (max-width: 768px) {
    padding: 16px;
    margin: 0 auto 6px;
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    margin: 0 auto 4px;
    border-radius: 12px;
  }
`;

const LevelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  
  @media (max-width: 768px) {
    gap: 10px;
  }
  
  @media (max-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  
  @media (max-width: 480px) {
    gap: 6px;
  }
`;

const LevelButton = styled.button`
  background: ${props => props.isActive 
    ? 'linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%)'
    : 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
  };
  border: 2px solid ${props => props.isActive ? '#00d4ff' : '#444'};
  border-radius: 12px;
  color: ${props => props.isActive ? '#000000' : '#ffffff'};
  cursor: pointer;
  font-size: clamp(14px, 2.5vw, 16px);
  font-weight: 700;
  min-height: 36px;
  padding: 8px 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${props => props.isActive 
    ? '0 4px 16px rgba(0, 212, 255, 0.3)'
    : '0 2px 8px rgba(0, 0, 0, 0.2)'
  };
  touch-action: manipulation;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: ${props => props.isActive 
      ? '0 6px 20px rgba(0, 212, 255, 0.4)'
      : '0 4px 12px rgba(0, 0, 0, 0.3)'
    };
  }
  
  @media (max-width: 768px) {
    min-height: 32px;
    padding: 6px 6px;
    font-size: 14px;
  }
  
  @media (max-width: 640px) {
    min-height: 28px;
    padding: 4px 4px;
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    min-height: 24px;
    padding: 2px 2px;
    font-size: 12px;
  }
`;

const MainContent = styled.main`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
`;


const ContentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  text-align: center;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.div`
  margin-top: 16px;
  
  h3 {
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }
  
  p {
    color: #cccccc;
    font-size: 14px;
    margin: 0;
  }
`;

const ErrorContainer = styled.div`
  background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
  border: 2px solid #ff6666;
  border-radius: 16px;
  color: #ffffff;
  padding: 20px;
  text-align: center;
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }
  
  p {
    font-size: 14px;
    margin: 0;
    opacity: 0.9;
  }
`;

const ScrollToTopButton = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  border: 2px solid #00d4ff;
  border-radius: 50%;
  color: #000000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px rgba(0, 212, 255, 0.3);
  z-index: 1000;
  touch-action: manipulation;
  
  &:hover {
    transform: translateY(-2px) scale(1.1);
    box-shadow: 0 12px 32px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  @media (max-width: 768px) {
    width: 52px;
    height: 52px;
    bottom: 20px;
    right: 20px;
  }
  
  @media (max-width: 640px) {
    width: 48px;
    height: 48px;
    bottom: 16px;
    right: 16px;
  }
  
  @media (max-width: 480px) {
    width: 44px;
    height: 44px;
    bottom: 12px;
    right: 12px;
  }
`;

const Footer = styled.footer`
  text-align: center;
  margin-top: 48px;
  padding: 24px 0;
  
  p {
    color: #888888;
    font-size: 12px;
    margin: 0;
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
    const [showScrollToTop, setShowScrollToTop] = useState(false);

    // 커스텀 훅 사용
    const { 
        audioStates, 
        playAudio, 
        clearNewsAudioCache, 
        clearOldAudioCache
    } = useAudio();
    const { translateText, summarizeText, generateExamples, translations } = useTranslation();
    const { loading, error, fetchExpressions, fetchNews, initializeData } = useDataFetching();

    const levels = useMemo(() => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], []);


    // 데이터 가져오기
    const loadData = useCallback(async () => {
        try {
            if (activeTab === 'expressions') {
                // 표현 데이터를 새로 불러올 때 오래된 캐시 정리
                clearOldAudioCache();
                const data = await fetchExpressions(currentDate, level);
                setExpressions(data);
                setActiveCardIndex(null);
            } else if (activeTab === 'news') {
                // 뉴스학습은 항상 오늘 날짜 사용
                const today = new Date();
                // 뉴스가 새로 불러와질 때 기존 뉴스 음성 캐시 삭제
                clearNewsAudioCache();
                const data = await fetchNews(today, level);
                setNews(data);
                setActiveNewsIndex(null);
            }
        } catch (err) {
            console.error('데이터 로딩 실패:', err);
        }
    }, [activeTab, currentDate, level, fetchExpressions, fetchNews, clearNewsAudioCache, clearOldAudioCache]);

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
                        <TitleRow>
                            <Title>
                                Daily English
                            </Title>
                            <FontControlWrapper>
                                <FontSizeControl />
                            </FontControlWrapper>
                        </TitleRow>
                        
                        <TabNavigation>
                            <TabButton 
                                isActive={activeTab === 'expressions'}
                                onClick={() => setActiveTab('expressions')}
                            >
                                오늘의 표현
                            </TabButton>
                            <TabButton 
                                isActive={activeTab === 'news'}
                                onClick={() => setActiveTab('news')}
                            >
                                뉴스 학습
                            </TabButton>
                        </TabNavigation>
                    </HeaderContent>
                </Header>

                    
                {/* 레벨 선택 */}
                <LevelSelection>
                    <LevelGrid>
                        {levels.map(l => (
                            <LevelButton 
                                key={l} 
                                isActive={level === l}
                                onClick={() => setLevel(l)} 
                            >
                                {l}
                            </LevelButton>
                        ))}
                    </LevelGrid>
                </LevelSelection>

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
                                        onWordClick={setWordModal}
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
                                        onWordClick={setWordModal}
                                        onTranslate={translateText}
                                        onSummarize={summarizeText}
                                        onGenerateExamples={generateExamples}
                                        translations={translations}
                                        handleTranslationClick={translateText}
                                    />
                                )) : (
                                    <div className="text-center py-8">
                                        <div className="text-gray-500 mb-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                            <p className="text-lg font-medium">뉴스를 불러오는 중...</p>
                                            <p className="text-sm">AI가 최신 뉴스를 분석하고 있습니다</p>
                                        </div>
                                    </div>
                                )
                            )}
                        </ContentList>
                    )}
                </MainContent>

                <Footer>
                    <p>Powered by Gemini AI</p>
                </Footer>
            </MainContainer>
        </AppContainer>
        </FontSizeProvider>
    );
}
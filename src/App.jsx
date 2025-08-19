import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, LoaderIcon, ArrowUpIcon } from './components/Icons';
import Calendar from './components/Calendar';
import WordModal from './components/WordModal';
import ExpressionCard from './components/ExpressionCard';
import NewsCard from './components/NewsCard';
import { useAudio } from './hooks/useAudio';
import { useTranslation } from './hooks/useTranslation';
import { useDataFetching } from './hooks/useDataFetching';
import { getAvailableDates, isCacheValid, getCacheKey } from './utils/cacheUtils';
import { levelDescriptions } from './utils/apiUtils';

export default function App() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [level, setLevel] = useState('B2');
    const [activeTab, setActiveTab] = useState('expressions');
    const [expressions, setExpressions] = useState([]);
    const [news, setNews] = useState([]);
    const [activeCardIndex, setActiveCardIndex] = useState(null);
    const [activeNewsIndex, setActiveNewsIndex] = useState(null);
    const [isCalendarOpen, setCalendarOpen] = useState(false);
    const [wordModal, setWordModal] = useState({ isOpen: false, word: '', meaning: '', example: '', detailedInfo: null });
    const [showScrollToTop, setShowScrollToTop] = useState(false);

    // 커스텀 훅 사용
    const { audioStates, playAudio, clearNewsAudioCache, clearOldExpressionsAudioCache } = useAudio();
    const { translateText, summarizeText, generateExamples, clearOldTranslations } = useTranslation();
    const { loading, error, fetchExpressions, fetchNews, initializeData } = useDataFetching();

    const levels = useMemo(() => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], []);

    // 캐시 관련 헬퍼 함수들
    const getExpressionsCacheKey = useCallback((date) => getCacheKey('expressions', date), []);
    const getNewsCacheKey = useCallback((date) => getCacheKey('news', date), []);
    const isExpressionsCacheValid = useCallback((date) => isCacheValid('expressions', date), []);
    const isNewsCacheValid = useCallback((date) => isCacheValid('news', date), []);

    // 데이터 가져오기
    const loadData = useCallback(async () => {
        try {
            if (activeTab === 'expressions') {
                // 표현 데이터를 새로 불러올 때 1주일 전 데이터 삭제
                clearOldExpressionsAudioCache();
                clearOldTranslations();
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
        } catch (e) {
            console.error('데이터 로드 실패:', e);
        }
    }, [currentDate, level, activeTab, fetchExpressions, fetchNews, clearNewsAudioCache, clearOldExpressionsAudioCache, clearOldTranslations]);

    // 초기화 및 데이터 로드
    useEffect(() => {
        initializeData();
        loadData();
    }, [initializeData, loadData]);

    // 스크롤 이벤트 핸들러
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollToTop(window.scrollY > 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 이벤트 핸들러들
    const changeDate = useCallback((days) => {
        // 뉴스학습 탭에서는 날짜 변경 불가
        if (activeTab === 'news') {
            return;
        }
        
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + days);
            return d;
        });
    }, [activeTab]);

    const goToToday = useCallback(() => {
        // 뉴스학습 탭에서는 오늘로 돌아가기 불가
        if (activeTab === 'news') {
            return;
        }
        
        setCurrentDate(new Date());
    }, [activeTab]);

    const formatDate = useCallback((date) => {
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
    }, []);
    
    const isToday = useMemo(() => {
        return currentDate.toDateString() === new Date().toDateString();
    }, [currentDate]);

    const toggleCard = useCallback((index) => {
        setActiveCardIndex(prev => prev === index ? null : index);
    }, []);

    const handleWordClick = useCallback((word, meaning, example, detailedInfo) => {
        setWordModal({ isOpen: true, word, meaning, example, detailedInfo });
    }, []);

    const closeWordModal = useCallback(() => {
        setWordModal({ isOpen: false, word: '', meaning: '', example: '', detailedInfo: null });
    }, []);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    return (
        <div className="bg-gray-50 font-sans min-h-screen flex flex-col items-center mobile-spacing mobile-scroll">
            {isCalendarOpen && activeTab === 'expressions' && (
                <Calendar 
                    selectedDate={currentDate} 
                    onDateSelect={setCurrentDate} 
                    closeCalendar={() => setCalendarOpen(false)} 
                    goToToday={goToToday}
                    availableDates={getAvailableDates()}
                />
            )}
            
            <WordModal
                isOpen={wordModal.isOpen}
                word={wordModal.word}
                meaning={wordModal.meaning}
                example={wordModal.example}
                detailedInfo={wordModal.detailedInfo}
                onClose={closeWordModal}
                onPlayAudio={playAudio}
                audioStates={audioStates}
                onGenerateExamples={generateExamples}
            />

            {/* 플로팅 스크롤 버튼 */}
            {showScrollToTop && (
                <button
                    onClick={scrollToTop}
                    className="mobile-floating bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 transition-all duration-200 transform hover:scale-110"
                    aria-label="맨 위로 이동"
                >
                    <ArrowUpIcon className="h-5 w-5" />
                </button>
            )}
            
            <div className="w-full max-w-2xl mx-auto pt-0">
                {/* 고정 헤더 */}
                <div className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 transition-transform duration-300 ${
                    showScrollToTop ? 'translate-y-0' : '-translate-y-full'
                }`}>
                    <div className="max-w-2xl mx-auto mobile-spacing">
                        <div className="flex items-center justify-between py-2">
                            <button 
                                onClick={() => changeDate(-1)} 
                                className={`mobile-button p-2 rounded-full transition-colors ${
                                    activeTab === 'news' ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                                disabled={activeTab === 'news'}
                                aria-label="이전 날"
                            >
                                <ChevronLeftIcon />
                            </button>
                            
                            <div className="flex flex-col items-center">
                                {activeTab === 'expressions' ? (
                                    <button 
                                        onClick={() => setCalendarOpen(true)} 
                                        className="mobile-button flex items-center text-sm font-semibold text-indigo-600 tabular-nums p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                                        <CalendarIcon className="h-4 w-4 mr-1" /> 
                                        {formatDate(currentDate)}
                                    </button>
                                ) : (
                                    <div className="text-sm font-semibold text-indigo-600 tabular-nums p-2">
                                        {formatDate(currentDate)}
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => changeDate(1)} 
                                className={`mobile-button p-2 rounded-full transition-colors ${
                                    activeTab === 'news' ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                                disabled={activeTab === 'news'}
                                aria-label="다음 날"
                            >
                                <ChevronRightIcon />
                            </button>
                        </div>
                        
                        {/* 탭 표시 (선택 불가) */}
                        <div className="flex gap-1 mb-2">
                            <div className={`flex-1 py-1 px-2 text-xs font-medium rounded relative ${
                                activeTab === 'expressions'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-gray-500'
                            }`}>
                                오늘의 표현
                                {activeTab === 'expressions' && isExpressionsCacheValid(currentDate) && (
                                    <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white text-xs rounded-full w-2 h-2 flex items-center justify-center">
                                        ✓
                                    </span>
                                )}
                            </div>
                            <div className={`flex-1 py-1 px-2 text-xs font-medium rounded relative ${
                                activeTab === 'news'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-gray-500'
                            }`}>
                                뉴스 학습
                                {activeTab === 'news' && isNewsCacheValid(new Date()) && (
                                    <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white text-xs rounded-full w-2 h-2 flex items-center justify-center">
                                        ✓
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 메인 헤더 */}
                <header className="text-center mb-2 mobile-header">
                    <h1 className="mobile-text-large font-bold text-gray-800">
                        Daily English
                    </h1>
                </header>

                <div className="bg-white mobile-spacing rounded-xl shadow-sm mb-2 mobile-card">
                    {/* 날짜 선택 및 탭 버튼 */}
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            onClick={() => changeDate(-1)} 
                            className={`mobile-button p-3 rounded-full transition-colors ${
                                activeTab === 'news' ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            disabled={activeTab === 'news'}
                            aria-label="이전 날"
                        >
                            <ChevronLeftIcon />
                        </button>
                        
                        <div className="flex flex-col items-center">
                            {activeTab === 'expressions' ? (
                                <>
                                    <button 
                                        onClick={() => setCalendarOpen(true)} 
                                        className="mobile-button flex items-center mobile-text-large font-semibold text-indigo-600 tabular-nums p-3 rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                                        <CalendarIcon /> {formatDate(currentDate)}
                                    </button>
                                    {!isToday && (
                                        <button 
                                            onClick={goToToday} 
                                            className="mobile-button mt-2 mobile-text bg-indigo-100 text-indigo-700 font-semibold px-4 py-2 rounded-full hover:bg-indigo-200 transition-colors"
                                        >
                                            오늘로 돌아가기
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="mobile-text-large font-semibold text-indigo-600 tabular-nums p-3">
                                    {formatDate(currentDate)}
                                </div>
                            )}
                        </div>
                        
                        <button 
                            onClick={() => changeDate(1)} 
                            className={`mobile-button p-3 rounded-full transition-colors ${
                                activeTab === 'news' ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            disabled={activeTab === 'news'}
                            aria-label="다음 날"
                        >
                            <ChevronRightIcon />
                        </button>
                    </div>
                    
                    {/* 탭 버튼 */}
                    <div className="flex gap-2 mb-4 p-1 bg-gray-50 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('expressions')}
                            className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 relative cursor-pointer ${
                                activeTab === 'expressions'
                                    ? 'bg-white text-indigo-700 shadow-sm transform scale-105'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                        >
                            오늘의 표현
                            {activeTab === 'expressions' && isExpressionsCacheValid(currentDate) && (
                                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                    ✓
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTab('news')}
                            className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 relative cursor-pointer ${
                                activeTab === 'news'
                                    ? 'bg-white text-indigo-700 shadow-sm transform scale-105'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                        >
                            뉴스 학습
                            {activeTab === 'news' && isNewsCacheValid(new Date()) && (
                                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                    ✓
                                </span>
                            )}
                        </button>
                    </div>
                    
                    {/* 캐시 상태 표시 - 모바일에서는 숨김 */}
                    <div className="hidden sm:block">
                        {activeTab === 'news' && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                        <span className="text-sm text-blue-700">
                                            {isNewsCacheValid(new Date()) 
                                                ? '오늘의 뉴스가 캐시되어 있습니다. 레벨을 변경하면 같은 기사를 해당 레벨에 맞게 재구성합니다.'
                                                : '새로운 뉴스를 가져오는 중입니다. 하루에 한 번만 업데이트되며, 이전 데이터는 자동으로 삭제됩니다.'
                                            }
                                        </span>
                                    </div>
                                    {isNewsCacheValid(new Date()) && (
                                        <button 
                                            onClick={() => {
                                                const cacheKey = getNewsCacheKey(new Date());
                                                localStorage.removeItem(cacheKey);
                                                window.location.reload();
                                            }}
                                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                        >
                                            캐시 새로고침
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'expressions' && (
                            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                        <span className="text-sm text-green-700">
                                            {isExpressionsCacheValid(currentDate) 
                                                ? '오늘의 표현이 캐시되어 있습니다. 레벨을 변경하면 같은 표현을 해당 레벨에 맞게 재구성합니다.'
                                                : '새로운 표현을 가져오는 중입니다. 하루에 한 번만 업데이트되며, 일주일 이전 데이터는 자동으로 삭제됩니다.'
                                            }
                                        </span>
                                    </div>
                                    {isExpressionsCacheValid(currentDate) && (
                                        <button 
                                            onClick={() => {
                                                const cacheKey = getExpressionsCacheKey(currentDate);
                                                localStorage.removeItem(cacheKey);
                                                window.location.reload();
                                            }}
                                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                                        >
                                            캐시 새로고침
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {levels.map(l => (
                            <button 
                                key={l} 
                                onClick={() => setLevel(l)} 
                                className={`py-2 px-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                    level === l 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-indigo-100'
                                }`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                <main className="mobile-list mt-6">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="text-center">
                                <LoaderIcon size="h-10 w-10" />
                                <p className="mt-4 text-gray-600">
                                    {activeTab === 'expressions' 
                                        ? `${levelDescriptions[level]} 레벨 표현을 만들고 있어요...`
                                        : `${levelDescriptions[level]} 레벨 뉴스를 만들고 있어요...`
                                    }
                                </p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center">
                            {error}
                        </div>
                    ) : activeTab === 'expressions' ? (
                        expressions.map((expr, index) => (
                            <ExpressionCard
                                key={index}
                                expression={expr}
                                index={index}
                                isActive={activeCardIndex === index}
                                onToggle={toggleCard}
                                audioStates={audioStates}
                                onPlayAudio={playAudio}
                                onWordClick={handleWordClick}
                                onTranslate={translateText}
                            />
                        ))
                    ) : (
                        news.map((newsItem, index) => (
                            <NewsCard
                                key={index}
                                news={newsItem}
                                index={index}
                                isActive={activeNewsIndex === index}
                                onToggle={setActiveNewsIndex}
                                audioStates={audioStates}
                                onPlayAudio={playAudio}
                                onWordClick={handleWordClick}
                                onTranslate={translateText}
                                onSummarize={summarizeText}
                            />
                        ))
                    )}
                </main>

                <footer className="mobile-footer text-center mt-8 text-gray-400 mobile-text">
                    <p>Powered by Gemini API</p>
                </footer>
            </div>

            {/* 최상단으로 올라가는 플로팅 버튼 */}
            {showScrollToTop && (
                <button
                    onClick={scrollToTop}
                    className="mobile-floating bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center hover:scale-110"
                    aria-label="최상단으로 이동"
                >
                    <ArrowUpIcon />
                </button>
            )}
        </div>
    );
}

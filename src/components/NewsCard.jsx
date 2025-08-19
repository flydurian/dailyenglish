import React, { useState, useCallback, useEffect } from 'react';
import { Volume2Icon, TranslateIcon, LoaderIcon } from './Icons';

const NewsCard = ({ news, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate, onSummarize }) => {
    const [showTitleTranslation, setShowTitleTranslation] = useState(false);
    const [showArticleTranslation, setShowArticleTranslation] = useState(false);
    const [showLearningMaterials, setShowLearningMaterials] = useState(false);
    const [titleTranslation, setTitleTranslation] = useState('');
    const [articleTranslation, setArticleTranslation] = useState('');
    const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
    const [isTranslatingArticle, setIsTranslatingArticle] = useState(false);
    const [summarizedText, setSummarizedText] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    
    // 정리된 텍스트들
    const cleanTitle = news.title.replace(/\*\*(.*?)\*\*/g, '$1');
    const textToRead = summarizedText || news.full_text.replace(/\*\*(.*?)\*\*/g, '$1');
    
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

    const handleFullTextClick = useCallback((e) => {
        e.stopPropagation();
        setShowLearningMaterials(!showLearningMaterials);
    }, [showLearningMaterials]);

    // 컴포넌트 마운트 시 요약된 텍스트 가져오기
    useEffect(() => {
        const getSummarizedText = async () => {
            if (news.full_text && !summarizedText) {
                setIsSummarizing(true);
                const summary = await onSummarize(news.full_text);
                setSummarizedText(summary);
                setIsSummarizing(false);
            }
        };
        getSummarizedText();
    }, [news.full_text, summarizedText, onSummarize]);

    const handleWordClick = useCallback((e, word, meaning, example, detailedInfo) => {
        e.stopPropagation();
        onWordClick(word, meaning, example, detailedInfo);
    }, [onWordClick]);

    return (
        <div className="mobile-card bg-white overflow-visible transition-all duration-300 hover:shadow-lg">
            <div className="mobile-spacing">
                <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                        <h3 
                            className="mobile-text-large font-bold text-gray-800 mb-2 cursor-pointer hover:text-indigo-600 active:text-indigo-800 transition-colors touch-optimized"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick();
                            }}
                        >
                            {news.title.replace(/\*\*(.*?)\*\*/g, '$1')}
                        </h3>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={handleTitleTranslateClick}
                            className={`p-2 rounded-full transition-colors icon-button ${
                                isTranslatingTitle 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-blue-500 hover:bg-blue-50'
                            }`}
                            disabled={isTranslatingTitle}
                            aria-label="제목 번역 보기"
                        >
                            {isTranslatingTitle ? (
                                <LoaderIcon size="h-6 w-6" />
                            ) : (
                                <TranslateIcon />
                            )}
                        </button>
                        <button 
                            onClick={(e) => handleAudioClick(e, cleanTitle)}
                            className={`p-2 rounded-full transition-colors icon-button ${
                                audioStates[cleanTitle] === 'loading' 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-indigo-500 hover:bg-indigo-50'
                            }`} 
                            disabled={audioStates[cleanTitle] === 'loading'}
                            aria-label="제목 음성 재생"
                        >
                            {audioStates[cleanTitle] === 'loading' ? (
                                <LoaderIcon size="h-6 w-6" />
                            ) : (
                                <Volume2Icon />
                            )}
                        </button>
                    </div>
                </div>
                
                {showTitleTranslation && (
                    <div className="mt-3 mobile-spacing bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-gray-700 font-medium mobile-text">
                            {titleTranslation || '번역을 불러오는 중...'}
                        </p>
                    </div>
                )}
            </div>
            
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                isActive ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
            }`}>
                <div className="mobile-spacing pt-2 border-t border-gray-100">
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-800 mobile-text">전체 기사</h4>
                            <div className="flex items-center space-x-3">
                                <button 
                                    onClick={handleArticleTranslateClick}
                                    className={`p-2 rounded-full transition-colors icon-button ${
                                        isTranslatingArticle 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-blue-500 hover:bg-blue-50'
                                    }`}
                                    disabled={isTranslatingArticle}
                                    aria-label="기사 번역 보기"
                                >
                                    {isTranslatingArticle ? (
                                        <LoaderIcon size="h-5 w-5" />
                                    ) : (
                                        <TranslateIcon />
                                    )}
                                </button>
                                <button 
                                    onClick={(e) => handleAudioClick(e, textToRead)}
                                    className={`p-2 rounded-full transition-colors icon-button ${
                                        audioStates[textToRead] === 'loading' 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-indigo-500 hover:bg-indigo-50'
                                    }`} 
                                    disabled={audioStates[textToRead] === 'loading'}
                                    aria-label="기사 음성 재생"
                                >
                                    {audioStates[textToRead] === 'loading' ? (
                                        <LoaderIcon size="h-5 w-5" />
                                    ) : (
                                        <Volume2Icon />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div 
                            className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors touch-optimized"
                            onClick={handleFullTextClick}
                        >
                            <p className="text-gray-700 leading-relaxed mobile-text">
                                {isSummarizing ? (
                                    <span className="text-gray-500 italic">기사를 요약하고 있습니다...</span>
                                ) : (
                                    summarizedText || news.full_text.replace(/\*\*(.*?)\*\*/g, '$1')
                                )}
                            </p>
                            <p className="mobile-text text-blue-600 mt-2 font-medium">
                                {showLearningMaterials ? '▼ 학습 자료 숨기기' : '▶ 학습 자료 보기'}
                            </p>
                            {summarizedText && (
                                <p className="text-xs text-gray-500 mt-1 italic">
                                    * 요약된 기사입니다
                                </p>
                            )}
                        </div>
                        
                        {showArticleTranslation && (
                            <div className="mt-3 mobile-spacing bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-gray-700 font-medium mobile-text">
                                    {summarizedText ? '요약된 기사 번역:' : '전체 기사 번역:'}
                                </p>
                                <p className="text-gray-700 mt-2 leading-relaxed mobile-text">
                                    {articleTranslation || '번역을 불러오는 중...'}
                                </p>
                            </div>
                        )}
                        
                        {showLearningMaterials && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-visible">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div>
                                        <h4 className="font-semibold text-indigo-600 mb-2 text-sm">주요 단어</h4>
                                        <div className="grid grid-cols-2 gap-1">
                                            {news.key_words?.slice(0, 6).map((word, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={(e) => handleWordClick(e, word.word, word.meaning, word.example, {
                                                        type: 'vocabulary',
                                                        context: '뉴스 기사에서 사용된 단어',
                                                        frequency: 'high',
                                                        collocations: ['뉴스에서 자주 사용되는 표현']
                                                    })}
                                                    className="text-left hover:bg-indigo-50 p-1.5 rounded transition-colors text-xs touch-optimized"
                                                >
                                                    <div className="font-semibold text-gray-800 truncate">
                                                        {word.word}
                                                    </div>
                                                    <div className="text-gray-600 truncate text-xs">
                                                        {word.meaning}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-semibold text-green-600 mb-2 text-sm">주요 표현</h4>
                                        <div className="space-y-1">
                                            {news.key_expressions?.slice(0, 4).map((expr, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={(e) => handleWordClick(e, expr.expression, expr.meaning, expr.example, {
                                                        type: 'expression',
                                                        context: '뉴스에서 사용된 표현',
                                                        formality: 'formal',
                                                        usage: '뉴스 및 공식 문서에서 자주 사용'
                                                    })}
                                                    className="text-left hover:bg-green-50 p-1.5 rounded w-full transition-colors text-xs touch-optimized"
                                                >
                                                    <div className="font-semibold text-gray-800 truncate">
                                                        {expr.expression}
                                                    </div>
                                                    <div className="text-gray-600 truncate text-xs">
                                                        {expr.meaning}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="sm:col-span-2 lg:col-span-1">
                                        <h4 className="font-semibold text-purple-600 mb-2 text-sm">구동사</h4>
                                        <div className="space-y-1">
                                            {news.phrasal_verbs?.slice(0, 4).map((verb, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={(e) => handleWordClick(e, verb.phrasal_verb, verb.meaning, verb.example, {
                                                        type: 'phrasal_verb',
                                                        context: '뉴스에서 사용된 구동사',
                                                        formality: 'neutral to formal',
                                                        usage: '뉴스 및 비즈니스 상황에서 사용'
                                                    })}
                                                    className="text-left hover:bg-purple-50 p-1.5 rounded w-full transition-colors text-xs touch-optimized"
                                                >
                                                    <div className="font-semibold text-gray-800 truncate">
                                                        {verb.phrasal_verb}
                                                    </div>
                                                    <div className="text-gray-600 truncate text-xs">
                                                        {verb.meaning}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsCard;

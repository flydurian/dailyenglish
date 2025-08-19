import React, { useState, useCallback } from 'react';
import { Volume2Icon, TranslateIcon, LoaderIcon } from './Icons';

const ExpressionCard = ({ expression, index, isActive, onToggle, audioStates, onPlayAudio, onWordClick, onTranslate }) => {
    const [showTranslation, setShowTranslation] = useState(false);
    const [translation, setTranslation] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    
    const handleCardClick = useCallback(() => {
        onToggle(index);
    }, [onToggle, index]);

    const handleAudioClick = useCallback((e) => {
        e.stopPropagation();
        onPlayAudio(expression.sentence);
    }, [onPlayAudio, expression.sentence]);

    const handleTranslateClick = useCallback(async (e) => {
        e.stopPropagation();
        if (!showTranslation && !translation) {
            setIsTranslating(true);
            // 문장에서 마크다운 형식 제거 후 번역
            const cleanSentence = expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1');
            const result = await onTranslate(cleanSentence);
            setTranslation(result);
            setIsTranslating(false);
        }
        setShowTranslation(!showTranslation);
    }, [showTranslation, translation, onTranslate, expression.sentence]);

    const handleWordClick = useCallback((e, word, meaning, example, detailedInfo) => {
        e.stopPropagation();
        onWordClick(word, meaning, example, detailedInfo);
    }, [onWordClick]);

    return (
        <div className="mobile-card bg-white overflow-visible transition-all duration-300 hover:shadow-lg">
            <div className="mobile-spacing cursor-pointer" onClick={handleCardClick}>
                <div className="flex items-center justify-between">
                    <p className="mobile-text-large text-gray-800 font-medium flex-1 pr-4">
                        {expression.sentence.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={handleTranslateClick}
                            className={`p-2 rounded-full transition-colors icon-button ${
                                isTranslating 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-blue-500 hover:bg-blue-50'
                            }`}
                            disabled={isTranslating}
                            aria-label="번역 보기"
                        >
                            {isTranslating ? (
                                <LoaderIcon size="h-6 w-6" />
                            ) : (
                                <TranslateIcon />
                            )}
                        </button>
                        <button 
                            onClick={handleAudioClick}
                            className={`p-2 rounded-full transition-colors icon-button ${
                                audioStates[expression.sentence] === 'loading' 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-indigo-500 hover:bg-indigo-50'
                            }`} 
                            disabled={audioStates[expression.sentence] === 'loading'}
                            aria-label="음성 재생"
                        >
                            {audioStates[expression.sentence] === 'loading' ? (
                                <LoaderIcon size="h-6 w-6" />
                            ) : (
                                <Volume2Icon />
                            )}
                        </button>
                    </div>
                </div>
                
                {showTranslation && (
                    <div className="mt-3 mobile-spacing bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-gray-700 font-medium mobile-text">
                            {translation || '번역을 불러오는 중...'}
                        </p>
                    </div>
                )}
            </div>
            
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                isActive ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
                <div className="mobile-spacing pt-2 border-t border-gray-100">
                    <div className="mb-4">
                        <button 
                            onClick={(e) => handleWordClick(e, expression.phrasal_verb, expression.meaning, expression.sentence, {
                                type: 'phrasal_verb',
                                usage: '일상 대화에서 자주 사용되는 구동사',
                                examples: [
                                    'I need to look up that word in the dictionary.',
                                    'She always looks after her younger brother.',
                                    'Let\'s look into this problem together.'
                                ],
                                synonyms: ['investigate', 'examine', 'research'],
                                formality: 'informal to formal'
                            })}
                            className="text-left hover:bg-indigo-50 p-3 rounded transition-colors w-full touch-optimized"
                        >
                            <h3 className="mobile-text-large font-bold text-indigo-600 bg-indigo-50 inline-block px-3 py-2 rounded-md">
                                {expression.phrasal_verb}
                            </h3>
                            <p className="text-gray-700 mt-2 mobile-text">
                                {expression.meaning}
                            </p>
                        </button>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-gray-600 mb-2 text-sm">주요 단어</h4>
                        <div className="grid grid-cols-2 gap-1">
                            {expression.other_words?.slice(0, 4).map((word, i) => (
                                <button 
                                    key={i}
                                    onClick={(e) => handleWordClick(e, word.word, word.meaning, word.example || expression.sentence, {
                                        type: 'vocabulary',
                                        part_of_speech: 'noun/verb/adjective',
                                        frequency: 'high/medium/low',
                                        collocations: ['common phrases with this word'],
                                        etymology: 'word origin information'
                                    })}
                                    className="text-left hover:bg-gray-50 p-1.5 rounded transition-colors text-xs touch-optimized"
                                >
                                    <div className="font-semibold text-gray-800 truncate">
                                        {word.word}
                                    </div>
                                    <div className="text-gray-600 truncate text-xs">
                                        {word.meaning}
                                    </div>
                                </button>
                            )) || <div className="text-gray-500 text-xs col-span-2">주요 단어 정보가 없습니다.</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpressionCard;

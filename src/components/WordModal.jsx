import React, { useState, useEffect } from 'react';
import { Volume2Icon, LoaderIcon, CloseIcon } from './Icons';

const WordModal = ({ isOpen, word, meaning, example, detailedInfo, onClose, onPlayAudio, audioStates, onGenerateExamples }) => {
    const [examples, setExamples] = useState([]);
    const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);

    // 모달이 열리고 단어가 변경될 때 예문 생성
    useEffect(() => {
        if (isOpen && word && meaning) {
            const generateWordExamples = async () => {
                setIsGeneratingExamples(true);
                try {
                    const generatedExamples = await onGenerateExamples(word, meaning);
                    setExamples(generatedExamples);
                } catch (error) {
                    console.error('예문 생성 실패:', error);
                    setExamples([]);
                } finally {
                    setIsGeneratingExamples(false);
                }
            };
            generateWordExamples();
        } else {
            setExamples([]);
        }
    }, [isOpen, word, meaning, onGenerateExamples]);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="mobile-modal bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl shadow-2xl mobile-spacing w-full max-w-lg animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">단어 상세 정보</h3>
                    <button
                        onClick={onClose}
                        className="mobile-button p-3 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="닫기"
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between">
                            <h4 className="mobile-text-large font-bold text-indigo-600 mb-2">{word}</h4>
                            <button
                                onClick={() => onPlayAudio(word)}
                                className={`p-2 rounded-full transition-colors icon-button ${audioStates[word] === 'loading'
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-indigo-500 hover:bg-indigo-50'
                                    }`}
                                disabled={audioStates[word] === 'loading'}
                                aria-label="단어 음성 재생"
                            >
                                {audioStates[word] === 'loading' ? (
                                    <LoaderIcon size="h-5 w-5" />
                                ) : (
                                    <Volume2Icon />
                                )}
                            </button>
                        </div>
                        <p className="text-gray-700 mobile-text">{meaning}</p>
                    </div>

                    {detailedInfo && (
                        <div className="bg-gray-50 mobile-spacing rounded-lg">
                            <h5 className="font-semibold text-gray-700 mb-2 mobile-text">상세 정보</h5>
                            <div className="space-y-2 mobile-text">
                                {detailedInfo.type && (
                                    <div>
                                        <span className="font-medium text-gray-600">유형:</span>
                                        <span className="ml-2 text-gray-800">
                                            {detailedInfo.type === 'phrasal_verb' ? '구동사' :
                                                detailedInfo.type === 'expression' ? '표현' : '단어'}
                                        </span>
                                    </div>
                                )}
                                {detailedInfo.usage && (
                                    <div>
                                        <span className="font-medium text-gray-600">사용법:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.usage}</span>
                                    </div>
                                )}
                                {detailedInfo.context && (
                                    <div>
                                        <span className="font-medium text-gray-600">맥락:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.context}</span>
                                    </div>
                                )}
                                {detailedInfo.formality && (
                                    <div>
                                        <span className="font-medium text-gray-600">격식:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.formality}</span>
                                    </div>
                                )}
                                {detailedInfo.frequency && (
                                    <div>
                                        <span className="font-medium text-gray-600">빈도:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.frequency}</span>
                                    </div>
                                )}

                                {detailedInfo.synonyms && (
                                    <div>
                                        <span className="font-medium text-gray-600">동의어:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.synonyms.join(', ')}</span>
                                    </div>
                                )}

                                {detailedInfo.grammar && (
                                    <div>
                                        <span className="font-medium text-gray-600">문법:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.grammar}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 동적 생성 예문 */}
                    <div>
                        <h5 className="font-semibold text-gray-600 mb-2 mobile-text">예문</h5>
                        {isGeneratingExamples ? (
                            <div className="flex items-center justify-center p-4">
                                <LoaderIcon size="h-5 w-5" />
                                <span className="ml-2 text-gray-500 mobile-text">예문 생성 중...</span>
                            </div>
                        ) : examples.length > 0 ? (
                            <div className="space-y-2">
                                {examples.map((example, index) => (
                                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                                        <p className="text-gray-700 italic mobile-text">"{example}"</p>
                                        <button
                                            onClick={() => onPlayAudio(example)}
                                            className={`mt-2 text-sm px-3 py-1 rounded transition-colors ${audioStates[example] === 'loading'
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                }`}
                                            disabled={audioStates[example] === 'loading'}
                                        >
                                            {audioStates[example] === 'loading' ? (
                                                <div className="flex items-center">
                                                    <LoaderIcon size="h-3 w-3" />
                                                    <span className="ml-1">생성 중...</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center">
                                                    <Volume2Icon className="h-3 w-3" />
                                                    <span className="ml-1">듣기</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic mobile-text">예문을 생성할 수 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WordModal;

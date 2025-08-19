import React from 'react';
import { Volume2Icon, LoaderIcon, CloseIcon } from './Icons';

const WordModal = ({ isOpen, word, meaning, example, detailedInfo, onClose, onPlayAudio, audioStates }) => {
    if (!isOpen) return null;

    return (
        <div className="mobile-modal bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                                className={`p-2 rounded-full transition-colors icon-button ${
                                    audioStates[word] === 'loading' 
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
                                                                        {detailedInfo.examples && (
                                            <div>
                                                <span className="font-medium text-gray-600">추가 예문:</span>
                                                <ul className="mt-1 ml-4 text-gray-700">
                                                    {detailedInfo.examples.map((example, i) => (
                                                        <li key={i} className="mobile-text italic">• {example}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                {detailedInfo.synonyms && (
                                    <div>
                                        <span className="font-medium text-gray-600">동의어:</span>
                                        <span className="ml-2 text-gray-800">{detailedInfo.synonyms.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <h5 className="font-semibold text-gray-600 mb-2 mobile-text">예문</h5>
                        <p className="text-gray-700 italic mobile-text">"{example}"</p>
                    </div>
                    
                    <button 
                        onClick={() => onPlayAudio(example)}
                        className={`w-full p-3 rounded-lg transition-colors ${
                            audioStates[example] === 'loading' 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                        disabled={audioStates[example] === 'loading'}
                    >
                        {audioStates[example] === 'loading' ? (
                            <div className="flex items-center justify-center">
                                <LoaderIcon size="h-5 w-5" />
                                <span className="ml-2 mobile-text">음성 생성 중...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center">
                                <Volume2Icon />
                                <span className="ml-2 mobile-text">예문 듣기</span>
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordModal;

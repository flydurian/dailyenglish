import React, { createContext, useContext, useState, useCallback } from 'react';

const FontSizeContext = createContext();

export const useFontSize = () => {
    const context = useContext(FontSizeContext);
    if (!context) {
        throw new Error('useFontSize must be used within a FontSizeProvider');
    }
    return context;
};

export const FontSizeProvider = ({ children }) => {
    const [fontSize, setFontSize] = useState(1); // 기본값 1 (100%)

    const increaseFontSize = useCallback(() => {
        setFontSize(prev => Math.min(prev + 0.1, 1.5)); // 최대 150%
    }, []);

    const decreaseFontSize = useCallback(() => {
        setFontSize(prev => Math.max(prev - 0.1, 0.7)); // 최소 70%
    }, []);

    const resetFontSize = useCallback(() => {
        setFontSize(1); // 기본값으로 리셋
    }, []);

    const value = {
        fontSize,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize
    };

    return (
        <FontSizeContext.Provider value={value}>
            {children}
        </FontSizeContext.Provider>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { useFontSize } from '../contexts/FontSizeContext';

const FontControlContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  border-radius: 12px;
  padding: 8px 12px;
  border: 1px solid #444;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 768px) {
    padding: 6px 10px;
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    padding: 4px 8px;
    gap: 4px;
  }
`;

const FontIconButton = styled.button`
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  color: #000;
  border: none;
  border-radius: 8px;
  width: 40px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
  
  &:hover {
    background: linear-gradient(135deg, #00b8e6 0%, rgba(0, 184, 230, 0.9) 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
  }
  
  @media (max-width: 768px) {
    width: 36px;
    height: 28px;
    font-size: 12px;
  }
  
  @media (max-width: 480px) {
    width: 32px;
    height: 24px;
    font-size: 10px;
  }
`;

const FontButton = styled.button`
  background: linear-gradient(135deg, #00d4ff 0%, rgba(0, 212, 255, 0.8) 100%);
  color: #000;
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
  
  &:hover {
    background: linear-gradient(135deg, #00b8e6 0%, rgba(0, 184, 230, 0.9) 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 212, 255, 0.4);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
  }
  
  &:disabled {
    background: linear-gradient(135deg, #666 0%, #555 100%);
    color: #999;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
`;

const FontSizeDisplay = styled.span`
  color: #cccccc;
  font-size: 12px;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 11px;
    min-width: 35px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    min-width: 30px;
  }
`;

const FontSizeControl = () => {
    const { fontSize, increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef(null);

    const isMaxSize = fontSize >= 1.5;
    const isMinSize = fontSize <= 0.7;

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isExpanded]);

    const handleIconClick = () => {
        setIsExpanded(!isExpanded);
    };

    const handleFontChange = (action) => {
        action();
        // 폰트 크기 변경 후 메뉴를 닫지 않고 계속 열어둠
    };

    return (
        <FontControlContainer ref={containerRef}>
            {!isExpanded ? (
                <FontIconButton 
                    onClick={handleIconClick}
                    aria-label="폰트 크기 조절"
                >
                    Aa
                </FontIconButton>
            ) : (
                <>
                    <FontButton 
                        onClick={() => handleFontChange(decreaseFontSize)} 
                        disabled={isMinSize}
                        aria-label="폰트 크기 줄이기"
                    >
                        −
                    </FontButton>
                    <FontSizeDisplay>
                        {Math.round(fontSize * 100)}%
                    </FontSizeDisplay>
                    <FontButton 
                        onClick={() => handleFontChange(increaseFontSize)} 
                        disabled={isMaxSize}
                        aria-label="폰트 크기 늘리기"
                    >
                        +
                    </FontButton>
                    <FontButton 
                        onClick={() => handleFontChange(resetFontSize)}
                        aria-label="폰트 크기 초기화"
                        style={{ 
                            fontSize: '10px',
                            background: 'linear-gradient(135deg, #666 0%, #555 100%)',
                            color: '#ccc'
                        }}
                    >
                        ↺
                    </FontButton>
                </>
            )}
        </FontControlContainer>
    );
};

export default FontSizeControl;

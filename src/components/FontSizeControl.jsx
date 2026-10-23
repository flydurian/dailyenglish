import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { useFontSize } from '../contexts/FontSizeContext';

const FontControlContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const FontIconButton = styled.button`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ink);
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 15px;
  font-style: italic;
  line-height: 1;
  cursor: pointer;
  transition: 160ms ease;
  touch-action: manipulation;

  &:hover,
  &[aria-expanded="true"] {
    background: var(--ink);
    color: var(--paper);
  }

  &:active {
    transform: scale(0.94);
  }
`;

const FontPanel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card-paper);
  box-shadow: 0 14px 30px rgba(23, 20, 15, 0.16);
  white-space: nowrap;
  animation: panel-in 160ms ease-out;

  @keyframes panel-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const FontButton = styled.button`
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  &:hover {
    border-color: var(--ink);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    color: var(--line);
    border-color: var(--line);
    cursor: not-allowed;
  }

  &[data-reset="true"] {
    color: var(--muted);
    font-size: 12px;
  }
`;

const FontSizeDisplay = styled.span`
  min-width: 34px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
  text-align: center;
`;

const FontSizeControl = () => {
    const { fontSize, increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef(null);

    const isMaxSize = fontSize >= 1.5;
    const isMinSize = fontSize <= 0.7;

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

    return (
        <FontControlContainer ref={containerRef}>
            <FontIconButton
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label="폰트 크기 조절"
                aria-expanded={isExpanded}
            >
                Aa
            </FontIconButton>

            {isExpanded && (
                <FontPanel role="group" aria-label="폰트 크기">
                    <FontButton
                        onClick={decreaseFontSize}
                        disabled={isMinSize}
                        aria-label="폰트 크기 줄이기"
                    >
                        −
                    </FontButton>
                    <FontSizeDisplay>
                        {Math.round(fontSize * 100)}%
                    </FontSizeDisplay>
                    <FontButton
                        onClick={increaseFontSize}
                        disabled={isMaxSize}
                        aria-label="폰트 크기 늘리기"
                    >
                        +
                    </FontButton>
                    <FontButton
                        onClick={resetFontSize}
                        aria-label="폰트 크기 초기화"
                        data-reset="true"
                    >
                        ↺
                    </FontButton>
                </FontPanel>
            )}
        </FontControlContainer>
    );
};

export default FontSizeControl;

import React from 'react';
import styled from '@emotion/styled';

// 스피커 옆에 붙는 미국/영국 발음 버튼. 누르면 그 억양으로 TTS를 다시 생성해 재생합니다.
const Group = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
`;

const FlagButton = styled.button<{ $size: number }>`
  display: grid;
  place-items: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--card-paper);
  color: var(--ink);
  font-size: ${({ $size }) => Math.round($size * 0.5)}px;
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
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

interface AccentFlagsProps {
  text: string;
  onPlayAudio?: (text: string, accent: 'us' | 'gb') => void;
  audioState?: string;
  size?: number;
}

const AccentFlags = ({ text, onPlayAudio, audioState, size = 26 }: AccentFlagsProps) => {
  if (typeof onPlayAudio !== 'function' || !text) return null;

  const play = (event: React.MouseEvent<HTMLButtonElement>, accent: 'us' | 'gb') => {
    event.stopPropagation();
    onPlayAudio(text, accent);
  };

  const disabled = audioState === 'loading';

  return (
    <Group role="group" aria-label="발음 억양 선택">
      <FlagButton
        type="button"
        $size={size}
        onClick={(event) => play(event, 'us')}
        disabled={disabled}
        aria-label="미국 발음으로 듣기"
        title="미국 발음"
      >
        🇺🇸
      </FlagButton>
      <FlagButton
        type="button"
        $size={size}
        onClick={(event) => play(event, 'gb')}
        disabled={disabled}
        aria-label="영국 발음으로 듣기"
        title="영국 왕실 발음 (RP)"
      >
        🇬🇧
      </FlagButton>
    </Group>
  );
};

export default React.memo(AccentFlags);

import React from 'react';
import styled from '@emotion/styled';
import { MoonOffIcon, SunIcon } from './Icons';
import { useWakeLock } from '../hooks/useWakeLock';

const Container = styled.div`
  position: relative;
  flex: 0 0 auto;
`;

const AwakeButton = styled.button<{ $active: boolean }>`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ $active }) => ($active ? 'var(--coral)' : 'var(--ink)')};
  border-radius: 50%;
  background: ${({ $active }) => ($active ? 'var(--coral)' : 'transparent')};
  color: ${({ $active }) => ($active ? '#fff' : 'var(--ink)')};
  cursor: pointer;
  transition: 160ms ease;
  touch-action: manipulation;

  svg { width: 19px !important; height: 19px !important; }

  &:hover,
  &[aria-pressed="true"]:hover {
    filter: brightness(0.96);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    border-color: var(--line);
    color: var(--line);
    cursor: not-allowed;
  }
`;

const Notice = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  width: 210px;
  padding: 9px 11px;
  border: 1px solid var(--coral);
  border-radius: 10px;
  background: var(--card-paper);
  box-shadow: 0 14px 30px rgba(23, 20, 15, 0.16);
  color: var(--coral);
  font-size: 11px;
  line-height: 1.5;
  word-break: keep-all;
  animation: notice-in 160ms ease-out;

  @keyframes notice-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const StayAwakeButton = () => {
  const { isSupported, isActive, error, toggle } = useWakeLock();

  const label = isActive ? '화면 잠금 방지 끄기' : '화면 잠금 방지 켜기';
  const title = !isSupported
    ? '이 브라우저에서는 화면 잠금 방지를 지원하지 않아요'
    : isActive
      ? '화면이 켜져 있어요 · 눌러서 끄기'
      : '화면이 저절로 잠들지 않게 해요';

  return (
    <Container>
      <AwakeButton
        type="button"
        $active={isActive}
        onClick={() => { void toggle(); }}
        disabled={!isSupported}
        aria-label={label}
        aria-pressed={isActive}
        title={title}
      >
        {isActive ? <SunIcon /> : <MoonOffIcon />}
      </AwakeButton>
      {error && <Notice role="alert">{error}</Notice>}
    </Container>
  );
};

export default React.memo(StayAwakeButton);

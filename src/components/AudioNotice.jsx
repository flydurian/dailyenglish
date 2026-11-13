import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import { CloseIcon } from './Icons';

// 음성(TTS)이 실패했을 때 화면 아래에 잠깐 띄우는 알림.
// 강의 모달(z-index 2000) 위에서도 보이도록 body에 포털로 띄웁니다.
const Toast = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom));
  z-index: 3000;
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 11px 10px 11px 16px;
  border-radius: 14px;
  background: var(--ink);
  color: var(--card-paper);
  box-shadow: 0 12px 32px rgba(23, 20, 15, 0.28);
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: -0.01em;
  word-break: keep-all;
  transform: translateX(-50%);
  animation: audio-notice-in 200ms ease-out;

  @keyframes audio-notice-in {
    from { opacity: 0; transform: translate(-50%, 8px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DismissButton = styled.button`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;

  svg { width: 13px; height: 13px; }

  &:hover { opacity: 1; }
`;

const AudioNotice = ({ notice, onDismiss }) => {
  if (!notice) return null;

  return ReactDOM.createPortal(
    <Toast key={notice.id} role="status" aria-live="polite" data-audio-notice="">
      <span>{notice.message}</span>
      <DismissButton type="button" onClick={onDismiss} aria-label="알림 닫기">
        <CloseIcon />
      </DismissButton>
    </Toast>,
    document.body
  );
};

export default AudioNotice;

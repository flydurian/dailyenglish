import React from 'react';
import styled from '@emotion/styled';
import { LoaderIcon } from './Icons';

// 번역을 기다리는 동안 해당 문장 자리에서 보여주는 진행 표시.
const Status = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: inherit;
  line-height: 1.5;
  word-break: keep-all;

  svg {
    width: 12px !important;
    height: 12px !important;
  }
`;

const TranslationStatus = ({ label = '번역하고 있어요...' }) => (
  <Status role="status" aria-live="polite">
    <LoaderIcon />
    <span>{label}</span>
  </Status>
);

export default React.memo(TranslationStatus);

// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TranslationStatus from '../src/components/TranslationStatus';

describe('TranslationStatus', () => {
  it('기본 라벨과 함께 접근 가능한 status 영역을 렌더링한다', () => {
    render(React.createElement(TranslationStatus));
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('번역하고 있어요...');
  });

  it('전달한 라벨을 표시한다', () => {
    render(React.createElement(TranslationStatus, { label: '요약하고 있어요...' }));
    expect(screen.getByRole('status')).toHaveTextContent('요약하고 있어요...');
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccentFlags from '../src/components/AccentFlags.jsx';

describe('AccentFlags', () => {
  it('us/gb 버튼을 렌더링하고 클릭 시 onPlayAudio(text, accent)를 호출한다', () => {
    const onPlayAudio = vi.fn();
    render(React.createElement(AccentFlags, { text: 'take off', onPlayAudio }));

    const usButton = screen.getByRole('button', { name: '미국 발음으로 듣기' });
    const gbButton = screen.getByRole('button', { name: '영국 발음으로 듣기' });
    expect(usButton).toBeInTheDocument();
    expect(gbButton).toBeInTheDocument();

    fireEvent.click(usButton);
    expect(onPlayAudio).toHaveBeenCalledWith('take off', 'us');
    fireEvent.click(gbButton);
    expect(onPlayAudio).toHaveBeenCalledWith('take off', 'gb');
    expect(onPlayAudio).toHaveBeenCalledTimes(2);
  });

  it('text가 없거나 onPlayAudio가 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(React.createElement(AccentFlags, { text: '', onPlayAudio: vi.fn() }));
    expect(container).toBeEmptyDOMElement();
  });

  it('audioState가 loading이면 버튼이 비활성화된다', () => {
    render(React.createElement(AccentFlags, {
      text: 'take off', onPlayAudio: vi.fn(), audioState: 'loading',
    }));
    expect(screen.getByRole('button', { name: '미국 발음으로 듣기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '영국 발음으로 듣기' })).toBeDisabled();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lock = {
  isSupported: true,
  isActive: false,
  error: null,
  toggle: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
};

vi.mock('../src/hooks/useWakeLock', () => ({
  useWakeLock: () => lock,
}));

import StayAwakeButton from '../src/components/StayAwakeButton';

describe('StayAwakeButton', () => {
  beforeEach(() => {
    lock.isSupported = true;
    lock.isActive = false;
    lock.error = null;
    lock.toggle.mockClear();
  });

  it('꺼짐 방지 켜기 버튼을 누르면 toggle을 호출한다', () => {
    render(React.createElement(StayAwakeButton));
    const button = screen.getByRole('button', { name: '화면 잠금 방지 켜기' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(lock.toggle).toHaveBeenCalledTimes(1);
  });

  it('활성 상태에서는 끄기 라벨과 눌림 상태를 보여준다', () => {
    lock.isActive = true;
    render(React.createElement(StayAwakeButton));
    const button = screen.getByRole('button', { name: '화면 잠금 방지 끄기' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('지원하지 않는 브라우저에서는 버튼이 비활성화된다', () => {
    lock.isSupported = false;
    render(React.createElement(StayAwakeButton));
    expect(screen.getByRole('button', { name: '화면 잠금 방지 켜기' })).toBeDisabled();
  });

  it('오류가 있으면 메시지를 보여준다', () => {
    lock.error = '화면 잠금 방지를 켜지 못했어요. 다시 눌러 주세요.';
    render(React.createElement(StayAwakeButton));
    expect(screen.getByRole('alert')).toHaveTextContent('화면 잠금 방지를 켜지 못했어요');
  });
});

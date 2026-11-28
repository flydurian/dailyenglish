// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const recognition = {
  status: 'idle',
  transcript: '',
  interim: '',
  error: null,
  start: vi.fn(() => true),
  stop: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../src/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => recognition,
  isSpeechRecognitionSupported: () => true,
}));

import ReadAlongPractice from '../src/components/ReadAlongPractice';

describe('ReadAlongPractice', () => {
  beforeEach(() => {
    recognition.status = 'idle';
    recognition.transcript = '';
    recognition.interim = '';
    recognition.error = null;
    recognition.start.mockClear();
    recognition.stop.mockClear();
    recognition.reset.mockClear();
  });

  it('autoStart이면 시작했을 때 start()를 호출하고 듣는 상태를 보여준다', () => {
    recognition.status = 'listening';
    render(React.createElement(ReadAlongPractice, { text: 'I **get up** early.', autoStart: true }));

    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/듣고 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '그만두기' })).toBeInTheDocument();
  });

  it('인식 결과를 단어별로 초록/주황/회색으로 채점해 보여준다', () => {
    recognition.transcript = 'I get up early every morning exercise';
    render(React.createElement(ReadAlongPractice, { text: 'I **get up** early every morning to exercise.' }));

    // 점수와 인식된 단어 수가 표시됩니다.
    expect(screen.getByText('88%')).toBeInTheDocument(); // 7/8 단어 인식 ('to' 누락)
    expect(screen.getByText(/들린 내용/)).toBeInTheDocument();
    expect(screen.getByText(/놓침 1/)).toBeInTheDocument();

    // 단어가 각각 색이 있는 칩으로 렌더링됩니다.
    const wordChips = screen.getByText('get').closest('span');
    expect(wordChips).toHaveStyle({ color: '#2f7d58' }); // correct
    const missed = screen.getByText('to').closest('span');
    expect(missed).toHaveStyle({ color: '#9a9286' }); // missed
  });

  it('마이크 권한 오류 메시지를 보여주고 재시도 버튼을 제공한다', () => {
    recognition.status = 'error';
    recognition.error = '마이크 권한이 필요해요. 브라우저에서 마이크 사용을 허용해 주세요.';
    render(React.createElement(ReadAlongPractice, { text: 'Take off' }));

    expect(screen.getByText(/마이크 권한/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }));
    expect(recognition.reset).toHaveBeenCalled();
    expect(recognition.start).toHaveBeenCalled();
  });

  it('닫기를 누르면 reset 후 onClose를 호출한다', () => {
    const onClose = vi.fn();
    render(React.createElement(ReadAlongPractice, { text: 'Take off', onClose }));

    fireEvent.click(screen.getByRole('button', { name: '따라 읽기 닫기' }));
    expect(recognition.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

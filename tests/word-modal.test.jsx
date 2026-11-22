import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WordModal from '../src/components/WordModal.jsx';
import { ProgressProvider } from '../src/contexts/ProgressContext';
import { WordbookProvider } from '../src/contexts/WordbookContext';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const renderModal = (props) => render(
  <ProgressProvider>
    <WordbookProvider>
      <WordModal {...props} />
    </WordbookProvider>
  </ProgressProvider>,
);

describe('WordModal 예문 생성 경쟁', () => {
  it('이전 단어의 늦은 응답이 새 단어 화면을 덮어쓰지 않는다', async () => {
    const first = deferred();
    const second = deferred();
    const onGenerateExamples = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const props = {
      isOpen: true,
      word: 'give up',
      meaning: '포기하다',
      example: '',
      onClose: vi.fn(),
      onGenerateExamples,
    };
    const { rerender } = renderModal(props);

    rerender(
      <ProgressProvider>
        <WordbookProvider>
          <WordModal {...props} word="look into" meaning="조사하다" />
        </WordbookProvider>
      </ProgressProvider>,
    );

    await act(async () => {
      second.resolve(['새 단어 예문입니다.']);
      first.resolve(['이전 단어 예문입니다.']);
      await Promise.all([first.promise, second.promise]);
    });

    expect(screen.getByText(/새 단어 예문입니다/)).toBeInTheDocument();
    expect(screen.queryByText(/이전 단어 예문입니다/)).not.toBeInTheDocument();
  });

  it('Escape 키로 모달을 닫는다', () => {
    const onClose = vi.fn();
    renderModal({
      isOpen: true,
      word: 'give up',
      meaning: '포기하다',
      onClose,
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

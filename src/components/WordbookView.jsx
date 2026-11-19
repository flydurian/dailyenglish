import React, { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Volume2Icon, LoaderIcon, CloseIcon } from './Icons';
import AccentFlags from './AccentFlags';
import { useWordbook } from '../contexts/WordbookContext';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'phrasal', label: '구동사' },
  { key: 'word', label: '단어' },
];

const TYPE_LABELS = {
  phrasal: '구동사',
  word: '단어',
};

const Wrapper = styled.section`
  width: 100%;
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 12px;
`;

const FilterChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 2px 0 4px;
`;

const FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  height: 34px;
  padding: 0 13px;
  border: 1px solid ${props => props.isActive ? 'var(--ink)' : 'var(--line)'};
  border-radius: 999px;
  background: ${props => props.isActive ? 'var(--ink)' : 'transparent'};
  color: ${props => props.isActive ? 'var(--paper)' : 'var(--muted)'};
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  &:active {
    transform: scale(0.95);
  }
`;

const ChipCount = styled.span`
  font-size: 9px;
  letter-spacing: 0.02em;
  opacity: ${props => props.isActive ? 0.72 : 1};
`;

const TotalCount = styled.span`
  padding-bottom: 2px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  white-space: nowrap;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 11px;
`;

const ItemCard = styled.article`
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--card-paper);
  animation: item-rise 380ms cubic-bezier(0.2, 0.7, 0.2, 1) both;

  @keyframes item-rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 480px) {
    padding: 15px;
    border-radius: 16px;
  }
`;

const ItemTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const ItemHeading = styled.div`
  min-width: 0;
`;

const Term = styled.h3`
  margin: 0;
  color: var(--ink);
  font-size: 18px;
  font-weight: 720;
  line-height: 1.35;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
`;

const TypeLabel = styled.span`
  display: inline-flex;
  margin-top: 5px;
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;

const ItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
`;

const IconButton = styled.button`
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: 150ms ease;
  touch-action: manipulation;

  svg {
    width: 14px !important;
    height: 14px !important;
  }

  &:hover,
  &.on {
    border-color: var(--coral);
    color: var(--coral);
  }

  &:active {
    transform: scale(0.94);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 360px) {
    width: 32px;
    height: 32px;
  }
`;

const Meaning = styled.p`
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
`;

const Example = styled.p`
  margin: 9px 0 0;
  padding-top: 9px;
  border-top: 1px dashed var(--line);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 13.5px;
  font-style: italic;
  line-height: 1.6;
  overflow-wrap: anywhere;
`;

const EmptyState = styled.div`
  padding: 30px 20px;
  border: 1px dashed var(--line);
  border-radius: 18px;
  background: var(--card-paper);
  text-align: center;
`;

const EmptyText = styled.p`
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 14px;
  font-style: italic;
  line-height: 1.65;
  text-wrap: pretty;
`;

const EmptyHint = styled.p`
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
`;

const WordbookView = ({ onPlayAudio, audioStates = {} }) => {
  const { items, removeItem } = useWordbook();
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => ({
    all: items.length,
    phrasal: items.filter((item) => item.type === 'phrasal').length,
    word: items.filter((item) => item.type === 'word').length,
  }), [items]);

  const filteredItems = useMemo(() => (
    filter === 'all' ? items : items.filter((item) => item.type === filter)
  ), [items, filter]);

  const canPlay = typeof onPlayAudio === 'function';

  const handlePlay = (term, accent) => {
    if (canPlay) onPlayAudio(term, accent);
  };

  return (
    <Wrapper>
      <Toolbar>
        <FilterChips role="group" aria-label="단어장 유형 필터">
          {FILTERS.map(({ key, label }) => (
            <FilterChip
              key={key}
              isActive={filter === key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              {counts[key] > 0 && (
                <ChipCount isActive={filter === key} aria-hidden="true">{counts[key]}</ChipCount>
              )}
            </FilterChip>
          ))}
        </FilterChips>
        <TotalCount>{filteredItems.length}개</TotalCount>
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState>
          <EmptyText>
            아직 저장한 표현이 없어요. 오늘의 표현이나 단어 카드에서 &apos;저장&apos;을 눌러 보세요.
          </EmptyText>
        </EmptyState>
      ) : filteredItems.length === 0 ? (
        <EmptyState>
          <EmptyText>이 유형에 저장한 표현이 없어요.</EmptyText>
          <EmptyHint>다른 필터를 선택해 보세요.</EmptyHint>
        </EmptyState>
      ) : (
        <List>
          {filteredItems.map((item) => {
            const audioState = audioStates[item.term];
            const isLoading = audioState === 'loading';

            return (
              <ItemCard key={item.id}>
                <ItemTop>
                  <ItemHeading>
                    <Term>{item.term}</Term>
                    <TypeLabel>{TYPE_LABELS[item.type] || '표현'}</TypeLabel>
                  </ItemHeading>
                  <ItemActions>
                    <IconButton
                      onClick={() => handlePlay(item.term)}
                      disabled={isLoading || !canPlay}
                      className={audioState === 'playing' ? 'on' : ''}
                      aria-label={`${item.term} 듣기`}
                    >
                      {isLoading ? <LoaderIcon size="h-3.5 w-3.5" /> : <Volume2Icon />}
                    </IconButton>
                    <AccentFlags
                      text={item.term}
                      onPlayAudio={handlePlay}
                      audioState={audioState}
                      size={22}
                    />
                    <IconButton
                      onClick={() => removeItem(item.id)}
                      aria-label={`${item.term} 단어장에서 삭제`}
                    >
                      <CloseIcon />
                    </IconButton>
                  </ItemActions>
                </ItemTop>
                {item.meaning && <Meaning>{item.meaning}</Meaning>}
                {item.example && <Example>{item.example}</Example>}
              </ItemCard>
            );
          })}
        </List>
      )}
    </Wrapper>
  );
};

export default WordbookView;

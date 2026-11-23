import React from 'react';
import styled from '@emotion/styled';
import type { CollectedWord, TodayWordGroups, WordSource } from '../utils/todayWords';

interface TodayWordsViewProps {
  groups: TodayWordGroups;
  expressionsLoading: boolean;
  newsLoading: boolean;
}

const SOURCE_LABELS: Record<WordSource, string> = {
  expression: '표현',
  news: '뉴스',
};

const Wrapper = styled.section`
  width: 100%;
`;

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
`;

const StatusChip = styled.div<{ ready?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid ${props => props.ready ? 'var(--line)' : 'var(--line)'};
  border-radius: 999px;
  background: ${props => props.ready ? 'var(--card-paper)' : 'transparent'};
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
`;

const StatusDot = styled.span<{ ready?: boolean; loading?: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${props => props.ready ? 'var(--coral)' : 'var(--line)'};
  animation: ${props => props.loading ? 'status-pulse 1s ease-in-out infinite' : 'none'};

  @keyframes status-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }
`;

const GroupBlock = styled.div`
  & + & {
    margin-top: 22px;
  }
`;

const GroupHeading = styled.div`
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--ink);
`;

const GroupTitle = styled.h3`
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  font-weight: 720;
  letter-spacing: -0.02em;
`;

const GroupCount = styled.span`
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
`;

const WordList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;

  @media (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const WordRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--line);
`;

const WordText = styled.div`
  min-width: 0;
`;

const Term = styled.span`
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
`;

const Meaning = styled.span`
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
`;

const SourceTags = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
`;

const SourceTag = styled.span`
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.04em;
`;

const EmptyState = styled.div`
  padding: 34px 20px;
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
`;

const EmptyHint = styled.p`
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
`;

const Spinner = styled.div`
  width: 24px;
  height: 24px;
  margin: 0 auto 12px;
  border: 2px solid rgba(23, 20, 15, 0.14);
  border-top-color: var(--coral);
  border-radius: 50%;
  animation: word-spin 0.9s linear infinite;

  @keyframes word-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const WordGroup = ({ title, entries }: { title: string; entries: CollectedWord[] }) => {
  if (entries.length === 0) return null;

  return (
    <GroupBlock>
      <GroupHeading>
        <GroupTitle>{title}</GroupTitle>
        <GroupCount>{entries.length} WORDS</GroupCount>
      </GroupHeading>
      <WordList>
        {entries.map((entry) => (
          <WordRow key={`${entry.type}:${entry.word.toLowerCase()}`}>
            <WordText>
              <Term>{entry.word}</Term>
              {entry.meaning && <Meaning>{entry.meaning}</Meaning>}
            </WordText>
            <SourceTags aria-hidden="true">
              {entry.sources.map((source) => (
                <SourceTag key={source}>{SOURCE_LABELS[source]}</SourceTag>
              ))}
            </SourceTags>
          </WordRow>
        ))}
      </WordList>
    </GroupBlock>
  );
};

const TodayWordsView = ({ groups, expressionsLoading, newsLoading }: TodayWordsViewProps) => {
  const total = groups.phrasal.length + groups.words.length;
  const { expression, news } = groups.counts;
  const anyLoading = expressionsLoading || newsLoading;

  return (
    <Wrapper>
      <StatusRow aria-live="polite">
        <StatusChip ready={expression > 0}>
          <StatusDot ready={expression > 0} loading={expressionsLoading && expression === 0} />
          {`오늘의 표현 · ${expression > 0 ? `${expression}개` : expressionsLoading ? '생성 중' : '없음'}`}
        </StatusChip>
        <StatusChip ready={news > 0}>
          <StatusDot ready={news > 0} loading={newsLoading && news === 0} />
          {`뉴스 · ${news > 0 ? `${news}개` : newsLoading ? '생성 중' : '없음'}`}
        </StatusChip>
      </StatusRow>

      {total === 0 ? (
        <EmptyState>
          {anyLoading && <Spinner />}
          <EmptyText>
            {anyLoading
              ? '오늘의 자료에서 중요한 단어를 모으고 있어요.'
              : '아직 모을 단어가 없어요.'}
          </EmptyText>
          <EmptyHint>
            {anyLoading
              ? '표현이나 뉴스가 만들어지는 대로 여기에 추가됩니다.'
              : '오늘의 표현이나 뉴스 학습을 먼저 만들어 보세요.'}
          </EmptyHint>
        </EmptyState>
      ) : (
        <>
          <WordGroup title="구동사" entries={groups.phrasal} />
          <WordGroup title="단어" entries={groups.words} />
          {anyLoading && (
            <EmptyHint role="status">
              나머지 자료가 만들어지는 대로 단어가 추가됩니다.
            </EmptyHint>
          )}
        </>
      )}
    </Wrapper>
  );
};

export default TodayWordsView;

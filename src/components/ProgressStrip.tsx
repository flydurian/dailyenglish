import React from 'react';
import styled from '@emotion/styled';
import { useProgress } from '../contexts/ProgressContext';
import { useWordbook } from '../contexts/WordbookContext';

const formatDayLabel = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${month}월 ${day}일`;
};

const Strip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 14px;
  margin-top: 14px;
  padding-top: 9px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.04em;
  line-height: 1.5;
`;

const Summary = styled.span`
  min-width: 0;
`;

const Days = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
`;

const DayDot = styled.span<{ $today: boolean; $active: boolean }>`
  width: 9px;
  height: 9px;
  border: 1px solid ${(props) => (props.$today ? 'var(--ink)' : 'var(--line)')};
  border-radius: 50%;
  background: ${(props) => (props.$active ? 'var(--coral)' : 'transparent')};
  box-sizing: border-box;
`;

const ProgressStrip = () => {
  const { streak, lastDays, today } = useProgress();
  const { items } = useWordbook();
  const todayKey = lastDays[lastDays.length - 1]?.dateKey;

  return (
    <Strip>
      <Summary>
        {`연속 ${streak}일 · 단어장 ${items.length} · 오늘 복습 ${today.reviewed}`}
      </Summary>

      <Days role="group" aria-label="최근 7일 학습 기록">
        {lastDays.map((day) => {
          const label = `${formatDayLabel(day.dateKey)} ${day.active ? '활동함' : '기록 없음'}`;

          return (
            <DayDot
              key={day.dateKey}
              role="img"
              title={label}
              aria-label={label}
              $active={day.active}
              $today={day.dateKey === todayKey}
            />
          );
        })}
      </Days>
    </Strip>
  );
};

export default ProgressStrip;

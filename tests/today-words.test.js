// 오늘의 단어 페이지가 표현·뉴스 자료에서 단어를 올바르게 모으는지 검증합니다.
import { describe, it, expect } from 'vitest';
import { collectTodayWords, parseWordLabel } from '../src/utils/todayWords';

describe('parseWordLabel', () => {
  it('"단어: 뜻" 형식을 분리하고 강조 기호를 제거한다', () => {
    expect(parseWordLabel('get up: 일어나다')).toEqual({ word: 'get up', meaning: '일어나다' });
    expect(parseWordLabel('**comprehensive**: 포괄적인')).toEqual({ word: 'comprehensive', meaning: '포괄적인' });
    expect(parseWordLabel('- sustainable: 지속가능한')).toEqual({ word: 'sustainable', meaning: '지속가능한' });
  });

  it('뜻이 없거나 콜론만 있는 경우 단어만 남긴다', () => {
    expect(parseWordLabel('innovation')).toEqual({ word: 'innovation', meaning: '' });
    expect(parseWordLabel('look into:')).toEqual({ word: 'look into', meaning: '' });
  });
});

describe('collectTodayWords', () => {
  const expressions = [
    {
      phrasal_verb: 'get up: 일어나다',
      other_words: [
        { word: 'early', meaning: '일찍' },
        { word: 'routine', meaning: '일과' },
      ],
    },
  ];
  const news = [
    {
      key_points: ['look into: 조사하다', 'get up: 일어나다'],
      vocabulary_notes: ['comprehensive: 포괄적인', 'early: 일찍'],
    },
  ];

  it('표현과 뉴스에서 구동사와 단어를 각각 모은다', () => {
    const groups = collectTodayWords(expressions, news);

    expect(groups.phrasal.map((item) => item.word)).toEqual(['get up', 'look into']);
    expect(groups.words.map((item) => item.word)).toEqual(['early', 'routine', 'comprehensive']);
    expect(groups.counts).toEqual({ expression: 3, news: 4 });
  });

  it('같은 단어는 한 번만 표시하고 출처를 합친다', () => {
    const groups = collectTodayWords(expressions, news);
    const early = groups.words.find((item) => item.word === 'early');
    const getUp = groups.phrasal.find((item) => item.word === 'get up');

    expect(early.sources).toEqual(['expression', 'news']);
    expect(getUp.sources).toEqual(['expression', 'news']);
  });

  it('한쪽 자료만 있어도 준비된 단어를 보여준다', () => {
    const onlyExpressions = collectTodayWords(expressions, []);
    const onlyNews = collectTodayWords([], news);

    expect(onlyExpressions.phrasal).toHaveLength(1);
    expect(onlyExpressions.words).toHaveLength(2);
    expect(onlyExpressions.counts).toEqual({ expression: 3, news: 0 });

    expect(onlyNews.phrasal).toHaveLength(2);
    expect(onlyNews.words).toHaveLength(2);
    expect(onlyNews.counts).toEqual({ expression: 0, news: 4 });
  });

  it('자료가 없거나 형식이 잘못된 항목은 무시한다', () => {
    const empty = collectTodayWords();
    expect(empty.phrasal).toEqual([]);
    expect(empty.words).toEqual([]);
    expect(empty.counts).toEqual({ expression: 0, news: 0 });

    const malformed = collectTodayWords(
      [null, { phrasal_verb: '', other_words: [{ meaning: '뜻만 있음' }, null] }],
      [{ key_points: [7, null], vocabulary_notes: '배열이 아님' }]
    );
    expect(malformed.phrasal).toEqual([]);
    expect(malformed.words).toEqual([]);
  });

  it('단어가 없는 뜻은 비우고, 뜻이 나중에 나오면 채운다', () => {
    const groups = collectTodayWords(
      [{ other_words: [{ word: 'impact', meaning: '' }] }],
      [{ vocabulary_notes: ['impact: 영향'] }]
    );

    expect(groups.words).toHaveLength(1);
    expect(groups.words[0].meaning).toBe('영향');
    expect(groups.words[0].sources).toEqual(['expression', 'news']);
  });
});

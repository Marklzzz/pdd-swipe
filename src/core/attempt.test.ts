import { describe, expect, it } from 'vitest';
import { firstRef, judge, ticketOrder } from './attempt';
import type { Question } from './data';

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    refs: [[1, 1]],
    topics: [],
    text: 'Вопрос?',
    img: null,
    options: ['A', 'B', 'C'],
    correct: 1,
    tip: '',
    twins: [],
    ...overrides,
  };
}

describe('judge', () => {
  it('marks the correct option as correct', () => {
    const a = judge(question(), 'train', { kind: 'option', index: 1, dir: 'left' }, 1234.6, 99);
    expect(a).toEqual({
      qid: 'q1',
      mode: 'train',
      dir: 'left',
      chosen: 1,
      correct: true,
      ms: 1235,
      ts: 99,
    });
  });

  it('marks another option as wrong', () => {
    const a = judge(question(), 'train', { kind: 'option', index: 2, dir: 'down' }, 10, 0);
    expect(a.correct).toBe(false);
    expect(a.chosen).toBe(2);
  });

  it('counts "не знаю" as a mistake with no choice', () => {
    const a = judge(question(), 'train', { kind: 'unknown' }, 10, 0);
    expect(a).toMatchObject({ dir: null, chosen: null, correct: false });
  });

  it('keeps a null direction for taps on a row', () => {
    const a = judge(question(), 'exam', { kind: 'option', index: 1, dir: null }, 10, 0);
    expect(a).toMatchObject({ dir: null, chosen: 1, correct: true });
  });

  it('rejects an option out of range', () => {
    expect(() => judge(question(), 'train', { kind: 'option', index: 3, dir: null }, 10, 0)).toThrow(
      /out of range/,
    );
  });
});

describe('firstRef', () => {
  it('picks the earliest ticket, then the earliest position', () => {
    expect(firstRef(question({ refs: [[9, 15], [1, 15]] }))).toEqual([1, 15]);
    expect(firstRef(question({ refs: [[3, 7], [3, 2], [4, 1]] }))).toEqual([3, 2]);
  });
});

describe('ticketOrder', () => {
  it('sorts by the earliest ticket and position', () => {
    const qs = [
      question({ id: 'c', refs: [[2, 1]] }),
      question({ id: 'b', refs: [[9, 15], [1, 15]] }),
      question({ id: 'a', refs: [[1, 3]] }),
      question({ id: 'd', refs: [[1, 20]] }),
    ];
    expect(ticketOrder(qs).map((q) => q.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('does not mutate the input', () => {
    const qs = [question({ id: 'b', refs: [[2, 1]] }), question({ id: 'a', refs: [[1, 1]] })];
    ticketOrder(qs);
    expect(qs.map((q) => q.id)).toEqual(['b', 'a']);
  });
});

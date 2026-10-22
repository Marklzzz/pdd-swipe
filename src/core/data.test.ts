import { describe, expect, it } from 'vitest';
import { parseQuestionBank } from './data';

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a',
    refs: [[1, 1]],
    topics: ['Общие положения'],
    text: 'Вопрос?',
    img: null,
    options: ['Да', 'Нет'],
    correct: 1,
    tip: 'Пункт 1.2 ПДД',
    twins: [],
    ...overrides,
  };
}

describe('parseQuestionBank', () => {
  it('accepts a valid bank', () => {
    const bank = parseQuestionBank({
      source: 'fa37933',
      questions: [question(), question({ id: 'b', img: 'img/x.jpg', twins: ['a'] })],
    });
    expect(bank.source).toBe('fa37933');
    expect(bank.questions.map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('rejects a non-object root', () => {
    expect(() => parseQuestionBank(null)).toThrow(/root/);
  });

  it('rejects correct out of range', () => {
    expect(() => parseQuestionBank({ source: 's', questions: [question({ correct: 2 })] })).toThrow(
      /correct/,
    );
  });

  it('rejects bad refs', () => {
    expect(() => parseQuestionBank({ source: 's', questions: [question({ refs: [[0, 1]] })] })).toThrow(
      /refs/,
    );
  });

  it('rejects duplicate ids', () => {
    expect(() => parseQuestionBank({ source: 's', questions: [question(), question()] })).toThrow(
      /duplicate/,
    );
  });

  it('rejects twins pointing to unknown questions', () => {
    expect(() =>
      parseQuestionBank({ source: 's', questions: [question({ twins: ['missing'] })] }),
    ).toThrow(/unknown twin/);
  });
});

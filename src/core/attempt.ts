// Answer judging and the attempt log record (see "Повторения и лог" in SPEC.md).

import type { Question } from './data';
import type { Dir } from './layout';

export type Mode = 'train' | 'control' | 'twins' | 'exam';

/** What the user did: picked an option (by swipe or tap) or tapped "не знаю". */
export type Answer = { kind: 'option'; index: number; dir: Dir | null } | { kind: 'unknown' };

export interface Attempt {
  qid: string;
  mode: Mode;
  /** Swipe direction, null for a tap. */
  dir: Dir | null;
  /** Index into options as shown in ticket order, null for "не знаю". */
  chosen: number | null;
  correct: boolean;
  /** Time from the question being shown to the answer. */
  ms: number;
  /** Unix time of the answer, ms. */
  ts: number;
}

export function judge(q: Question, mode: Mode, answer: Answer, ms: number, ts: number): Attempt {
  if (answer.kind === 'unknown') {
    return { qid: q.id, mode, dir: null, chosen: null, correct: false, ms: Math.round(ms), ts };
  }
  if (!Number.isInteger(answer.index) || answer.index < 0 || answer.index >= q.options.length) {
    throw new Error(`option ${answer.index} is out of range for question ${q.id}`);
  }
  return {
    qid: q.id,
    mode,
    dir: answer.dir,
    chosen: answer.index,
    correct: answer.index === q.correct,
    ms: Math.round(ms),
    ts,
  };
}

/** Earliest [ticket, question number] the question appears at. */
export function firstRef(q: Question): [number, number] {
  return q.refs.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a));
}

/** Questions in ticket order, each at its earliest occurrence. */
export function ticketOrder(questions: readonly Question[]): Question[] {
  const key = (q: Question) => {
    const [ticket, num] = firstRef(q);
    return ticket * 100 + num;
  };
  return [...questions].sort((a, b) => key(a) - key(b));
}

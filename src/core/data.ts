// Shape of public/data/questions.json, produced by scripts/build_data.py.

export interface Question {
  id: string;
  /** Every occurrence as [ticket, question number]. */
  refs: [number, number][];
  topics: string[];
  text: string;
  /** Path relative to the data directory, or null when there is no image. */
  img: string | null;
  /** Options in ticket order. */
  options: string[];
  /** Zero-based index into options. */
  correct: number;
  tip: string;
  /** Ids of questions with the same text and a different correct position. */
  twins: string[];
}

export interface QuestionBank {
  source: string;
  questions: Question[];
}

function fail(where: string, what: string): never {
  throw new Error(`questions.json: ${where}: ${what}`);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function checkQuestion(raw: unknown, i: number): Question {
  const where = `questions[${i}]`;
  if (typeof raw !== 'object' || raw === null) fail(where, 'not an object');
  const q = raw as Record<string, unknown>;
  if (typeof q.id !== 'string' || q.id === '') fail(where, 'bad id');
  if (typeof q.text !== 'string') fail(where, 'bad text');
  if (typeof q.tip !== 'string') fail(where, 'bad tip');
  if (q.img !== null && typeof q.img !== 'string') fail(where, 'bad img');
  if (!isStringArray(q.topics)) fail(where, 'bad topics');
  if (!isStringArray(q.twins)) fail(where, 'bad twins');
  if (!isStringArray(q.options) || q.options.length < 2) fail(where, 'bad options');
  if (
    typeof q.correct !== 'number' ||
    !Number.isInteger(q.correct) ||
    q.correct < 0 ||
    q.correct >= q.options.length
  ) {
    fail(where, 'correct is out of range');
  }
  const refsOk =
    Array.isArray(q.refs) &&
    q.refs.length > 0 &&
    q.refs.every(
      (r) => Array.isArray(r) && r.length === 2 && r.every((n) => Number.isInteger(n) && n > 0),
    );
  if (!refsOk) fail(where, 'bad refs');
  return q as unknown as Question;
}

/** Validate parsed questions.json; throws a descriptive Error on bad shape. */
export function parseQuestionBank(raw: unknown): QuestionBank {
  if (typeof raw !== 'object' || raw === null) fail('root', 'not an object');
  const bank = raw as Record<string, unknown>;
  if (typeof bank.source !== 'string') fail('root', 'bad source');
  if (!Array.isArray(bank.questions)) fail('root', 'questions is not an array');
  const questions = bank.questions.map(checkQuestion);
  const ids = new Set(questions.map((q) => q.id));
  if (ids.size !== questions.length) fail('root', 'duplicate question ids');
  for (const q of questions) {
    for (const t of q.twins) {
      if (!ids.has(t)) fail(`question ${q.id}`, `unknown twin ${t}`);
    }
  }
  return { source: bank.source, questions };
}

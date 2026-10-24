// "Все подряд": every question once, in ticket order, resuming where the user stopped.

import { firstRef, judge, type Answer, type Attempt } from '../core/attempt';
import type { Question } from '../core/data';
import type { Release } from '../core/gesture';
import { optionDirs, optionForDir, type Dir } from '../core/layout';
import { Card } from './card';
import { el } from './dom';
import { Pad } from './pad';

/** How long a correct answer stays on screen before the next question. */
const CORRECT_PAUSE_MS = 600;

export interface SequentialDeps {
  imgBase: string;
  log(a: Attempt): void;
  /** Persist the id of the next question, or null when the pass is over. */
  saveCursor(qid: string | null): void;
}

type State = 'question' | 'correct' | 'reveal' | 'done';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export class Sequential {
  private state: State = 'question';
  private card: Card | null = null;
  private shownAt = 0;
  private answered = false;
  private timer: number | undefined;
  private right = 0;
  private wrong = 0;

  private readonly where = el('span', { className: 'where' });
  private readonly score = el('span', { className: 'score' });
  private readonly progress = el('span', { className: 'progress' });
  private readonly stage = el('div', { className: 'stage' });
  private readonly pad = new Pad(
    (dir, dx, dy) => {
      if (this.state === 'question') this.card?.lean(dir, dx, dy);
    },
    (r) => this.onRelease(r),
  );

  constructor(
    root: HTMLElement,
    private readonly questions: readonly Question[],
    private index: number,
    private readonly deps: SequentialDeps,
  ) {
    root.replaceChildren(
      el('header', { className: 'bar' }, this.where, this.score, this.progress),
      this.stage,
      this.pad.root,
    );
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.fit());
    this.show();
  }

  private get question(): Question {
    return this.questions[this.index]!;
  }

  private show(): void {
    window.clearTimeout(this.timer);
    this.updateBar();
    if (this.index >= this.questions.length) {
      this.showDone();
      return;
    }
    const q = this.question;
    this.state = 'question';
    this.answered = false;
    this.card = new Card(q, this.deps.imgBase, (index) => {
      if (this.state === 'question') this.answer({ kind: 'option', index, dir: null });
    });
    this.pad.setDirs(optionDirs(q.options.length));
    this.stage.replaceChildren(el('div', { className: 'stack' }, this.card.root));
    this.stage.scrollTop = 0;
    this.fit();
    this.setHint(
      q.options.length > 4 ? 'Тап по варианту — ответ · тап здесь — не знаю' : 'Свайп — ответ · тап — не знаю',
    );
    // The clock starts once the picture is visible.
    this.shownAt = performance.now();
    void this.card.ready().then(() => {
      if (this.card?.root.isConnected) this.fit();
      if (!this.answered && this.question === q) this.shownAt = performance.now();
    });
    const nextImg = this.questions[this.index + 1]?.img;
    if (nextImg) new Image().src = this.deps.imgBase + nextImg;
  }

  private onRelease(release: Release): void {
    if (this.state === 'correct' || this.state === 'reveal') {
      if (release.kind !== 'cancel') this.next();
      return;
    }
    if (this.state !== 'question') return;
    if (release.kind === 'tap') {
      this.answer({ kind: 'unknown' });
    } else if (release.kind === 'swipe') {
      const index = optionForDir(this.question.options.length, release.dir);
      if (index !== null) this.answer({ kind: 'option', index, dir: release.dir });
    }
  }

  private answer(a: Answer): void {
    const q = this.question;
    this.answered = true;
    const attempt = judge(q, 'train', a, performance.now() - this.shownAt, Date.now());
    this.deps.log(attempt);
    this.deps.saveCursor(this.questions[this.index + 1]?.id ?? null);
    this.card!.mark(attempt.chosen, q.correct);
    if (attempt.correct) {
      this.right++;
      this.state = 'correct';
      this.setHint('Верно');
      this.timer = window.setTimeout(() => this.next(), CORRECT_PAUSE_MS);
    } else {
      this.wrong++;
      this.state = 'reveal';
      const stack = this.stage.firstElementChild!;
      if (q.tip) {
        const tip = el('section', { className: 'tip' }, q.tip);
        stack.append(tip);
        this.fit();
        tip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      this.setHint('Дальше');
    }
    this.updateBar();
  }

  private next(): void {
    this.index++;
    this.show();
  }

  private showDone(): void {
    this.state = 'done';
    this.card = null;
    const again = el('button', { className: 'primary', type: 'button' }, 'Пройти заново');
    again.addEventListener('click', () => {
      this.index = 0;
      this.right = 0;
      this.wrong = 0;
      this.deps.saveCursor(this.questions[0]?.id ?? null);
      this.show();
    });
    this.stage.replaceChildren(
      el(
        'div',
        { className: 'stack done' },
        el('h1', {}, 'Все вопросы пройдены'),
        el('p', { className: 'muted' }, `За этот заход: верно ${this.right}, ошибок ${this.wrong}`),
        again,
      ),
    );
    this.fit();
    this.setHint('');
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    // A focused button handles Enter and Space itself.
    if ((e.target as Element | null)?.closest?.('button')) return;
    const dir = KEY_DIRS[e.key];
    let release: Release | null = null;
    if (dir) release = { kind: 'swipe', dir };
    else if (e.key === ' ') release = { kind: 'tap' };
    else if (e.key === 'Enter' && this.state !== 'question') release = { kind: 'tap' };
    else if (/^[1-5]$/.test(e.key) && this.state === 'question') {
      const index = Number(e.key) - 1;
      if (index < this.question.options.length) {
        e.preventDefault();
        this.answer({ kind: 'option', index, dir: null });
      }
      return;
    }
    if (!release || this.state === 'done') return;
    e.preventDefault();
    this.onRelease(release);
  }

  /** Shrink a card that does not fit, and let the stage scroll as a last resort or for the tip. */
  private fit(): void {
    const s = this.stage;
    const overflows = () => s.scrollHeight > s.clientHeight + 1;
    s.classList.remove('compact', 'tiny', 'scroll');
    if (overflows()) s.classList.add('compact');
    if (overflows()) s.classList.add('tiny');
    if (overflows() || this.state === 'reveal') s.classList.add('scroll');
  }

  private updateBar(): void {
    const q = this.questions[this.index];
    if (q) {
      const [ticket, num] = firstRef(q);
      this.where.textContent = `Билет ${ticket} · ${num}`;
    } else {
      this.where.textContent = '';
    }
    this.score.textContent = `✓ ${this.right}  ✗ ${this.wrong}`;
    this.progress.textContent = `${Math.min(this.index + 1, this.questions.length)} / ${this.questions.length}`;
  }

  private setHint(text: string): void {
    this.pad.setLabel(text, this.state === 'reveal');
  }
}

// Question card: renders a question and turns pointer input on it into Release events.

import type { Question } from '../core/data';
import { GestureTracker, type Release, type Sample } from '../core/gesture';
import { optionDirs, optionForDir, type Dir } from '../core/layout';
import { el } from './dom';

const ARROWS: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

export interface CardRelease {
  release: Release;
  /** Option row under the pointer at pointer down, if any. */
  row: number | null;
}

export class Card {
  readonly root: HTMLElement;
  private readonly rows: HTMLElement[];
  private readonly count: number;
  private tracker: GestureTracker | null = null;
  private pointerId: number | null = null;
  private downRow: number | null = null;
  private start: Sample | null = null;

  constructor(
    q: Question,
    imgBase: string,
    private readonly onRelease: (r: CardRelease) => void,
  ) {
    this.count = q.options.length;
    const dirs = optionDirs(this.count);
    this.rows = q.options.map((text, i) =>
      el(
        'li',
        { className: 'opt' },
        el('span', { className: 'key' }, dirs ? ARROWS[dirs[i]!] : String(i + 1)),
        el('span', { className: 'opt-text' }, text),
      ),
    );
    const img = q.img
      ? el('img', { src: imgBase + q.img, alt: '', draggable: false, decoding: 'async' })
      : null;
    this.root = el(
      'article',
      { className: dirs ? 'card' : 'card no-swipe' },
      ...(img ? [img] : []),
      el('p', { className: 'q-text' }, q.text),
      el('ol', { className: 'opts' }, ...this.rows),
    );
    this.bind();
  }

  /** Resolves when the image (if any) can be shown. */
  ready(): Promise<void> {
    const img = this.root.querySelector('img');
    return img ? img.decode().catch(() => undefined) : Promise.resolve();
  }

  /** Colour rows after an answer: `chosen` (may be null) and the correct one. */
  mark(chosen: number | null, correct: number): void {
    this.aim(null);
    this.root.classList.add('answered');
    if (chosen !== null && chosen !== correct) this.rows[chosen]?.classList.add('bad');
    this.rows[correct]?.classList.add('ok');
  }

  private aim(dir: Dir | null): void {
    const i = dir === null ? null : optionForDir(this.count, dir);
    this.rows.forEach((row, j) => row.classList.toggle('aim', j === i));
  }

  private bind(): void {
    const c = this.root;
    c.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null || !e.isPrimary || e.button !== 0) return;
      this.pointerId = e.pointerId;
      c.setPointerCapture(e.pointerId);
      const row = (e.target as Element).closest('.opt');
      this.downRow = row ? this.rows.indexOf(row as HTMLElement) : null;
      this.start = sample(e);
      this.tracker = new GestureTracker(this.start);
      c.classList.remove('settling');
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId || !this.tracker || !this.start) return;
      const s = sample(e);
      const dx = s.x - this.start.x;
      const dy = s.y - this.start.y;
      c.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.02}deg)`;
      if (!c.classList.contains('answered')) this.aim(this.tracker.move(s));
      else this.tracker.move(s);
    });
    c.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.pointerId || !this.tracker) return;
      const release = this.tracker.end(sample(e));
      const row = this.downRow;
      this.reset();
      this.onRelease({ release, row });
    });
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) this.reset();
    };
    c.addEventListener('pointercancel', cancel);
    c.addEventListener('lostpointercapture', cancel);
  }

  /** Spring the card back to the centre. */
  private reset(): void {
    this.pointerId = null;
    this.tracker = null;
    this.start = null;
    this.aim(null);
    this.root.classList.add('settling');
    this.root.style.transform = '';
  }
}

function sample(e: PointerEvent): Sample {
  return { x: e.clientX, y: e.clientY, t: e.timeStamp };
}

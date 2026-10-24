// Question card: renders a question; input comes from the gesture pad, except row taps with 5 options.

import type { Question } from '../core/data';
import { nudgeOffset } from '../core/gesture';
import { optionDirs, optionForDir, type Dir } from '../core/layout';
import { el } from './dom';

const ARROWS: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

export class Card {
  readonly root: HTMLElement;
  private readonly rows: HTMLElement[];
  private readonly count: number;

  constructor(
    q: Question,
    imgBase: string,
    /** Called when an option row is tapped; only with 5 options, where swipes are off. */
    onRow: (index: number) => void,
  ) {
    this.count = q.options.length;
    const dirs = optionDirs(this.count);
    this.rows = q.options.map((text, i) => {
      const row = el(
        'li',
        { className: 'opt' },
        el('span', { className: 'key' }, dirs ? ARROWS[dirs[i]!] : String(i + 1)),
        el('span', { className: 'opt-text' }, text),
      );
      if (!dirs) row.addEventListener('click', () => onRow(i));
      return row;
    });
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
  }

  /** Resolves when the image (if any) can be shown. */
  ready(): Promise<void> {
    const img = this.root.querySelector('img');
    return img ? img.decode().catch(() => undefined) : Promise.resolve();
  }

  /** Highlight the option a pad drag aims at and lean the card towards it; null springs back. */
  lean(dir: Dir | null, dx: number, dy: number): void {
    const i = dir === null ? null : optionForDir(this.count, dir);
    this.rows.forEach((row, j) => row.classList.toggle('aim', j === i));
    const o = nudgeOffset(i === null ? null : dir, dx, dy);
    this.root.classList.toggle('settling', i === null);
    this.root.style.transform = i === null ? '' : `translate(${o.x}px, ${o.y}px)`;
  }

  /** Colour rows after an answer: `chosen` (may be null) and the correct one. */
  mark(chosen: number | null, correct: number): void {
    this.lean(null, 0, 0);
    this.root.classList.add('answered');
    if (chosen !== null && chosen !== correct) this.rows[chosen]?.classList.add('bad');
    this.rows[correct]?.classList.add('ok');
  }
}

// Gesture pad at the bottom of the screen: the thumb swipes here, the card above only shows the question.

import { clampOffset, GestureTracker, PAD_THUMB_MAX_PX, type Release, type Sample } from '../core/gesture';
import type { Dir } from '../core/layout';
import { el } from './dom';

const ARROWS: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export class Pad {
  readonly root: HTMLElement;
  private readonly arrows: Record<Dir, HTMLElement>;
  private readonly thumb = el('span', { className: 'pad-thumb' });
  private readonly label = el('span', { className: 'pad-label' });
  private active: ReadonlySet<Dir> = new Set();
  private tracker: GestureTracker | null = null;
  private pointerId: number | null = null;
  private start: Sample | null = null;

  constructor(
    /** Called on every move with the aimed direction and the drag so far; (null, 0, 0) when it ends. */
    private readonly onAim: (dir: Dir | null, dx: number, dy: number) => void,
    private readonly onRelease: (r: Release) => void,
  ) {
    this.arrows = Object.fromEntries(
      DIRS.map((d) => [d, el('span', { className: `pad-arrow ${d}` }, ARROWS[d])]),
    ) as Record<Dir, HTMLElement>;
    // The thumb goes first so the lit arrow stays on top of it.
    this.root = el('div', { className: 'pad' }, this.thumb, this.label, ...DIRS.map((d) => this.arrows[d]));
    this.bind();
  }

  /** Directions that answer something; null when swipes are off. */
  setDirs(dirs: readonly Dir[] | null): void {
    this.active = new Set(dirs ?? []);
    for (const d of DIRS) this.arrows[d].classList.toggle('off', !this.active.has(d));
  }

  /** `action` styles the pad as a "next" button. An empty text hides the pad. */
  setLabel(text: string, action: boolean): void {
    this.label.textContent = text;
    this.root.classList.toggle('action', action);
    this.root.hidden = text === '';
  }

  private bind(): void {
    const p = this.root;
    p.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null || !e.isPrimary || e.button !== 0) return;
      this.pointerId = e.pointerId;
      p.setPointerCapture(e.pointerId);
      this.start = sample(e);
      this.tracker = new GestureTracker(this.start);
      p.classList.remove('settling');
      p.classList.add('pressed');
    });
    p.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId || !this.tracker || !this.start) return;
      const s = sample(e);
      const dx = s.x - this.start.x;
      const dy = s.y - this.start.y;
      const t = clampOffset(dx, dy, PAD_THUMB_MAX_PX);
      this.thumb.style.transform = `translate(${t.x}px, ${t.y}px)`;
      const dir = this.tracker.move(s);
      this.light(dir);
      this.onAim(dir, dx, dy);
    });
    p.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.pointerId || !this.tracker) return;
      const release = this.tracker.end(sample(e));
      this.reset();
      this.onRelease(release);
    });
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) this.reset();
    };
    p.addEventListener('pointercancel', cancel);
    p.addEventListener('lostpointercapture', cancel);
  }

  private light(dir: Dir | null): void {
    for (const d of DIRS) this.arrows[d].classList.toggle('aim', d === dir && this.active.has(d));
  }

  /** Spring the thumb back to the centre. */
  private reset(): void {
    this.pointerId = null;
    this.tracker = null;
    this.start = null;
    this.light(null);
    this.root.classList.remove('pressed');
    this.root.classList.add('settling');
    this.thumb.style.transform = '';
    this.onAim(null, 0, 0);
  }
}

function sample(e: PointerEvent): Sample {
  return { x: e.clientX, y: e.clientY, t: e.timeStamp };
}

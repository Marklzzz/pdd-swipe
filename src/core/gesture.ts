// Swipe recognition from pointer samples, independent of the DOM (see "Жест" in SPEC.md).

import type { Dir } from './layout';

/** Total movement below this is a tap ("не знаю"). */
export const TAP_SLOP_PX = 8;
/** No direction until the dominant axis moves this far. */
export const DEAD_ZONE_PX = 30;
/** Release beyond this distance answers. */
export const COMMIT_DISTANCE_PX = 80;
/** Release faster than this (along the direction) answers. */
export const COMMIT_VELOCITY_PX_MS = 0.6;
/** Release velocity is measured over this trailing window. */
export const VELOCITY_WINDOW_MS = 100;

export interface Sample {
  x: number;
  y: number;
  /** Milliseconds, any monotonic clock. */
  t: number;
}

export type Release = { kind: 'tap' } | { kind: 'swipe'; dir: Dir } | { kind: 'cancel' };

/** Direction along the dominant axis, or null inside the dead zone. Screen y grows downwards. */
export function dragDir(dx: number, dy: number): Dir | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= DEAD_ZONE_PX) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Signed displacement along `dir` (positive means towards it). */
function along(dir: Dir, dx: number, dy: number): number {
  switch (dir) {
    case 'up':
      return -dy;
    case 'down':
      return dy;
    case 'left':
      return -dx;
    case 'right':
      return dx;
  }
}

/** Tracks one pointer from down to up. */
export class GestureTracker {
  private readonly start: Sample;
  private samples: Sample[];
  private maxDistance = 0;

  constructor(start: Sample) {
    this.start = start;
    this.samples = [start];
  }

  /** Record a move; returns the direction the card is currently aimed at. */
  move(s: Sample): Dir | null {
    const dx = s.x - this.start.x;
    const dy = s.y - this.start.y;
    this.maxDistance = Math.max(this.maxDistance, Math.hypot(dx, dy));
    this.samples.push(s);
    // Keep one sample older than the window so velocity spans the whole window.
    while (this.samples.length > 2 && s.t - this.samples[1]!.t >= VELOCITY_WINDOW_MS) {
      this.samples.shift();
    }
    return dragDir(dx, dy);
  }

  /** Classify the gesture at pointer up. */
  end(s: Sample): Release {
    const dir = this.move(s);
    if (this.maxDistance < TAP_SLOP_PX) return { kind: 'tap' };
    if (dir === null) return { kind: 'cancel' };

    const distance = along(dir, s.x - this.start.x, s.y - this.start.y);
    const from = this.samples[0]!;
    const dt = s.t - from.t;
    const velocity = dt > 0 ? along(dir, s.x - from.x, s.y - from.y) / dt : 0;
    if (distance > COMMIT_DISTANCE_PX || velocity > COMMIT_VELOCITY_PX_MS) {
      return { kind: 'swipe', dir };
    }
    return { kind: 'cancel' };
  }
}

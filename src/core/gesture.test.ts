import { describe, expect, it } from 'vitest';
import {
  CARD_NUDGE_PX,
  clampOffset,
  dragDir,
  GestureTracker,
  nudgeOffset,
  type Sample,
} from './gesture';

/** Run a gesture through the tracker; the last sample is the pointer up. */
function release(...samples: Sample[]) {
  const [first, ...rest] = samples;
  const tracker = new GestureTracker(first!);
  const last = rest.pop() ?? first!;
  for (const s of rest) tracker.move(s);
  return tracker.end(last);
}

/** Slow straight drag from the origin to (x, y) over `ms`, sampled every 16 ms. */
function slowDrag(x: number, y: number, ms: number): Sample[] {
  const out: Sample[] = [];
  for (let t = 0; t < ms; t += 16) out.push({ x: (x * t) / ms, y: (y * t) / ms, t });
  out.push({ x, y, t: ms });
  return out;
}

describe('dragDir', () => {
  it('is null inside the dead zone', () => {
    expect(dragDir(0, 0)).toBeNull();
    expect(dragDir(30, -30)).toBeNull();
  });

  it('follows the dominant axis', () => {
    expect(dragDir(0, -31)).toBe('up');
    expect(dragDir(10, 40)).toBe('down');
    expect(dragDir(-50, 20)).toBe('left');
    expect(dragDir(50, -49)).toBe('right');
  });
});

describe('GestureTracker', () => {
  it('reports the aimed direction while dragging', () => {
    const t = new GestureTracker({ x: 100, y: 100, t: 0 });
    expect(t.move({ x: 100, y: 80, t: 50 })).toBeNull();
    expect(t.move({ x: 100, y: 60, t: 100 })).toBe('up');
    expect(t.move({ x: 160, y: 60, t: 150 })).toBe('right');
  });

  it('treats a still pointer as a tap', () => {
    expect(release({ x: 0, y: 0, t: 0 }, { x: 3, y: -4, t: 200 })).toEqual({ kind: 'tap' });
  });

  it('is not a tap if the pointer wandered off and came back', () => {
    expect(release({ x: 0, y: 0, t: 0 }, { x: 20, y: 0, t: 100 }, { x: 1, y: 0, t: 200 })).toEqual({
      kind: 'cancel',
    });
  });

  it('answers past the commit distance, however slow', () => {
    expect(release(...slowDrag(0, -90, 2000))).toEqual({ kind: 'swipe', dir: 'up' });
    expect(release(...slowDrag(85, 10, 2000))).toEqual({ kind: 'swipe', dir: 'right' });
  });

  it('springs back on a slow short drag', () => {
    expect(release(...slowDrag(0, 60, 1000))).toEqual({ kind: 'cancel' });
  });

  it('answers on a fast flick shorter than the commit distance', () => {
    expect(release(...slowDrag(-50, 0, 50))).toEqual({ kind: 'swipe', dir: 'left' });
  });

  it('does not answer a fast flick inside the dead zone', () => {
    expect(release(...slowDrag(0, 25, 10))).toEqual({ kind: 'cancel' });
  });

  it('measures velocity over the trailing window only', () => {
    // Fast start, then a long pause: the release is slow.
    const samples = [...slowDrag(0, 60, 50), { x: 0, y: 60, t: 400 }, { x: 0, y: 61, t: 500 }];
    expect(release(...samples)).toEqual({ kind: 'cancel' });
  });

  it('cancels when the finger is pulled back towards the start', () => {
    // Went far up, then slowly back to 50 px: still aimed up, but the user changed their mind.
    const back = slowDrag(0, 70, 700).map((s) => ({ x: 0, y: -120 + s.y, t: 300 + s.t }));
    expect(release(...slowDrag(0, -120, 300), ...back)).toEqual({ kind: 'cancel' });
  });

  it('does not count velocity away from the aimed direction', () => {
    // Still above the dead zone but moving back down fast.
    const samples = [...slowDrag(0, -70, 1000), { x: 0, y: -60, t: 1010 }, { x: 0, y: -40, t: 1030 }];
    expect(release(...samples)).toEqual({ kind: 'cancel' });
  });
});

describe('clampOffset', () => {
  it('keeps a short vector as is', () => {
    expect(clampOffset(3, -4, 10)).toEqual({ x: 3, y: -4 });
  });

  it('shortens a long vector, keeping its direction', () => {
    expect(clampOffset(30, -40, 10)).toEqual({ x: 6, y: -8 });
  });
});

describe('nudgeOffset', () => {
  it('stays put without a direction', () => {
    expect(nudgeOffset(null, 50, 50)).toEqual({ x: 0, y: 0 });
  });

  it('moves only along the aimed axis, growing with the drag', () => {
    expect(nudgeOffset('up', 20, -40)).toEqual({ x: 0, y: -CARD_NUDGE_PX / 2 });
    expect(nudgeOffset('left', -40, 5)).toEqual({ x: -CARD_NUDGE_PX / 2, y: 0 });
  });

  it('stops at CARD_NUDGE_PX', () => {
    expect(nudgeOffset('down', 0, 500)).toEqual({ x: 0, y: CARD_NUDGE_PX });
    expect(nudgeOffset('right', 500, 0)).toEqual({ x: CARD_NUDGE_PX, y: 0 });
  });
});

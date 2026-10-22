// Swipe layout: which direction answers which option (see "Раскладка свайпов" in SPEC.md).
// The direction mirrors the option's position on the exam screen: top is up, bottom is down.

export type Dir = 'up' | 'down' | 'left' | 'right';

const LAYOUTS: Record<number, Dir[]> = {
  2: ['up', 'down'],
  3: ['up', 'left', 'down'],
  4: ['up', 'left', 'right', 'down'],
};

/** Direction for each option in display order, or null when swipes are off (5 options). */
export function optionDirs(count: number): Dir[] | null {
  if (!Number.isInteger(count) || count < 2) throw new Error(`bad option count: ${count}`);
  return LAYOUTS[count] ?? null;
}

/** Option index answered by a swipe in `dir`, or null when nothing sits there. */
export function optionForDir(count: number, dir: Dir): number | null {
  const i = optionDirs(count)?.indexOf(dir) ?? -1;
  return i >= 0 ? i : null;
}

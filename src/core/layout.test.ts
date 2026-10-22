import { describe, expect, it } from 'vitest';
import { optionDirs, optionForDir } from './layout';

describe('optionDirs', () => {
  it('follows the layout table', () => {
    expect(optionDirs(2)).toEqual(['up', 'down']);
    expect(optionDirs(3)).toEqual(['up', 'left', 'down']);
    expect(optionDirs(4)).toEqual(['up', 'left', 'right', 'down']);
  });

  it('turns swipes off for 5 options', () => {
    expect(optionDirs(5)).toBeNull();
  });

  it('rejects fewer than 2 options', () => {
    expect(() => optionDirs(1)).toThrow(/option count/);
  });
});

describe('optionForDir', () => {
  it('maps up to the first and down to the last option', () => {
    for (const n of [2, 3, 4]) {
      expect(optionForDir(n, 'up')).toBe(0);
      expect(optionForDir(n, 'down')).toBe(n - 1);
    }
  });

  it('maps left to the second and right to the third option', () => {
    expect(optionForDir(3, 'left')).toBe(1);
    expect(optionForDir(4, 'left')).toBe(1);
    expect(optionForDir(4, 'right')).toBe(2);
  });

  it('returns null where no option sits', () => {
    expect(optionForDir(2, 'left')).toBeNull();
    expect(optionForDir(2, 'right')).toBeNull();
    expect(optionForDir(3, 'right')).toBeNull();
    expect(optionForDir(5, 'up')).toBeNull();
  });
});

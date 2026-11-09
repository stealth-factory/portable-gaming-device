import { describe, expect, it } from 'vitest';
import { menuRows } from '../../src/console/menu-layout';

const footer = (n: number, lh: number) => {
  const { rowH, gap, top } = menuRows(n, lh);
  return { rowH, gap, top, bottom: top + 88 + n * (rowH + gap) };
};

describe('disk menu rows', () => {
  it('keeps four disks on a short tube at the old row size', () => {
    expect(menuRows(4, 188)).toMatchObject({ rowH: 18, gap: 3 });
  });

  it('fits five disks on the shortest landscape tube', () => {
    const frame = footer(5, 188);
    expect(frame.bottom).toBeLessThanOrEqual(187);
    expect(frame.rowH).toBeGreaterThanOrEqual(12);
    expect(frame.top).toBeGreaterThanOrEqual(4);
  });

  it('fits six disks on the shortest landscape tube', () => {
    const frame = footer(6, 188);
    expect(frame.bottom).toBeLessThanOrEqual(187);
    expect(frame.rowH).toBeGreaterThanOrEqual(12);
    expect(frame.top).toBeGreaterThanOrEqual(4);
  });

  it('still gives a tall tube its second line', () => {
    expect(menuRows(5, 356).rowH).toBeGreaterThanOrEqual(30);
  });
});

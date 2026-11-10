import { describe, it, expect } from 'vitest';
import { launcherLayout, pickTier, MIN_TAP, LINE, type Layout, type Rect } from '../../src/console/launcher/layout';

/* every tube the console deals (src/console/core.ts targetGrid): sideways 15 or 17 cells by 7 to 14 rows,
   upright 10, 11 or 13 cells by 9 to 22 rows; 24 px cells under a 20 px status bar */
const tube = (w: number, h: number) => [w * 24, h * 24 + 20] as const;
const NAMED: Record<string, readonly [number, number]> = {
  desk: tube(15, 10), console: tube(17, 14), 'short console': tube(17, 8), 'phone landscape': tube(15, 7),
  'phone portrait': tube(10, 22), 'small phone portrait': tube(10, 9), 'tablet portrait': tube(13, 22), 'tablet landscape': tube(17, 12),
};
const ALL: [number, number][] = [];
for (const w of [15, 17]) for (let h = 7; h <= 14; h++) ALL.push(tube(w, h) as [number, number]);
for (const w of [10, 11, 13]) for (let h = 9; h <= 22; h++) ALL.push(tube(w, h) as [number, number]);

const inside = (r: Rect, LW: number, LH: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= LW && r.y + r.h <= LH;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/* the horizontal bands down the tube, in order: header, front cover, label, details, ticks, counter line */
const bands = (L: Layout) => [
  { name: 'header', y0: L.header.y, y1: L.header.ruleY + 1 },
  { name: 'cover', y0: L.front.y - 1, y1: L.front.y + L.front.h + 1 },
  { name: 'label', y0: L.label.y, y1: L.label.y + 20 },
  { name: 'details', y0: L.details.y, y1: L.details.y + L.details.lines.length * LINE },
  { name: 'ticks', y0: L.ticks.y - 2, y1: L.ticks.y + L.ticks.h },
  { name: 'counter', y0: L.counter.y, y1: L.counter.y + 8 },
];

describe('launcher tiers', () => {
  it('picks wide, portrait and short as the design spec says', () => {
    expect(pickTier(...NAMED.desk)).toBe('wide');
    expect(pickTier(...NAMED.console)).toBe('wide');
    expect(pickTier(...NAMED['tablet landscape'])).toBe('wide');
    expect(pickTier(...NAMED['phone portrait'])).toBe('portrait');
    expect(pickTier(...NAMED['small phone portrait'])).toBe('portrait');
    expect(pickTier(...NAMED['phone landscape'])).toBe('short');
    expect(pickTier(...NAMED['short console'])).toBe('short');
  });
  it('wide tubes show two neighbours a side, upright and short ones one', () => {
    expect(launcherLayout(...NAMED.desk, 5, 2).cards.length).toBe(5);
    expect(launcherLayout(...NAMED['phone portrait'], 5, 2).cards.length).toBe(3);
    expect(launcherLayout(...NAMED['phone landscape'], 5, 2).cards.length).toBe(3);
  });
});

describe.each([1, 2, 5, 9, 20])('launcher layout with %i disks', n => {
  it.each(ALL)('fits a %i × %i tube', (LW, LH) => {
    for (const sel of [0, n - 1, Math.floor(n / 2)]) {
      const L = launcherLayout(LW, LH, n, sel);
      // the front cover, label, details, ticks and counter all sit on the glass, in order, without overlapping
      expect(inside(L.front, LW, LH)).toBe(true);
      const B = bands(L);
      for (const b of B) { expect(b.y0, b.name).toBeGreaterThanOrEqual(0); expect(b.y1, b.name).toBeLessThanOrEqual(LH); }
      for (let k = 1; k < B.length; k++) expect(B[k].y0, `${B[k - 1].name} / ${B[k].name}`).toBeGreaterThanOrEqual(B[k - 1].y1);
      // covers keep their shape: 4:3, or 3:4 upright
      const ar = L.front.w / L.front.h;
      expect(Math.abs(ar - (L.portraitCovers ? 3 / 4 : 4 / 3))).toBeLessThan(0.05);
      // each disk shows once; neighbours don't cover the front
      const ids = L.cards.map(c => c.i);
      expect(new Set(ids).size).toBe(ids.length);
      expect(L.cards[L.cards.length - 1]).toBe(L.front);
      for (const c of L.cards) if (c !== L.front) expect(overlap(c, L.front)).toBe(false);
      // ticks: the front disk's tick is in the strip, all ticks on the glass
      expect(L.ticks.items.some(t => t.i === sel)).toBe(true);
      for (const t of L.ticks.items) expect(inside(t, LW, LH)).toBe(true);
      for (let k = 1; k < L.ticks.items.length; k++) expect(L.ticks.items[k].x).toBeGreaterThanOrEqual(L.ticks.items[k - 1].x + L.ticks.items[k - 1].w);
      // every tap target is on the glass and at least 12 low-res px each way
      for (const q of L.targets) {
        expect(inside(q, LW, LH), JSON.stringify(q)).toBe(true);
        expect(q.w).toBeGreaterThanOrEqual(MIN_TAP); expect(q.h).toBeGreaterThanOrEqual(MIN_TAP);
      }
      // the front cover is a target; every disk on screen can be reached by a tap
      expect(L.targets.some(q => q.kind === 'front' && q.i === sel)).toBe(true);
    }
  });
});

describe('a big box', () => {
  it('shows a window of ticks round the front disk, with ends that step', () => {
    const L = launcherLayout(...NAMED['phone portrait'], 20, 15);
    expect(L.ticks.items.length).toBeLessThan(20);
    expect(L.ticks.items.some(t => t.i === 15)).toBe(true);
    expect(L.ticks.before || L.ticks.after).toBe(true);
  });
  it('shows every tick when they fit', () => {
    const L = launcherLayout(...NAMED.desk, 9, 0);
    expect(L.ticks.items.map(t => t.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(L.ticks.before || L.ticks.after).toBe(false);
  });
});

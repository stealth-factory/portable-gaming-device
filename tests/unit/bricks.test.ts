import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BEND_PX, DROP_CHANCE, EMBER, FAST_MUL, NARROW_MUL, SEAR_HITS, SLOW_MUL, WIDE_MUL,
  applyCatch, applySear, baseSpeed, batSigned, batTopAt, batWidth, batWidthWith, bendIntent,
  breakableCount, brickReleasesDrop, buildWall, clampTravel, columnCount, easeBend, emptyFraction,
  fittedRows, loseEmberMods, pacedSpeed, pickDrop, quotas, resolveBat, resolveBrick, rowCountForHeight,
  travelDegrees, velocityFromSigned, wallCleared, waveSpeed,
} from '../../src/games/bricks/rules';
import type { Cell } from '../../src/games/bricks/rules';

const RAD = Math.PI / 180;

/** The console's generator, copied so these tests never import src/console. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const wall = (wave: number, cols: number, rows: number) => buildWall(wave, cols, rows, mulberry32(wave * 10007 + 17));

function count(cells: readonly Cell[]) {
  const tally = { empty: 0, clay: 0, kiln: 0, glass: 0, cinder: 0, anvil: 0 };
  for (const c of cells) {
    if (!c) tally.empty += 1;
    else tally[c.kind] += 1;
  }
  return tally;
}

function orthogonal(cols: number, a: number, b: number) {
  const ar = Math.floor(a / cols), ac = a % cols;
  const br = Math.floor(b / cols), bc = b % cols;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

describe('serve angle and the travel clamp', () => {
  it('serves from the middle at 18° toward the last direction', () => {
    expect(batSigned(50, 50, 72, 0, 1)).toBe(18);
    expect(batSigned(50, 50, 72, 0, -1)).toBe(-18);
    const v = velocityFromSigned(18, 130);
    expect(v.vx).toBeGreaterThan(0);
    expect(v.vy).toBeLessThan(0);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(130, 5);
  });

  it('snaps a shallow bat angle out to 18° and keeps a wide one', () => {
    expect(batSigned(50, 50, 72, 1, 1)).toBe(18);
    const edge = batSigned(86, 50, 72, 1, 1);
    expect(edge).toBeGreaterThan(18);
    expect(edge).toBeLessThanOrEqual(72);
  });

  it('pulls a horizontal skim and a vertical drill into 12°–72° without changing the speed', () => {
    const flat = clampTravel(100, 0);
    expect(Math.abs(travelDegrees(flat.vx, flat.vy))).toBeGreaterThanOrEqual(12);
    expect(Math.abs(travelDegrees(flat.vx, flat.vy))).toBeLessThanOrEqual(72);
    expect(Math.hypot(flat.vx, flat.vy)).toBeCloseTo(100, 5);
    expect(flat.vy).toBeGreaterThan(0);

    const drill = clampTravel(0, -100);
    expect(travelDegrees(drill.vx, drill.vy)).toBeCloseTo(12, 5);
    expect(drill.vy).toBeLessThan(0);
    expect(Math.hypot(drill.vx, drill.vy)).toBeCloseTo(100, 5);

    const mid = clampTravel(Math.sin(40 * RAD) * 80, -Math.cos(40 * RAD) * 80);
    expect(travelDegrees(mid.vx, mid.vy)).toBeCloseTo(40, 4);
    expect(Math.hypot(mid.vx, mid.vy)).toBeCloseTo(80, 4);
  });
});

describe('the bat', () => {
  const bat = { x: 100, y: 200, w: 56 };

  it('sends an ember coming down onto the top back up', () => {
    const hit = resolveBat({ x: 120, y: 198, vx: 0, vy: 50 }, bat, 0, 1, 130);
    expect(hit.kind).toBe('bounce');
    if (hit.kind !== 'bounce') return;
    expect(hit.vy).toBeLessThan(0);
    expect(hit.y).toBe(bat.y - 6);
  });

  it('pushes an ember whose centre is below the bat out of the nearest end and does not send it up', () => {
    const hit = resolveBat({ x: 120, y: 204, vx: 30, vy: 40 }, bat, 1, 1, 130);
    expect(hit.kind).toBe('deflect');
    if (hit.kind !== 'deflect') return;
    expect(hit.vx).toBe(-30);
    expect(hit.vy).toBe(40);
    expect(hit.x).toBe(bat.x - EMBER);
  });
});

describe('brick hits', () => {
  it('lets glass break without changing the velocity', () => {
    const hit = resolveBrick([{ kind: 'glass', hits: 0 }], 1, 0, 40, -30, 'top');
    expect(hit.cell).toBeNull();
    expect(hit.bounced).toBe(false);
    expect(hit.points).toBe(20);
    expect(hit.vx).toBe(40);
    expect(hit.vy).toBe(-30);
    expect(hit.clay).toBe(-1);
  });

  it('cracks a kiln, then shatters it', () => {
    const cells: Cell[] = [{ kind: 'kiln', hits: 0 }];
    const crack = resolveBrick(cells, 1, 0, 10, 40, 'top');
    expect(crack.cell).toEqual({ kind: 'kiln', hits: 1 });
    expect(crack.points).toBe(20);
    expect(crack.bounced).toBe(true);
    expect(crack.vy).toBeLessThan(0);
    cells[0] = crack.cell;
    const shatter = resolveBrick(cells, 1, 0, 10, 40, 'top');
    expect(shatter.cell).toBeNull();
    expect(shatter.points).toBe(50);
  });

  it('keeps an anvil and scores nothing', () => {
    const cells: Cell[] = [{ kind: 'anvil', hits: 0 }];
    const hit = resolveBrick(cells, 1, 0, 40, -10, 'left');
    expect(hit.cell?.kind).toBe('anvil');
    expect(hit.points).toBe(0);
    expect(hit.bounced).toBe(true);
    expect(hit.vx).toBeLessThan(0);
    expect(hit.vy).toBeLessThan(0);
  });

  it('takes one clay on the side the ember came from, and never a kiln or another cinder', () => {
    const cells: Cell[] = [
      { kind: 'clay', hits: 0 }, { kind: 'cinder', hits: 0 }, { kind: 'clay', hits: 0 },
      { kind: 'kiln', hits: 0 }, { kind: 'cinder', hits: 0 }, { kind: 'glass', hits: 0 },
    ];
    const fromLeft = resolveBrick(cells, 3, 1, 20, -5, 'left');
    expect(fromLeft.cell).toBeNull();
    expect(fromLeft.points).toBe(30);
    expect(fromLeft.clay).toBe(0);
    const fromRight = resolveBrick(cells, 3, 1, -20, -5, 'right');
    expect(fromRight.clay).toBe(2);
    const blocked = resolveBrick(cells, 3, 4, 20, 5, 'left');
    expect(blocked.clay).toBe(-1);
    expect(blocked.points).toBe(30);
  });
});

describe('walls', () => {
  it('builds wave 1 from clay and empty slots only', () => {
    const cols = 10, rows = 6;
    const cells = wall(1, cols, rows);
    const tally = count(cells);
    expect(tally.kiln + tally.glass + tally.cinder + tally.anvil).toBe(0);
    expect(tally.empty).toBe(Math.round(cols * rows * emptyFraction(1)));
    expect(tally.clay + tally.empty).toBe(cols * rows);
    expect(wallCleared(cells)).toBe(false);
  });

  it('keeps later waves inside the quotas and the neighbourhood rules', () => {
    for (const [cols, rows] of [[10, 4], [12, 6], [16, 8]] as const) {
      for (let wave = 1; wave <= 12; wave++) {
        const cells = wall(wave, cols, rows);
        const tally = count(cells);
        const q = quotas(wave, cols, rows);
        expect(tally.empty).toBe(q.empty);
        expect(tally.kiln).toBeLessThanOrEqual(q.kiln);
        expect(tally.glass).toBeLessThanOrEqual(q.glass);
        expect(tally.cinder).toBeLessThanOrEqual(q.cinder);
        expect(tally.anvil).toBeLessThanOrEqual(q.anvil);
        expect(tally.clay + tally.kiln + tally.glass + tally.cinder + tally.anvil + tally.empty).toBe(cols * rows);
        const cinders: number[] = [], anvils: number[] = [];
        cells.forEach((c, i) => {
          if (c?.kind === 'cinder') cinders.push(i);
          if (c?.kind === 'anvil') anvils.push(i);
        });
        for (const i of anvils) expect(Math.floor(i / cols)).toBeLessThan(rows - 2);
        for (let a = 0; a < cinders.length; a++) for (let b = a + 1; b < cinders.length; b++) {
          expect(orthogonal(cols, cinders[a]!, cinders[b]!)).toBe(false);
        }
        for (let a = 0; a < anvils.length; a++) for (let b = a + 1; b < anvils.length; b++) {
          expect(orthogonal(cols, anvils[a]!, anvils[b]!)).toBe(false);
        }
      }
    }
  });

  it('actually places the later brick types once their wave arrives', () => {
    const tally = count(wall(6, 12, 6));
    expect(tally.kiln).toBeGreaterThan(0);
    expect(tally.glass).toBeGreaterThan(0);
    expect(tally.cinder).toBeGreaterThan(0);
    expect(tally.anvil).toBeGreaterThan(0);
  });

  it('is clear only when the breakable bricks are gone', () => {
    const anvils: Cell[] = [{ kind: 'anvil', hits: 0 }, null];
    expect(wallCleared(anvils)).toBe(true);
    expect(breakableCount(anvils)).toBe(0);
    expect(wallCleared([{ kind: 'clay', hits: 0 }, { kind: 'anvil', hits: 0 }])).toBe(false);
    expect(wallCleared([{ kind: 'kiln', hits: 1 }])).toBe(false);
  });
});

describe('the court', () => {
  it('picks columns, rows and the bat from the tube', () => {
    expect(columnCount(248)).toBe(10);
    expect(columnCount(408)).toBe(16);
    expect(rowCountForHeight(8)).toBe(4);
    expect(rowCountForHeight(12)).toBe(6);
    expect(rowCountForHeight(13)).toBe(8);
    expect(fittedRows(13, 100, 20)).toBe(3);
    expect(batWidth(360, 1)).toBe(72);
    expect(batWidth(264, 1)).toBe(56);
    expect(batWidth(200, 1)).toBe(48);
    expect(batWidth(360, 5)).toBe(64);
    expect(batWidth(360, 9)).toBe(56);
    expect(batWidth(200, 9)).toBe(40);
  });

  it('thins the speed below 75, 50 and 25 percent and caps it', () => {
    expect(baseSpeed(1)).toBe(130);
    expect(baseSpeed(20)).toBe(220);
    expect(waveSpeed(1, 75, 100)).toBe(130);
    expect(waveSpeed(1, 74, 100)).toBeCloseTo(130 * 1.04, 5);
    expect(waveSpeed(1, 49, 100)).toBeCloseTo(130 * 1.08, 5);
    expect(waveSpeed(1, 24, 100)).toBeCloseTo(130 * 1.12, 5);
    expect(waveSpeed(30, 10, 100)).toBe(220);
  });
});

describe('the bow', () => {
  it('leaves a flat bat on the old angles', () => {
    expect(batSigned(50, 50, 72, 0, 1, 0)).toBe(18);
    expect(batSigned(86, 50, 72, 0, 1)).toBe(batSigned(86, 50, 72, 0, 1, 0));
  });

  it('steers off the slope of the curve, and a centre hit stays put', () => {
    const flat = batSigned(86, 50, 72, 0, 1, 0);
    const hill = batSigned(86, 50, 72, 0, 1, BEND_PX);
    const valley = batSigned(86, 50, 72, 0, 1, -BEND_PX);
    expect(hill).toBeGreaterThan(flat);
    expect(valley).toBeLessThan(flat);
    expect(hill).toBeLessThanOrEqual(72);
    expect(batSigned(50, 50, 72, 0, 1, BEND_PX)).toBe(18);
    expect(batSigned(50, 50, 72, 0, -1, -BEND_PX)).toBe(-18);
  });

  it('lifts only the middle', () => {
    expect(batTopAt(200, 0, BEND_PX)).toBe(200 - BEND_PX);
    expect(batTopAt(200, 1, BEND_PX)).toBe(200);
    expect(batTopAt(200, -1, -BEND_PX)).toBe(200);
    expect(batTopAt(200, 0, -BEND_PX)).toBe(200 + BEND_PX);
  });

  it('reads up and down from the stick or the keys, and eases back instead of snapping', () => {
    expect(bendIntent('up', [])).toBe(1);
    expect(bendIntent('down', [])).toBe(-1);
    expect(bendIntent('left', [])).toBe(0);
    expect(bendIntent('right', ['up'])).toBe(1);
    expect(bendIntent('down', ['up'])).toBe(-1);
    expect(bendIntent(null, ['left', 'down'])).toBe(-1);
    expect(bendIntent(null, [])).toBe(0);
    const step = easeBend(1, 0, 1 / 60);
    expect(step).toBeLessThan(1);
    expect(step).toBeGreaterThan(0.5);
    let bend = 1;
    for (let i = 0; i < 90; i++) bend = easeBend(bend, 0, 1 / 60);
    expect(bend).toBe(0);
  });

  it('still catches an ember on the raised middle', () => {
    const bat = { x: 100, y: 200, w: 72 };
    const flat = resolveBat({ x: 134, y: 193, vx: 0, vy: 40 }, bat, 0, 1, 130, 0);
    const raised = resolveBat({ x: 134, y: 193, vx: 0, vy: 40 }, bat, 0, 1, 130, BEND_PX);
    expect(flat.kind).toBe('miss');
    expect(raised.kind).toBe('bounce');
    if (raised.kind !== 'bounce') return;
    expect(raised.y).toBe(bat.y - BEND_PX - 6);
  });
});

describe('falling capsules', () => {
  it('releases one from a broken brick, and never from an anvil or a crack', () => {
    for (const kind of ['clay', 'kiln', 'glass', 'cinder'] as const) {
      expect(brickReleasesDrop(kind, true, 0)).toBe(true);
      expect(brickReleasesDrop(kind, true, DROP_CHANCE)).toBe(false);
      expect(brickReleasesDrop(kind, false, 0)).toBe(false);
    }
    expect(brickReleasesDrop('anvil', true, 0)).toBe(false);
    expect(brickReleasesDrop('clay', true, 0, 4)).toBe(false);
    expect(pickDrop(0)).toBe('broad');
    expect(pickDrop(0.99)).toBe('sear');
  });

  it('replaces size with size and speed with speed, and clears both when the ember is missed', () => {
    let got = applyCatch(null, null, 0, 'broad');
    expect(got.size).toBe('broad');
    expect(batWidthWith(72, got.size)).toBe(Math.round(72 * WIDE_MUL));
    got = applyCatch(got.size, got.pace, got.sear, 'slim');
    expect(got.size).toBe('slim');
    expect(batWidthWith(72, got.size)).toBe(Math.round(72 * NARROW_MUL));
    got = applyCatch(got.size, got.pace, got.sear, 'flare');
    expect(got).toMatchObject({ size: 'slim', pace: 'flare' });
    expect(pacedSpeed(130, got.pace)).toBeCloseTo(130 * FAST_MUL, 5);
    got = applyCatch(got.size, got.pace, got.sear, 'damp');
    expect(got.pace).toBe('damp');
    expect(pacedSpeed(130, got.pace)).toBeCloseTo(130 * SLOW_MUL, 5);
    got = applyCatch(got.size, got.pace, got.sear, 'sear');
    expect(got.sear).toBe(SEAR_HITS);
    expect(got.size).toBe('slim');
    expect(loseEmberMods(got.size, got.pace, got.sear)).toEqual({ size: null, pace: null, sear: SEAR_HITS });
  });

  it('spends a Sear charge when the ember leaves, and not on an anvil, glass or a kiln crack', () => {
    const clay = resolveBrick([{ kind: 'clay', hits: 0 }], 1, 0, 10, 40, 'top');
    const through = applySear('clay', clay.cell == null, 3, { vx: 10, vy: 40 }, clay);
    expect(through.bounced).toBe(false);
    expect(through.vx).toBe(10);
    expect(through.vy).toBe(40);
    expect(through.charges).toBe(2);

    const crack = resolveBrick([{ kind: 'kiln', hits: 0 }], 1, 0, 10, 40, 'top');
    const stay = applySear('kiln', crack.cell == null, 2, { vx: 10, vy: 40 }, crack);
    expect(crack.cell).toEqual({ kind: 'kiln', hits: 1 });
    expect(stay.bounced).toBe(false);
    expect(stay.charges).toBe(2);

    const anvil = resolveBrick([{ kind: 'anvil', hits: 0 }], 1, 0, 10, 40, 'top');
    const bounced = applySear('anvil', false, 3, { vx: 10, vy: 40 }, anvil);
    expect(bounced.bounced).toBe(true);
    expect(bounced.charges).toBe(3);
    expect(bounced.vy).toBeLessThan(0);

    const glass = resolveBrick([{ kind: 'glass', hits: 0 }], 1, 0, 40, -30, 'top');
    const pane = applySear('glass', true, 3, { vx: 40, vy: -30 }, glass);
    expect(pane.bounced).toBe(false);
    expect(pane.charges).toBe(3);
    expect(pane.vx).toBe(40);
    expect(pane.vy).toBe(-30);

    const plain = applySear('clay', true, 0, { vx: 10, vy: 40 }, clay);
    expect(plain.bounced).toBe(true);
    expect(plain.charges).toBe(0);
  });
});

describe('the disk stays off the kit and the console', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../src/games/bricks');
  it('disk.ts draws the loader itself', () => {
    const src = readFileSync(join(root, 'disk.ts'), 'utf8');
    expect(src).not.toMatch(/kit\/play/);
    expect(src).not.toMatch(/console\//);
  });
});

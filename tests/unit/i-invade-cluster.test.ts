import { describe, expect, it } from 'vitest';
import { advanceSweep, earthFacing } from '../../src/games/i-invade/cluster';
import type { SweepDir } from '../../src/games/i-invade/cluster';

describe('cluster sweep', () => {
  it('picks the earth-facing alien in each column and orders them left to right', () => {
    const aliens = [
      { c: 1, r: 2, alive: true },
      { c: 0, r: 1, alive: true },
      { c: 0, r: 0, alive: false },
      { c: 0, r: 3, alive: true },
      { c: 2, r: 0, alive: true },
      { c: 1, r: 0, alive: true },
      { c: 3, r: 4, alive: false },
    ];
    expect(earthFacing(aliens).map(a => [a.c, a.r])).toEqual([[0, 1], [1, 0], [2, 0]]);
  });

  it('sweeps left to right, then right to left, without firing an end twice', () => {
    const seq: number[] = [];
    let i = 0;
    let dir: SweepDir = 1;
    for (let n = 0; n < 10; n++) {
      seq.push(i);
      ({ i, dir } = advanceSweep(i, dir, 4));
    }
    expect(seq).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2, 3]);
  });

  it('keeps firing the only column that still has an alien', () => {
    let i = 3;
    let dir: SweepDir = 1;
    const seq: number[] = [];
    for (let n = 0; n < 3; n++) {
      ({ i, dir } = advanceSweep(i, dir, 1));
      seq.push(i);
    }
    expect(seq).toEqual([0, 0, 0]);
    expect(dir).toBe(1);
  });
});

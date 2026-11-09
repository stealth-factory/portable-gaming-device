import { describe, expect, it } from 'vitest';
import { earthFacing, nextSweep } from '../../src/games/i-invade/cluster';
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

  function march(columnsAt: (shot: number) => number[]) {
    const seq: number[] = [];
    let last = -1;
    let dir: SweepDir = 1;
    for (let n = 0; ; n++) {
      const columns = columnsAt(n);
      if (!columns.length) break;
      const step = nextSweep(columns, last, dir);
      seq.push(step.c);
      last = step.c;
      dir = step.dir;
      if (n > 20) break;
    }
    return { seq, dir };
  }

  it('sweeps left to right, then right to left, without firing an end twice', () => {
    const { seq } = march(() => [0, 1, 2, 3]);
    expect(seq.slice(0, 10)).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2, 3]);
  });

  it('keeps firing the only column that still has an alien', () => {
    const { seq, dir } = march(n => (n < 3 ? [0] : []));
    expect(seq).toEqual([0, 0, 0]);
    expect(dir).toBe(1);
  });

  it('does not skip the next column when the one just fired dies', () => {
    // columns 0, 1, 2, 3. After 0 fires it is gone. An index of 1 into [1, 2, 3] would be column 2.
    const { seq } = march(n => (n === 0 ? [0, 1, 2, 3] : [1, 2, 3]));
    expect(seq.slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it('does not fire the right-hand end again when a column on the left dies', () => {
    // fire 0, 1, 2, 3. The old next index is 2. Column 0 then dies, so [1, 2, 3][2] is column 3 again.
    const seq: number[] = [];
    let last = -1;
    let dir: SweepDir = 1;
    for (let n = 0; n < 6; n++) {
      const step = nextSweep(n < 4 ? [0, 1, 2, 3] : [1, 2, 3], last, dir);
      seq.push(step.c);
      last = step.c;
      dir = step.dir;
    }
    expect(seq).toEqual([0, 1, 2, 3, 2, 1]);
    expect(dir).toBe(-1);
  });
});

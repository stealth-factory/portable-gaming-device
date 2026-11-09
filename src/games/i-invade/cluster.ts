/* Cluster's sweep, with no drawing and no console.
   The earth-facing alien in a column is the one on the lowest row index still alive: row 0 is the front,
   nearest the planet. After damage that alien can sit on a different row in each column.
   Shots go left to right across that line, then right to left, turning at each end instead of firing it twice. */

export type FormationAlien = { c: number; r: number; alive: boolean };
export type SweepDir = 1 | -1;

/** Earth-facing alien of each living column, left to right. */
export function earthFacing<T extends FormationAlien>(aliens: readonly T[]): T[] {
  const by = new Map<number, T>();
  for (const a of aliens) {
    if (!a.alive) continue;
    const prev = by.get(a.c);
    if (!prev || a.r < prev.r) by.set(a.c, a);
  }
  return [...by.values()].sort((a, b) => a.c - b.c);
}

/** The next column index after firing `i` of `n` earth-facing aliens. */
export function advanceSweep(i: number, dir: SweepDir, n: number): { i: number; dir: SweepDir } {
  if (n <= 1) return { i: 0, dir: 1 };
  const next = i + dir;
  if (next < 0 || next >= n) {
    const flipped: SweepDir = dir === 1 ? -1 : 1;
    return { i: Math.max(0, Math.min(n - 1, i + flipped)), dir: flipped };
  }
  return { i: next, dir };
}

/* Cluster's sweep, with no drawing and no console.
   The earth-facing alien in a column is the one on the lowest row index still alive: row 0 is the front,
   nearest the planet. After damage that alien can sit on a different row in each column.
   Shots go left to right across the living columns, then right to left. The sweep remembers the last
   column it fired and the direction, not a place in the list, so a column that vanishes is skipped
   and an end is not fired twice. */

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

/** The next living column after `last` (-1 before the first shot), travelling `dir`. */
export function nextSweep(columns: readonly number[], last: number, dir: SweepDir): { c: number; dir: SweepDir } {
  const cols = [...new Set(columns)].sort((a, b) => a - b);
  if (cols.length === 0) return { c: last, dir };
  if (cols.length === 1) return { c: cols[0], dir: 1 };
  const forward = (way: SweepDir) => way === 1 ? cols.find(c => c > last) : [...cols].reverse().find(c => c < last);
  const ahead = forward(dir);
  if (ahead !== undefined) return { c: ahead, dir };
  const flipped: SweepDir = dir === 1 ? -1 : 1;
  const back = forward(flipped);
  return { c: back ?? cols[0], dir: back !== undefined ? flipped : dir };
}

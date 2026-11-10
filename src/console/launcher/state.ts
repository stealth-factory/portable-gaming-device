/* The carousel's state and its rules, pure: (state, input, dt) → state. No drawing, no sound, no DOM. */
import type { Dir } from '../../games/types';

/** Held stick: the first repeat after 0.4 s, then every 0.18 s (as the old list). */
export const REPEAT_FIRST = 0.4, REPEAT_NEXT = 0.18;
/** Seconds on one disk before its cover gives way to the preview. */
export const PREVIEW_AFTER = 0.8;

export interface LauncherState {
  /** How many disks are in the box, and which is at the front. */
  n: number;
  sel: number;
  /** Seconds since this disk came to the front (the preview clock). */
  t: number;
  /** Seconds since the launcher opened (the cursor's blink). */
  clock: number;
  /** The stick direction last seen, and the time to its next repeat. */
  dir: Dir | null;
  rep: number;
}

/** A fresh launcher, open at `sel` (the last disk played), wrapped into the box. */
export function initState(n: number, sel = 0): LauncherState {
  n = Math.max(0, n | 0);
  return { n, sel: n ? ((sel % n) + n) % n : 0, t: 0, clock: 0, dir: null, rep: 0 };
}

/** One step back (-1) or on (+1) through the box, wrapping round. The preview clock restarts. */
export function move(s: LauncherState, by: number): LauncherState {
  if (s.n < 2 || !by) return s;
  return { ...s, sel: (((s.sel + by) % s.n) + s.n) % s.n, t: 0 };
}

/** Bring a disk to the front by index. */
export function bringToFront(s: LauncherState, i: number): LauncherState {
  if (i < 0 || i >= s.n || i === s.sel) return s;
  return { ...s, sel: i, t: 0 };
}

/** Up and left go back, down and right go on. */
export const stepOf = (d: Dir) => (d === 'down' || d === 'right' ? 1 : -1);

/** Advance the clocks and apply a held stick. `moves` is how many moves happened this step (0 or 1), for the tick. */
export function update(s: LauncherState, stick: Dir | null, dt: number): { state: LauncherState; moves: number } {
  let next: LauncherState = { ...s, t: s.t + dt, clock: s.clock + dt, rep: s.rep - dt };
  let moves = 0;
  if (stick !== s.dir) {
    next.dir = stick;
    if (stick) { next = { ...move(next, stepOf(stick)), rep: REPEAT_FIRST }; moves = next.sel !== s.sel ? 1 : 0; }
  } else if (stick && next.rep <= 0) {
    next = { ...move(next, stepOf(stick)), rep: REPEAT_NEXT }; moves = next.sel !== s.sel ? 1 : 0;
  }
  return { state: next, moves };
}

/** Whether the front disk shows its preview now. Never with reduced motion. */
export const previewing = (s: LauncherState, reducedMotion: boolean) => !reducedMotion && s.t >= PREVIEW_AFTER;
/** Seconds into the front disk's preview (0 before it starts). */
export const previewT = (s: LauncherState) => Math.max(0, s.t - PREVIEW_AFTER);
/** The prompt's cursor: blinking, or steady with reduced motion. */
export const cursorOn = (s: LauncherState, reducedMotion: boolean) => reducedMotion || Math.floor(s.clock * 3) % 2 === 0;

/** Something on the tube a tap can hit. */
export type Target =
  | { kind: 'front'; i: number; x: number; y: number; w: number; h: number }
  | { kind: 'cover'; i: number; x: number; y: number; w: number; h: number }
  | { kind: 'tick'; i: number; x: number; y: number; w: number; h: number }
  | { kind: 'arrow'; by: -1 | 1; x: number; y: number; w: number; h: number };

/** What a tap does: load the front disk, bring another to the front, or nothing. */
export type TapResult = { kind: 'load'; i: number } | { kind: 'front'; i: number } | null;

/** A tap at x, y. The front cover (or the front disk's own tick) loads; a side cover or a tick brings that disk to
    the front, so a second tap loads it; an arrow steps one disk. The first target listed wins where two overlap. */
export function tap(s: LauncherState, targets: Target[], x: number, y: number): TapResult {
  const hit = targets.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  if (!hit || !s.n) return null;
  if (hit.kind === 'arrow') return { kind: 'front', i: move(s, hit.by).sel };
  if (hit.kind === 'front' || hit.i === s.sel) return { kind: 'load', i: hit.i };
  return { kind: 'front', i: hit.i };
}

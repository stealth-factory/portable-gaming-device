/* Collision helpers on boxes and points, in low-res screen pixels. */
import type { Box } from './types';

/** Do two boxes overlap (touching edges don't count)? */
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Is a point inside a box (left and top edges in, right and bottom out)? */
export const pointIn = (x: number, y: number, b: Box) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
/** Is any part of a box within `r` of (cx, cy)? Invader Force's blast test. */
export function boxInCircle(cx: number, cy: number, r: number, b: Box){
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 <= r * r;
}
/** Move something fast in steps of at most `step` px so it can't skip over a thin target; stop at the
    first point where `hit` says yes. Returns where it ended and whether it hit. */
export function sweep(from: { x: number; y: number }, dx: number, dy: number, step: number,
  hit: (x: number, y: number) => boolean): { x: number; y: number; hit: boolean } {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(step, 1e-6)));
  for (let i = 1; i <= n; i++) {
    const x = from.x + dx * i / n, y = from.y + dy * i / n;
    if (hit(x, y)) return { x, y, hit: true };
  }
  return { x: from.x + dx, y: from.y + dy, hit: false };
}

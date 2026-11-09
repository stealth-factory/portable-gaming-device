/* Small number helpers every game writes for itself. */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** A random number from a up to b, as every game writes it. */
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** A random element of a non-empty list. */
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
/** True for the first half of each blink at `hz` blinks per second (`Math.floor(time * hz) % 2 === 0`). */
export const blink = (time: number, hz: number) => Math.floor(time * hz) % 2 === 0;

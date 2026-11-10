/* Martian Storm's rules, with no console and no drawing. The game applies whatever these functions return.
   Legs are generated from a seed. Nothing here is a stage table from another shooter. */

export const SKIFF_SPEED = 80;
export const SHOT_CAP = 6;
export const SHOT_COOLDOWN = 0.14;
export const TWIN_GAP = 8;
export const TUCK_SECS = 0.6;
export const TUCKS_START = 3;
export const TUCK_CAP = 5;
export const LEGS = 8;
export const LEG_CLOCK = 24;
export const SLAB_WAIT = 6;
export const SLAB_HITS = 4;
export const MAX_CRAFT = 12;
export const FLIGHT_TRIES = 20;
export const SPORE_GAP = 14;
export const TOKEN_PERIOD = 0.35;
export const CLEAR_SECS = 1.6;

export type Axis = 'up' | 'down' | 'left' | 'right';
export type TokenPhase = 'points' | 'tuck' | 'twin';
export type BeatKind = 'flight' | 'barb' | 'slab' | 'gap';
export type FlightShape = 'v' | 'file';

export interface FlightState { left: number; escaped: boolean }
export interface Beat { kind: BeatKind; t: number }

const PHASES: readonly TokenPhase[] = ['points', 'tuck', 'twin'];

/** Keyboard diagonals share one speed with a single axis. A stick direction wins, and it is only ever one axis. */
export function skiffVelocity(held: readonly Axis[], stick: Axis | null): { vx: number; vy: number } {
  if (stick) {
    const vx = stick === 'left' ? -SKIFF_SPEED : stick === 'right' ? SKIFF_SPEED : 0;
    const vy = stick === 'up' ? -SKIFF_SPEED : stick === 'down' ? SKIFF_SPEED : 0;
    return { vx, vy };
  }
  const horizontal = [...held].reverse().find(d => d === 'left' || d === 'right');
  const vertical = [...held].reverse().find(d => d === 'up' || d === 'down');
  let x = horizontal === 'left' ? -1 : horizontal === 'right' ? 1 : 0;
  let y = vertical === 'up' ? -1 : vertical === 'down' ? 1 : 0;
  if (x !== 0 && y !== 0) {
    const scale = 1 / Math.SQRT2;
    x *= scale;
    y *= scale;
  }
  return { vx: x * SKIFF_SPEED, vy: y * SKIFF_SPEED };
}

/** Keep the whole skiff inside the playfield. It does not wrap. */
export function clampSkiff(x: number, y: number, w: number, h: number, lw: number, lh: number, hud: number): { x: number; y: number } {
  return {
    x: Math.max(4, Math.min(lw - 4 - w, x)),
    y: Math.max(hud + 4, Math.min(lh - 4 - h, y)),
  };
}

/** The drawn body, inset so a graze on the outer pixel is not a hit. */
export function insetBox(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  return { x: x + 1, y: y + 1, w: Math.max(0, w - 2), h: Math.max(0, h - 2) };
}

/** Twin fires a pair or nothing, so the pair is never split by the cap of six. */
export function shotsThisPress(twin: boolean, inAir: number): 0 | 1 | 2 {
  if (twin) return inAir + 2 <= SHOT_CAP ? 2 : 0;
  return inAir < SHOT_CAP ? 1 : 0;
}

/** One tuck per press. At zero the press is still consumed, and nothing starts. */
export function spendTuck(tucks: number): { ok: boolean; tucks: number } {
  if (tucks <= 0) return { ok: false, tucks: 0 };
  return { ok: true, tucks: tucks - 1 };
}

/** True while a tuck that started at elapsed 0 is still up. It ends at 0.6 s. */
export function tuckCovers(elapsed: number): boolean {
  return elapsed >= 0 && elapsed < TUCK_SECS;
}

export function scrollSpeed(leg: number): number {
  return 20 + 3 * (leg - 1);
}

export function beatGap(leg: number): number {
  return Math.max(0.7, 1.6 - 0.1 * (leg - 1));
}

export function flightCount(leg: number): number {
  return 3 + leg;
}

export function barbCount(leg: number): number {
  return 1 + leg;
}

/** No slab on leg 1 or leg 2. From leg 3, one more each leg, holding at three. */
export function slabCount(leg: number): number {
  if (leg < 3) return 0;
  return Math.min(3, leg - 2);
}

export function pelletSpeed(leg: number): number {
  return 70 + 6 * (leg - 1);
}

/** 100 for each tuck still held, plus 80 for the leg, once, on the pad. */
export function landingBonus(tucks: number, leg: number): number {
  return 100 * tucks + 80 * leg;
}

/** A beat waits while the craft it would add would pass twelve on screen. */
export function beatFits(onScreen: number, incoming: number, max = MAX_CRAFT): boolean {
  return onScreen + incoming <= max;
}

function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** Content in a shuffled order, with empty gaps spread through it so the leg is not one block. */
export function buildBeats(leg: number, rng: () => number): BeatKind[] {
  const content: BeatKind[] = [];
  for (let i = 0; i < flightCount(leg); i++) content.push('flight');
  for (let i = 0; i < barbCount(leg); i++) content.push('barb');
  for (let i = 0; i < slabCount(leg); i++) content.push('slab');
  const shuffled = shuffle(content, rng);
  const slots = Math.max(shuffled.length, Math.floor(LEG_CLOCK / beatGap(leg)));
  const empties = slots - shuffled.length;
  if (empties <= 0) return shuffled;
  const gaps = shuffled.length + 1;
  const base = Math.floor(empties / gaps);
  let extra = empties % gaps;
  const out: BeatKind[] = [];
  for (let i = 0; i < gaps; i++) {
    const n = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    for (let k = 0; k < n; k++) out.push('gap');
    if (i < shuffled.length) out.push(shuffled[i]!);
  }
  return out;
}

/** Beat times from the start of play. Every time is inside the 24 s clock. */
export function beatSchedule(leg: number, rng: () => number): Beat[] {
  const gap = beatGap(leg);
  const out: Beat[] = [];
  buildBeats(leg, rng).forEach((kind, i) => {
    const t = i * gap;
    if (t < LEG_CLOCK) out.push({ kind, t });
  });
  return out;
}

/** Four spores. A file steps 14 px and drifts sideways. A shallow V shares one straight velocity. */
export function flightOffsets(shape: FlightShape, sign: -1 | 1): { x: number; y: number }[] {
  if (shape === 'file') return [0, 1, 2, 3].map(i => ({ x: -i * SPORE_GAP * sign, y: -i * SPORE_GAP }));
  if (shape === 'v') return [{ x: -21, y: 0 }, { x: -7, y: 5 }, { x: 7, y: 5 }, { x: 21, y: 0 }];
  const never: never = shape;
  return never;
}

/** One velocity for the whole flight: the dust's scroll, plus 36 px/s down, and ±20 only for a file. */
export function flightVelocity(shape: FlightShape, sign: -1 | 1, scroll: number): { vx: number; vy: number } {
  if (shape === 'file') return { vx: 20 * sign, vy: scroll + 36 };
  if (shape === 'v') return { vx: 0, vy: scroll + 36 };
  const never: never = shape;
  return never;
}

/** The fourth hit drops a token only when none of the four had already left. */
export function onSporeGone(flight: FlightState, how: 'hit' | 'left'): { flight: FlightState; drop: boolean } {
  const next: FlightState = {
    left: Math.max(0, flight.left - 1),
    escaped: flight.escaped || how === 'left',
  };
  const drop = how === 'hit' && next.left === 0 && !next.escaped;
  return { flight: next, drop };
}

/** A second token does not drop while one is already falling. A spoiled flight never drops one. */
export function offerToken(tokenOnScreen: boolean, clean: boolean): boolean {
  return clean && !tokenOnScreen;
}

/** Age 0 is points, then tuck, then twin, every 0.35 s, then back to points. */
export function tokenPhase(age: number): TokenPhase {
  const i = Math.floor(Math.max(0, age) / TOKEN_PERIOD) % PHASES.length;
  return PHASES[i] ?? 'points';
}

/** Points, one tuck up to five, or twin guns. A gift you already have is 200 points instead. */
export function grantToken(phase: TokenPhase, tucks: number, twin: boolean): { tucks: number; twin: boolean; points: number } {
  if (phase === 'points') return { tucks, twin, points: 200 };
  if (phase === 'tuck') {
    if (tucks >= TUCK_CAP) return { tucks, twin, points: 200 };
    return { tucks: tucks + 1, twin, points: 0 };
  }
  if (phase === 'twin') {
    if (twin) return { tucks, twin: true, points: 200 };
    return { tucks, twin: true, points: 0 };
  }
  const never: never = phase;
  return never;
}

/** A skiff shot that meets a slab is removed. The fourth hit breaks it. */
export function shotMeetsSlab(hits: number): { hits: number; gone: boolean; points: number; stopped: boolean } {
  const next = hits + 1;
  const gone = next >= SLAB_HITS;
  return { hits: gone ? SLAB_HITS : next, gone, points: gone ? 80 : 0, stopped: true };
}

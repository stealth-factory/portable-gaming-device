/* Reef Run's rules, with no console and no drawing: the kick, the current, and the openings.
   The game applies whatever these functions return. */

export const FISH_W = 18;
export const FISH_H = 11;
export const GATE_W = 26;
/** Upward speed, in px/s, a kick sets. A second kick replaces it; it does not add.
    The hop is shorter than a fresh opening, so a kick from the lower half stays inside it. */
export const KICK_VY = -186;
/** Downward acceleration, px/s². Screen y grows downward. */
export const GRAVITY = 520;
/** Fastest the fish sinks, so a long drop cannot skip an opening in one step. */
export const FALL_MAX = 240;
export const SPEED_START = 68;
export const SPEED_MAX = 128;

export type GateKind = 'coral' | 'wreck';

export interface Gate {
  x: number;
  /** Top of the opening. */
  gapY: number;
  gapH: number;
  w: number;
  scored: boolean;
  kind: GateKind;
}

export interface Lane { top: number; bottom: number; fishX: number; height: number }

/** The swim lane. Tall tubes letterbox it so the kick still reaches the next opening. */
export function laneOf(lw: number, lh: number, hud: number): Lane {
  const fieldTop = hud + 2;
  const fieldBottom = lh - 2;
  const fieldH = Math.max(80, fieldBottom - fieldTop);
  const height = Math.min(fieldH, 176);
  const extra = fieldH - height;
  const top = fieldTop + Math.floor(extra / 2);
  return { top, bottom: top + height, fishX: Math.round(Math.min(72, Math.max(36, lw * 0.26))), height };
}

/** Where a new fish rests: the middle of the lane. */
export function startY(top: number, bottom: number): number {
  return (top + bottom) / 2 - FISH_H / 2;
}

export function applyKick(): number {
  return KICK_VY;
}

export function stepFish(y: number, vy: number, dt: number): { y: number; vy: number } {
  const nextVy = Math.min(FALL_MAX, vy + GRAVITY * dt);
  return { y: y + nextVy * dt, vy: nextVy };
}

/** One kick per press. Repeats while the control stays down do not kick again.
    A queued press still counts when the key is already up. */
export function wantKick(queued: boolean, held: boolean, latched: boolean): { kick: boolean; latched: boolean } {
  return { kick: !latched && (queued || held), latched: held };
}

/** px/s the reef scrolls. It rises with the score and then holds. */
export function currentSpeed(score: number): number {
  return Math.min(SPEED_MAX, SPEED_START + Math.max(0, score) * 2.5);
}

/** Pixels between the left edges of two openings. */
export function gateSpacing(score: number): number {
  return Math.max(148, 206 - Math.max(0, score) * 2);
}

/** How tall the opening is. It starts roomy and draws in, and it always fits the lane. */
export function openingHeight(laneH: number, score: number): number {
  const start = Math.round(Math.min(laneH * 0.5, 96));
  const min = Math.round(Math.min(laneH * 0.36, Math.max(56, laneH * 0.32)));
  const h = Math.round(Math.max(min, start - Math.max(0, score) * 1.4));
  return Math.min(h, Math.max(FISH_H + 24, laneH - 20));
}

/** How far the next opening's middle may wander from the last, in px. */
export function driftFor(score: number): number {
  return Math.min(52, 22 + Math.max(0, score) * 1.5);
}

export function firstGateX(fishX: number, lw: number): number {
  return Math.round(Math.max(fishX + FISH_W + 120, Math.min(lw - GATE_W - 8, fishX + lw * 0.55)));
}

/** Every fifth barrier is a wreck. The opening is the same shape either way. */
export function gateKind(index: number): GateKind {
  return index % 5 === 4 ? 'wreck' : 'coral';
}

/** Top of the opening. `drift` of 0 keeps it on `prevCentre` (the first one). */
export function placeGapY(prevCentre: number, gapH: number, top: number, bottom: number, rng: () => number, drift: number): number {
  const minY = top + 8;
  const maxY = bottom - gapH - 8;
  if (maxY <= minY) return minY;
  const shift = drift <= 0 ? 0 : (rng() * 2 - 1) * drift;
  const centre = Math.max(minY + gapH / 2, Math.min(maxY + gapH / 2, prevCentre + shift));
  return Math.round(centre - gapH / 2);
}

export function hitsBound(y: number, top: number, bottom: number): 'ceiling' | 'floor' | null {
  if (y < top) return 'ceiling';
  if (y + FISH_H > bottom) return 'floor';
  return null;
}

/** The fish overlaps a barrier. The opening itself is clear, and the fringe of the sprite is forgiven. */
export function hitsReef(fishX: number, fishY: number, gate: Pick<Gate, 'x' | 'w' | 'gapY' | 'gapH'>): boolean {
  const x0 = fishX + 2;
  const x1 = fishX + FISH_W - 2;
  const y0 = fishY + 1;
  const y1 = fishY + FISH_H - 1;
  if (x1 <= gate.x + 1 || x0 >= gate.x + gate.w - 1) return false;
  return y0 < gate.gapY || y1 > gate.gapY + gate.gapH;
}

/** The nose has cleared the far side of an opening that has not scored yet. */
export function clearedGate(fishX: number, gate: Pick<Gate, 'x' | 'w' | 'scored'>): boolean {
  return !gate.scored && fishX + FISH_W > gate.x + gate.w;
}

/* Return Burn's rules, with no console and no drawing. The field is normalised: x runs 0 (left) to 1 (right) and
   y runs 0 (top) to 1 (ground). Speeds are per second. The game turns these numbers into pixels. */

export const GROUND = 0.9;          // the rocket's centre touches the ground here
export const G = 0.42;              // gravity, pulling down
export const MAIN_THRUST = 0.9;     // the main engine, along the rocket's axis (more than G, so it can climb)
export const MAIN_FUEL = 0.11;      // fuel per second the main engine burns
export const RCS_TORQUE = 2.4;      // side thrusters: turning rate change, rad/s²
export const RCS_FUEL = 0.02;       // fuel per second the side thrusters burn
export const RCS_DAMP = 1.4;        // turning slows on its own, /s
export const LEVEL_GAIN = 7;        // attitude hold pulls the angle to zero, /s²
export const LEVEL_FUEL = 0.05;     // fuel per second attitude hold burns
export const LEVEL_DAMP = 4;        // attitude hold steadies the turn quickly, /s (critically damped with LEVEL_GAIN)
export const LAND_VY = 0.18;        // softest touchdown allowed, downward
export const LAND_VX = 0.07;        // sideways speed allowed at touchdown
export const LAND_TILT = 0.18;      // angle allowed at touchdown, rad (about 8 degrees)

export interface Rocket {
  x: number; y: number; vx: number; vy: number;
  /** Tilt, rad: 0 is upright, positive leans right. */
  a: number; w: number;
  fuel: number;
}

export interface Input {
  main: boolean;     // main engine held
  rcs: -1 | 0 | 1;   // side thrusters: -1 left, 1 right
  level: boolean;    // attitude hold held
}

/** How fast the inbound rocket is falling when the level starts: each level comes in faster, up to a cap
    the main engine can still stop from full fuel. */
export function inboundSpeed(level: number): number {
  return Math.min(0.22, 0.06 + 0.025 * (Math.max(1, level) - 1));
}

export function startRocket(x: number, level = 1): Rocket {
  return { x, y: 0.15, vx: 0, vy: inboundSpeed(level), a: 0, w: 0, fuel: 1 };
}

/** The pad: its centre and half-width. It is wide on the first level and narrows each level, down to a floor. */
/** The softest touchdown the level allows, downward. Early levels allow more; it tightens each level to a floor. */
export function landingVy(level: number): number {
  return Math.max(0.12, 0.2 - (Math.max(1, level) - 1) * 0.01);
}

/** The most sideways speed a touchdown allows. It tightens with the level, like the downward speed. */
export function landingVx(level: number): number {
  return Math.max(0.04, 0.09 - (Math.max(1, level) - 1) * 0.005);
}

export function padFor(level: number): { centre: number; half: number } {
  return { centre: 0.5, half: Math.max(0.05, 0.16 - (level - 1) * 0.012) };
}

/** Sideways push from the wind on this level. It is deterministic, so a replay matches. */
export function windFor(level: number): number {
  return Math.sin(level * 1.7) * Math.min(0.03, 0.006 * level);
}

/** One step. Fuel can run out mid-burn: the engine just stops then. */
export function stepRocket(r: Rocket, input: Input, dt: number, wind: number): Rocket {
  let fuel = r.fuel;
  let thrust = 0;
  if (input.main && fuel > 0) { thrust = MAIN_THRUST; fuel = Math.max(0, fuel - MAIN_FUEL * dt); }
  // the main engine pushes along the axis: up when upright, sideways when tilted
  const ax = -Math.sin(r.a) * thrust + wind;
  const ay = -Math.cos(r.a) * thrust + G;

  let torque = 0;
  if (input.rcs !== 0 && fuel > 0) { torque = input.rcs * RCS_TORQUE; fuel = Math.max(0, fuel - RCS_FUEL * dt); }
  if (input.level && fuel > 0) {
    torque += -r.a * LEVEL_GAIN;
    fuel = Math.max(0, fuel - LEVEL_FUEL * dt);
  }
  const damp = input.level ? LEVEL_DAMP : input.rcs === 0 ? RCS_DAMP : RCS_DAMP * 0.2;
  const w = r.w + (torque - damp * r.w) * dt;
  const a = r.a + w * dt;

  let vx = r.vx + ax * dt;
  let vy = r.vy + ay * dt;
  let x = r.x + vx * dt;
  let y = r.y + vy * dt;
  if (y < 0) { y = 0; vy = Math.max(0, vy); }   // the ceiling stops it
  if (y > GROUND) { y = GROUND; }
  return { x, y, vx, vy, a, w, fuel };
}

export type Outcome = 'landed' | 'crashed' | null;

/** Touchdown: the rocket has reached the ground. It counts only when slow, upright and on the pad. */
export function touchdown(r: Rocket, level: number): Outcome {
  if (r.y < GROUND) return r.x < 0 || r.x > 1 ? 'crashed' : null;
  const pad = padFor(level);
  const onPad = Math.abs(r.x - pad.centre) <= pad.half;
  const soft = Math.abs(r.vy) <= landingVy(level) && Math.abs(r.vx) <= landingVx(level) && Math.abs(r.a) <= LAND_TILT;
  return onPad && soft ? 'landed' : 'crashed';
}

/** Points for a landing: fuel left, a centred touchdown and a gentle one, times the level. */
export function landingScore(r: Rocket, level: number): number {
  const pad = padFor(level);
  const centred = 1 - Math.min(1, Math.abs(r.x - pad.centre) / pad.half);
  const gentle = 1 - Math.min(1, Math.abs(r.vy) / landingVy(level));
  const base = 100 + Math.round(fuelPoints(r.fuel) + 60 * centred + 40 * gentle);
  return base * Math.max(1, level);
}

export function fuelPoints(fuel: number): number {
  return Math.round(Math.max(0, Math.min(1, fuel)) * 100);
}

/** The speed meter's full scale, in field heights per second either way (up is negative, down positive). */
export const METER_SCALE = 0.3;

/** Where the speed meter's needle sits: -1 is full climb, 0 is still, +1 is full fall, and `inZone` says the
    rocket is inside the landing band (the speeds a touchdown allows). */
export function speedMeter(vy: number, level = 1): { fill: number; inZone: boolean } {
  return {
    fill: Math.max(-1, Math.min(1, vy / METER_SCALE)),
    inZone: Math.abs(vy) <= landingVy(level),
  };
}

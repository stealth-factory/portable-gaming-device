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
  fin?: -1 | 0 | 1;  // grid fins: -1 left, 1 right (free, but only while falling fast)
}

/* ---- grid fins: free steering that only bites while the rocket falls fast, fading to nothing near a stop ---- */
export const FIN_TORQUE = 1.8;      // turning rate change at full bite, rad/s²
export const FIN_MIN = 0.04;        // falling slower than this, the fins do nothing
export const FIN_FULL = 0.2;        // falling this fast or faster, the fins bite fully

/** How much the grid fins bite at this downward speed, 0 to 1. Climbing or hanging still, they do nothing. */
export function finBite(vy: number): number {
  return Math.max(0, Math.min(1, (vy - FIN_MIN) / (FIN_FULL - FIN_MIN)));
}

/** STICK's fins, worked for the player: lean back against the tilt (and the turn) while the fins can bite. */
export function autoFin(r: Rocket): -1 | 0 | 1 {
  const lean = r.a + r.w * 0.3;
  if (finBite(r.vy) <= 0 || Math.abs(lean) < 0.03) return 0;
  return lean > 0 ? -1 : 1;
}

/** Options for a step. `settle: false` is ENGINEER's rocket: a turn keeps going until a thruster stops it. */
export interface StepOptions { settle?: boolean }

/* ---- the setup card: which rocket, and how much control ---- */
export type RocketId = 'stilt' | 'hauler' | 'cruiser';
export type ControlId = 'stick' | 'pilot' | 'engineer';

export interface RocketSpec { id: RocketId; name: string; ready: boolean }
/** The rockets, in the setup card's order. Only STILT flies so far; the others come with the tower (GAM-111). */
export const ROCKETS: readonly RocketSpec[] = [
  { id: 'stilt', name: 'STILT', ready: true },
  { id: 'hauler', name: 'HAULER', ready: false },
  { id: 'cruiser', name: 'CRUISER', ready: false },
];

export interface ControlSpec {
  id: ControlId; name: string;
  /** What the card says about it, one short line in the pixel font. */
  line: string;
  /** Points are multiplied by this, so one table stays fair. */
  mult: number;
  /** Thruster buttons in the stick's place (the pad), not the stick. */
  buttons: boolean;
  /** Turns settle by themselves when no thruster fires (false: they keep going). */
  settle: boolean;
  /** The fins are worked for the player. */
  autoFins: boolean;
}
export const CONTROLS: readonly ControlSpec[] = [
  { id: 'stick', name: 'STICK', line: 'STICK STEERS  X1', mult: 1, buttons: false, settle: true, autoFins: true },
  { id: 'pilot', name: 'PILOT', line: 'THRUSTER KEYS  X1.5', mult: 1.5, buttons: true, settle: true, autoFins: false },
  { id: 'engineer', name: 'ENGINEER', line: 'NO LEVEL, NO HELP  X2', mult: 2, buttons: true, settle: false, autoFins: false },
];
/** A new player starts on PILOT, the thruster buttons. */
export const DEFAULT_CONTROL = 1;

/** How many times LEVEL can be switched on for one rocket. STICK: always; PILOT: always for the first three levels,
    then three; ENGINEER: never. */
export function levelUses(control: ControlId, level: number): number {
  if (control === 'engineer') return 0;
  if (control === 'pilot' && level >= 4) return 3;
  return Infinity;
}

/** LEVEL's gate: a press starts a hold and spends one use; the hold lasts while the button stays down. */
export interface LevelGate { left: number; active: boolean }
export function gateLevel(g: LevelGate, held: boolean): { gate: LevelGate; on: boolean } {
  if (!held) return { gate: { left: g.left, active: false }, on: false };
  if (g.active) return { gate: g, on: true };
  if (g.left <= 0) return { gate: g, on: false };
  return { gate: { left: g.left - 1, active: true }, on: true };
}

export interface SetupChoice { row: 0 | 1; rocket: number; control: number }
/** Move on the setup card: up and down pick the row, left and right change it. Rockets not built yet are skipped. */
export function setupMove(c: SetupChoice, dir: 'up' | 'down' | 'left' | 'right'): SetupChoice {
  if (dir === 'up' || dir === 'down') return { ...c, row: dir === 'up' ? 0 : 1 };
  const step = dir === 'left' ? -1 : 1;
  if (c.row === 1) return { ...c, control: (c.control + step + CONTROLS.length) % CONTROLS.length };
  let i = c.rocket;
  for (let n = 0; n < ROCKETS.length; n++) {
    i = (i + step + ROCKETS.length) % ROCKETS.length;
    if (ROCKETS[i].ready) return { ...c, rocket: i };
  }
  return c;
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
  return Math.sign(Math.sin(level * 1.7)) * Math.min(0.03, 0.006 * level);
}

/** One step. Fuel can run out mid-burn: the engine just stops then. */
export function stepRocket(r: Rocket, input: Input, dt: number, wind: number, opts: StepOptions = {}): Rocket {
  let fuel = r.fuel;
  let thrust = 0;
  if (input.main && fuel > 0) { thrust = MAIN_THRUST; fuel = Math.max(0, fuel - MAIN_FUEL * dt); }
  // the main engine pushes along the axis: up when upright, sideways when tilted
  // the nose points along (sin a, -cos a): tilted right, the engine pushes right
  const ax = Math.sin(r.a) * thrust + wind;
  const ay = -Math.cos(r.a) * thrust + G;

  let torque = 0;
  if (input.rcs !== 0 && fuel > 0) { torque = input.rcs * RCS_TORQUE; fuel = Math.max(0, fuel - RCS_FUEL * dt); }
  if (input.level && fuel > 0) {
    torque += -r.a * LEVEL_GAIN;
    fuel = Math.max(0, fuel - LEVEL_FUEL * dt);
  }
  if (input.fin) torque += input.fin * FIN_TORQUE * finBite(r.vy);   // free: the fins cost no fuel
  const settle = opts.settle ?? true;
  const damp = input.level ? LEVEL_DAMP : !settle ? 0 : input.rcs === 0 ? RCS_DAMP : RCS_DAMP * 0.2;
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

export type Outcome = 'landed' | 'crashed' | 'splashed' | null;

/* ---- at sea (STILT from level 4): the ship's deck heaves, rolls and drifts with the swell ---- */

/** The first level flown out to the ship at sea; levels before it land on the pad ashore. */
export const SEA_LEVEL = 4;
/** How far above the sea the deck stands, in field heights (the rocket's centre rests this high above the water). */
export const DECK_HEIGHT = 0.04;

export function atSea(level: number): boolean { return level >= SEA_LEVEL; }

/** The swell on this level: heave (up and down, field heights), roll (rad), drift (side to side, field widths) and
    the swell's period in seconds. Calm before the sea levels; it builds each level out there, to a cap. */
export interface SeaState { heave: number; roll: number; drift: number; period: number }
export function seaFor(level: number): SeaState {
  if (!atSea(level)) return { heave: 0, roll: 0, drift: 0, period: 1 };
  const n = level - SEA_LEVEL;
  return {
    heave: Math.min(0.03, 0.012 + 0.004 * n),
    roll: Math.min(0.12, 0.04 + 0.016 * n),
    drift: Math.min(0.06, 0.02 + 0.008 * n),
    period: Math.max(3, 4.5 - 0.3 * n),
  };
}

/** Where the landing surface is: its centre and half-width across, its height (the rocket's centre at touchdown), its
    roll, and how fast it moves (the rocket is judged against the deck, not the sea). */
export interface Deck { centre: number; half: number; y: number; roll: number; vx: number; vy: number; ship: boolean }

/** The pad ashore: still and flat, at ground level. */
export function landDeck(level: number): Deck {
  const pad = padFor(level);
  return { centre: pad.centre, half: pad.half, y: GROUND, roll: 0, vx: 0, vy: 0, ship: false };
}

/** The ship's deck is narrower than the pad and shrinks a little each sea level, to a floor. */
export function shipHalf(level: number): number {
  return Math.max(0.06, 0.11 - (Math.max(SEA_LEVEL, level) - SEA_LEVEL) * 0.008);
}

/** The deck at time `t` seconds into the level: the pad ashore, or the ship riding the swell. Deterministic, so a
    replay matches. Heave, roll and drift each run on their own period, so the deck never repeats a simple pattern. */
export function deckAt(level: number, t: number): Deck {
  if (!atSea(level)) return landDeck(level);
  const s = seaFor(level);
  const wh = (2 * Math.PI) / s.period;            // heave
  const wr = wh * 0.83;                           // roll, a little slower than the heave
  const wd = wh / 2.7;                            // drift, slow
  return {
    centre: 0.5 + s.drift * Math.sin(wd * t),
    half: shipHalf(level),
    y: GROUND - DECK_HEIGHT + s.heave * Math.sin(wh * t),
    roll: s.roll * Math.sin(wr * t + 1.1),
    vx: s.drift * wd * Math.cos(wd * t),
    vy: s.heave * wh * Math.cos(wh * t),
    ship: true,
  };
}

/** Touchdown: the rocket has reached the deck (or the ground, or the sea). It counts only when slow, upright and on
    the deck, all measured against the deck: its speed, its roll. Missing the ship at sea is a splash. */
export function touchdown(r: Rocket, level: number, deck: Deck = landDeck(level)): Outcome {
  const onDeck = Math.abs(r.x - deck.centre) <= deck.half;
  if (deck.ship && !onDeck) {
    if (r.y >= GROUND) return 'splashed';
    return r.x < 0 || r.x > 1 ? 'crashed' : null;
  }
  if (r.y < deck.y) return r.x < 0 || r.x > 1 ? 'crashed' : null;
  const soft = Math.abs(r.vy - deck.vy) <= landingVy(level) && Math.abs(r.vx - deck.vx) <= landingVx(level)
    && Math.abs(r.a - deck.roll) <= LAND_TILT;
  return onDeck && soft ? 'landed' : 'crashed';
}

/** Points for a landing: fuel left, a centred touchdown and a gentle one, times the level, times the control's
    multiplier (STICK 1, PILOT 1.5, ENGINEER 2). Measured against the deck it landed on. */
export function landingScore(r: Rocket, level: number, mult = 1, deck: Deck = landDeck(level)): number {
  const centred = 1 - Math.min(1, Math.abs(r.x - deck.centre) / deck.half);
  const gentle = 1 - Math.min(1, Math.abs(r.vy - deck.vy) / landingVy(level));
  const base = 100 + Math.round(fuelPoints(r.fuel) + 60 * centred + 40 * gentle);
  return Math.round(base * Math.max(1, level) * mult);
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

/** The wind meter's full scale: the strongest wind any level can blow. */
export const WIND_SCALE = 0.03;

/** Which way the wind blows (-1 left, +1 right, 0 none) and how hard, from 0 to 1 of full scale. */
export function windMeter(wind: number): { dir: -1 | 0 | 1; fill: number } {
  const fill = Math.max(0, Math.min(1, Math.abs(wind) / WIND_SCALE));
  return { dir: wind > 0 ? 1 : wind < 0 ? -1 : 0, fill };
}

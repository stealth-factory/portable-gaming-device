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
export interface StepOptions {
  settle?: boolean;
  /** The main engine's push and fuel per second, when not STILT's (HAULER's engine ring and its core). */
  thrust?: number; burn?: number;
  /** The turn input swings the engines (HAULER) instead of firing nose thrusters: it only turns while burning. */
  gimbal?: boolean;
}

/* ---- the setup card: which rocket, and how much control ---- */
export type RocketId = 'stilt' | 'hauler' | 'cruiser';
export type ControlId = 'stick' | 'pilot' | 'engineer';

export interface RocketSpec { id: RocketId; name: string; ready: boolean }
/** The rockets, in the setup card's order. Only STILT flies so far; the others come with the tower (GAM-111). */
export const ROCKETS: readonly RocketSpec[] = [
  { id: 'stilt', name: 'STILT', ready: true },
  { id: 'hauler', name: 'HAULER', ready: true },
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
  if (input.main && fuel > 0) { thrust = opts.thrust ?? MAIN_THRUST; fuel = Math.max(0, fuel - (opts.burn ?? MAIN_FUEL) * dt); }
  // the main engine pushes along the axis: up when upright, sideways when tilted
  // the nose points along (sin a, -cos a): tilted right, the engine pushes right
  const ax = Math.sin(r.a) * thrust + wind;
  const ay = -Math.cos(r.a) * thrust + G;

  let torque = 0;
  if (opts.gimbal) { if (input.rcs !== 0 && thrust > 0) torque = input.rcs * GIMBAL_TORQUE; }   // free: the engines are burning anyway
  else if (input.rcs !== 0 && fuel > 0) { torque = input.rcs * RCS_TORQUE; fuel = Math.max(0, fuel - RCS_FUEL * dt); }
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
export interface Deck { centre: number; half: number; y: number; roll: number; vx: number; vy: number; vroll: number; ship: boolean }

/** The pad ashore: still and flat, at ground level. */
export function landDeck(level: number): Deck {
  const pad = padFor(level);
  return { centre: pad.centre, half: pad.half, y: GROUND, roll: 0, vx: 0, vy: 0, vroll: 0, ship: false };
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
    vroll: s.roll * wr * Math.cos(wr * t + 1.1),
    ship: true,
  };
}

/** The deck's surface height under `x`: a rolled deck is higher at one end than the other. `aspect` is the field's
    width over its height on the tube, so the slope matches the deck as drawn. Never below the water line, where the
    rocket stops falling: a deck end dipped into the swell meets the rocket there. */
export function deckSurface(deck: Deck, x: number, aspect = 1): number {
  return Math.min(GROUND, deck.y + (x - deck.centre) * Math.tan(deck.roll) * aspect);
}

/** How fast the deck's surface under `x` is moving down (+) or up (-): the heave, plus the roll lifting or dropping
    that point, plus the slope sliding sideways under it as the ship drifts. Where the surface sits on the water line
    it is still. */
export function deckVyAt(deck: Deck, x: number, aspect = 1): number {
  if (!deck.ship) return deck.vy;
  if (deck.y + (x - deck.centre) * Math.tan(deck.roll) * aspect >= GROUND) return 0;
  const c = Math.cos(deck.roll);
  return deck.vy + aspect * ((x - deck.centre) * deck.vroll / (c * c) - deck.vx * Math.tan(deck.roll));
}

/** What the last step looked like, so a touchdown can tell a rocket coming down onto the deck from one sliding into
    the ship's side below it. */
export type TouchdownPrev = { x: number; y: number; deck: Deck };

/** Touchdown: the rocket has reached the deck (or the ground, or the sea). It counts only when slow, upright and on
    the deck, all measured against the deck: its speed, its roll. Missing the ship at sea is a splash, and coming in
    from the side below the deck (it was already under the deck's surface last step) hits the hull. */
export function touchdown(r: Rocket, level: number, deck: Deck = landDeck(level), aspect = 1, prev?: TouchdownPrev): Outcome {
  const onDeck = Math.abs(r.x - deck.centre) <= deck.half;
  if (deck.ship && !onDeck) {
    if (r.y >= GROUND) return 'splashed';
    return r.x < 0 || r.x > 1 ? 'crashed' : null;
  }
  const surface = deck.ship ? deckSurface(deck, r.x, aspect) : deck.y;
  if (r.y < surface) return r.x < 0 || r.x > 1 ? 'crashed' : null;
  if (deck.ship && prev && prev.y >= deckSurface(prev.deck, prev.x, aspect)) return 'crashed';
  const soft = Math.abs(r.vy - deckVyAt(deck, r.x, aspect)) <= landingVy(level) && Math.abs(r.vx - deck.vx) <= landingVx(level)
    && Math.abs(r.a - deck.roll) <= LAND_TILT;
  return onDeck && soft ? 'landed' : 'crashed';
}

/** Points for a landing: fuel left, a centred touchdown and a gentle one, times the level, times the control's
    multiplier (STICK 1, PILOT 1.5, ENGINEER 2). Measured against the deck it landed on. */
export function landingScore(r: Rocket, level: number, mult = 1, deck: Deck = landDeck(level), aspect = 1): number {
  const centred = 1 - Math.min(1, Math.abs(r.x - deck.centre) / deck.half);
  const gentle = 1 - Math.min(1, Math.abs(r.vy - deckVyAt(deck, r.x, aspect)) / landingVy(level));
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

/* ---- HAULER: the legless heavy booster, caught by the tower's arms ---- */

/** The engine ring: a hard push for the landing burn, thirsty. Below the step line it drops to the core engines. */
export const RING_THRUST = 1.5;
export const RING_FUEL = 0.2;
/** The core engines: a gentle push for the last stretch, just over gravity, so it can hover between the arms. */
export const CORE_THRUST = 0.62;
export const CORE_FUEL = 0.07;
/** Swinging the burning engines turns HAULER: rad/s² at full swing. */
export const GIMBAL_TORQUE = 2.2;
/** Where the engines step from the ring to the core, and where the tower calls GO or NO-GO. */
export const STEP_Y = 0.42;
/** The arms' height: the rocket's centre stops here to be caught. */
export const ARM_Y = 0.62;

export function haulerInbound(level: number): number {
  return Math.min(0.28, 0.12 + 0.02 * (Math.max(1, level) - 1));
}

export function startHauler(x: number, level = 1): Rocket {
  return { x, y: 0.08, vx: 0, vy: haulerInbound(level), a: 0, w: 0, fuel: 1 };
}

/** The engine setting for HAULER at this height: the ring above the step line, the core below it. */
export function haulerEngine(r: Rocket): { core: boolean; thrust: number; burn: number } {
  const core = r.y >= STEP_Y;
  return { core, thrust: core ? CORE_THRUST : RING_THRUST, burn: core ? CORE_FUEL : RING_FUEL };
}

/** The tower: the catch point's centre and half-width between the arms (narrower each level), the arms' height, and
    the tower's own column, just right of the arms. */
export interface Tower { x: number; half: number; armY: number; towerX: number; topY: number }
export function towerFor(level: number): Tower {
  const half = Math.max(0.025, 0.06 - 0.004 * (Math.max(1, level) - 1));
  return { x: 0.5, half, armY: ARM_Y, towerX: 0.5 + half + 0.05, topY: ARM_Y - 0.14 };
}

/** The slowest the rocket must be moving, up or down, for the arms to close on it. Tighter each level. */
export function catchVy(level: number): number {
  return Math.max(0.05, 0.1 - 0.006 * (Math.max(1, level) - 1));
}

/** GO or NO-GO, called as the rocket crosses the step line: on course for the arms and not falling too fast for the
    core engines to stop. NO-GO diverts it away from the tower, and that rocket is lost. */
export function goNoGo(r: Rocket, level: number): boolean {
  const t = towerFor(level);
  return Math.abs(r.x - t.x) <= 0.12 && r.vy <= 0.24 && Math.abs(r.a) <= 0.35;
}

/** The catch: the rocket stops between the arms, upright and slow, and the arms close. Dropping below the arms, or
    running into the tower, crashes it. Null while it is still on its way. */
export function catchOutcome(r: Rocket, level: number): 'caught' | 'crashed' | null {
  const t = towerFor(level);
  const tower = r.x >= t.towerX - 0.015 && r.y >= t.topY;
  if (tower || r.x < 0 || r.x > 1) return 'crashed';
  if (r.y >= GROUND) return 'crashed';
  const inBox = Math.abs(r.x - t.x) <= t.half && Math.abs(r.y - t.armY) <= 0.035;
  if (inBox && Math.abs(r.vy) <= catchVy(level) && Math.abs(r.vx) <= 0.05 && Math.abs(r.a) <= 0.1) return 'caught';
  return null;
}

/** Points for a catch: fuel left, how centred and how still it was, times the level and the control's multiplier. */
export function catchScore(r: Rocket, level: number, mult = 1): number {
  const t = towerFor(level);
  const centred = 1 - Math.min(1, Math.abs(r.x - t.x) / t.half);
  const gentle = 1 - Math.min(1, Math.abs(r.vy) / catchVy(level));
  const base = 150 + Math.round(fuelPoints(r.fuel) + 60 * centred + 40 * gentle);
  return Math.round(base * Math.max(1, level) * mult);
}

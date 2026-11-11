/* Martian Storm's rules, with no console and no drawing. The game applies whatever these functions return.
   Legs are generated from a seed. Nothing here is a stage table from another shooter. */

export const SKIFF_SPEED = 80;
/** Every shot of the skiff's in the air at once, across all weapons. Plenty, so a level 3 spread fills the sky. */
export const SHOT_CAP = 72;
export const TUCK_SECS = 0.6;
export const TUCKS_START = 3;
export const TUCK_CAP = 5;
export const LEGS = 8;
export const LEG_CLOCK = 24;
export const SLAB_WAIT = 6;
export const MAX_CRAFT = 16;
export const FLIGHT_TRIES = 20;
export const SPORE_GAP = 16;
export const CAPSULE_PERIOD = 0.5;
export const CLEAR_SECS = 1.6;
export const HEARTS_START = 3;
export const HEART_CAP = 5;
/** Seconds of blinking safety after a heart is lost. */
export const HIT_GRACE = 1.4;
export const LIVES_START = 3;
export const LIFE_CAP = 9;
export const EXTRA_EVERY = 5000;
export const WEAPON_MAX = 3;
export const PICKUP_CAP = 4;
export const SPORE_HP = 1;
export const BARB_HP = 3;
export const SLAB_HP = 14;

export type Axis = 'up' | 'down' | 'left' | 'right';
export type Weapon = 'blaster' | 'spread' | 'laser' | 'missile' | 'wave';
/** The guns a capsule can hold. The blaster is what every skiff starts with, so it is never on a capsule. */
export type CapsuleWeapon = Exclude<Weapon, 'blaster'>;
export type PickupKind = 'weapon' | 'heart' | 'life' | 'tuck';
export type ShotKind = 'bolt' | 'beam' | 'missile' | 'wave';
export type BeatKind = 'flight' | 'barb' | 'slab' | 'gap';
export type FlightShape = 'v' | 'file';

export interface FlightState { left: number; escaped: boolean }
export interface Beat { kind: BeatKind; t: number }

export const CAPSULE_ORDER: readonly CapsuleWeapon[] = ['spread', 'laser', 'missile', 'wave'];

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

/** A craft's body where it can ram the skiff: two pixels in, so the bigger bodies' horns, fringes and rocky
    corners don't cost a skiff. Shots still use the generous insetBox, so the craft stay as easy to hit. */
export function touchBox(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  return { x: x + 2, y: y + 2, w: Math.max(0, w - 4), h: Math.max(0, h - 4) };
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

/** Four spores. A file steps 16 px and drifts sideways. A shallow V shares one straight velocity. Both leave a
    clear gap between 9 px spores. */
export function flightOffsets(shape: FlightShape, sign: -1 | 1): { x: number; y: number }[] {
  if (shape === 'file') return [0, 1, 2, 3].map(i => ({ x: -i * SPORE_GAP * sign, y: -i * SPORE_GAP }));
  if (shape === 'v') return [{ x: -24, y: 0 }, { x: -8, y: 6 }, { x: 8, y: 6 }, { x: 24, y: 0 }];
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

/** A second capsule does not drop while one is already falling. A spoiled flight never drops one. */
export function offerToken(capsuleOnScreen: boolean, clean: boolean): boolean {
  return clean && !capsuleOnScreen;
}

/** A capsule shows S, L, M, then W, changing every 0.5 s while it falls, and starts on `first`. */
export function capsuleWeapon(age: number, first = 0): CapsuleWeapon {
  const i = (Math.floor(Math.max(0, age) / CAPSULE_PERIOD) + first) % CAPSULE_ORDER.length;
  return CAPSULE_ORDER[i] ?? 'spread';
}

/** Catch your own gun and it goes up a level (200 points at the top). Catch another and you switch to it at the
    level you had, as the colour-changing capsules of the arcade shooters did. */
export function catchWeapon(weapon: Weapon, level: number, got: CapsuleWeapon): { weapon: Weapon; level: number; points: number } {
  if (got === weapon) {
    if (level >= WEAPON_MAX) return { weapon, level: WEAPON_MAX, points: 200 };
    return { weapon, level: level + 1, points: 0 };
  }
  return { weapon: got, level: Math.max(1, Math.min(WEAPON_MAX, level)), points: 0 };
}

/** A heart up to five, a tuck up to five, a skiff up to nine. A gift you can't hold is 200 points instead. */
export function catchGift(kind: Exclude<PickupKind, 'weapon'>, have: { hearts: number; tucks: number; lives: number }): { hearts: number; tucks: number; lives: number; points: number } {
  const out = { ...have, points: 0 };
  if (kind === 'heart') { if (have.hearts >= HEART_CAP) out.points = 200; else out.hearts += 1; }
  else if (kind === 'tuck') { if (have.tucks >= TUCK_CAP) out.points = 200; else out.tucks += 1; }
  else if (kind === 'life') { if (have.lives >= LIFE_CAP) out.points = 200; else out.lives += 1; }
  else { const never: never = kind; return never; }
  return out;
}

/** What a destroyed barb or a broken slab leaves behind, from one roll in [0, 1). Spores drop nothing on
    their own: a clean flight of four drops a weapon capsule. Slabs always leave something. */
export function dropFor(kind: 'barb' | 'slab', roll: number): PickupKind | null {
  if (kind === 'barb') {
    if (roll < 0.05) return 'life';
    if (roll < 0.27) return 'heart';
    if (roll < 0.37) return 'tuck';
    if (roll < 0.45) return 'weapon';
    return null;
  }
  if (roll < 0.18) return 'life';
  if (roll < 0.55) return 'heart';
  return 'weapon';
}

/** A hit takes one heart. The last one costs the skiff, and the next skiff starts with three. */
export function takeHit(hearts: number): { hearts: number; lost: boolean } {
  const left = Math.max(0, hearts - 1);
  return { hearts: left, lost: left === 0 };
}

/** One more skiff for every leg cleared, up to nine. */
export function legReward(lives: number): number {
  return Math.min(LIFE_CAP, lives + 1);
}

/** Damage to a craft. It is gone when its hit points run out. */
export function damage(hp: number, dmg: number): { hp: number; gone: boolean } {
  const left = Math.max(0, hp - dmg);
  return { hp: left, gone: left === 0 };
}

export function hpFor(kind: 'spore' | 'barb' | 'slab'): number {
  return kind === 'spore' ? SPORE_HP : kind === 'barb' ? BARB_HP : SLAB_HP;
}

/** One shot of a volley: where it leaves from (dx across the nose), its velocity, what it is and what it does. */
export interface ShotSpec {
  kind: ShotKind;
  dx: number;
  vx: number;
  vy: number;
  dmg: number;
  /** A beam goes through spores and barbs. Slabs still stop it. */
  pierce: boolean;
  /** For a wave shot: how far it weaves either side, and which way it starts. */
  amp?: number;
  phase?: number;
}

const BOLT = 180;
const BEAM = 300;
const deg = (d: number) => d * Math.PI / 180;
const fan = (angles: number[], speed: number): ShotSpec[] => angles.map(a => ({
  kind: 'bolt', dx: 0, vx: Math.sin(deg(a)) * speed, vy: -Math.cos(deg(a)) * speed, dmg: 1, pierce: false,
}));
const straight = (dx: number): ShotSpec => ({ kind: 'bolt', dx, vx: 0, vy: -BOLT, dmg: 1, pierce: false });

/** Seconds between volleys while FIRE is held. */
export function weaponCooldown(weapon: Weapon): number {
  if (weapon === 'blaster') return 0.12;
  if (weapon === 'spread') return 0.16;
  if (weapon === 'laser') return 0.09;
  if (weapon === 'missile') return 0.13;
  if (weapon === 'wave') return 0.14;
  const never: never = weapon;
  return never;
}

/** Seconds between missile salvoes with the missile gun. */
export const MISSILE_COOLDOWN = 0.42;

/** The shots one press (or one repeat while held) puts in the air. Missiles come on their own clock: see
    missileSalvo. The more of a gun you catch, the more it sprays. */
export function volley(weapon: Weapon, level: number): ShotSpec[] {
  const lv = Math.max(1, Math.min(WEAPON_MAX, level));
  // the blaster is never on a capsule, so it only ever has its one shot; catch a capsule to grow the spray
  if (weapon === 'blaster') return [straight(0)];
  if (weapon === 'spread') {
    if (lv === 1) return fan([-12, 0, 12], BOLT);
    if (lv === 2) return fan([-22, -11, 0, 11, 22], BOLT);
    return fan([-33, -22, -11, 0, 11, 22, 33], BOLT);
  }
  if (weapon === 'laser') {
    const beam = (dx: number): ShotSpec => ({ kind: 'beam', dx, vx: 0, vy: -BEAM, dmg: 1, pierce: true });
    if (lv === 1) return [beam(0)];
    if (lv === 2) return [beam(-3), beam(3)];
    return [beam(-6), beam(0), beam(6)];
  }
  if (weapon === 'missile') {
    if (lv === 1) return [straight(0)];
    return [straight(-3), straight(3)];
  }
  if (weapon === 'wave') {
    const wave = (phase: number, amp: number): ShotSpec => ({ kind: 'wave', dx: 0, vx: 0, vy: -150, dmg: 1, pierce: false, amp, phase });
    if (lv === 1) return [wave(0, 10), wave(Math.PI, 10)];
    if (lv === 2) return [wave(0, 12), wave(Math.PI, 12), straight(0)];
    return [wave(0, 9), wave(Math.PI, 9), wave(0, 18), wave(Math.PI, 18)];
  }
  const never: never = weapon;
  return never;
}

/** Homing missiles from the pods: one, two, then four, launched outward before they turn on a target. */
export function missileSalvo(level: number): ShotSpec[] {
  const lv = Math.max(1, Math.min(WEAPON_MAX, level));
  const m = (dx: number, vx: number): ShotSpec => ({ kind: 'missile', dx, vx, vy: -70, dmg: 2, pierce: false });
  if (lv === 1) return [m(-6, -40)];
  if (lv === 2) return [m(-6, -40), m(6, 40)];
  return [m(-6, -50), m(6, 50), m(-4, -20), m(4, 20)];
}

/** How many of a volley fit under the cap: all or none, so a fan is never cut in half. */
export function volleyFits(inAir: number, size: number, cap = SHOT_CAP): boolean {
  return inAir + size <= cap;
}

/** Turn a missile's velocity toward a target, at most `turn` radians this step, holding its speed. */
export function steerMissile(vx: number, vy: number, tx: number, ty: number, turn: number, speed: number): { vx: number; vy: number } {
  const now = Math.atan2(vy, vx);
  const want = Math.atan2(ty, tx);
  let d = want - now;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const a = now + Math.max(-turn, Math.min(turn, d));
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

/** Short names for the bar and the pickup pop. */
export const WEAPON_NAME: Record<Weapon, string> = {
  blaster: 'BLAST', spread: 'SPREAD', laser: 'LASER', missile: 'MISSILE', wave: 'WAVE',
};

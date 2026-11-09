/* Invader Force's weapon drops: capsules that fall from shot-down aliens and the saucer, and the timed
   weapons they hold. Pure rules with no drawing or sound, so the unit tests can drive them directly. */

export type Weapon = 'basic' | 'twin' | 'spread' | 'rapid' | 'pierce';
/** What a capsule can hold: one of the four weapons, or a shot-speed boost. */
export type Drop = Exclude<Weapon, 'basic'> | 'speed' | 'nuke';
export const DROPS: Drop[] = ['twin', 'spread', 'rapid', 'pierce', 'speed'];
/** The atomic bomb is rare: a separate, much smaller roll per alien, and now and then the saucer's capsule. */
export const NUKE_CHANCE = 0.004, SAUCER_NUKE = 0.12, NUKE_BLAST_R = 28;
/** A nuke is a missile: it flies up (through walls and bombs) until it hits an alien or the saucer,
    then wipes out 3 or 4 whole rows around the point of impact, so it never empties a wave of 6 or more. */
export const NUKE_MIN = 3, NUKE_MAX = 4, NUKE_SPEED = 260;
export const nukeDepth = (rand: number) => (rand < 0.5 ? 3 : 4);
export const rollNuke = (rand: number, falling: number) => falling < MAX_CAPSULES && rand < NUKE_CHANCE;
/** The rows a nuke wipes out: `depth` rows around the row it hit (one above it, the rest below,
    shifted to stay inside the formation's `rows`). */
export function nukeRows(hitRow: number, depth: number, rows: number): number[] {
  const top = Math.max(0, Math.min(rows - depth, hitRow - 1));
  return Array.from({ length: Math.min(depth, rows) }, (_, i) => top + i);
}

/** How many rows a wave has: 6 at first, one more every two waves, up to 8, and never more than fit
    above the walls with room to march (`room` is the height in px between the formation's top and the walls). */
export const ROWS_MIN = 6, ROWS_MAX = 8;
export function waveRows(wave: number, room: number, rowH = 12): number {
  const want = Math.min(ROWS_MAX, ROWS_MIN + Math.floor((wave - 1) / 2));
  const fit = Math.floor((room - 60) / rowH);                // keep about five row-drops of marching room
  return Math.max(5, Math.min(want, fit));
}
/** Which alien a row holds: a jelly on top, beetles down to about halfway, drones below. */
export const rowType = (r: number, rows: number) => (r === 0 ? 0 : r < 1 + Math.round((rows - 1) / 2) ? 1 : 2);
/** On-tube names, in the pixel font. */
export const WEAPON_NAME: Record<Weapon, string> = { basic: '', twin: 'TWIN', spread: 'SPREAD', rapid: 'RAPID', pierce: 'PIERCE' };

/** Seconds a weapon lasts; being hit loses it sooner. */
export const WEAPON_TIME = 12;
/** Chance a shot-down alien drops a capsule: about one or two a wave of 55. The saucer always drops one. */
export const DROP_CHANCE = 0.028;
/** No more than this many capsules falling at once. */
export const MAX_CAPSULES = 2;
export const CAPSULE_W = 9, CAPSULE_H = 7, CAPSULE_SPEED = 32;
/** Rapid fire: shots in the air at once, and the gap between them. */
export const RAPID_SHOTS = 3, RAPID_GAP = 0.12;
/** Spread: sideways speed of the outer shots (px/s). Twin: gap either side of the barrel. */
export const SPREAD_VX = 70, TWIN_GAP = 3;
/** The lightning laser: how long a bolt lights the column, and the wait before the next one. */
export const BEAM_TIME = 0.24, BEAM_COOLDOWN = 0.55;

export type Shot = { x: number; y: number; vx: number };
export type Capsule = { x: number; y: number; w: Drop };

/** The shots one press of FIRE launches, from the barrel's tip. */
export function volley(w: Weapon, x: number, y: number): Shot[] {
  if (w === 'twin') return [{ x: x - TWIN_GAP, y, vx: 0 }, { x: x + TWIN_GAP, y, vx: 0 }];
  if (w === 'spread') return [{ x, y, vx: -SPREAD_VX }, { x, y, vx: 0 }, { x, y, vx: SPREAD_VX }];
  if (w === 'pierce') return [];                      // the laser is a beam, not a shot
  return [{ x, y, vx: 0 }];
}

/** Whether FIRE may launch now. The basic cannon, Twin and Spread wait for the last volley to finish;
    Rapid keeps up to three in the air, a short gap apart; the laser waits for its cooldown. */
export function canFire(w: Weapon, inAir: number, cooldown: number): boolean {
  if (cooldown > 0) return false;
  if (w === 'rapid') return inAir < RAPID_SHOTS;
  if (w === 'pierce') return true;
  return inAir === 0;
}
/** The wait after firing before the next press counts. */
export const fireGap = (w: Weapon) => (w === 'rapid' ? RAPID_GAP : w === 'pierce' ? BEAM_COOLDOWN : 0);

/** Does a shot-down alien drop a capsule? `rand` is 0..1. */
export const rollDrop = (rand: number, falling: number) => falling < MAX_CAPSULES && rand < DROP_CHANCE;

/** What a new capsule holds: any weapon but the one you already have, or a speed boost. */
export function pickDrop(rand: number, current: Weapon): Drop {
  const pool = DROPS.filter(w => w !== current);
  return pool[Math.min(pool.length - 1, Math.floor(rand * pool.length))];
}

/** A capsule (top-left x, y) touching the cannon (left px, top cy, 13 × 7). */
export const catches = (c: Capsule, px: number, cy: number) =>
  c.x + CAPSULE_W > px && c.x < px + 13 && c.y + CAPSULE_H >= cy && c.y < cy + 7;

/** The weapon after a step: it runs out when its time does. */
export function tickWeapon(w: Weapon, t: number, dt: number): { w: Weapon; t: number } {
  if (w === 'basic') return { w, t: 0 };
  t -= dt;
  return t > 0 ? { w, t } : { w: 'basic', t: 0 };
}

/** Is an alien's box (left x, width) in the laser's column? */
export const inBeam = (beamX: number, x: number, w: number) => beamX >= x - 1 && beamX < x + w + 1;

/** An alien bomb that hits a falling capsule sets it off: a blast this wide (radius, px) that bites
    walls, kills aliens and takes your cannon unless the shield is up. Your own shot (or the laser) sets
    one off too, in the same wide blast, but that one spares your cannon. */
export const BLAST_R = 16;
/** Does an alien bomb (x, y, 4 tall) hit a capsule? */
export const bombHitsCapsule = (bx: number, by: number, c: Capsule) =>
  bx >= c.x && bx < c.x + CAPSULE_W && by + 4 >= c.y && by < c.y + CAPSULE_H;
/** Does your shot (x, y, 3 tall) hit a capsule? */
export const shotHitsCapsule = (sx: number, sy: number, c: Capsule) =>
  sx >= c.x && sx < c.x + CAPSULE_W && sy + 3 >= c.y && sy < c.y + CAPSULE_H;
/** Is a box (x, y, w, h) inside a blast centred at (cx, cy)? */
export function inBlast(cx: number, cy: number, x: number, y: number, w: number, h: number, r = BLAST_R){
  const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 <= r * r;
}

/** Speed capsules stack: each one adds a level (up to SPEED_MAX) and resets the timer to SPEED_TIME.
    Each level makes your shots this much faster. The boost runs on its own clock, separate from the
    weapon, and isn't lost when you're hit. */
export const SPEED_TIME = 60, SPEED_STEP = 0.35, SPEED_MAX = 5;
export const stackSpeed = (level: number) => ({ level: Math.min(SPEED_MAX, level + 1), t: SPEED_TIME });
export const shotSpeedFactor = (level: number) => 1 + SPEED_STEP * level;
export function tickSpeed(level: number, t: number, dt: number){
  if (!level) return { level: 0, t: 0 };
  t -= dt;
  return t > 0 ? { level, t } : { level: 0, t: 0 };
}

/** Your shot meeting an alien bomb sets off a smaller blast (radius, px) where they meet. It bites walls
    and takes out aliens and bombs around it, but never your own cannon. */
export const CLASH_R = 11;

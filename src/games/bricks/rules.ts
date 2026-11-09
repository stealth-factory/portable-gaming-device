/* Bricks' rules, with no console and no drawing: the court, the serve, a hit, and how a wall is filled.
   The game applies whatever these functions return. Nothing here is copied from a commercial board. */

export const SLOT_W = 24;
export const SLOT_H = 12;
export const EMBER = 4;
export const BAT_H = 6;
export const BAT_BOTTOM = 4;

export type BrickKind = 'clay' | 'kiln' | 'glass' | 'cinder' | 'anvil';
export interface Brick { kind: BrickKind; hits: number }
/** An empty slot. The only gaps in a wall. */
export type Cell = Brick | null;
export type Side = 'left' | 'right' | 'top' | 'bottom';
export type HDir = -1 | 0 | 1;

export interface BrickHit {
  /** What the slot holds afterwards. `null` means the brick is gone. */
  cell: Cell;
  vx: number;
  vy: number;
  points: number;
  /** Index of one neighbouring clay to remove, or -1. A cinder never names another cinder. */
  clay: number;
  bounced: boolean;
}

export interface EmberBody { x: number; y: number; vx: number; vy: number }
export interface BatBody { x: number; y: number; w: number }
export type BatHit =
  | { kind: 'bounce'; x: number; y: number; vx: number; vy: number }
  | { kind: 'deflect'; x: number; y: number; vx: number; vy: number }
  | { kind: 'miss' };

const RAD = Math.PI / 180;
const FOUR: readonly { dc: number; dr: number }[] = [
  { dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Degrees off the vertical axis the ember is travelling, positive to the right. A horizontal skim is ±90. */
export function travelDegrees(vx: number, vy: number): number {
  return Math.atan2(vx, Math.abs(vy)) * 180 / Math.PI;
}

/** Keep the speed. Pull the direction back into 12°–72° from the vertical so it cannot skim or drill one column. */
export function clampTravel(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return { vx: 0, vy: 0 };
  const deg = travelDegrees(vx, vy);
  const sign = deg < 0 ? -1 : 1;
  const mag = clamp(Math.abs(deg), 12, 72);
  const rad = sign * mag * RAD;
  const vySign = vy < 0 ? -1 : 1;
  return { vx: Math.sin(rad) * speed, vy: vySign * Math.cos(rad) * speed };
}

/** How far, in pixels, a full bow lifts the middle of the bat. The ends stay where they are. */
export const BEND_PX = 4;

/** Pixels the middle has risen. Positive is up the screen. `bend` runs from −1 to 1. */
export function bendRise(bend: number): number {
  return clamp(bend, -1, 1) * BEND_PX;
}

/** −1 when the stick or the newest up/down key says down, +1 for up, otherwise 0.
    A sideways stick does not cancel keys, so the keyboard can bow while it also slides.
    A tap is not a direction and never comes through here. */
export function bendIntent(stick: 'up' | 'down' | 'left' | 'right' | null, held: readonly ('up' | 'down' | 'left' | 'right')[]): -1 | 0 | 1 {
  if (stick === 'up') return 1;
  if (stick === 'down') return -1;
  const keys = held.filter(d => d === 'up' || d === 'down');
  const d = keys[keys.length - 1];
  if (d === 'up') return 1;
  if (d === 'down') return -1;
  return 0;
}

/** Ease `current` (−1..1) toward `target`. Letting go settles back instead of snapping flat. */
export function easeBend(current: number, target: -1 | 0 | 1, dt: number): number {
  const rate = target === 0 ? 8 : 14;
  const next = current + (target - current) * Math.min(1, rate * dt);
  if (target === 0 && Math.abs(next) < 0.02) return 0;
  return clamp(next, -1, 1);
}

/** Where along the bat `x` sits: −1 at the left end, 0 in the middle, 1 at the right. */
export function batT(x: number, batX: number, batW: number): number {
  return clamp((x - (batX + batW / 2)) / (batW / 2 || 1), -1, 1);
}

/** Top of the bowed bat. `rise` lifts the middle; the ends stay at `endTop`. */
export function batTopAt(endTop: number, t: number, rise: number): number {
  const u = clamp(t, -1, 1);
  return endTop - rise * (1 - u * u);
}

/** Degrees from straight up, positive to the right. A serve from the middle is 18° toward `lastDir`.
    `rise` is the bow in pixels. The slope of that curve is added to the angle; a flat bat is unchanged.
    This is the face of the bat, not a table of zones. */
export function batSigned(contactX: number, batCentreX: number, batW: number, batDir: HDir, lastDir: -1 | 1, rise = 0): number {
  const offset = clamp((contactX - batCentreX) / (batW / 2 || 1), -1, 1);
  let signed = offset * 55 + batDir * 8;
  if (rise !== 0 && batW > 0) {
    const slope = (4 * rise * offset) / batW;
    signed += Math.atan(slope) / RAD;
  }
  if (Math.abs(signed) < 18) signed = 18 * lastDir;
  return clamp(signed, -72, 72);
}

export function velocityFromSigned(signed: number, speed: number): { vx: number; vy: number } {
  const rad = signed * RAD;
  return { vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed };
}

/** The side of `slot` the ember was on before this step. A corner uses the stronger axis of travel. */
export function approachSide(px: number, py: number, slot: { x: number; y: number; w: number; h: number }, vx: number, vy: number): Side {
  const fromTop = py + EMBER <= slot.y + 0.5;
  const fromBottom = py >= slot.y + slot.h - 0.5;
  const fromLeft = px + EMBER <= slot.x + 0.5;
  const fromRight = px >= slot.x + slot.w - 0.5;
  const vertical = fromTop || fromBottom;
  const horizontal = fromLeft || fromRight;
  if (vertical && !horizontal) return fromTop ? 'top' : 'bottom';
  if (horizontal && !vertical) return fromLeft ? 'left' : 'right';
  if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? 'left' : 'right';
  return vy >= 0 ? 'top' : 'bottom';
}

function reflect(vx: number, vy: number, side: Side): { vx: number; vy: number } {
  const nx = side === 'left' || side === 'right' ? -vx : vx;
  const ny = side === 'top' || side === 'bottom' ? -vy : vy;
  return clampTravel(nx, ny);
}

/** The four-neighbour the ember came from. A tie prefers the horizontal side. */
function cameFrom(vx: number, vy: number): { dc: number; dr: number } {
  if (Math.abs(vx) >= Math.abs(vy)) return { dc: vx >= 0 ? -1 : 1, dr: 0 };
  return { dc: 0, dr: vy >= 0 ? -1 : 1 };
}

function clayNeighbour(cells: readonly Cell[], cols: number, index: number, vx: number, vy: number): number {
  const rows = Math.ceil(cells.length / cols);
  const r = Math.floor(index / cols), c = index % cols;
  const prefer = cameFrom(vx, vy);
  const order = [prefer, ...FOUR.filter(d => d.dc !== prefer.dc || d.dr !== prefer.dr)];
  for (const d of order) {
    const nc = c + d.dc, nr = r + d.dr;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
    const i = nr * cols + nc;
    if (cells[i]?.kind === 'clay') return i;
  }
  return -1;
}

/** One brick, one hit. Glass keeps the velocity. An anvil stays. A cinder names at most one clay. */
export function resolveBrick(cells: readonly Cell[], cols: number, index: number, vx: number, vy: number, side: Side): BrickHit {
  const brick = cells[index];
  if (!brick) return { cell: null, vx, vy, points: 0, clay: -1, bounced: false };
  switch (brick.kind) {
    case 'clay':
      return { cell: null, ...reflect(vx, vy, side), points: 10, clay: -1, bounced: true };
    case 'kiln':
      if (brick.hits < 1) return { cell: { kind: 'kiln', hits: 1 }, ...reflect(vx, vy, side), points: 20, clay: -1, bounced: true };
      return { cell: null, ...reflect(vx, vy, side), points: 50, clay: -1, bounced: true };
    case 'glass':
      return { cell: null, vx, vy, points: 20, clay: -1, bounced: false };
    case 'cinder':
      return { cell: null, ...reflect(vx, vy, side), points: 30, clay: clayNeighbour(cells, cols, index, vx, vy), bounced: true };
    case 'anvil':
      return { cell: brick, ...reflect(vx, vy, side), points: 0, clay: -1, bounced: true };
    default: {
      const never: never = brick.kind;
      return never;
    }
  }
}

/** Overlap with the bat, following the bow. A hit from above sends the ember up; a hit from below only shoves it out the end. */
export function resolveBat(ember: EmberBody, bat: BatBody, batDir: HDir, lastDir: -1 | 1, speed: number, rise = 0): BatHit {
  const overlapsX = ember.x < bat.x + bat.w && ember.x + EMBER > bat.x;
  if (!overlapsX) return { kind: 'miss' };
  const t = batT(ember.x + EMBER / 2, bat.x, bat.w);
  const top = batTopAt(bat.y, t, rise);
  const overlapsY = ember.y < top + BAT_H && ember.y + EMBER > top;
  if (!overlapsY) return { kind: 'miss' };
  const ecy = ember.y + EMBER / 2, bcy = top + BAT_H / 2;
  if (ecy <= bcy && ember.vy > 0) {
    const signed = batSigned(ember.x + EMBER / 2, bat.x + bat.w / 2, bat.w, batDir, lastDir, rise);
    const v = velocityFromSigned(signed, speed);
    return { kind: 'bounce', x: ember.x, y: top - 2 - EMBER, ...v };
  }
  if (ecy > bcy) {
    const ecx = ember.x + EMBER / 2, bcx = bat.x + bat.w / 2;
    const x = ecx < bcx ? bat.x - EMBER : bat.x + bat.w;
    return { kind: 'deflect', x, y: ember.y, vx: -ember.vx, vy: ember.vy };
  }
  return { kind: 'miss' };
}

export function columnCount(lw: number): number {
  return Math.max(1, Math.floor((lw - 8) / SLOT_W));
}

/** Rows before the bat-clearance trim: 4, 6 or 8 from the console's cell height. */
export function rowCountForHeight(h: number): number {
  if (h <= 8) return 4;
  if (h <= 12) return 6;
  return 8;
}

/** Drop a row until 36px remains above the bat. Never fewer than 3. */
export function fittedRows(h: number, lh: number, hud: number): number {
  let rows = rowCountForHeight(h);
  const batTop = lh - BAT_BOTTOM - BAT_H;
  const bandTop = hud + 6;
  while (rows > 3 && bandTop + rows * SLOT_H + 36 > batTop) rows -= 1;
  return rows;
}

export function bandX(lw: number, cols: number): number {
  return Math.round((lw - cols * SLOT_W) / 2);
}

/** Tube width first, then the wave. Wave 9 replaces the wave-5 trim; the bat is never narrower than 40. */
export function batWidth(lw: number, wave: number): number {
  let w = lw >= 360 ? 72 : lw >= 264 ? 56 : 48;
  if (wave >= 9) w -= 16;
  else if (wave >= 5) w -= 8;
  return Math.max(40, w);
}

export function baseSpeed(wave: number): number {
  return Math.min(220, 130 + 8 * (wave - 1));
}

/** 1 until the breakables left fall below 75%, 50% and 25% of the wave's starting count. */
export function thinMultiplier(left: number, start: number): number {
  if (start <= 0) return 1;
  const f = left / start;
  if (f < 0.25) return 1.12;
  if (f < 0.5) return 1.08;
  if (f < 0.75) return 1.04;
  return 1;
}

export function waveSpeed(wave: number, left: number, start: number): number {
  return Math.min(220, baseSpeed(wave) * thinMultiplier(left, start));
}

export function isBreakable(cell: Cell): boolean {
  return cell != null && cell.kind !== 'anvil';
}

export function breakableCount(cells: readonly Cell[]): number {
  let n = 0;
  for (const c of cells) if (isBreakable(c)) n += 1;
  return n;
}

/** Clear when no clay, kiln, glass or cinder remains. Anvils do not have to go. */
export function wallCleared(cells: readonly Cell[]): boolean {
  return breakableCount(cells) === 0;
}

export interface Quotas { empty: number; kiln: number; glass: number; cinder: number; anvil: number }

export function emptyFraction(wave: number): number {
  if (wave <= 1) return 0.18;
  return Math.max(0.08, 0.18 - 0.02 * (wave - 1));
}

export function quotas(wave: number, cols: number, rows: number): Quotas {
  const cells = cols * rows;
  return {
    empty: Math.round(cells * emptyFraction(wave)),
    kiln: wave <= 1 ? 0 : Math.round(cells * Math.min(0.35, 0.08 * (wave - 1))),
    glass: wave < 3 ? 0 : Math.round(cells * Math.min(0.2, 0.05 * (wave - 2))),
    cinder: wave < 5 ? 0 : Math.min(4, wave - 4),
    anvil: wave < 4 ? 0 : Math.min(Math.floor(cols / 3), wave - 3),
  };
}

function shuffle(idxs: readonly number[], rng: () => number): number[] {
  const a = idxs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function adjacent(cols: number, a: number, b: number): boolean {
  const ar = Math.floor(a / cols), ac = a % cols;
  const br = Math.floor(b / cols), bc = b % cols;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

/** Fill with clay, carve holes, upgrade clay, then lay anvils on clay that is still there.
    Forty tries is the budget for one quota. A rule is never broken to hit the number. */
export function buildWall(wave: number, cols: number, rows: number, rng: () => number): Cell[] {
  const cells: Cell[] = Array.from({ length: cols * rows }, () => ({ kind: 'clay' as const, hits: 0 }));
  const q = quotas(wave, cols, rows);
  const all = shuffle(cells.map((_, i) => i), rng);
  for (let n = 0; n < q.empty && n < all.length; n++) cells[all[n]!] = null;

  const place = (n: number, pool: number[], ok: (i: number) => boolean, paint: (i: number) => void) => {
    if (n <= 0 || pool.length === 0) return;
    const order = shuffle(pool, rng);
    let tries = 0, placed = 0;
    for (const i of order) {
      if (placed >= n || tries >= 40) break;
      tries += 1;
      if (cells[i]?.kind !== 'clay' || !ok(i)) continue;
      paint(i);
      placed += 1;
    }
  };
  const clay = () => cells.flatMap((c, i) => (c?.kind === 'clay' ? [i] : []));
  place(q.kiln, clay(), () => true, i => { cells[i] = { kind: 'kiln', hits: 0 }; });
  place(q.glass, clay(), () => true, i => { cells[i] = { kind: 'glass', hits: 0 }; });
  const cinders: number[] = [];
  place(q.cinder, clay(), i => cinders.every(p => !adjacent(cols, i, p)), i => {
    cells[i] = { kind: 'cinder', hits: 0 };
    cinders.push(i);
  });
  const anvils: number[] = [];
  const anvilPool = clay().filter(i => Math.floor(i / cols) < rows - 2);
  place(q.anvil, anvilPool, i => anvils.every(p => !adjacent(cols, i, p)), i => {
    cells[i] = { kind: 'anvil', hits: 0 };
    anvils.push(i);
  });
  return cells;
}

/* ---------- falling capsules ---------- */

/** About one broken brick in six releases a capsule. Never more than this many in the air. */
export const DROP_CHANCE = 0.18;
export const MAX_FALLING = 4;
/** The next this many breakable bricks the ember leaves, without bouncing. */
export const SEAR_HITS = 3;
export const WIDE_MUL = 1.5;
export const NARROW_MUL = 0.6;
export const FAST_MUL = 1.35;
export const SLOW_MUL = 0.75;

/** Original names. Broad and Slim change the bat, Flare and Damp the ember, Sear the next bricks. */
export type DropKind = 'broad' | 'slim' | 'flare' | 'damp' | 'sear';
export const DROP_KINDS: readonly DropKind[] = ['broad', 'slim', 'flare', 'damp', 'sear'];
export const DROP_LABEL: Record<DropKind, string> = {
  broad: 'BROAD', slim: 'SLIM', flare: 'FLARE', damp: 'DAMP', sear: 'SEAR',
};

export type SizeMod = 'broad' | 'slim' | null;
export type PaceMod = 'flare' | 'damp' | null;

/** A brick that has actually broken may release one capsule. An anvil never does, and a kiln that only cracks has not broken. */
export function brickReleasesDrop(kind: BrickKind, removed: boolean, rand: number, falling = 0, max = MAX_FALLING): boolean {
  if (kind === 'anvil' || !removed || falling >= max) return false;
  return rand < DROP_CHANCE;
}

export function pickDrop(rand: number): DropKind {
  return DROP_KINDS[Math.min(DROP_KINDS.length - 1, Math.floor(rand * DROP_KINDS.length))]!;
}

/** A new size replaces the last. A new speed replaces the last. Sear arms three hits. */
export function applyCatch(size: SizeMod, pace: PaceMod, sear: number, kind: DropKind): { size: SizeMod; pace: PaceMod; sear: number } {
  switch (kind) {
    case 'broad':
    case 'slim':
      return { size: kind, pace, sear };
    case 'flare':
    case 'damp':
      return { size, pace: kind, sear };
    case 'sear':
      return { size, pace, sear: SEAR_HITS };
    default: {
      const never: never = kind;
      return never;
    }
  }
}

/** Missing the ember clears the bat's size and the ember's speed. Sear charges stay until they are spent. */
export function loseEmberMods(size: SizeMod, pace: PaceMod, sear: number): { size: SizeMod; pace: PaceMod; sear: number } {
  return { size: null, pace: null, sear };
}

export function batWidthWith(base: number, size: SizeMod): number {
  if (size === 'broad') return Math.round(base * WIDE_MUL);
  if (size === 'slim') return Math.round(base * NARROW_MUL);
  return base;
}

export function paceMultiplier(pace: PaceMod): number {
  if (pace === 'flare') return FAST_MUL;
  if (pace === 'damp') return SLOW_MUL;
  return 1;
}

export function pacedSpeed(wave: number, pace: PaceMod): number {
  return wave * paceMultiplier(pace);
}

export interface PoweredHit { vx: number; vy: number; bounced: boolean; charges: number }

/** While Sear has charges, a breakable brick does not bounce the ember.
    A charge is spent only when the ember leaves that brick. Anvils always bounce and spend nothing.
    Glass never bounces and spends nothing. */
export function applySear(
  kind: BrickKind,
  removed: boolean,
  charges: number,
  incoming: { vx: number; vy: number },
  bounced: { vx: number; vy: number; bounced: boolean },
): PoweredHit {
  if (kind === 'anvil') return { vx: bounced.vx, vy: bounced.vy, bounced: true, charges };
  if (kind === 'glass') return { vx: incoming.vx, vy: incoming.vy, bounced: false, charges };
  if (charges <= 0) return { vx: bounced.vx, vy: bounced.vy, bounced: bounced.bounced, charges };
  return { vx: incoming.vx, vy: incoming.vy, bounced: false, charges: removed ? charges - 1 : charges };
}

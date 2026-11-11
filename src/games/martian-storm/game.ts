/* Martian Storm: one skiff, eight legs of dust, a tuck on BOOST, a bomb beside FIRE, guns that stack, and hearts to lose.
   No escorts, no bosses. */
import type { ConsoleAPI, CreateGame } from '../types';
import type { Fx, Round, Score } from '../../kit/play';
import { drawHud, drawSprite, makeFx, makeRound, makeScore, overlaps, play } from '../../kit/play';
import {
  BARB_H, BARB_W, BOMB_ICON, SHOT_BOX, SKIFF_H, SKIFF_MINI, SKIFF_W, SLAB_H, SLAB_W, SPEED_ICON, SPORE_H, SPORE_W,
  TOKEN_H, TOKEN_W, drawBarb, drawBlast, drawHeart, drawPellet, drawPickup, drawShot, drawSkiff, drawSlab, drawSpore,
} from './art';
import {
  BOMB_DMG, BOMB_SECS, BOMBS_START, CLEAR_SECS, EXTRA_EVERY, FLIGHT_TRIES, HEARTS_START, HIT_GRACE, LEG_CLOCK,
  LEGS, LIFE_CAP, LIVES_START, MAX_CRAFT, MISSILE_COOLDOWN, PICKUP_CAP, SLAB_HP, SLAB_WAIT, TUCK_CAP, TUCK_SECS, TUCKS_START,
  WEAPON_MAX, WEAPON_NAME,
  arsenalLabel, beatFits, beatSchedule, capsuleWeapon, catchGift, catchGun, clampSkiff, damage, dropFor, flightOffsets,
  flightVelocity, gunsOf, hpFor, insetBox, landingBonus, legReward, missileSalvo, offerToken, onSporeGone, pelletSpeed,
  scrollSpeed, skiffSpeed, skiffVelocity, spendBomb, spendTuck, steerMissile, takeHit, touchBox, volley, volleyFits,
  weaponCooldown,
} from './rules';
import type { Arsenal, Beat, CapsuleWeapon, FlightShape, FlightState, PickupKind, ShotKind, ShotSpec, Weapon } from './rules';

let api: ConsoleAPI;
let fx: Fx;
let score: Score;
let round: Round;

type Kind = 'spore' | 'barb' | 'slab';
interface Craft {
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  hp: number;
  flight: number;
  fired: boolean;
  leaving: boolean;
  alive: boolean;
}
interface Shot {
  kind: ShotKind;
  x: number; y: number;
  vx: number; vy: number;
  dmg: number;
  pierce: boolean;
  /** A wave shot weaves about this line. */
  ox: number;
  amp: number;
  phase: number;
  age: number;
  /** Craft a beam has already gone through, so it hits each once. */
  hit: Craft[];
  /** A missile's target, picked again when it is gone. */
  target: Craft | null;
}
interface Pellet { x: number; y: number; vx: number; vy: number }
interface Pickup { kind: PickupKind; x: number; y: number; age: number; first: number }
interface Mote { x: number; y: number; w: number; h: number; role: 'dirt' | 'textDim' }

let x = 0;
let y = 0;
let vx = 0;
let vy = 0;
let tucks = TUCKS_START;
let hearts = HEARTS_START;
/** The guns on board, stacked; empty is the blaster. `lastGun` is the one caught most recently. */
let arsenal: Arsenal = {};
let lastGun: Weapon = 'blaster';
/** Speed pickups on board, 0 to SPEED_MAX. */
let boosts = 0;
/** Bombs on board, and what is left of the one going off. */
let bombs = BOMBS_START;
let bombLeft = 0;
let bombLatched = false;
let bombX = 0;
let bombY = 0;
/** The next leg is coming out of the warp: the dust slows back to its pace while READY shows. */
let warpIn = false;
let missileCool = 0;
let capsuleSeq = 0;
let tuckLeft = 0;
let boostLatched = false;
let blinkLeft = 0;
/** Each gun's own clock between volleys. */
let cools: Partial<Record<Weapon, number>> = {};
let shots: Shot[] = [];
let enemies: Craft[] = [];
let pellets: Pellet[] = [];
let flights = new Map<number, FlightState>();
let flightSeq = 0;
let pickups: Pickup[] = [];
let dust: Mote[] = [];
let schedule: Beat[] = [];
let beatI = 0;
let clock = 0;
let waitT = 0;
let overtime = false;
let flying = false;
let settled = false;
let grounding = false;
let groundT = 0;
let done = false;
let side: 0 | 1 = 0;
let landFrom = { x: 0, y: 0 };
let legRng: () => number = () => 0;
/** Set only by debug.untouchable, so a capture can run on without losing the skiff. */
let untouchable = false;

const CLEAR_JINGLE = { notes: [392, 523, 659], dur: 0.09, vol: 0.045, gap: 0.1 };
const EXTRA_JINGLE = { notes: [523, 659, 784, 1046], dur: 0.08, vol: 0.045, gap: 0.08 };
const GROUNDED_JINGLE = { notes: [523, 392, 330, 220], dur: 0.07, vol: 0.05, gap: 0.08 };
const POWER_JINGLE = { notes: [659, 784, 988], dur: 0.05, vol: 0.045, gap: 0.05 };
const LIFE_JINGLE = { notes: [784, 988, 1175, 1568], dur: 0.06, vol: 0.05, gap: 0.06 };
const SLAB_BREAK = { notes: [180, 90], dur: 0.08, vol: 0.05, gap: 0.07 };

const sizeOf = (kind: Kind) => kind === 'spore' ? { w: SPORE_W, h: SPORE_H } : kind === 'barb' ? { w: BARB_W, h: BARB_H } : { w: SLAB_W, h: SLAB_H };

function placeSkiff() {
  const p = clampSkiff(api.LW / 2 - SKIFF_W / 2, api.LH - 4 - SKIFF_H, SKIFF_W, SKIFF_H, api.LW, api.LH, api.HUD);
  x = p.x;
  y = p.y;
  vx = 0;
  vy = 0;
}

function makeDust(rng: () => number) {
  const motes: Mote[] = [];
  const span = api.LH - api.HUD;
  for (let i = 0; i < 26; i++) {
    const dash = rng() < 0.72;
    motes.push({
      x: rng() * api.LW,
      y: api.HUD + rng() * span,
      w: dash ? 4 + Math.floor(rng() * 6) : 3,
      h: dash ? 1 : 2,
      // dim, so the dust never reads as a shot or a spore
      role: 'dirt',
    });
  }
  dust = motes;
}

/** A leg starts with at least three tucks; any extra ones caught carry over, like the guns, speed, bombs and hearts. */
function beginLeg(leg: number) {
  tucks = Math.max(tucks, TUCKS_START);
  bombLeft = 0;
  missileCool = 0;
  tuckLeft = 0;
  boostLatched = false;
  blinkLeft = 0;
  cools = {};
  shots = [];
  enemies = [];
  pellets = [];
  flights = new Map();
  flightSeq = 0;
  pickups = [];
  beatI = 0;
  clock = 0;
  waitT = 0;
  overtime = false;
  flying = false;
  settled = false;
  grounding = false;
  groundT = 0;
  done = false;
  side = 0;
  legRng = api.mulberry32(leg * 10007 + 17);
  schedule = beatSchedule(leg, legRng);
  makeDust(api.mulberry32(leg * 10007 + 91));
  placeSkiff();
  landFrom = { x, y };
}

function padBox() {
  const w = 26, h = 3;
  return { x: Math.round(api.LW / 2 - w / 2), y: api.LH - 4 - h, w, h };
}

/** Where every skiff starts: the middle of the bottom edge. The warp between legs glides it there. */
function homeAnchor() {
  return clampSkiff(api.LW / 2 - SKIFF_W / 2, api.LH - 4 - SKIFF_H, SKIFF_W, SKIFF_H, api.LW, api.LH, api.HUD);
}

/** How far into the warp between legs, 0 (the storm's own pace) to 1 (flat out). It builds through LEG CLEARED
    and dies away through the next leg's READY. The last leg lands on its pad instead. */
const WARP_SPEED = 560;
const READY_SECS = 1.2;
function warpFactor(): number {
  const { mode, modeT } = api.S;
  if (mode === 'clear' && !grounding) { const k = 1 - Math.max(0, modeT) / CLEAR_SECS; return k * k; }
  if (mode === 'ready' && warpIn) { const k = Math.max(0, modeT) / READY_SECS; return k * k; }
  return 0;
}

/** The dust falls at the leg's pace, or much faster while warping. */
function moveDust(dt: number) {
  const base = scrollSpeed(api.S.level);
  const speed = base + (WARP_SPEED - base) * warpFactor();
  for (const mote of dust) {
    mote.y += speed * dt;
    if (mote.y > api.LH) mote.y = api.HUD - mote.h;
  }
}

function padAnchor() {
  const pad = padBox();
  return clampSkiff(pad.x + pad.w / 2 - SKIFF_W / 2, pad.y - SKIFF_H, SKIFF_W, SKIFF_H, api.LW, api.LH, api.HUD);
}

function ease(left: number, total: number) {
  const u = 1 - Math.max(0, Math.min(1, left / total));
  const e = u * u * (3 - 2 * u);
  const target = grounding ? padAnchor() : homeAnchor();
  x = landFrom.x + (target.x - landFrom.x) * e;
  y = landFrom.y + (target.y - landFrom.y) * e;
  vx = 0;
  vy = 0;
}

function steer(dt: number) {
  const v = skiffVelocity(api.held, api.stickDir, skiffSpeed(boosts));
  vx = v.vx;
  vy = v.vy;
  const next = clampSkiff(x + vx * dt, y + vy * dt, SKIFF_W, SKIFF_H, api.LW, api.LH, api.HUD);
  x = next.x;
  y = next.y;
}

function readTuck() {
  // One tuck per press. A held key repeats and re-queues BOOST; that must not chain.
  if (api.boostHeld) {
    if (boostLatched) { api.clearBoost(); return; }
    if (!api.boostQueued) return;
    boostLatched = true;
  } else {
    boostLatched = false;
    if (!api.boostQueued) return;
  }
  api.clearBoost();
  if (tuckLeft > 0) return;
  const spent = spendTuck(tucks);
  tucks = spent.tucks;
  if (!spent.ok) {
    api.tone(90, 0.05, 0.05);
    return;
  }
  tuckLeft = TUCK_SECS;
  api.tone(200, 0.2, 0.05, 400);
}

/** The bomb button (V, or the BOMB key beside FIRE) is lit only while a bomb is left. */
function syncBombKey() {
  api.setButtons({ fireR: { enabled: bombs > 0 } });
}

/** One bomb per press; a held key that repeats does not chain them. */
function readBomb() {
  const key = api.button('fireR');
  if (key.held) {
    if (bombLatched) { api.clearButton('fireR'); return; }
    if (!key.queued) return;
    bombLatched = true;
  } else {
    bombLatched = false;
    if (!key.queued) return;
  }
  api.clearButton('fireR');
  if (bombLeft > 0) return;
  const spent = spendBomb(bombs);
  if (!spent.ok) { api.tone(90, 0.05, 0.05); return; }
  bombs = spent.bombs;
  syncBombKey();
  detonate();
}

/** Every spore and barb on screen goes, the sky is swept of pellets, and anything tougher takes BOMB_DMG. */
function detonate() {
  bombLeft = BOMB_SECS;
  bombX = x + SKIFF_W / 2;
  bombY = y + SKIFF_H / 2;
  pellets = [];
  for (const craft of enemies) {
    if (!craft.alive) continue;
    const s = sizeOf(craft.kind);
    if (craft.y + s.h < api.HUD || craft.y > api.LH || craft.x + s.w < 0 || craft.x > api.LW) continue;
    strike(craft, BOMB_DMG);
  }
  api.tone(70, 0.5, 0.07, -40);
  api.tone(140, 0.3, 0.05, -100, 0.05);
  api.buzz([60, 40, 120]);
  api.track('bomb', { game: 'martian-storm', level: api.S.level });
}

function launch(spec: ShotSpec, nose: number, top: number) {
  const box = SHOT_BOX[spec.kind];
  shots.push({
    kind: spec.kind, x: nose + spec.dx - box.w / 2, y: top, vx: spec.vx, vy: spec.vy, dmg: spec.dmg, pierce: spec.pierce,
    ox: nose + spec.dx - box.w / 2, amp: spec.amp ?? 0, phase: spec.phase ?? 0, age: 0, hit: [], target: null,
  });
}

const GUN_TONE: Record<Weapon, number> = { blaster: 680, spread: 600, laser: 1040, missile: 680, wave: 760 };

/** Every gun on board fires on its own clock while FIRE is held. */
function guns(dt: number) {
  for (const w of Object.keys(cools) as Weapon[]) cools[w] = Math.max(0, (cools[w] ?? 0) - dt);
  missileCool = Math.max(0, missileCool - dt);
  // A tap that lands and lifts between frames is queued, not held. Leave it queued until a gun is ready.
  if (!(api.fireHeld || api.tapHeld || api.fireQueued || api.tapQueued)) return;
  const nose = x + SKIFF_W / 2;
  const top = y - 4;
  let fired: Weapon | null = null;
  for (const { weapon, level } of gunsOf(arsenal)) {
    if ((cools[weapon] ?? 0) > 0) continue;
    const specs = volley(weapon, level);
    if (!volleyFits(shots.length, specs.length)) continue;
    for (const spec of specs) launch(spec, nose, top);
    cools[weapon] = weaponCooldown(weapon);
    fired = fired ?? weapon;
    if (weapon === 'missile' && missileCool <= 0) {
      const salvo = missileSalvo(level);
      if (volleyFits(shots.length, salvo.length)) {
        for (const spec of salvo) launch(spec, nose, y + 2);
        missileCool = MISSILE_COOLDOWN;
        api.tone(260, 0.06, 0.03, 200);
      }
    }
  }
  if (!fired) return;
  api.tone(GUN_TONE[fired], 0.04, 0.03);
  api.buzz('fire');
  api.clearFire();
  api.clearTap();
}

function spawnFlight(): boolean {
  const scroll = scrollSpeed(api.S.level);
  const taken = enemies.filter(e => e.alive && e.y < api.HUD + 36).map(e => {
    const s = sizeOf(e.kind);
    return { x: e.x, y: e.y, w: s.w, h: s.h };
  });
  for (let n = 0; n < FLIGHT_TRIES; n++) {
    const shape: FlightShape = legRng() < 0.5 ? 'v' : 'file';
    const sign: -1 | 1 = side === 0 ? 1 : -1;
    const offs = flightOffsets(shape, sign);
    const minX = Math.min(...offs.map(o => o.x));
    const maxX = Math.max(...offs.map(o => o.x));
    const lo = 4 - minX;
    const hi = api.LW - 4 - SPORE_W - maxX;
    if (hi <= lo) continue;
    const mid = (lo + hi) / 2;
    const anchor = (side === 0 ? lo : mid) + legRng() * Math.max(1, (side === 0 ? mid : hi) - (side === 0 ? lo : mid));
    const boxes = offs.map(o => ({ x: anchor + o.x, y: api.HUD - 1 + o.y, w: SPORE_W, h: SPORE_H }));
    if (boxes.some(b => b.x < 2 || b.x + b.w > api.LW - 2)) continue;
    if (boxes.some(b => taken.some(t => overlaps(b, t)))) continue;
    const id = ++flightSeq;
    flights.set(id, { left: 4, hits: 0 });
    const vel = flightVelocity(shape, sign, scroll);
    for (const b of boxes) {
      enemies.push({
        kind: 'spore', x: b.x, y: b.y, vx: vel.vx, vy: vel.vy,
        hp: hpFor('spore'), flight: id, fired: false, leaving: false, alive: true,
      });
    }
    return true;
  }
  return false;
}

function spawnBarb() {
  const scroll = scrollSpeed(api.S.level);
  const bandW = Math.max(8, api.LW * 0.32);
  const x0 = side === 0 ? 8 + legRng() * bandW : api.LW - 8 - BARB_W - legRng() * bandW;
  enemies.push({
    kind: 'barb', x: x0, y: api.HUD - BARB_H,
    vx: side === 0 ? 16 : -16, vy: scroll + 22,
    hp: hpFor('barb'), flight: -1, fired: false, leaving: false, alive: true,
  });
}

function spawnSlab() {
  enemies.push({
    kind: 'slab', x: Math.round(api.LW / 2 - SLAB_W / 2), y: api.HUD - SLAB_H,
    vx: 0, vy: scrollSpeed(api.S.level),
    hp: hpFor('slab'), flight: -1, fired: false, leaving: false, alive: true,
  });
}

function spawnDue() {
  while (beatI < schedule.length && schedule[beatI]!.t <= clock && schedule[beatI]!.t < LEG_CLOCK) {
    const beat = schedule[beatI]!;
    if (beat.kind === 'gap') { beatI += 1; continue; }
    const incoming = beat.kind === 'flight' ? 4 : 1;
    if (!beatFits(enemies.filter(e => e.alive).length, incoming, MAX_CRAFT)) break;
    if (beat.kind === 'flight') spawnFlight();
    else if (beat.kind === 'barb') spawnBarb();
    else spawnSlab();
    side = side === 0 ? 1 : 0;
    beatI += 1;
  }
}

/** A pickup starts to fall. `sure` (a slab's reward) goes in even when the cap is full. */
function drop(kind: PickupKind, px: number, py: number, sure = false) {
  if (pickups.length >= PICKUP_CAP && !sure) return;
  pickups.push({ kind, x: px, y: py, age: 0, first: capsuleSeq++ % 4 });
}

function capsuleFalling(): boolean {
  return pickups.some(p => p.kind === 'weapon');
}

function noteSpore(craft: Craft, how: 'hit' | 'left') {
  const flight = flights.get(craft.flight);
  if (!flight) return;
  const result = onSporeGone(flight, how);
  flights.set(craft.flight, result.flight);
  if (!offerToken(capsuleFalling(), result.drop)) return;
  // earned by shooting the flight down, so it is never turned away by the cap
  drop('weapon', craft.x, craft.y, true);
}

/** One shot (or a ram) lands on a craft. True when it is destroyed. */
function strike(craft: Craft, dmg: number, scored = true): boolean {
  const hit = damage(craft.hp, dmg);
  craft.hp = hit.hp;
  if (!hit.gone) { api.tone(craft.kind === 'slab' ? 140 : 300, 0.03, 0.04); return false; }
  craft.alive = false;
  const s = sizeOf(craft.kind);
  const cx = craft.x + s.w / 2, cy = craft.y + s.h / 2;
  if (craft.kind === 'slab') {
    if (scored) score.add(80, cx, craft.y);
    play(api, SLAB_BREAK);
    const got = dropFor('slab', legRng());
    if (got) drop(got, cx - TOKEN_W / 2, cy, true);
    return true;
  }
  const points = craft.kind === 'spore' ? 20 : 40;
  if (scored) score.add(points, craft.x, craft.y);
  api.tone(craft.kind === 'spore' ? 520 : 400, 0.04, 0.04);
  fx.burst(cx - 2, cy - 2, 0.2, ['# #', ' # ', '# #'], 'spark');
  if (craft.kind === 'spore') noteSpore(craft, scored ? 'hit' : 'left');
  else {
    const got = dropFor('barb', legRng());
    if (got) drop(got, cx - TOKEN_W / 2, cy);
  }
  return true;
}

function loseSkiff() {
  api.tone(440, 0.25, 0.05, -400);
  api.track('life_lost', { game: 'martian-storm', level: api.S.level });
  tuckLeft = 0;
  fx.burst(x, y, 0.35, [
    ' # # ',
    '#   #',
    ' # # ',
    '#   #',
    ' # # ',
  ], 'spark');
  round.lose({ secs: 1.1 });
}

/** A shot or a ram: one heart, and a blink of safety. The last heart loses the skiff. */
function hurt() {
  if (api.S.mode !== 'play' || settled || untouchable || bombLeft > 0) return;
  const hit = takeHit(hearts);
  hearts = hit.hearts;
  if (hit.lost) { loseSkiff(); return; }
  blinkLeft = HIT_GRACE;
  api.tone(220, 0.12, 0.05, -120);
  api.buzz('lose');
  fx.pop('-1', x + SKIFF_W / 2, y - 4, { role: 'spark' });
}

function open() {
  return tuckLeft <= 0 && blinkLeft <= 0 && api.S.mode === 'play' && !settled;
}

function beginLanding() {
  if (settled) return;
  settled = true;
  const leg = api.S.level;
  score.add(landingBonus(tucks, leg), api.LW / 2, api.HUD + 28);
  // A skiff for every leg cleared, as the brief asks.
  if (api.S.lives < LIFE_CAP) {
    api.S.lives = legReward(api.S.lives);
    fx.pop('1UP', api.LW / 2, api.HUD + 40, { role: 'gold' });
  }
  api.track('level_cleared', { game: 'martian-storm', level: leg });
  landFrom = { x, y };
  // anything still falling when the skiff heads for the pad is caught on the way down, so a reward from the last
  // slab is not lost when play stops
  for (const p of pickups) collect(p);
  pickups = [];
  if (leg >= 8) {
    grounding = true;
    groundT = CLEAR_SECS;
    play(api, GROUNDED_JINGLE);
    return;
  }
  play(api, CLEAR_JINGLE);
  // the storm rushes past as the skiff speeds on to the next leg
  api.tone(160, CLEAR_SECS, 0.03, 700);
  round.clear({ secs: CLEAR_SECS });
}

function windDown(dt: number) {
  if (!overtime) { overtime = true; waitT = 0; }
  waitT += dt;
  const slabs = enemies.filter(e => e.alive && e.kind === 'slab');
  if (slabs.length > 0 && waitT < SLAB_WAIT && !flying) return;
  flying = true;
  for (const slab of slabs) { slab.leaving = true; slab.vx = 0; slab.vy = -160; }
  if (!enemies.some(e => e.alive && e.kind === 'slab')) beginLanding();
}

function nearestCraft(sx: number, sy: number): Craft | null {
  let best: Craft | null = null, bestD = Infinity;
  for (const craft of enemies) {
    if (!craft.alive || craft.leaving || craft.y < api.HUD - 4) continue;
    const s = sizeOf(craft.kind);
    const d = Math.hypot(craft.x + s.w / 2 - sx, craft.y + s.h / 2 - sy);
    if (craft.y + s.h / 2 < sy + 8 && d < bestD) { best = craft; bestD = d; }
  }
  return best;
}

function moveShots(dt: number) {
  for (const shot of shots) {
    shot.age += dt;
    if (shot.kind === 'missile') {
      const speed = Math.min(200, 70 + shot.age * 260);
      if (!shot.target || !shot.target.alive || shot.target.leaving) shot.target = nearestCraft(shot.x, shot.y);
      if (shot.age > 0.12 && shot.target) {
        const s = sizeOf(shot.target.kind);
        const v = steerMissile(shot.vx, shot.vy, shot.target.x + s.w / 2 - shot.x, shot.target.y + s.h / 2 - shot.y, 7 * dt, speed);
        shot.vx = v.vx; shot.vy = v.vy;
      } else {
        const len = Math.hypot(shot.vx, shot.vy) || 1;
        const vx = shot.age > 0.12 ? shot.vx * 0.9 : shot.vx;
        const vy = shot.age > 0.12 ? Math.min(shot.vy, -speed * 0.8) : shot.vy;
        const k = speed / (Math.hypot(vx, vy) || len);
        shot.vx = vx * k; shot.vy = vy * k;
      }
    }
    shot.y += shot.vy * dt;
    if (shot.kind === 'wave') {
      shot.x = shot.ox + Math.sin(shot.age * 14 + shot.phase) * shot.amp * Math.min(1, shot.age * 6);
    } else shot.x += shot.vx * dt;
  }
  shots = shots.filter(shot => shot.y + 10 > api.HUD && shot.y < api.LH + 8 && shot.x > -8 && shot.x < api.LW + 8);
}

const GIFT_POP: Record<Exclude<PickupKind, 'weapon'>, string> = { heart: 'HEART', life: '1UP', tuck: 'TUCK', speed: 'SPEED', bomb: 'BOMB' };

/** Give the skiff a pickup it has caught. */
function collect(p: Pickup) {
  if (p.kind === 'weapon') {
    const got: CapsuleWeapon = capsuleWeapon(p.age, p.first);
    const next = catchGun(arsenal, got);
    arsenal = next.arsenal;
    lastGun = got;
    if (next.points) score.add(next.points, p.x, p.y);
    else fx.pop(WEAPON_NAME[got] + (next.level > 1 ? ' ' + next.level : ''), p.x, p.y, { role: 'gold' });
    play(api, POWER_JINGLE);
  } else {
    const next = catchGift(p.kind, { hearts, tucks: Math.min(TUCK_CAP, tucks), lives: api.S.lives, speed: boosts, bombs });
    if (p.kind === 'life' && next.lives > api.S.lives) play(api, LIFE_JINGLE);
    else api.tone(880, 0.06, 0.045);
    hearts = next.hearts;
    tucks = next.tucks;
    api.S.lives = next.lives;
    boosts = next.speed;
    if (next.bombs !== bombs) { bombs = next.bombs; syncBombKey(); }
    if (next.points) score.add(next.points, p.x, p.y);
    else fx.pop(GIFT_POP[p.kind], p.x, p.y, { role: 'gold' });
  }
  api.buzz('pickup');
}

/** Pickups fall with the dust. The skiff catches one with any part of it, blinking or not, but not mid-tuck. */
function catchPickups(dt: number) {
  const skiff = { x, y, w: SKIFF_W, h: SKIFF_H };
  pickups = pickups.filter(p => {
    p.age += dt;
    p.y += 40 * dt;
    if (p.y > api.LH) return false;
    if (api.S.mode !== 'play' || tuckLeft > 0 || !overlaps(skiff, { x: p.x, y: p.y, w: TOKEN_W, h: TOKEN_H })) return true;
    collect(p);
    return false;
  });
}

function combat(dt: number) {
  moveDust(dt);
  moveShots(dt);
  for (const craft of enemies) {
    if (!craft.alive) continue;
    craft.x += craft.vx * dt;
    craft.y += craft.vy * dt;
  }
  const line = api.HUD + 0.4 * (api.LH - api.HUD);
  for (const craft of enemies) {
    if (!craft.alive || craft.kind !== 'barb' || craft.fired || craft.leaving) continue;
    if (craft.y + BARB_H / 2 < line) continue;
    craft.fired = true;
    const pace = pelletSpeed(api.S.level);
    const bx = craft.x + BARB_W / 2, by = craft.y + BARB_H / 2;
    const dx = x + SKIFF_W / 2 - bx, dy = y + SKIFF_H / 2 - by;
    const len = Math.hypot(dx, dy) || 1;
    pellets.push({ x: bx - 1, y: by, vx: dx / len * pace, vy: dy / len * pace });
  }
  for (const pellet of pellets) { pellet.x += pellet.vx * dt; pellet.y += pellet.vy * dt; }
  // the blast eats any shot fired into it while it lasts
  if (bombLeft > 0) { bombLeft = Math.max(0, bombLeft - dt); pellets = []; }
  shots = shots.filter(shot => {
    const box = { x: shot.x, y: shot.y, ...SHOT_BOX[shot.kind] };
    for (const craft of enemies) {
      if (!craft.alive || craft.leaving || shot.hit.includes(craft)) continue;
      const s = sizeOf(craft.kind);
      if (!overlaps(box, insetBox(craft.x, craft.y, s.w, s.h))) continue;
      strike(craft, shot.dmg);
      // a beam goes on through spores and barbs; a slab stops everything
      if (!shot.pierce || craft.kind === 'slab') return false;
      shot.hit.push(craft);
    }
    return true;
  });
  enemies = enemies.filter(craft => {
    if (!craft.alive) return false;
    const s = sizeOf(craft.kind);
    const leftBottom = craft.y > api.LH;
    const leftSide = craft.x + s.w < -8 || craft.x > api.LW + 8;
    const flown = craft.leaving && craft.y + s.h < api.HUD;
    if (!leftBottom && !leftSide && !flown) return true;
    if (craft.kind === 'spore') noteSpore(craft, 'left');
    // gone from the field: a missile still chasing it picks a new target
    craft.alive = false;
    return false;
  });
  catchPickups(dt);
  if (open()) {
    const me = insetBox(x, y, SKIFF_W, SKIFF_H);
    for (const craft of enemies) {
      if (!craft.alive || craft.leaving) continue;
      const s = sizeOf(craft.kind);
      if (!overlaps(me, touchBox(craft.x, craft.y, s.w, s.h))) continue;
      // a ram costs a heart and wrecks a spore or a barb, for no points; a slab shrugs it off
      if (craft.kind !== 'slab') strike(craft, craft.hp, false);
      hurt();
      break;
    }
  }
  if (open()) {
    const me = insetBox(x, y, SKIFF_W, SKIFF_H);
    const hitBy = pellets.find(pellet => overlaps(me, { x: pellet.x, y: pellet.y, w: 2, h: 2 }));
    if (hitBy) { pellets = pellets.filter(p => p !== hitBy); hurt(); }
  }
  pellets = pellets.filter(pellet => pellet.y < api.LH + 4 && pellet.y > api.HUD - 8);
  if (api.S.mode !== 'play' || settled) return;
  spawnDue();
  if (clock >= LEG_CLOCK) windDown(dt);
  clock += dt;
}

function drawTuck() {
  const g = api.g;
  const u = 1 - tuckLeft / TUCK_SECS;
  const radius = 4 + Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) * 10;
  const cx = x + SKIFF_W / 2, cy = y + SKIFF_H / 2;
  g.fillStyle = api.col('spark');
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + u * 5;
    g.fillRect(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius), 1, 1);
  }
}

function draw() {
  const { g, LW, LH, HUD, S } = api;
  g.fillStyle = api.col('bg');
  g.fillRect(0, HUD, LW, LH - HUD);
  const warp = warpFactor();
  for (const mote of dust) {
    g.fillStyle = api.col(mote.role);
    // flat out, each mote is drawn as a streak down the screen
    if (warp > 0.12) g.fillRect(Math.round(mote.x), Math.round(mote.y), 1, Math.round(2 + warp * 26));
    else g.fillRect(Math.round(mote.x), Math.round(mote.y), mote.w, mote.h);
  }
  if (S.level >= LEGS && (settled || S.mode === 'clear' || grounding || clock >= LEG_CLOCK)) {
    const pad = padBox();
    g.fillStyle = api.col('hud');
    g.fillRect(pad.x, pad.y, pad.w, pad.h);
    g.fillStyle = api.col('textDim');
    g.fillRect(pad.x + 2, pad.y + 1, pad.w - 4, 1);
  }
  for (const craft of enemies) {
    if (!craft.alive) continue;
    if (craft.kind === 'spore') drawSpore(api, craft.x, craft.y);
    else if (craft.kind === 'barb') drawBarb(api, craft.x, craft.y);
    else drawSlab(api, craft.x, craft.y, Math.floor((1 - craft.hp / SLAB_HP) * 4));
  }
  for (const pellet of pellets) drawPellet(api, pellet.x, pellet.y, S.time);
  for (const p of pickups) drawPickup(api, p.x, p.y, p.kind, capsuleWeapon(p.age, p.first), S.time);
  for (const shot of shots) drawShot(api, shot.kind, shot.x, shot.y, S.time);
  if (bombLeft > 0) drawBlast(api, bombX, bombY, 1 - bombLeft / BOMB_SECS, Math.hypot(LW, LH - HUD), HUD);
  const hidden = blinkLeft > 0 && Math.floor(S.time * 12) % 2 === 0;
  if (tuckLeft > 0) drawTuck();
  else if (S.mode !== 'dying' && !hidden) drawSkiff(api, x, y);
  fx.draw();
  drawHud(api, {
    right: 'LEG ' + S.level,
    lives: { art: SKIFF_MINI, role: 'cart', spare: true, max: 4 },
    badges: [
      { text: 'TUCK ' + tucks, role: tuckLeft > 0 ? 'spark' : 'hud' },
      { text: arsenalLabel(arsenal), role: 'gold' },
    ],
  });
  drawStatus();
  if (S.mode === 'ready') api.banner('LEG ' + S.level, 'FLY');
  if (S.mode === 'clear') api.banner('LEG CLEARED');
  if (S.mode === 'dying' && S.lives <= 0) api.banner('DUSTED');
  if (grounding) api.banner('GROUNDED');
}

/** Hearts under the bar on the left, and the spare skiffs as a number on the right when there are more than the
    bar has room for. */
function drawStatus() {
  const { LW, HUD, S } = api;
  const slots = Math.max(HEARTS_START, hearts);
  for (let i = 0; i < slots; i++) drawHeart(api, 4 + i * 7, HUD + 2, i < hearts);
  // then a bomb for each one left, and a chevron for each speed pickup
  let at = 4 + slots * 7 + 3;
  for (let i = 0; i < bombs; i++, at += 6) drawSprite(api, BOMB_ICON, at, HUD + 2, 'spark');
  if (bombs) at += 3;
  for (let i = 0; i < boosts; i++, at += 6) drawSprite(api, SPEED_ICON, at, HUD + 2, 'text');
  const spare = S.lives - (S.mode !== 'dying' ? 1 : 0);
  if (spare > 4) api.txt('x' + spare, LW - 4, HUD + 2, 'textDim', 'right');
}

/** The tuck count is the badge on the tube. Tunnel Raider's BOOST meter stays full and still. */
function pinMeters() {
  api.S.boost = 1;
  api.S.boostT = 0;
  api.S.charge = 1;
}

function start() {
  api.fitGrid();
  api.S.lives = LIVES_START;
  api.S.level = 1;
  hearts = HEARTS_START;
  arsenal = {};
  lastGun = 'blaster';
  boosts = 0;
  bombs = BOMBS_START;
  bombLeft = 0;
  tucks = TUCKS_START;
  warpIn = false;
  syncBombKey();
  score.reset();
  pinMeters();
  beginLeg(1);
}

function update(dt: number) {
  pinMeters();
  fx.update(dt);
  if (done) return;
  const mode = api.S.mode;
  if (blinkLeft > 0 && (mode === 'ready' || mode === 'play')) blinkLeft = Math.max(0, blinkLeft - dt);
  if (tuckLeft > 0 && mode === 'play') tuckLeft = Math.max(0, tuckLeft - dt);

  if (grounding) {
    ease(groundT, CLEAR_SECS);
    groundT -= dt;
    if (groundT <= 0) { done = true; api.finishGame(); }
    return;
  }

  round.tick(dt);

  if (api.S.mode === 'play' && !settled) readBomb();
  else if (api.button('fireR').queued) api.clearButton('fireR');
  if (api.S.mode === 'play' && !settled && tuckLeft <= 0) readTuck();
  else if (api.S.mode === 'play' && tuckLeft > 0) {
    api.clearFire();
    api.clearTap();
    if (api.boostQueued) api.clearBoost();
  }

  if (api.S.mode === 'clear' || api.S.mode === 'ready') moveDust(dt);
  // shots already in the air fly on off the top through the warp instead of hanging still
  if (api.S.mode === 'clear') moveShots(dt);
  if (api.S.mode === 'play') warpIn = false;
  if (api.S.mode === 'clear') ease(api.S.modeT, CLEAR_SECS);
  else if ((api.S.mode === 'ready' || api.S.mode === 'play') && tuckLeft <= 0 && !settled) steer(dt);
  else { vx = 0; vy = 0; }

  if (api.S.mode === 'play' && tuckLeft <= 0 && !settled) guns(dt);
  if (api.S.mode !== 'play' || settled) return;
  combat(dt);
}

const create: CreateGame = a => {
  api = a;
  fx = makeFx(a);
  score = makeScore(a, { extraEvery: EXTRA_EVERY, maxLives: LIFE_CAP, fx, onExtra: () => play(a, EXTRA_JINGLE) });
  round = makeRound(a, {
    respawn() {
      placeSkiff();
      blinkLeft = 1.2;
      // a lost skiff takes its guns and its speed with it, as in the arcade; the next one has three hearts
      arsenal = {};
      lastGun = 'blaster';
      boosts = 0;
      bombs = BOMBS_START;
      bombLeft = 0;
      warpIn = false;
      syncBombKey();
      hearts = HEARTS_START;
      missileCool = 0;
      tuckLeft = 0;
      boostLatched = false;
      shots = [];
      cools = {};
    },
    nextLevel() { beginLeg(a.S.level); warpIn = true; },
    times: { ready: READY_SECS, respawn: 0.9, dying: 1.1, clear: CLEAR_SECS },
    clearOnReady: ['fire', 'boost', 'fireR'],
  });
  return {
    start, update, draw,
    debug: {
      state: () => ({
        x, y, vx, vy, tucks, hearts, speed: boosts, bombs, bombing: bombLeft > 0, warp: warpFactor(),
        /** the gun caught last and its level; `guns` is the whole stack */
        weapon: lastGun, level: lastGun === 'blaster' ? 1 : arsenal[lastGun] ?? 1, guns: { ...arsenal }, leg: a.S.level, lives: a.S.lives, shots: shots.length,
        pickups: pickups.map(p => p.kind),
        /** craft wholly on screen below the HUD, so a capture can wait for something to look at */
        craft: enemies.filter(e => e.alive && e.y > a.HUD + 4).length,
      }),
      /** Keep the skiff from being hit, for the share capture's flipbook. */
      untouchable: (on: boolean) => { untouchable = on; },
      /** Hang an enemy pellet on the skiff so the next frame can overlap it. */
      pellet: () => { pellets.push({ x: x + SKIFF_W / 2 - 1, y: y + SKIFF_H / 2 - 1, vx: 0, vy: 8 }); },
      /** Add a gun to the stack at a level, for tests and captures. The blaster empties the stack. */
      arm: (w: Weapon, lv = WEAPON_MAX) => {
        if (w === 'blaster') { arsenal = {}; lastGun = 'blaster'; return; }
        arsenal = { ...arsenal, [w]: Math.max(1, Math.min(WEAPON_MAX, lv)) };
        lastGun = w;
      },
      /** Drop a pickup on the skiff. */
      give: (kind: PickupKind) => { pickups.push({ kind, x: x + 2, y: y + 1, age: 0, first: 0 }); },
      /** End the blink after a hit, so the next shot counts. */
      unblink: () => { blinkLeft = 0; },
    },
  };
};

export default create;

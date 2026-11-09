/* I Invade: Invader Force turned round. You are the formation; the earthlings hold the ground.
   Steer the whole fleet, bomb their tanks from the bay, lob cluster bombs, call in a UFO strike and rain meteors on them.
   You get one formation and no spare lives; they get tanks with three lives each, and more tanks as the waves go on.
   Original art (shared with Invader Force), sound and code. Everything is in low-res screen pixels. */
import type { ConsoleAPI, CreateGame } from '../types';
import { useApi, sprite, JELLY, BEETLE, DRONE, CANNON, SAUCER, BURST } from '../invader-force/art';

let api: ConsoleAPI;

const SX = 16, SY = 12, AW = 11, AH = 8, ROWS = 5;
const TANK_W = 13, TANK_LIVES = 3;
/* speeds are for the desk tube (152 px from the fleet's first bottom row to the tanks); kH() scales them to taller tubes */
const BOMB_SPEED = 140, BOMB_CD = 0.3;
const CLUSTER_SPEED = 100, BOMBLET_SPEED = 175, CLUSTER_CD = 7, CLUSTER_SPREAD = 9;
const UFO_SPEED = 64, UFO_RECHARGE = 12, UFO_DROP = 0.3;
const METEORS = 18, STORM_PER_HIT = 0.3, STORM_TRICKLE = 1 / 80;
const DROPS_TO_LAND = 22;                                // rows the fleet must drop to touch down, whatever the tube's height
const ROLES = ['rockjaw', 'borer', 'grub'];
const SPRITES = [JELLY, BEETLE, DRONE];
const typeOf = (r: number) => (r === 0 ? 0 : r < 3 ? 1 : 2);
/** how many tanks hold the ground on each wave: one, then a team of three, then six */
const TEAM = [1, 1, 2, 3, 3, 4, 5, 6];
const teamSize = (w: number) => TEAM[Math.min(TEAM.length - 1, w - 1)];
/** what's falling: 0 and 1 are plain bombs from the bay, 2 the UFO's, 3 a cluster bomb, 4 its bomblets */
const HOW = ['bomb', 'bomb', 'ufo', 'cluster', 'cluster'];

type Alien = { c: number; r: number; t: number; alive: boolean };
type Tank = {
  x: number; lives: number; out: boolean; downT: number; safeT: number; cool: number; i: number;
  aimT: number; aimC: number; aimErr: number;             // the column it's lining up under, and how far off it is
  throughWall: boolean;                                   // every column left is behind a wall, so shoot through it
  dodgeT: number; dodgeX: number; dodgeCD: number;        // mid-dodge: where to, for how long; and when it may dodge again
};
type Bomb = { x: number; y: number; v: number; k: number };
type Bunker = { x: number; y: number; px: Uint8Array };
const BW = 18, BH = 12;

const F = {
  aliens: [] as Alien[], cols: 11, total: 0, ox: 0, oy: 0, frame: 0, stepT: 0, note: 0,
  step: 6, dropCD: 0, autoDropT: 10, lastSide: '' as '' | 'left' | 'right',
  bombCD: 0, clusterCD: 0, upWas: false,
  bombs: [] as Bomb[],
  meteors: [] as { x: number; y: number; vx: number; vy: number }[],
  shots: [] as { x: number; y: number; v: number; tank: Tank }[],
  tanks: [] as Tank[], bunkers: [] as Bunker[],
  ufo: null as null | { x: number; dir: number; dropT: number; humT: number },
  storm: 0, downWas: false, stormMsgT: 0,
  bursts: [] as { x: number; y: number; t: number; text?: string; big?: boolean }[],
  end: '' as '' | 'fallen' | 'touchdown' | 'repelled',
  tally: {} as Record<string, number>,   // hits by weapon, for the tests
};

const cannonY = () => api.LH - 14;
const bunkerY = () => cannonY() - 28;
/** how much taller than the desk tube the drop is; everything that falls or flies is scaled by it so every layout plays at the same tempo */
const kH = () => Math.max(1, (cannonY() - api.HUD - 74) / 152);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const tone: ConsoleAPI['tone'] = (...a) => api.tone(...a);
const skill = () => Math.min(1, (api.S.level - 1) / 5);   // how sharp the earthlings are: 0 on wave 1, sharpest by wave 6
const alive = () => F.aliens.filter(a => a.alive);
const autoDrop = () => Math.max(4, 9 - api.S.level * 0.5);

/* ---------- the formation: where it is, and which column bombs ---------- */
function span(al = alive()){
  let minC = 99, maxC = -1;
  for (const a of al) { if (a.c < minC) minC = a.c; if (a.c > maxC) maxC = a.c; }
  return { al, minC, maxC, left: F.ox + minC * SX, right: F.ox + maxC * SX + AW };
}
/** the bomb bay: the living column nearest the middle of the fleet. Steer it over a tank and drop. */
function bayColumn(al = alive()){
  const { left, right } = span(al), mid = (left + right) / 2;
  let best = -1, bestD = 1e9;
  for (const a of al) { const d = Math.abs(F.ox + a.c * SX + AW / 2 - mid); if (d < bestD) { bestD = d; best = a.c; } }
  return best;
}
const bottomOf = (c: number) => alive().filter(a => a.c === c).reduce((p, q) => (q.r > p.r ? q : p));
const bayX = () => F.ox + bayColumn() * SX + 5;
/** how far the bay can reach: the fleet stops at the sides, so its middle column only covers the middle of the ground.
    The earthlings hold that stretch (and their walls stand on it); it widens as the fleet thins. */
function reach(){
  const al = alive(); if (!al.length) return { min: 4, max: api.LW - 4 };
  const { left, right } = span(al), bx = F.ox + bayColumn(al) * SX + 5;
  return { min: 4 + (bx - left), max: api.LW - 4 - (right - bx) };
}
const maxBombs = () => Math.min(5, 3 + Math.floor(api.S.level / 3));

/* ---------- a wave ---------- */
function newWave(){
  const { LW, HUD, S } = api;
  F.cols = Math.max(6, Math.min(11, Math.floor((LW - 40) / SX)));
  F.aliens = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < F.cols; c++) F.aliens.push({ c, r, t: typeOf(r), alive: true });
  F.total = F.aliens.length;
  F.ox = Math.round((LW - (F.cols - 1) * SX - AW) / 2);
  const bottom0 = HUD + 18 + ROWS * SY - SY + AH;
  F.step = Math.max(6, Math.round((cannonY() - bottom0) / DROPS_TO_LAND));
  F.oy = HUD + 18 + Math.min(3, S.level - 1) * F.step;    // later waves start a little lower
  F.frame = 0; F.stepT = 0.5; F.dropCD = 0; F.autoDropT = autoDrop(); F.lastSide = '';
  F.bombCD = 0; F.clusterCD = 2.5; F.upWas = true; F.downWas = true;   // the cluster bay takes a moment to arm
  F.bombs = []; F.meteors = []; F.shots = []; F.ufo = null; F.bursts = []; F.end = '';
  // the earthlings' tanks, spread along the ground the fleet can reach, never parked right under the bay
  const n = teamSize(S.level), { min, max } = reach(), slot = (max - min) / (n + 1), shift = (Math.random() < 0.5 ? -1 : 1) * slot * rnd(0.3, 0.45);
  F.tanks = [];
  for (let i = 0; i < n; i++) F.tanks.push({
    x: Math.round(min - 6 + slot * (i + 1) + shift), lives: TANK_LIVES, out: false, downT: 0, safeT: 0, cool: rnd(1, 2), i,
    aimT: 0, aimC: -1, aimErr: 0, throughWall: false, dodgeT: 0, dodgeX: 0, dodgeCD: 0,
  });
  // their walls, on the same stretch
  const nb = max - min >= 150 ? 3 : 2, gap = (max - min + 12 - nb * BW) / (nb + 1);
  F.bunkers = [];
  for (let i = 0; i < nb; i++) {
    const px = new Uint8Array(BW * BH);
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const merlon = y < 2 ? x % 4 < 2 : true, gate = y >= BH - 3 && x >= 6 && x < 12;
      px[y * BW + x] = merlon && !gate ? 1 : 0;
    }
    F.bunkers.push({ x: Math.round(min - 6 + gap + i * (BW + gap)), y: bunkerY(), px });
  }
}

function start(){
  api.fitGrid();
  const S = api.S;
  S.score = 0; S.level = 1; S.lives = 1; S.charge = 1; S.boost = 0.5; S.boostT = 0;   // the UFO is half charged: no opening alpha strike
  F.storm = 0; F.stormMsgT = 0; F.tally = {};
  newWave();
}

function addScore(n: number, x?: number, y?: number){
  const S = api.S;
  S.score += n;
  if (S.score > api.best) api.best = S.score;
  if (x != null) F.bursts.push({ x, y: y!, t: 0.8, text: String(n) });
}

function bunkerHit(x: number, y: number, radius = 2){
  for (const b of F.bunkers) {
    const lx = Math.floor(x - b.x), ly = Math.floor(y - b.y);
    if (lx < 0 || ly < 0 || lx >= BW || ly >= BH || !b.px[ly * BW + lx]) continue;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = lx + dx, yy = ly + dy;
      if (xx < 0 || yy < 0 || xx >= BW || yy >= BH) continue;
      if (dx * dx + dy * dy <= radius * radius + 1 && Math.random() < 0.75) b.px[yy * BW + xx] = 0;
    }
    return true;
  }
  return false;
}

function dropRow(){
  F.oy += F.step; F.dropCD = 0.9; F.autoDropT = autoDrop();
  tone(70, 0.12, 0.07, -20);
}

/* ---------- tanks ---------- */
function hitTank(t: Tank, how: string){
  if (t.out || t.downT > 0 || t.safeT > 0) return false;
  t.lives--; F.tally[how] = (F.tally[how] || 0) + 1;
  F.bursts.push({ x: t.x + 1, y: cannonY(), t: 0.9, big: true });
  [330, 262, 196].forEach((f, i) => tone(f, 0.12, 0.05, -30, i * 0.09));
  chargeStorm(STORM_PER_HIT);
  if (t.lives <= 0) { t.out = true; addScore(300, t.x - 2, cannonY() - 10); api.track('ii_tank', { level: api.S.level, how }); }
  else { t.downT = 1.4; addScore(100, t.x, cannonY() - 10); }
  return true;
}
function chargeStorm(n: number){
  if (F.storm >= 1) return;
  F.storm = Math.min(1, F.storm + n);
  if (F.storm >= 1) F.stormMsgT = 2.2;
}
function tankAt(x: number, y: number){
  const cy = cannonY();
  if (y < cy - 1 || y > cy + 7) return null;
  return F.tanks.find(t => !t.out && t.downT <= 0 && t.safeT <= 0 && x >= t.x && x < t.x + TANK_W) || null;
}
/** is there still wall above this spot on the ground? Tanks don't waste shells on their own walls. */
function wallAbove(x: number){
  for (const b of F.bunkers) {
    const lx = Math.floor(x - b.x);
    if (lx < 0 || lx >= BW) continue;
    for (let y = 0; y < BH; y++) if (b.px[y * BW + lx]) return true;
  }
  return false;
}
/** pick a column to line up under: one from this tank's stretch of the fleet (the sharp ones go for the bomber), not behind a wall if it can help it */
function pickAim(t: Tank, cols: number[], bay: number, team: number, d: number){
  const pick = () => cols[Math.min(cols.length - 1, Math.floor(((t.i % team) + Math.random()) / team * cols.length))];
  t.throughWall = true;
  for (let tries = 0; tries < 4; tries++) {
    if (bay >= 0 && tries === 0 && Math.random() < (t.i === 0 ? 0.6 : 0.3) * d) t.aimC = bay;   // the sharp ones hunt the bomber, the lead tank most of all
    else { const a = pick(), b = pick(); t.aimC = Math.abs(F.ox + a * SX - t.x) < Math.abs(F.ox + b * SX - t.x) ? a : b; }   // the nearer of two: less driving about
    t.aimErr = Math.round(rnd(-3, 3) * (1 - d));
    if (!wallAbove(F.ox + t.aimC * SX + AW / 2 + t.aimErr)) { t.throughWall = false; break; }
  }
  t.aimT = rnd(0.8, 1.6) - d * 0.4;
}
/** the earthlings' wits, sharper every wave: notice what's falling and dodge it (not always, and not always the right way),
    line up under an alien column, fire one shell each. A bigger team reloads slower, so six tanks aren't six times the fire. */
function updateTanks(dt: number){
  const { LW, S } = api, d = skill(), cy = cannonY(), k = kH();
  const team = F.tanks.filter(t => !t.out).length || 1;
  const late = Math.max(0, S.level - 6);   // past wave 6 they only get quicker on the trigger
  const speed = 36 + 32 * d, look = 0.45 + 0.35 * d, react = 3.5 + 5.5 * d, reload = (0.6 - 0.3 * d) * Math.pow(team, 0.4) / (1 + 0.08 * late);
  const falling = [...F.bombs.map(b => ({ x: b.x, y: b.y, v: b.v })), ...F.meteors.map(m => ({ x: m.x + m.vx * ((cy - m.y) / m.vy), y: m.y, v: m.vy }))];
  const al = alive(), cols = [...new Set(al.map(a => a.c))].sort((a, b) => a - b);
  const bay = al.length ? bayColumn(al) : -1;
  const { min, max } = reach();
  const lo = Math.max(4, min - 11), hi = Math.min(LW - 4 - TANK_W, max - 1);   // where a tank may drive: the bay can still clip it at either end
  for (const t of F.tanks) {
    if (t.out) continue;
    if (t.downT > 0) {
      if ((t.downT -= dt) <= 0) {   // back in a fresh tank, somewhere nothing is falling
        let best = t.x, bestD = -1;
        for (let n = 0; n < 8; n++) {
          const x = rnd(lo, hi), near = Math.min(999, ...falling.map(f => Math.abs(f.x - x - 6)));
          if (near > bestD) { bestD = near; best = x; }
        }
        t.x = Math.round(best); t.safeT = 1.2; t.aimT = 0;
      }
      continue;
    }
    if (t.safeT > 0) t.safeT -= dt;
    t.cool -= dt;
    if (t.dodgeCD > 0) t.dodgeCD -= dt;
    const cx = t.x + 6;
    // anything about to land on me?
    let threat = null as null | { x: number };
    for (const f of falling) {
      const eta = (cy - f.y) / f.v;
      if (eta > 0 && eta < look && Math.abs(f.x - cx) < 11) { threat = f; break; }
    }
    if (threat && t.dodgeT <= 0 && t.dodgeCD <= 0 && Math.random() < 1 - Math.exp(-react * dt)) {
      // which way? away from it; the sharper they are, the more often they pick the side with less coming down
      let side = threat.x <= cx ? 1 : -1;
      if (Math.random() < 0.5 + 0.5 * d) {
        const danger = (x: number) => falling.reduce((s, f) => s + (Math.abs(f.x - x) < 15 ? 1 : 0), 0);
        const L = danger(cx - 28), R = danger(cx + 28);
        if (L !== R) side = L < R ? -1 : 1;
      }
      t.dodgeX = t.x + side * 32; t.dodgeT = 0.45; t.dodgeCD = 0.6 - 0.35 * d;
    }
    let goal: number;
    if (t.dodgeT > 0) { t.dodgeT -= dt; goal = t.dodgeX; }
    else {
      if (((t.aimT -= dt) <= 0 || !al.some(a => a.c === t.aimC)) && cols.length) pickAim(t, cols, bay, team, d);
      goal = F.ox + t.aimC * SX + AW / 2 - 6 + t.aimErr;
    }
    const dx = goal - t.x;
    if (Math.abs(dx) > 1) t.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    t.x = Math.max(lo, Math.min(hi, t.x));
    // fire when lined up under an alien with no wall in the way (not mid-dodge); behind a wall, pick somewhere else
    const mine = F.shots.some(s => s.tank === t);
    if (!mine && t.cool <= 0 && t.dodgeT <= 0) {
      const fx = t.x + 6;
      if (wallAbove(fx) && !t.throughWall) { if (Math.abs(dx) <= 1) t.aimT = Math.min(t.aimT, 0.15); }
      else if (al.some(a => fx >= F.ox + a.c * SX - 1 && fx <= F.ox + a.c * SX + AW)) {
        F.shots.push({ x: Math.round(fx), y: cy - 2, v: Math.min(320, 240 + 10 * S.level) * k, tank: t });
        t.cool = reload * rnd(0.8, 1.3); tone(880, 0.05, 0.022, -500);
      }
    }
  }
  // a team keeps its spacing: no two tanks on the same patch of ground
  const up = F.tanks.filter(t => !t.out && t.downT <= 0).sort((a, b) => a.x - b.x);
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < up.length; i++) {
    const a = up[i - 1], b = up[i], gap = TANK_W + 3 - (b.x - a.x);
    if (gap > 0) { a.x = Math.max(lo, a.x - gap / 2); b.x = Math.min(hi, b.x + gap / 2); }
  }
}

/* ---------- the loop ---------- */
function update(dt: number){
  const S = api.S, LW = api.LW, k = kH();
  for (const b of F.bursts) b.t -= dt;
  F.bursts = F.bursts.filter(b => b.t > 0);
  if (F.stormMsgT > 0) F.stormMsgT -= dt;
  if (S.mode === 'ready') { if ((S.modeT -= dt) <= 0) S.mode = 'play'; api.clearFire(); api.clearTap(); api.clearBoost(); return; }
  if (S.mode === 'clear') { if ((S.modeT -= dt) <= 0) { S.level++; newWave(); S.mode = 'ready'; S.modeT = 1.6; api.saveBest(); } return; }
  if (S.mode === 'dying') { if ((S.modeT -= dt) <= 0) { S.lives = 0; api.finishGame(); } return; }
  if (S.mode !== 'play') return;

  const al = alive();
  if (!al.length) return repelled();

  /* steer the fleet; pushing into a side drops it a row, then it needs the other side for the next (the old zigzag) */
  const sd = api.stickDir, keys = api.held.filter(d => d === 'left' || d === 'right');
  const dir = sd === 'left' || sd === 'right' ? sd : keys[keys.length - 1];
  const { left, right } = span(al);
  const speed = Math.min(90, 40 + 3 * S.level + 40 * (1 - al.length / F.total));
  if (F.dropCD > 0) F.dropCD -= dt;
  if (dir) {
    const v = (dir === 'left' ? -1 : 1) * speed * dt;
    const side = left + v < 4 ? 'left' : right + v > LW - 4 ? 'right' : '';
    if (side) {
      F.ox += side === 'left' ? 4 - left : LW - 4 - right;
      if (F.dropCD <= 0 && F.lastSide !== side) { dropRow(); F.lastSide = side; }
    } else F.ox += v;
  }
  if ((F.autoDropT -= dt) <= 0) dropRow();
  if ((F.stepT -= dt) <= 0) {   // the march: the legs and the heartbeat speed up as the fleet thins
    F.stepT = 0.06 + 0.5 * Math.pow(al.length / F.total, 1.1);
    F.frame ^= 1; tone([98, 87, 78, 73][F.note = (F.note + 1) % 4], 0.07, 0.05);
  }

  /* FIRE: a bomb from the bay. UP: a cluster bomb. BOOST: the UFO strike. DOWN: the meteor shower, once it's charged */
  if (F.bombCD > 0) F.bombCD -= dt;
  if (F.clusterCD > 0) F.clusterCD -= dt;
  const bay = bottomOf(bayColumn(al)), bx = F.ox + bay.c * SX + 5, by = F.oy + bay.r * SY + AH;
  const mine = F.bombs.filter(b => b.k < 2).length;
  if ((api.fireQueued || api.tapQueued) && F.bombCD <= 0 && mine < maxBombs()) {
    F.bombs.push({ x: bx, y: by, v: (BOMB_SPEED + S.level * 4) * k, k: Math.floor(Math.random() * 2) });
    F.bombCD = BOMB_CD; tone(300, 0.08, 0.035, -160);
  }
  api.clearFire(); api.clearTap();
  S.charge = mine < maxBombs() ? 1 : 0;
  const up = api.stickDir === 'up' || api.held.includes('up');
  if (up && !F.upWas && F.clusterCD <= 0) {
    F.bombs.push({ x: bx, y: by, v: CLUSTER_SPEED * k, k: 3 });
    F.clusterCD = CLUSTER_CD; tone(220, 0.18, 0.045, -120); tone(110, 0.3, 0.03, -40, 0.05);
  }
  F.upWas = up;
  if (api.boostQueued && S.boost >= 1 && !F.ufo) {
    const d = Math.random() < 0.5 ? 1 : -1;
    F.ufo = { x: d > 0 ? -16 : LW, dir: d, dropT: 0.3, humT: 0 }; S.boost = 0; S.boostT = 1;
    api.track('ii_ufo', { level: S.level, tanks: F.tanks.filter(t => !t.out).length });
  }
  api.clearBoost();
  if (!F.ufo) { S.boostT = 0; S.boost = Math.min(1, S.boost + dt / UFO_RECHARGE); }
  chargeStorm(dt * STORM_TRICKLE);
  const down = api.stickDir === 'down' || api.held.includes('down');
  if (down && !F.downWas && F.storm >= 1) {
    F.storm = 0; F.stormMsgT = 0;
    const { min, max } = reach();
    for (let i = 0; i < METEORS; i++) F.meteors.push({ x: rnd(min - 20, max + 20), y: api.HUD - rnd(0, 120 * k), vx: rnd(-14, 14), vy: rnd(85, 135) * k });
    tone(180, 1.2, 0.05, -140); tone(90, 1.4, 0.04, -50, 0.1);
    api.track('ii_meteors', { level: S.level, tanks: F.tanks.filter(t => !t.out).length });
  }
  F.downWas = down;

  /* the UFO crosses, raining bombs */
  if (F.ufo) {
    const u = F.ufo;
    u.x += u.dir * UFO_SPEED * dt;
    if ((u.humT -= dt) <= 0) { u.humT = 0.18; tone(Math.floor(S.time * 10) % 2 ? 330 : 247, 0.12, 0.02); }
    if ((u.dropT -= dt) <= 0 && u.x > 0 && u.x < LW - 16) { u.dropT = UFO_DROP; F.bombs.push({ x: Math.round(u.x + 8), y: api.HUD + 10, v: 130 * k, k: 2 }); }
    if (u.x < -20 || u.x > LW + 4) F.ufo = null;
  }

  updateTanks(dt);

  /* bombs and meteors fall on the earthlings */
  const cy = cannonY(), burstY = bunkerY() - 10, spawn: Bomb[] = [];
  for (const b of F.bombs) {
    b.y += b.v * dt;
    if (b.k === 3 && b.y >= burstY) {   // the cluster bursts into three bomblets above the walls
      for (const dx of [-CLUSTER_SPREAD, 0, CLUSTER_SPREAD]) spawn.push({ x: b.x + dx, y: b.y, v: BOMBLET_SPEED * k, k: 4 });
      F.bursts.push({ x: b.x - 5, y: b.y - 3, t: 0.15 }); tone(520, 0.08, 0.04, -300);
      b.y = 9999; continue;
    }
    if (bunkerHit(b.x, b.y + 3, 2)) { b.y = 9999; continue; }
    const t = tankAt(b.x, b.y + 4);
    if (t) { b.y = 9999; hitTank(t, HOW[b.k]); }
  }
  F.bombs.push(...spawn);
  for (const m of F.meteors) {
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.y < api.HUD) continue;
    if (bunkerHit(m.x, m.y + 2, 3)) { F.bursts.push({ x: m.x - 5, y: m.y - 3, t: 0.2 }); m.y = 9999; continue; }
    const t = tankAt(m.x, m.y + 2) || tankAt(m.x + 1, m.y + 2);
    if (t) { m.y = 9999; hitTank(t, 'meteor'); continue; }
    if (m.y >= api.LH - 6) { F.bursts.push({ x: m.x - 5, y: api.LH - 12, t: 0.2 }); tone(60, 0.1, 0.03); }
  }
  F.bombs = F.bombs.filter(b => b.y < api.LH - 6);
  F.meteors = F.meteors.filter(m => m.y < api.LH - 6 && m.x > -10 && m.x < LW + 10);

  /* their shells: one alien each, unless a bomb, a wall or the UFO gets in the way */
  for (const s of F.shots) {
    s.y -= s.v * dt;
    let hit = false;
    for (const a of F.aliens) {
      if (!a.alive) continue;
      const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
      if (s.x >= ax && s.x < ax + AW && s.y + 3 >= ay && s.y < ay + AH) {
        a.alive = false; hit = true; F.bursts.push({ x: ax, y: ay, t: 0.18 }); tone(200, 0.14, 0.04, -120); break;
      }
    }
    if (!hit) for (const b of F.bombs) if (Math.abs(b.x - s.x) <= (b.k === 3 ? 2 : 1) && Math.abs(b.y - s.y) < 4) {
      if (b.k === 3) { F.bursts.push({ x: b.x - 5, y: b.y - 3, t: 0.2 }); tone(700, 0.1, 0.035, -400); }   // they shot the cluster down
      b.y = 9999; hit = true; break;
    }
    if (!hit && bunkerHit(s.x, s.y, 1)) hit = true;
    if (!hit && F.ufo && s.y < api.HUD + 12 && s.x >= F.ufo.x && s.x < F.ufo.x + 16) {   // they got the UFO
      F.bursts.push({ x: F.ufo.x + 2, y: api.HUD + 2, t: 0.5 }); tone(1200, 0.25, 0.045, -900); F.ufo = null; hit = true;
    }
    if (hit || s.y < api.HUD + 2) s.y = -99;
  }
  F.shots = F.shots.filter(s => s.y > -50);

  /* how the wave ends */
  const left2 = alive();
  if (!left2.length) return repelled();
  // the fleet chews through the walls it reaches
  for (const a of left2) {
    const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
    if (ay + AH >= bunkerY()) for (let x = ax; x < ax + AW; x += 2) for (let y = ay; y < ay + AH; y += 2) bunkerHit(x, y, 1);
  }
  const bottom = F.oy + Math.max(...left2.map(a => a.r)) * SY + AH;
  if (bottom >= cy) return waveWon('touchdown', 500 + 20 * left2.length);
  if (F.tanks.every(t => t.out)) return waveWon('fallen', 20 * left2.length);
}
function repelled(){
  const S = api.S;
  F.end = 'repelled'; S.mode = 'dying'; S.modeT = 2.2;
  [440, 392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 0.045, -20, i * 0.15));
  api.track('ii_wave', { level: S.level, how: 'repelled' });
}
function waveWon(how: 'touchdown' | 'fallen', bonus: number){
  const S = api.S;
  F.end = how; S.mode = 'clear'; S.modeT = 2.4;
  addScore(bonus);
  F.bursts.push({ x: api.LW / 2 - 16, y: api.HUD + 6, t: 2.2, text: '+' + bonus });
  [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 0.04, 0, i * 0.09));
  api.track('ii_wave', { level: S.level, how });
}

/* ---------- drawing ---------- */
const MINI = ['...#...', '..###..', '#######', '#.#.#.#'];
function hud(){
  const { g, LW, HUD, S, txt } = api;
  g.fillStyle = api.col('bg'); g.fillRect(0, 0, LW, HUD);
  txt(String(S.score).padStart(6, '0'), 6, 6, 'text');
  if (LW >= 300) txt('HI ' + String(api.best).padStart(6, '0'), 80, 6, 'hud');
  const wave = 'WAVE ' + S.level;
  txt(wave, LW - 6, 6, 'hud', 'right');
  // the earthlings' tanks, each with its lives as pips underneath
  let x = LW - 14 - wave.length * 6 - F.tanks.length * 10;
  for (const t of F.tanks) {
    if (!t.out) sprite(MINI, x, 5, t.downT > 0 ? 'textDim' : 'cart');
    else { g.fillStyle = api.col('textDim'); g.fillRect(x, 8, 7, 1); }
    g.fillStyle = api.col('gold'); for (let i = 0; i < t.lives; i++) g.fillRect(x + i * 3, 11, 1, 1);
    x += 10;
  }
  // the meteor charge: a falling-rock glyph and a bar under the score, gold when it's ready
  const ready = F.storm >= 1 && Math.floor(S.time * 4) % 2 === 0;
  g.fillStyle = api.col(ready ? 'gold' : 'textDim'); g.fillRect(7, 14, 1, 1); g.fillRect(8, 15, 2, 2);
  g.fillStyle = api.col('textDim'); g.fillRect(12, 15, 36, 1);
  g.fillStyle = api.col(F.storm >= 1 ? 'gold' : 'hud'); g.fillRect(12, 15, Math.round(36 * F.storm), 1);
  g.fillStyle = api.col('hud'); for (let i = 0; i < LW; i += 4) g.fillRect(i, HUD - 2, 2, 1);
}
function draw(){
  const { g, LW, LH, S } = api;
  g.fillStyle = api.col('gem');
  for (const b of F.bunkers) for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (b.px[y * BW + x]) g.fillRect(b.x + x, b.y + y, 1, 1);
  // your fleet, and the bomb bay with its sight line
  const al = alive();
  for (const a of al) sprite(SPRITES[a.t][F.frame], F.ox + a.c * SX, F.oy + a.r * SY, ROLES[a.t]);
  if (al.length && (S.mode === 'play' || S.mode === 'ready')) {
    const a = bottomOf(bayColumn(al)), bx = F.ox + a.c * SX + 5, by = F.oy + a.r * SY + AH + 2;
    g.fillStyle = api.col('text'); g.fillRect(bx - 1, by, 3, 1); g.fillRect(bx, by + 1, 1, 1);
    if (F.clusterCD <= 0) { g.fillStyle = api.col('gold'); g.fillRect(bx - 3, by, 1, 2); g.fillRect(bx + 3, by, 1, 2); }   // a cluster is ready
    g.fillStyle = api.col('textDim'); for (let y = by + 6; y < cannonY() - 2; y += 6) g.fillRect(bx, y, 1, 2);
  }
  if (F.ufo) sprite(SAUCER, F.ufo.x, api.HUD + 3, 'sun');
  // falling things
  for (const b of F.bombs) {
    const y = Math.round(b.y), w = Math.floor(S.time * 12 + b.x) % 2;
    if (b.k === 3) { g.fillStyle = api.col('gold'); g.fillRect(b.x - 1, y, 3, 4); g.fillStyle = api.col(w ? 'spark' : 'sun'); g.fillRect(b.x, y + 1, 1, 2); continue; }
    g.fillStyle = api.col(b.k === 2 ? 'sun' : 'gold');
    if (b.k === 4) g.fillRect(b.x, y, 1, 3);
    else if (b.k === 1) { g.fillRect(b.x + w, y, 1, 1); g.fillRect(b.x + 1 - w, y + 1, 1, 1); g.fillRect(b.x + w, y + 2, 1, 1); g.fillRect(b.x + 1 - w, y + 3, 1, 1); }
    else if (b.k === 2) { g.fillRect(b.x - 1, y, 2, 2); g.fillRect(b.x, y + 2, 1, 2); }
    else { g.fillRect(b.x, y, 1, 4); g.fillRect(b.x - 1, y + 1 + w * 2, 3, 1); }
  }
  for (const m of F.meteors) {
    if (m.y < api.HUD) continue;
    const x = Math.round(m.x), y = Math.round(m.y);
    g.fillStyle = api.col('textDim'); g.fillRect(Math.round(x - m.vx * 0.06), y - 5, 1, 4);
    g.fillStyle = api.col('sun'); g.fillRect(x, y, 2, 2);
  }
  g.fillStyle = api.col('spark'); for (const s of F.shots) g.fillRect(s.x, Math.round(s.y), 1, 4);
  // the earthlings
  const cy = cannonY();
  for (const t of F.tanks) {
    if (t.out || t.downT > 0) continue;
    if (t.safeT > 0 && Math.floor(t.safeT * 10) % 2) continue;
    sprite(CANNON, Math.round(t.x), cy, 'cart');
  }
  g.fillStyle = api.col('hud'); g.fillRect(0, LH - 5, LW, 1);
  for (const b of F.bursts) {
    if (b.text) api.txt(b.text, b.x, b.y, 'gold');
    else sprite(BURST, b.x, b.y, b.big && Math.floor(b.t * 10) % 2 ? 'spark' : 'gold');
  }
  hud();
  if (S.mode === 'play' && F.stormMsgT > 0 && Math.floor(F.stormMsgT * 5) % 2) api.txt('METEORS READY · PULL DOWN', LW / 2, api.HUD + 4, 'gold', 'center');
  if (S.mode === 'ready') {
    const n = F.tanks.length;
    api.banner('WAVE ' + S.level, S.level === 1 ? 'BOMB THE TANK · PUSH UP: CLUSTER' : `${n} TANK${n > 1 ? 'S' : ''} · ${TANK_LIVES} LIVES EACH`);
  }
  if (S.mode === 'clear') api.banner(F.end === 'touchdown' ? 'TOUCHDOWN' : 'EARTH HAS FALLEN', F.end === 'touchdown' ? 'THE FLEET HAS LANDED' : 'EVERY TANK DESTROYED');
  if (S.mode === 'dying') api.banner('INVASION REPELLED');
}

const create: CreateGame = a => {
  api = a; useApi(a);
  return { start, update, draw, debug: { state: () => F } };
};
export default create;

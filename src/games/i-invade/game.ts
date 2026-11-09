/* I Invade: the fixed-screen alien shooter turned round. You are the fleet, at the bottom of the screen; the
   earthlings' tanks hold the top. The fleet marches on its own, side to side and a row closer at each edge, faster
   as it thins: you only choose which of its three bomb bays fires, and when. Everything you throw goes up: bombs,
   cluster bombs, the UFO's carpet and the meteor swarm. One fleet a game; every tank has three lives, and the
   teams grow. The fleet, tanks, art, sound and code here are original. Everything is in low-res screen pixels. */
import type { ConsoleAPI, CreateGame } from '../types';
import { makeFx, makeWalls, makeScore, makeRound, drawHud, drawSprite, play, rnd } from '../../kit/play';
import type { Fx, Walls, Score, Round, Jingle, Role, Sprite } from '../../kit/play';
import { CROWN, PUFFER, POD, TANK, UFO, BLAST, PILLBOX, MINI } from './art';

let api: ConsoleAPI, fx: Fx, walls: Walls, score: Score, round: Round;
const sprite = (s: Sprite, x: number, y: number, role: Role) => drawSprite(api, s, x, y, role);
/* the tanks and their pillboxes hang from the planet at the top, so they face down at you */
const TANK_DOWN = [...TANK].reverse(), PILLBOX_DOWN = [...PILLBOX].reverse(), PH = PILLBOX.length, MINI_DOWN = [...MINI].reverse();

const SX = 16, SY = 12, AW = 11, AH = 8, ROWS = 5;     // formation spacing; alien size
const TW = 13, TH = 7, TANK_LIVES = 3, TANK_GAP = 16;  // tank size, lives, and how far apart a team keeps
/* speeds are for a 152 px climb (the desk tube); kH() scales them so every layout plays at the same tempo */
const BOMB_SPEED = 170, BOMB_CD = 0.3;
const CLUSTER_SPEED = 100, BOMBLET_SPEED = 175, CLUSTER_CD = 7, CLUSTER_ARM = 2.5, CLUSTER_SPREAD = 9;
const UFO_SPEED = 64, UFO_RECHARGE = 12, UFO_DROP = 0.3;
const METEORS = 18, STORM_PER_HIT = 0.3, STORM_TRICKLE = 1 / 80;
const DROPS_TO_LAND = 22;                               // rows the fleet advances to touch down, whatever the tube's height
const SPRITES = [POD, POD, PUFFER, PUFFER, CROWN];      // row 0 is the front row, nearest the tanks
const ROLES = ['grub', 'grub', 'borer', 'borer', 'rockjaw'];
/** tanks per wave: one, then a team of three, then six */
const TEAM = [1, 1, 2, 3, 3, 4, 5, 6];
const teamSize = (w: number) => TEAM[Math.min(TEAM.length - 1, w - 1)];
/** the pad: three bomb bays along the top, the cluster bomb and the meteor swarm underneath (BOOST is the UFO) */
const PAD = ['pad1', 'pad2', 'pad3', 'pad4', 'pad5'];
type Bay = 'L' | 'M' | 'R';
const BAYS: Bay[] = ['L', 'M', 'R'];
/** what's flying: a bomb from a bay, the UFO's carpet, a cluster bomb, and its bomblets */
type Kind = 'bomb' | 'ufo' | 'cluster' | 'bomblet';
const HOW: Record<Kind, string> = { bomb: 'bomb', ufo: 'ufo', cluster: 'cluster', bomblet: 'cluster' };
/* tunes */
const LANDED: Jingle = { notes: [262, 330, 392, 523, 392, 523, 659], dur: 0.12, vol: 0.045, gap: 0.1 };
const LOST: Jingle = { notes: [440, 392, 330, 262, 196], dur: 0.16, vol: 0.045, gap: 0.15, slide: -20 };
const WON: Jingle = { notes: [392, 523, 659, 784, 1047], dur: 0.1, vol: 0.04, gap: 0.09 };

type Alien = { c: number; r: number; alive: boolean };
type Tank = {
  x: number; lives: number; out: boolean; downT: number; safeT: number; cool: number; i: number;
  aimT: number; aimC: number; aimErr: number;             // the column it's lining up under, and how far off it is
  throughWall: boolean;                                   // every column left is behind a wall, so shoot through it
  dodgeT: number; dodgeX: number; dodgeCD: number;        // mid-dodge: where to, for how long; and when it may dodge again
};
type Bomb = { x: number; y: number; v: number; k: Kind; bay?: Bay };
type Meteor = { x: number; y: number; vx: number; vy: number };
type Shell = { x: number; y: number; v: number; tank: Tank };

const F = {
  aliens: [] as Alien[], cols: 9, total: 0, ox: 0, oy: 0, dir: 1, step: 6, frame: 0, note: 0, marchT: 0,
  bayCD: { L: 0, M: 0, R: 0 } as Record<Bay, number>, clusterCD: 0, lastBay: -1,
  bombs: [] as Bomb[], meteors: [] as Meteor[], shells: [] as Shell[],
  tanks: [] as Tank[],
  ufo: null as null | { x: number; dir: number; dropT: number; humT: number },
  storm: 0, stormMsgT: 0,
  end: '' as '' | 'fallen' | 'touchdown' | 'repelled', landed: false,
  pad: '',                                                // the pad's live state last sent to the console
  tally: {} as Record<string, number>,                    // hits by weapon, for the tests and the autopilots
};

const groundY = () => api.HUD + 2;                        // the planet's surface, along the top
const tankY = () => api.HUD + 3;
const bunkerY = () => tankY() + TH + 16;                  // top of the pillboxes, below the tanks
const touchY = () => tankY() + TH + 6;                    // the fleet's front row reaching this line lands
const ufoY = () => api.LH - 8;                            // the UFO flies under your fleet
const homeOy = () => api.LH - 20 - AH - (ROWS - 1) * SY;  // the back row starts 20 px off the bottom
/** how much longer the climb is than the desk tube's; everything that flies is scaled by it */
const kH = () => Math.max(1, (homeOy() - touchY()) / 152);
const tone: ConsoleAPI['tone'] = (...a) => api.tone(...a);
const alive = () => F.aliens.filter(a => a.alive);
const skill = () => Math.min(1, (api.S.level - 1) / 5);  // how sharp the earthlings are: 0 on wave 1, sharpest by wave 6
const perBay = () => (api.S.level >= 6 ? 2 : 1);          // bombs each bay may have in the air
const liveTanks = () => F.tanks.filter(t => !t.out).length;

/* ---------- the fleet: where it is, and its three bomb bays ---------- */
function span(al = alive()){
  if (!al.length) return null;
  let minC = 99, maxC = -1;
  for (const a of al) { if (a.c < minC) minC = a.c; if (a.c > maxC) maxC = a.c; }
  const left = F.ox + minC * SX, right = F.ox + maxC * SX + AW, mid = (left + right) / 2;
  const cols = [...new Set(al.map(a => a.c))].sort((a, b) => a - b);
  const midC = cols.reduce((b, c) => (Math.abs(F.ox + c * SX + AW / 2 - mid) < Math.abs(F.ox + b * SX + AW / 2 - mid) ? c : b), cols[0]);
  const front = F.oy + Math.min(...al.map(a => a.r)) * SY;
  const col: Record<Bay, number> = { L: minC, M: midC, R: maxC };
  return { minC, maxC, left, right, mid, cols, col, front };
}
/** where a bay's bomb leaves: the top of its column's front alien */
function bayAt(c: number, al = alive()){
  const lead = al.filter(a => a.c === c).reduce((p, q) => (q.r < p.r ? q : p));
  return { x: F.ox + c * SX + 5, y: F.oy + lead.r * SY - 2 };
}
/** a march step every this many seconds: about 10 s from edge to edge with a full fleet (a little quicker each wave),
    up to 1.8 times faster as the fleet thins. A step is 2 px, so the time across scales with the tube's width, not the speed. */
function marchEvery(n: number){
  const travel = Math.max(40, api.LW - 8 - ((F.cols - 1) * SX + AW));
  const pass = Math.max(6, 10 - 0.4 * (api.S.level - 1));
  return pass * 2 / travel * (0.55 + 0.45 * Math.pow(n / F.total, 1.2));
}

/* ---------- a wave: a fresh fleet, a team of tanks and the walls they hide behind ---------- */
function newWave(){
  const { LW, S } = api;
  F.cols = Math.max(5, Math.min(9, Math.floor(((LW - 8) * 0.62 - AW) / SX) + 1));
  F.aliens = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < F.cols; c++) F.aliens.push({ c, r, alive: true });
  F.total = F.aliens.length;
  F.ox = Math.round((LW - (F.cols - 1) * SX - AW) / 2);
  F.step = Math.max(4, Math.round((homeOy() - touchY()) / DROPS_TO_LAND));
  F.oy = homeOy() - Math.min(3, S.level - 1) * F.step;   // later waves start a little closer
  F.dir = Math.random() < 0.5 ? 1 : -1; F.marchT = 0.5; F.frame = 0;
  F.bayCD = { L: 0, M: 0, R: 0 }; F.clusterCD = CLUSTER_ARM; F.lastBay = -1;
  F.bombs = []; F.meteors = []; F.shells = []; F.ufo = null; F.end = ''; F.landed = false; F.stormMsgT = 0;
  fx.clear();
  // the team: spread along the top, never parked over a bay
  const n = teamSize(S.level), sp = span()!, bayX = BAYS.map(b => F.ox + sp.col[b] * SX + 5);
  const slot = (LW - 8 - TW) / n, shift = rnd(0.25, 0.75);
  F.tanks = [];
  for (let i = 0; i < n; i++) {
    let x = Math.round(4 + slot * (i + shift));
    for (let tries = 0; tries < 6 && bayX.some(bx => Math.abs(x + TW / 2 - bx) < 9); tries++) x += (i % 2 ? -1 : 1) * 6;
    F.tanks.push({
      x: Math.max(4, Math.min(LW - 4 - TW, x)), lives: TANK_LIVES, out: false, downT: 0, safeT: 0, cool: rnd(1, 2), i,
      aimT: 0, aimC: -1, aimErr: 0, throughWall: false, dodgeT: 0, dodgeX: 0, dodgeCD: 0,
    });
  }
  walls.clear(); walls.row(LW >= 300 ? 4 : 3, bunkerY(), PILLBOX_DOWN);
  syncPad(true);
}

function start(){
  api.fitGrid();
  const S = api.S;
  S.level = 1; S.lives = 1; S.charge = 1; S.boost = 0.5; S.boostT = 0;   // one fleet, no spares; the UFO starts half charged
  score.reset();
  F.storm = 0; F.tally = {};
  newWave();
}

/* the pad follows the game: CLUSTER is dark while it reloads, METEORS until the swarm is charged */
function syncPad(force = false){
  const cluster = F.clusterCD <= 0, meteors = F.storm >= 1, key = `${cluster}${meteors}`;
  if (!force && key === F.pad) return;
  F.pad = key;
  api.setButtons({ pad4: { enabled: cluster }, pad5: { enabled: meteors } });
}

/* ---------- tanks ---------- */
function tankAt(x: number, y: number){
  const ty = tankY();
  if (y < ty - 1 || y > ty + TH + 1) return null;
  return F.tanks.find(t => !t.out && t.downT <= 0 && t.safeT <= 0 && x >= t.x - 1 && x <= t.x + TW) || null;
}
function hitTank(t: Tank, how: string){
  const S = api.S, ty = tankY();
  t.lives--; F.tally[how] = (F.tally[how] || 0) + 1;
  fx.burst(t.x, ty, 0.9, BLAST);
  [196, 262, 330].forEach((f, i) => tone(f, 0.12, 0.05, -30, i * 0.09));
  if (how !== 'meteor') chargeStorm(STORM_PER_HIT);      // the swarm charges from the other weapons' hits, not its own
  if (t.lives <= 0) {
    t.out = true; score.add(300, t.x - 2, ty + TH + 6);
    api.track('ii_tank', { level: S.level, how });
  } else { t.downT = 1.4; score.add(100, t.x, ty + TH + 6); }   // back in a fresh tank once the wreck clears
}
function chargeStorm(n: number){
  if (F.storm >= 1) return;
  F.storm = Math.min(1, F.storm + n);
  if (F.storm >= 1) { F.stormMsgT = 2.2; tone(660, 0.08, 0.03); tone(880, 0.12, 0.03, 0, 0.09); }
}
/** is there still wall below this spot on the tanks' row? Tanks don't waste shells on their own walls. */
function wallBelow(x: number){
  for (const w of walls.list) {
    const lx = Math.floor(x - w.x);
    if (lx < 0 || lx >= w.w) continue;
    for (let y = 0; y < w.h; y++) if (w.px[y * w.w + lx]) return true;
  }
  return false;
}
/** pick a column to line up over: one from this tank's stretch of the fleet (the sharp ones go for the bay that fired
    last), not behind a wall if it can help it */
function pickAim(t: Tank, cols: number[], team: number, d: number){
  const pick = () => cols[Math.min(cols.length - 1, Math.floor(((t.i % team) + Math.random()) / team * cols.length))];
  t.throughWall = true;
  if (cols.length <= 2) return void (t.aimC = cols[Math.floor(Math.random() * cols.length)], t.aimErr = 0, t.aimT = rnd(0.8, 1.6));   // the last stragglers: whatever's in the way
  for (let tries = 0; tries < 4; tries++) {
    if (F.lastBay >= 0 && cols.includes(F.lastBay) && tries === 0 && Math.random() < (t.i === 0 ? 0.6 : 0.3) * d) t.aimC = F.lastBay;
    else { const a = pick(), b = pick(); t.aimC = Math.abs(F.ox + a * SX - t.x) < Math.abs(F.ox + b * SX - t.x) ? a : b; }   // the nearer of two
    t.aimErr = Math.round(rnd(-3, 3) * (1 - d));
    if (!wallBelow(F.ox + t.aimC * SX + AW / 2 + t.aimErr)) { t.throughWall = false; break; }
  }
  t.aimT = rnd(0.8, 1.6) - d * 0.4;
}
/** the earthlings' wits, sharper every wave: notice what's coming up and dodge it (not always, and not always the
    right way), line up over an alien column, fire one shell each. A bigger team reloads slower, so six tanks aren't
    six times the fire. */
function updateTanks(dt: number){
  const { LW, S } = api, d = skill(), k = kH(), row = tankY() + TH;
  const team = liveTanks() || 1;
  const late = Math.max(0, S.level - 6);                  // past wave 6 they only get quicker on the trigger
  const speed = 36 + 32 * d, look = 0.45 + 0.35 * d, react = 3.5 + 5.5 * d;
  const reload = (0.6 - 0.3 * d) * Math.pow(team, 0.4) / (1 + 0.12 * late);
  const rising = [
    ...F.bombs.map(b => ({ x: b.x, y: b.y, v: b.v })),
    ...F.meteors.map(m => ({ x: m.x + m.vx * Math.max(0, (m.y - row) / m.vy), y: m.y, v: m.vy })),
  ];
  const al = alive(), cols = [...new Set(al.map(a => a.c))].sort((a, b) => a - b);
  const lo = 4, hi = LW - 4 - TW;
  // they lead the march: aim about where the column will be when the shell gets there
  const shellV = Math.min(320, 240 + 10 * S.level) * k;
  const eta = al.length ? (F.oy + Math.max(...al.map(a => a.r)) * SY / 2 - row) / shellV : 0;
  let lead = 0;
  if (al.length) {   // how far the fleet goes in that time, turning back at the edge
    const sp = span(al)!, dist = 0.75 * (2 / marchEvery(al.length)) * eta, room = F.dir > 0 ? LW - 4 - sp.right : sp.left - 4;
    lead = F.dir * (dist <= room ? dist : 2 * room - dist);
  }
  for (const t of F.tanks) {
    if (t.out) continue;
    if (t.downT > 0) {
      if ((t.downT -= dt) <= 0) {   // back in a fresh tank, somewhere nothing is coming up
        let best = t.x, bestD = -1;
        for (let n = 0; n < 8; n++) {
          const x = rnd(lo, hi), near = Math.min(999, ...rising.map(f => Math.abs(f.x - x - TW / 2)));
          if (near > bestD) { bestD = near; best = x; }
        }
        t.x = Math.round(best); t.safeT = 1.2; t.aimT = 0; t.dodgeT = 0;
      }
      continue;
    }
    if (t.safeT > 0) t.safeT -= dt;
    t.cool -= dt;
    if (t.dodgeCD > 0) t.dodgeCD -= dt;
    const cx = t.x + TW / 2;
    // anything about to hit me?
    let threat = null as null | { x: number };
    for (const f of rising) {
      const eta = (f.y - row) / f.v;
      if (eta > 0 && eta < look && Math.abs(f.x - cx) < 11) { threat = f; break; }
    }
    if (threat && t.dodgeT <= 0 && t.dodgeCD <= 0 && Math.random() < 1 - Math.exp(-react * dt)) {
      // away from it; the sharper they are, the more often they pick the side with less coming up
      let side = threat.x <= cx ? 1 : -1;
      if (Math.random() < 0.5 + 0.5 * d) {
        const danger = (x: number) => rising.reduce((s, f) => s + (Math.abs(f.x - x) < 15 ? 1 : 0), 0);
        const L = danger(cx - 28), R = danger(cx + 28);
        if (L !== R) side = L < R ? -1 : 1;
      }
      if (t.x + side * 32 < lo || t.x + side * 32 > hi) side = -side;   // not into the edge of the world
      t.dodgeX = t.x + side * 32; t.dodgeT = 0.45; t.dodgeCD = 0.6 - 0.35 * d;
    }
    let goal: number;
    if (t.dodgeT > 0) { t.dodgeT -= dt; goal = t.dodgeX; }
    else {
      if (((t.aimT -= dt) <= 0 || !cols.includes(t.aimC)) && cols.length) pickAim(t, cols, team, d);
      goal = F.ox + t.aimC * SX + AW / 2 - TW / 2 + t.aimErr + lead;
      if (Math.sign(goal - t.x) === -F.dir && Math.abs(goal - t.x) > 6) goal = t.x;   // it's coming this way: wait for it
    }
    const dx = goal - t.x;
    if (Math.abs(dx) > 1) t.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    t.x = Math.max(lo, Math.min(hi, t.x));
    // fire when lined up over an alien with no wall in the way (not mid-dodge); behind a wall, pick somewhere else,
    // unless every column left is behind one (otherwise a fleet that does nothing would never be shot down)
    const mine = F.shells.some(s => s.tank === t);
    if (!mine && t.cool <= 0 && t.dodgeT <= 0) {
      const sx = t.x + TW / 2;
      if (wallBelow(sx) && !t.throughWall) { if (Math.abs(dx) <= 1) t.aimT = Math.min(t.aimT, 0.15); }
      else if (al.some(a => sx - lead >= F.ox + a.c * SX && sx - lead <= F.ox + a.c * SX + AW - 1)) {
        F.shells.push({ x: Math.round(sx), y: row, v: shellV, tank: t });
        t.cool = reload * rnd(0.8, 1.3); tone(880, 0.05, 0.022, -500);
      }
    }
  }
  // a team keeps its spacing: no two tanks on the same patch of ground
  const up = F.tanks.filter(t => !t.out && t.downT <= 0).sort((a, b) => a.x - b.x);
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < up.length; i++) {
    const a = up[i - 1], b = up[i], gap = TANK_GAP - (b.x - a.x);
    if (gap > 0) { a.x = Math.max(lo, a.x - gap / 2); b.x = Math.min(hi, b.x + gap / 2); }
  }
}

/* ---------- the loop ---------- */
function fireBay(bay: Bay, sp: NonNullable<ReturnType<typeof span>>){
  const S = api.S;
  if (F.bayCD[bay] > 0 || F.bombs.filter(b => b.bay === bay).length >= perBay()) return;
  const c = sp.col[bay], at = bayAt(c);
  F.bombs.push({ x: at.x, y: at.y, v: (BOMB_SPEED + S.level * 4) * kH(), k: 'bomb', bay });
  F.bayCD[bay] = BOMB_CD; F.lastBay = c;
  tone(bay === 'L' ? 360 : bay === 'R' ? 280 : 320, 0.08, 0.035, -160);
}

function update(dt: number){
  const S = api.S, LW = api.LW, k = kH();
  fx.update(dt);
  if (F.stormMsgT > 0) F.stormMsgT -= dt;
  if (!round.tick(dt)) return;
  let sp = span();
  if (!sp) return repelled();

  /* the march: a 2 px step at a time, and a row closer to the tanks at each edge; the legs and the heartbeat quicken
     as the fleet thins */
  const al = alive();
  if ((F.marchT -= dt) <= 0) {
    F.marchT += marchEvery(al.length);
    if (F.marchT < 0) F.marchT = 0;
    const nx = F.ox + F.dir * 2;
    if (sp.left + (nx - F.ox) < 4 || sp.right + (nx - F.ox) > LW - 4) {
      F.dir = -F.dir; F.oy -= F.step;
      tone(70, 0.12, 0.07, -20);
      for (const a of al) {   // the fleet chews through walls it climbs into
        const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
        if (ay <= bunkerY() + PH) walls.chew({ x: ax, y: ay, w: AW, h: AH });
      }
    } else F.ox = nx;
    F.frame ^= 1; tone([98, 87, 78, 73][F.note = (F.note + 1) % 4], 0.07, 0.05);
    sp = span()!;
  }

  /* the bays: ◀ ▲ ▶ on the pad (← ↑ →, Z X C), FIRE and Space for the middle one, and a tap fires the nearest */
  for (const b of BAYS) if (F.bayCD[b] > 0) F.bayCD[b] -= dt;
  if (api.button('pad1').queued) fireBay('L', sp);
  if (api.button('pad2').queued || api.fireQueued) fireBay('M', sp);
  if (api.button('pad3').queued) fireBay('R', sp);
  if (api.tapQueued) {
    const near = BAYS.reduce((p, q) => (Math.abs(bayAt(sp!.col[q]).x - api.tapX) < Math.abs(bayAt(sp!.col[p]).x - api.tapX) ? q : p), 'M' as Bay);
    fireBay(near, sp);
  }
  for (const id of ['pad1', 'pad2', 'pad3', 'fire']) api.clearButton(id);
  api.clearTap();

  /* CLUSTER (A): a slow bomb from the middle bay that bursts into three short of the walls */
  if (F.clusterCD > 0) F.clusterCD -= dt;
  if (api.button('pad4').queued && F.clusterCD <= 0) {
    const at = bayAt(sp.col.M);
    F.bombs.push({ x: at.x, y: at.y, v: CLUSTER_SPEED * k, k: 'cluster' });
    F.clusterCD = CLUSTER_CD; tone(220, 0.18, 0.045, -120); tone(110, 0.3, 0.03, -40, 0.05);
  }
  api.clearButton('pad4');

  /* BOOST (Shift): the UFO crosses under the fleet, sending a bomb up every 0.3 s along its way */
  if (api.boostQueued && S.boost >= 1 && !F.ufo) {
    const d = Math.random() < 0.5 ? 1 : -1;
    F.ufo = { x: d > 0 ? -16 : LW, dir: d, dropT: 0.2, humT: 0 }; S.boost = 0;
    api.track('ii_ufo', { level: S.level, tanks: liveTanks() });
  }
  api.clearBoost();
  if (F.ufo) {
    S.boostT = 1;
    const u = F.ufo;
    u.x += u.dir * UFO_SPEED * dt;
    if ((u.humT -= dt) <= 0) { u.humT = 0.18; tone(Math.floor(S.time * 10) % 2 ? 330 : 247, 0.12, 0.02); }
    if ((u.dropT -= dt) <= 0 && u.x > 0 && u.x < LW - 16) { u.dropT = UFO_DROP; F.bombs.push({ x: Math.round(u.x + 8), y: ufoY() - 2, v: 130 * k, k: 'ufo' }); }
    if (u.x < -20 || u.x > LW + 4) F.ufo = null;
  } else { S.boostT = 0; S.boost = Math.min(1, S.boost + dt / UFO_RECHARGE); }

  /* METEORS (S): once charged, 18 rocks hurled up from below the fleet, across the whole width */
  chargeStorm(dt * STORM_TRICKLE);
  if (api.button('pad5').queued && F.storm >= 1) {
    F.storm = 0; F.stormMsgT = 0;
    for (let i = 0; i < METEORS; i++) F.meteors.push({ x: rnd(8, LW - 8), y: api.LH + rnd(0, 120 * k), vx: rnd(-14, 14), vy: rnd(85, 135) * k });
    tone(180, 1.2, 0.05, -140); tone(90, 1.4, 0.04, -50, 0.1);
    api.track('ii_meteors', { level: S.level, tanks: liveTanks() });
  }
  api.clearButton('pad5');
  syncPad();
  S.charge = 1;

  updateTanks(dt);

  /* everything in flight moves in sub-steps of at most 3 px, so a fast shell on a tall tube can't skip an 8 px alien or a wall */
  const fastest = Math.max(0, ...F.bombs.map(b => b.v), ...F.meteors.map(m => Math.hypot(m.vx, m.vy)), ...F.shells.map(s => s.v));
  const steps = Math.min(12, Math.max(1, Math.ceil(fastest * dt / 3)));
  for (let i = 0; i < steps; i++) flight(dt / steps);

  /* how the wave ends */
  const left = alive();
  if (!left.length) return repelled();
  const front = F.oy + Math.min(...left.map(a => a.r)) * SY;
  if (front <= touchY()) {
    F.landed = true;
    for (const t of F.tanks) if (!t.out) { t.out = true; fx.burst(t.x, tankY(), 0.6, BLAST); }
    return waveWon('touchdown', 500 + 20 * left.length);
  }
  if (F.tanks.every(t => t.out)) return waveWon('fallen', 20 * left.length);
}
function flight(dt: number){
  const S = api.S, LW = api.LW;
  /* bombs and meteors rise to the earthlings */
  const k = kH(), burstY = bunkerY() + PH + 5, spawn: Bomb[] = [];
  for (const b of F.bombs) {
    b.y -= b.v * dt;
    if (b.k === 'cluster' && b.y <= burstY) {   // bursts into three bomblets short of the walls
      for (const dx of [-CLUSTER_SPREAD, 0, CLUSTER_SPREAD]) spawn.push({ x: b.x + dx, y: b.y, v: BOMBLET_SPEED * k, k: 'bomblet' });
      fx.burst(b.x - 6, b.y - 3, 0.15, BLAST); tone(520, 0.08, 0.04, -300);
      b.y = -99; continue;
    }
    if (walls.bite(b.x, b.y, 2)) { b.y = -99; continue; }
    const t = tankAt(b.x, b.y);
    if (t) { b.y = -99; hitTank(t, HOW[b.k]); continue; }
    if (b.y <= groundY()) { fx.burst(b.x - 6, groundY(), 0.2, BLAST); tone(90, 0.08, 0.03); b.y = -99; }
  }
  F.bombs.push(...spawn);
  for (const m of F.meteors) {
    m.x += m.vx * dt; m.y -= m.vy * dt;
    if (m.y > api.LH) continue;
    if (walls.bite(m.x, m.y, 3)) { fx.burst(m.x - 6, m.y - 3, 0.2, BLAST); m.y = -99; continue; }
    const t = tankAt(m.x, m.y) || tankAt(m.x + 1, m.y);
    if (t) { m.y = -99; hitTank(t, 'meteor'); continue; }
    if (m.y <= groundY()) { fx.burst(m.x - 6, groundY(), 0.2, BLAST); tone(60, 0.1, 0.03); m.y = -99; }
  }
  F.bombs = F.bombs.filter(b => b.y > 0);
  F.meteors = F.meteors.filter(m => m.y > 0 && m.x > -10 && m.x < LW + 10);

  /* their shells: one alien each, unless a bomb, a wall or the UFO gets in the way */
  for (const s of F.shells) {
    s.y += s.v * dt;
    let hit = false;
    for (const b of F.bombs) if (Math.abs(b.x - s.x) <= (b.k === 'cluster' ? 2 : 1) && Math.abs(b.y - s.y) < 4) {
      // a shell knocks a bomb out and carries on (a line of bombs is no shield); a cluster bomb stops it
      if (b.k === 'cluster') { fx.burst(b.x - 6, b.y - 3, 0.2, BLAST); tone(700, 0.1, 0.035, -400); hit = true; }
      else tone(1200, 0.04, 0.02);
      b.y = -99; break;
    }
    if (!hit && walls.bite(s.x, s.y + 2, 1)) hit = true;
    if (!hit) for (const a of F.aliens) {
      if (!a.alive) continue;
      const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
      if (s.x >= ax && s.x < ax + AW && s.y + 3 >= ay && s.y <= ay + AH) {
        a.alive = false; hit = true; fx.burst(ax - 1, ay, 0.2, BLAST); tone(240, 0.12, 0.04, -160); break;
      }
    }
    if (!hit && F.ufo && s.y + 3 >= ufoY() && s.x >= F.ufo.x && s.x < F.ufo.x + 16) {   // they got the UFO
      fx.burst(F.ufo.x + 1, ufoY() - 2, 0.5, BLAST); tone(1200, 0.25, 0.045, -900); F.ufo = null; hit = true;
    }
    if (hit || s.y > api.LH) s.y = api.LH + 99;
  }
  F.shells = F.shells.filter(s => s.y <= api.LH);
  F.bombs = F.bombs.filter(b => b.y > 0);
}
function repelled(){
  const S = api.S;
  F.end = 'repelled'; F.bombs = []; F.shells = []; F.meteors = []; F.ufo = null;
  round.lose({ fatal: true, secs: 2.2 });
  play(api, LOST);
  api.track('ii_wave', { level: S.level, how: 'repelled' });
}
function waveWon(how: 'touchdown' | 'fallen', bonus: number){
  const S = api.S;
  F.end = how; F.shells = []; F.ufo = null;
  score.add(bonus);
  fx.pop('+' + bonus, api.LW / 2 - 16, api.HUD + 30, { secs: 2.2 });
  round.clear({ secs: 2.4 });
  play(api, how === 'touchdown' ? LANDED : WON);
  api.track('ii_wave', { level: S.level, how });
}

/* ---------- drawing ---------- */
function hud(){
  const { g, LW, S } = api;
  const right = 'WAVE ' + S.level;
  drawHud(api, { right });
  // the earthlings' tanks, each with its lives as pips underneath
  let x = LW - 14 - right.length * 6 - F.tanks.length * 10;
  for (const t of F.tanks) {
    if (!t.out) sprite(MINI_DOWN, x, 5, t.downT > 0 || t.safeT > 0 ? 'textDim' : 'cart');
    else { g.fillStyle = api.col('textDim'); g.fillRect(x, 7, 7, 1); }
    g.fillStyle = api.col('gold'); for (let i = 0; i < t.lives; i++) g.fillRect(x + i * 3, 11, 1, 1);
    x += 10;
  }
  // the meteor charge: a rising-rock glyph and a bar under the score, flashing gold when it's ready
  const ready = F.storm >= 1, on = !ready || Math.floor(S.time * 4) % 2 === 0;
  if (on) {
    g.fillStyle = api.col(ready ? 'gold' : 'textDim'); g.fillRect(6, 14, 2, 2); g.fillRect(8, 16, 1, 1);
    g.fillStyle = api.col('textDim'); g.fillRect(11, 15, 32, 1);
    g.fillStyle = api.col(ready ? 'gold' : 'hud'); g.fillRect(11, 15, Math.round(32 * F.storm), 1);
  }
}
function draw(){
  const { g, LW, S } = api;
  walls.draw('gem');
  // your fleet, with each bay lit along its front while it can fire, and the cluster's ready marks either side of the middle
  const al = alive();
  for (const a of al) sprite(SPRITES[a.r][F.frame], F.ox + a.c * SX, F.oy + a.r * SY, ROLES[a.r]);
  const sp = span(al);
  if (sp && (S.mode === 'play' || S.mode === 'ready')) {
    for (const b of BAYS) {
      if (F.bayCD[b] > 0 || F.bombs.filter(q => q.bay === b).length >= perBay()) continue;
      const at = bayAt(sp.col[b], al);
      g.fillStyle = api.col('spark'); g.fillRect(Math.round(at.x) - 1, at.y, 3, 1); g.fillRect(Math.round(at.x), at.y - 1, 1, 1);
    }
    if (F.clusterCD <= 0) { const at = bayAt(sp.col.M, al); g.fillStyle = api.col('gold'); g.fillRect(at.x - 3, at.y - 1, 1, 2); g.fillRect(at.x + 3, at.y - 1, 1, 2); }
  }
  if (F.ufo) sprite(UFO, Math.round(F.ufo.x), ufoY(), 'sun');
  // everything going up
  for (const b of F.bombs) {
    const y = Math.round(b.y), x = Math.round(b.x), w = Math.floor(S.time * 12 + b.x) % 2;
    if (b.k === 'cluster') { g.fillStyle = api.col('gold'); g.fillRect(x - 1, y, 3, 4); g.fillStyle = api.col(w ? 'spark' : 'sun'); g.fillRect(x, y + 1, 1, 2); continue; }
    g.fillStyle = api.col(b.k === 'ufo' ? 'sun' : 'gold');
    if (b.k === 'bomblet') g.fillRect(x, y, 1, 3);
    else if (b.k === 'ufo') { g.fillRect(x, y, 1, 2); g.fillRect(x - 1, y + 2, 2, 2); }
    else { g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y + 1, 3, 3); }
  }
  for (const m of F.meteors) {
    if (m.y > api.LH) continue;
    const x = Math.round(m.x), y = Math.round(m.y);
    g.fillStyle = api.col('textDim'); g.fillRect(Math.round(x - m.vx * 0.06), y + 3, 1, 4);
    g.fillStyle = api.col('sun'); g.fillRect(x, y, 2, 2);
  }
  g.fillStyle = api.col('spark'); for (const s of F.shells) g.fillRect(s.x, Math.round(s.y), 1, 4);
  // the earthlings: a wreck is gone until its fresh tank rolls in, blinking while nothing can touch it
  for (const t of F.tanks) {
    if (t.out || t.downT > 0) continue;
    if (t.safeT > 0 && Math.floor(t.safeT * 10) % 2) continue;
    sprite(TANK_DOWN, Math.round(t.x), tankY(), 'cart');
  }
  g.fillStyle = api.col('hud'); g.fillRect(0, groundY(), LW, 1);
  fx.draw();
  hud();
  if (S.mode === 'play' && F.stormMsgT > 0 && Math.floor(F.stormMsgT * 5) % 2) api.txt('METEORS READY', LW / 2, api.LH - 22, 'gold', 'center');
  if (S.mode === 'ready') {
    const n = F.tanks.length;
    api.banner('WAVE ' + S.level, S.level === 1 ? 'BOMB AS A BAY PASSES UNDER' : `${n} TANK${n > 1 ? 'S' : ''} · ${TANK_LIVES} LIVES EACH`);
  }
  if (S.mode === 'clear') api.banner(F.end === 'touchdown' ? 'TOUCHDOWN' : 'EARTH HAS FALLEN', F.end === 'touchdown' ? 'THE FLEET HAS LANDED' : 'EVERY TANK DESTROYED');
  if (S.mode === 'dying') api.banner('INVASION REPELLED');
}

const create: CreateGame = a => {
  api = a;
  fx = makeFx(a); walls = makeWalls(a);
  score = makeScore(a, { extraEvery: Infinity, fx });   // no spare fleets, however well it goes
  round = makeRound(a, { respawn: () => {}, nextLevel: newWave, times: { ready: 1.6, dying: 2.2, clear: 2.4 }, clearOnReady: [...PAD, 'fire', 'boost'] });
  return { start, update, draw, debug: {
    state: () => ({ ...F, walls: walls.list, fx: fx.count, k: kH(), bays: (() => { const sp = span(); return sp && { L: bayAt(sp.col.L), M: bayAt(sp.col.M), R: bayAt(sp.col.R), col: sp.col }; })() }),
    /** Stop the tanks shooting for a while and clear their shells (tests). */
    holdFire: () => { F.shells = []; for (const t of F.tanks) t.cool = 99; },
    /** Move the fleet up (negative) or down by dy pixels (tests). */
    climb: (dy: number) => { F.oy += dy; },
    /** Charge the meteor swarm (tests). */
    charge: () => { F.storm = 1; },
  } };
};
export default create;

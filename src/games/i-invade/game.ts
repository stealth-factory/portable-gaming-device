/* I Invade: the fixed-screen alien shooter turned round. You are the fleet, climbing from the bottom of the screen;
   the tanks along the top are the defenders. Steer the formation, fire bombs up from its three bomb bays,
   and call in the UFO for a heavy strike from behind your lines.
   The fleet, tanks, art, sound and code here are original. Everything is in low-res screen pixels. */
import type { ConsoleAPI, CreateGame } from '../types';
import { makeFx, makeWalls, makeScore, makeRound, drawHud, drawSprite, horizontal, pressed, consume, play, rnd } from '../../kit/play';
import type { Fx, Walls, Score, Round, Jingle, Role, Sprite } from '../../kit/play';
import { CROWN, PUFFER, POD, TANK, UFO, BLAST, PILLBOX, MINI } from './art';

let api: ConsoleAPI, fx: Fx, walls: Walls, score: Score, round: Round;
const sprite = (s: Sprite, x: number, y: number, role: Role) => drawSprite(api, s, x, y, role);
/* the tanks and their pillboxes hang from the planet at the top, so they face down at you */
const TANK_DOWN = [...TANK].reverse(), PILLBOX_DOWN = [...PILLBOX].reverse(), PH = PILLBOX.length;

const SX = 16, SY = 12, AW = 11, AH = 8;                 // formation spacing; alien size
const ROWS = 4, FLEET_SPEED = 48, BOMB_SPEED = 150, SHOT_SPEED = 170;
const TW = 13, TH = 7;                                    // tank size
const UFO_SPEED = 72, UFO_RECHARGE = 14, EXTRA_EVERY = 2000;
const SPRITES = [POD, PUFFER, PUFFER, CROWN];            // row 0 is the front row, nearest the tanks
const ROLES = ['grub', 'borer', 'borer', 'rockjaw'];
/* tunes */
const EXTRA: Jingle = { notes: [523, 659, 784, 1047], dur: 0.08, vol: 0.05, gap: 0.07 };
const LANDED: Jingle = { notes: [262, 330, 392, 523, 392, 523, 659], dur: 0.12, vol: 0.045, gap: 0.1 };
const LOST: Jingle = { notes: [392, 330, 262, 196, 147], dur: 0.16, vol: 0.045, gap: 0.15, slide: -20 };
const WON: Jingle = { notes: [392, 523, 659, 784, 1047], dur: 0.1, vol: 0.04, gap: 0.09 };

type Alien = { c: number; r: number; alive: boolean };
type Tank = { x: number; dir: number; goal: number; goalT: number; cool: number; out: boolean; dodge: boolean };
type Shot = { x: number; y: number };

const F = {
  aliens: [] as Alien[], cols: 9, ox: 0, oy: 0, dropT: 0, beatT: 0, frame: 0, note: 0,
  bomb: null as null | Shot,
  tanks: [] as Tank[], shots: [] as Shot[],
  ufo: null as null | { x: number; dir: number; dropped: boolean }, heavy: null as null | Shot,
  landed: false, wiped: false,
};

const groundY = () => api.HUD + 2;                        // the planet's surface, along the top
const tankY = () => api.HUD + 3;
const bunkerY = () => tankY() + TH + 16;                  // top of the pillboxes, below the tanks
const ufoY = () => api.LH - 8;                            // the UFO flies under your fleet
const startOy = () => api.LH - 20 - AH - (ROWS - 1) * SY; // the back row starts 20 px off the bottom
const tone: ConsoleAPI['tone'] = (...a) => api.tone(...a);
const alive = () => F.aliens.filter(a => a.alive);
const tankPts = () => 100 + 50 * (api.S.level - 1);

/* ---------- the fleet ---------- */
function newFleet(){
  const { LW } = api;
  F.cols = Math.max(5, Math.min(9, Math.floor((LW - 60) / SX)));
  F.aliens = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < F.cols; c++) F.aliens.push({ c, r, alive: true });
  F.ox = Math.round((LW - (F.cols - 1) * SX - AW) / 2);
  F.oy = startOy();
  F.dropT = dropEvery(); F.beatT = 0; F.bomb = null; F.shots = []; F.wiped = false;
}
/* the fleet climbs a step every few seconds, sooner each wave */
const dropEvery = () => Math.max(1.6, 3.2 - 0.25 * (api.S.level - 1));
/* the columns still flying, the three bomb bays (the outermost columns and the one nearest the middle) and where they are;
   a bay fires from the top of its column's front alien */
type Bay = 'L' | 'M' | 'R';
const BAY_SLOTS = ['fireL', 'fire', 'fireR'];
function span(){
  const al = alive(); if (!al.length) return null;
  const cs = al.map(a => a.c), minC = Math.min(...cs), maxC = Math.max(...cs);
  const mid = F.ox + (minC + maxC) * SX / 2 + AW / 2;
  const cols = [...new Set(cs)];
  const bay = cols.reduce((b, c) => Math.abs(F.ox + c * SX + 5 - mid) < Math.abs(F.ox + b * SX + 5 - mid) ? c : b, cols[0]);
  const front = F.oy + Math.min(...al.map(a => a.r)) * SY;
  const at = (c: number) => {
    const lead = al.filter(a => a.c === c).reduce((p, q) => (q.r < p.r ? q : p));
    return { x: F.ox + c * SX + 5, y: F.oy + lead.r * SY };
  };
  const bays: Record<Bay, { x: number; y: number }> = { L: at(minC), M: at(bay), R: at(maxC) };
  return { minC, maxC, mid, bays, front, cols };
}

/* ---------- a wave: a fresh fleet, a row of tanks and the walls they hide behind ---------- */
function newWave(){
  const { LW, S } = api;
  newFleet();
  const n = Math.min(5, 1 + S.level);
  F.tanks = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round((LW - TW) * (i + 0.5) / n);
    F.tanks.push({ x, dir: i % 2 ? -1 : 1, goal: x, goalT: rnd(0.5, 1.5), cool: rnd(1.2, 2.4), out: false, dodge: false });
  }
  walls.clear(); walls.row(LW >= 300 ? 4 : 3, bunkerY(), PILLBOX_DOWN);
  F.ufo = null; F.heavy = null; fx.clear(); F.landed = false;
}

function start(){
  api.fitGrid();
  const S = api.S;
  S.level = 1; S.lives = 3; S.charge = 1; S.boost = 1; S.boostT = 0;
  score.reset();
  newWave();
}

function hitTank(x: number, y: number){
  const ty = tankY();
  if (y < ty - 1 || y > ty + TH) return null;
  return F.tanks.find(t => !t.out && x >= t.x - 1 && x <= t.x + TW) || null;
}
function blowUp(t: Tank){
  t.out = true;
  score.add(tankPts(), t.x, tankY() + TH + 4);
  fx.burst(t.x, tankY(), 0.5, BLAST);
  tone(140, 0.3, 0.06, -90); tone(70, 0.4, 0.05, -30, 0.05);
}

function update(dt: number){
  const S = api.S, LW = api.LW;
  fx.update(dt);
  if (!round.tick(dt)) return;
  const sp = span();
  if (!sp) return;

  /* you steer the fleet left and right; the three fire buttons send a bomb up from the left, middle or right bay, one in the air at a time */
  const dir = horizontal(api);
  if (dir) {
    const lo = 4 - sp.minC * SX, hi = LW - 4 - AW - sp.maxC * SX;
    F.ox = Math.max(lo, Math.min(hi, F.ox + dir * FLEET_SPEED * dt));
  }
  const which: Bay | null = pressed(api, 'fireL') ? 'L' : pressed(api, 'fireR') ? 'R' : pressed(api, 'fire', true) ? 'M' : null;
  if (which && !F.bomb) {
    const b = sp.bays[which];
    F.bomb = { x: Math.round(b.x), y: b.y - 4 };          // y is the bomb's nose
    tone(330, 0.12, 0.035, -200);
    const chance = Math.min(0.75, 0.2 + 0.1 * S.level);   // the defenders get better at spotting bombs
    for (const t of F.tanks) t.dodge = Math.random() < chance;
  }
  consume(api, BAY_SLOTS, true);
  S.charge = F.bomb ? 0 : 1;

  /* BOOST calls in the UFO: it crosses under your fleet and fires one heavy bomb up at the first tank it passes beneath */
  if (api.boostQueued && S.boost >= 1 && !F.ufo) {
    const from = sp.mid < LW / 2 ? 1 : -1;
    F.ufo = { x: from > 0 ? -16 : LW, dir: from, dropped: false };
    S.boost = 0; tone(520, 0.3, 0.04, 400);
  }
  api.clearBoost();
  if (F.ufo) {
    S.boostT = 1;
    F.ufo.x += F.ufo.dir * UFO_SPEED * dt;
    if (Math.floor(S.time * 8) % 2 === 0) tone(F.ufo.dropped ? 440 : 600, 0.03, 0.012);
    if (!F.ufo.dropped && F.tanks.some(t => !t.out && Math.abs(t.x + TW / 2 - (F.ufo!.x + 8)) < 3)) {
      F.ufo.dropped = true; F.heavy = { x: Math.round(F.ufo.x + 8), y: ufoY() - 6 }; tone(220, 0.4, 0.04, -150);
    }
    if (F.ufo.x < -20 || F.ufo.x > LW + 4) F.ufo = null;
  } else { S.boostT = 0; S.boost = Math.min(1, S.boost + dt / UFO_RECHARGE); }

  /* your bomb */
  if (F.bomb) {
    const b = F.bomb; b.y -= BOMB_SPEED * dt;
    const t = hitTank(b.x, b.y);
    if (t) { blowUp(t); F.bomb = null; }
    else if (walls.bite(b.x, b.y, 2)) { F.bomb = null; tone(180, 0.06, 0.03); }
    else if (b.y <= groundY()) { F.bomb = null; fx.burst(b.x - 6, groundY(), 0.2, BLAST); tone(90, 0.08, 0.03); }
  }
  /* the UFO's heavy bomb smashes through the walls */
  if (F.heavy) {
    const h = F.heavy; h.y -= BOMB_SPEED * 1.2 * dt;
    walls.bite(h.x, h.y, 3);
    const t = hitTank(h.x, h.y);
    if (t) { blowUp(t); F.heavy = null; }
    else if (h.y <= groundY()) F.heavy = null;
  }

  /* the fleet climbs; the beat quickens as it nears the tanks */
  const top = tankY() + TH + 6;
  const depth = Math.max(0, Math.min(1, (startOy() - sp.front) / Math.max(1, startOy() - top)));
  if ((F.beatT -= dt) <= 0) {
    F.beatT = 0.6 - depth * 0.4; F.frame ^= 1;
    tone([110, 98, 87, 82][F.note = (F.note + 1) % 4], 0.07, 0.06);
  }
  if ((F.dropT -= dt) <= 0) {
    F.dropT = dropEvery(); F.oy -= 6;
    for (const a of alive()) {   // the fleet chews through walls it climbs into
      const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
      if (ay <= bunkerY() + PH) walls.chew({ x: ax, y: ay, w: AW, h: AH });
    }
  }
  /* touchdown: the fleet reaches the tanks' row, and the planet is yours */
  if (sp.front <= top) {
    const left = alive().length;
    F.landed = true; score.add(left * 20);
    for (const t of F.tanks) if (!t.out) { t.out = true; fx.burst(t.x, tankY(), 0.6, BLAST); }
    round.clear({ secs: 2.2 });
    play(api, LANDED);
    api.track('touchdown', { level: S.level, aliens: left });
    return;
  }

  /* the tanks: patrol above the fleet, shoot down at it, and dodge bombs they spot */
  const lvl = S.level, tSpeed = Math.min(64, 30 + 5 * lvl);
  for (const t of F.tanks) {
    if (t.out) continue;
    const cx = t.x + TW / 2;
    const threat = [F.bomb, F.heavy].find(b => b && Math.abs(b.x - cx) < TW && b.y < api.LH * 0.65);
    let want = 0;
    if (threat && (t.dodge || threat === F.heavy)) want = threat.x < cx ? 1 : -1;
    else {
      if ((t.goalT -= dt) <= 0) { const c = sp.cols[Math.floor(Math.random() * sp.cols.length)]; t.goal = F.ox + c * SX + 5 - TW / 2; t.goalT = rnd(0.8, 2.2); }
      if (Math.abs(t.goal - t.x) > 1.5) want = t.goal > t.x ? 1 : -1;
    }
    if (want) t.x = Math.max(2, Math.min(LW - 2 - TW, t.x + want * tSpeed * (threat ? 1.4 : 1) * dt));
    // shoot when lined up over a column
    t.cool -= dt;
    const lined = sp.cols.some(c => Math.abs(F.ox + c * SX + 5 - cx) < 4);
    if (t.cool <= 0 && lined && !threat) {
      F.shots.push({ x: Math.round(cx), y: tankY() + TH });
      t.cool = Math.max(0.9, 2.7 - 0.25 * lvl) + rnd(0, 0.8);
      tone(900, 0.05, 0.025, -500);
    }
  }
  // tanks keep their distance from each other
  const live = F.tanks.filter(t => !t.out).sort((a, b) => a.x - b.x);
  for (let i = 1; i < live.length; i++) if (live[i].x - live[i - 1].x < TW + 2) { const m = (live[i].x + live[i - 1].x) / 2; live[i - 1].x = Math.max(2, m - (TW + 2) / 2); live[i].x = Math.min(LW - 2 - TW, m + (TW + 2) / 2); }

  /* tank shots: through the gaps, into your fleet */
  for (const s of F.shots) {
    s.y += SHOT_SPEED * dt;
    const gone = api.LH + 99;
    if (F.bomb && Math.abs(F.bomb.x - s.x) <= 1 && Math.abs(F.bomb.y - s.y) < 4) { F.bomb = null; s.y = gone; tone(1200, 0.04, 0.02); continue; }   // shot meets bomb
    if (walls.bite(s.x, s.y + 2, 1)) { s.y = gone; continue; }
    if (F.ufo && s.y + 2 >= ufoY() && s.x >= F.ufo.x && s.x < F.ufo.x + 16) { fx.burst(F.ufo.x, ufoY() - 2, 0.4, BLAST); F.ufo = null; s.y = gone; tone(700, 0.3, 0.04, -600); continue; }
    for (const a of F.aliens) {
      if (!a.alive) continue;
      const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
      if (s.x >= ax && s.x < ax + AW && s.y <= ay + AH && s.y + 3 >= ay) {
        a.alive = false; s.y = gone; fx.burst(ax - 1, ay, 0.2, BLAST); tone(240, 0.12, 0.04, -160);
        break;
      }
    }
  }
  F.shots = F.shots.filter(s => s.y < api.LH);

  /* every alien gone: that fleet is lost */
  if (!alive().length) {
    F.wiped = true; round.lose({ secs: 1.6 }); F.bomb = null; F.shots = [];
    play(api, LOST);
    return;
  }
  /* every tank gone: wave won */
  if (F.tanks.every(t => t.out)) {
    round.clear(); F.shots = [];
    play(api, WON);
  }
}

/* ---------- drawing ---------- */
function draw(){
  const { g, LW, S } = api;
  walls.draw('gem');
  // your fleet, with the bomb bays lit along its front while a bomb is ready
  for (const a of F.aliens) if (a.alive) sprite(SPRITES[a.r][F.frame], F.ox + a.c * SX, F.oy + a.r * SY, ROLES[a.r]);
  const sp = span();
  if (sp && !F.bomb && S.mode === 'play' && Math.floor(S.time * 4) % 2 === 0) {
    g.fillStyle = api.col('spark');
    for (const b of Object.values(sp.bays)) g.fillRect(Math.round(b.x) - 1, b.y - 2, 3, 1);
  }
  if (F.ufo) sprite(UFO, F.ufo.x, ufoY(), 'sun');
  // bombs and shots
  g.fillStyle = api.col('gold');
  if (F.bomb) { const y = Math.round(F.bomb.y); g.fillRect(F.bomb.x, y, 1, 1); g.fillRect(F.bomb.x - 1, y + 1, 3, 3); }
  if (F.heavy) { const y = Math.round(F.heavy.y); g.fillRect(F.heavy.x - 1, y, 3, 1); g.fillRect(F.heavy.x - 2, y + 1, 5, 4); }
  g.fillStyle = api.col('spark');
  for (const s of F.shots) g.fillRect(s.x, Math.round(s.y), 1, 3);
  for (const t of F.tanks) if (!t.out) sprite(TANK_DOWN, t.x, tankY(), 'cart');
  g.fillStyle = api.col('hud'); g.fillRect(0, groundY(), LW, 1);
  fx.draw();
  drawHud(api, { right: 'WAVE ' + S.level, lives: { art: MINI, role: 'grub' } });
  if (S.mode === 'ready') api.banner('WAVE ' + S.level, 'FIRE TO BOMB · BOOST FOR UFO');
  if (S.mode === 'clear') api.banner(F.landed ? 'TOUCHDOWN' : 'TANKS DESTROYED', F.landed ? 'THE PLANET IS YOURS' : '');
  if (S.mode === 'dying' && F.wiped) api.banner('FLEET LOST');
}

const create: CreateGame = a => {
  api = a;
  fx = makeFx(a); walls = makeWalls(a);
  score = makeScore(a, { extraEvery: EXTRA_EVERY, fx, onExtra: () => play(a, EXTRA) });
  round = makeRound(a, { respawn: newFleet, nextLevel: newWave, times: { ready: 1.2, respawn: 0.9, dying: 1.6, clear: 1.8 }, clearOnReady: [...BAY_SLOTS, 'boost'] });
  return { start, update, draw, debug: { state: () => ({ ...F, walls: walls.list, fx: fx.count, nextLife: score.nextLife }) } };
};
export default create;

/* Invader Force: hold the line against a marching alien formation.
   A tribute to the fixed-screen alien shooters of the late 1970s (Taito's Space Invaders, 1978).
   The aliens, cannon, art, sound and code here are original. Everything is in low-res screen pixels. */
import type { ConsoleAPI, CreateGame } from '../types';
import { makeFx, makeWalls, makeScore, makeRound, makePickups, drawHud, drawSprite, horizontal, play, rnd } from '../../kit/play';
import type { Fx, Walls, Score, Round, Pickups, Pickup, Badge, Jingle, Role, Sprite } from '../../kit/play';
import { JELLY, BEETLE, DRONE, CANNON, SAUCER, BURST, CAPSULE, CAPSULE_MARK, BLAST, CASTLE, MINI } from './art';
import {
  type Weapon, type Shot, type Capsule, MAX_CAPSULES, WEAPON_NAME, WEAPON_TIME, CAPSULE_W, CAPSULE_H, CAPSULE_SPEED, BEAM_TIME, BLAST_R, CLASH_R,
  SPEED_TIME, stackSpeed, SAUCER_NUKE, NUKE_BLAST_R, rollNuke, nukeRows, nukeDepth, NUKE_SPEED, waveRows, rowType, shotSpeedFactor, tickSpeed, type Drop,
  volley, canFire, fireGap, rollDrop, pickDrop, tickWeapon, inBeam, bombHitsCapsule, shotHitsCapsule, inBlast,
} from './weapons';

let api: ConsoleAPI, fx: Fx, walls: Walls, score: Score, round: Round, caps: Pickups<Drop>;
const sprite = (s: Sprite, x: number, y: number, role: Role) => drawSprite(api, s, x, y, role);
/** A falling capsule, as the weapon rules see it. */
const asCapsule = (c: Pickup<Drop>): Capsule => ({ x: c.x, y: c.y, w: c.kind });
const live = (c: Pickup<Drop>) => caps.list.includes(c);
/* tunes */
const EXTRA: Jingle = { notes: [1047, 1319, 1568], dur: 0.09, vol: 0.05, gap: 0.08 };
const LOST: Jingle = { notes: [440, 392, 330, 262, 196], dur: 0.16, vol: 0.045, gap: 0.15, slide: -20 };
const CLEARED: Jingle = { notes: [392, 523, 659, 784, 1047], dur: 0.1, vol: 0.04, gap: 0.09 };

const SX = 16, SY = 12, AW = 11, AH = 8;              // formation spacing; alien size
const CANNON_SPEED = 72, SHOT_SPEED = 240;
const SHIELD_TIME = 1.6, SHIELD_RECHARGE = 9, EXTRA_EVERY = 1500;
const POINTS = [30, 20, 10];                            // jelly, beetle, drone
const ROLES = ['rockjaw', 'borer', 'grub'];
const SPRITES = [JELLY, BEETLE, DRONE];

type Alien = { c: number; r: number; t: number; alive: boolean };

const F = {
  aliens: [] as Alien[], cols: 11, rows: 6, total: 0, ox: 0, oy: 0, dir: 1, stepT: 0, frame: 0, note: 0,
  px: 0, shots: [] as Shot[],
  weapon: 'basic' as Weapon, weaponT: 0, fireCd: 0, speed: 0, speedT: 0, nuke: false, flash: 0, missile: null as null | { x: number; y: number },
  beam: null as null | { x: number; t: number },
  /** The falling capsules (kept by the kit's pickups; setting it replaces them, for the tests). */
  get capsules(): Pickup<Drop>[] { return caps.list as Pickup<Drop>[]; },
  set capsules(v: Pickup<Drop>[]) { caps.clear(); for (const c of v) caps.drop(c.x, c.y, c.kind, true); },
  blasts: [] as { x: number; y: number; t: number; r: number }[],
  bombs: [] as { x: number; y: number; v: number; k: number }[],
  ufo: null as null | { x: number; dir: number; pts: number; sirenT: number }, ufoT: 20,
  invaded: false,
};

const cannonY = () => api.LH - 14;
const bunkerY = () => cannonY() - 28;
const tone: ConsoleAPI['tone'] = (...a) => api.tone(...a);

/* ---------- a wave ---------- */
function newWave(){
  const { LW, HUD, S } = api;
  const wave = S.level;
  F.cols = Math.max(6, Math.min(11, Math.floor((LW - 40) / SX)));
  F.aliens = [];
  F.oy = HUD + 22 + Math.min(4, wave - 1) * 6;           // each wave starts a little lower
  F.rows = waveRows(wave, bunkerY() - F.oy, SY);           // and grows a row every two waves
  for (let r = 0; r < F.rows; r++) for (let c = 0; c < F.cols; c++) F.aliens.push({ c, r, t: rowType(r, F.rows), alive: true });
  F.total = F.aliens.length;
  F.ox = Math.round((LW - (F.cols - 1) * SX - AW) / 2);
  F.dir = 1; F.stepT = 0.6; F.frame = 0;
  F.shots = []; F.beam = null; F.missile = null; caps.clear(); F.blasts = []; F.flash = 0; F.fireCd = 0; F.bombs = []; F.ufo = null; F.ufoT = rnd(16, 24); fx.clear(); F.invaded = false;
  // castle walls with a gate, rebuilt every wave
  walls.clear(); walls.row(LW >= 300 ? 4 : 3, bunkerY(), CASTLE);
}
function stepInterval(){
  const alive = F.aliens.filter(a => a.alive).length;
  const base = Math.max(0.2, 0.62 * Math.pow(0.9, api.S.level - 1));
  return 0.016 + base * Math.pow(alive / F.total, 1.15);  // the fewer left, the faster they march
}

function start(){
  api.fitGrid();
  const S = api.S;
  S.level = 1; S.lives = 3; S.charge = 1; S.boost = 1; S.boostT = 0;
  score.reset(); F.weapon = 'basic'; F.weaponT = 0; F.speed = 0; F.speedT = 0; F.nuke = false; F.flash = 0; api.setButtons({ boost: null });
  F.px = Math.round(api.LW / 2 - 6);
  newWave();
}


/* ---------- the player is hit, or the line falls ---------- */
function loseLife(invaded = false){
  const S = api.S;
  F.invaded = invaded;
  round.lose({ fatal: invaded });
  F.shots = []; F.beam = null; F.weapon = 'basic'; F.weaponT = 0;
  play(api, LOST);
  fx.burst(F.px + 1, cannonY(), 1.2, BURST, burstRole);
}

/* ---------- shots, the laser, capsules ---------- */
function killAlien(a: Alien, drops = true){
  const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
  a.alive = false; score.add(POINTS[a.t]);
  fx.burst(ax, ay, 0.18, BURST, burstRole); tone(260, 0.12, 0.04, -180);
  if (!drops) return;
  if (rollNuke(Math.random(), caps.falling)) dropCapsule(ax + 1, ay + AH, 'nuke');
  else if (rollDrop(Math.random(), caps.falling)) dropCapsule(ax + 1, ay + AH);
}
function hitSaucer(){
  const u = F.ufo!;
  score.add(u.pts, u.x + 2, api.HUD + 4); tone(1200, 0.25, 0.045, -900);
  dropCapsule(u.x + 4, api.HUD + 10, Math.random() < SAUCER_NUKE ? 'nuke' : undefined);   // the saucer always carries one
  F.ufo = null;
}
function dropCapsule(x: number, y: number, w?: Drop){
  caps.drop(Math.round(x), y, w ?? pickDrop(Math.random(), F.weapon), true);   // the odds were rolled already; the saucer always drops
  tone(1568, 0.05, 0.025, 400);
}
/** A capsule right on top of the barrel is yours to catch, not to shoot. */
const reachable = (c: Pickup<Drop>) => c.y + CAPSULE_H > cannonY() - 4;
/** A shot at (x, y): does it hit something (and is it used up)? */
function shotHits(x: number, y: number){
  if (F.ufo && y < api.HUD + 12 && x >= F.ufo.x && x < F.ufo.x + 16) { hitSaucer(); return true; }
  for (const a of F.aliens) {
    if (!a.alive) continue;
    const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
    if (x >= ax && x < ax + AW && y + 3 >= ay && y < ay + AH) { killAlien(a); return true; }
  }
  for (const b of F.bombs) if (Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) < 4) { b.y = 9999; clash(x, y); return true; }   // shots meet and go off
  for (const c of caps.list) if (!reachable(c) && shotHitsCapsule(x, y, asCapsule(c))) { explode(c, false); return true; }   // shoot one and it goes off
  return walls.bite(x, y, 1);
}
function fire(){
  const x = Math.round(F.px) + 6, y = cannonY() - 2;
  F.fireCd = fireGap(F.weapon);
  if (F.weapon === 'pierce') { lightning(x); return; }
  const v = volley(F.weapon, x, y);
  F.shots.push(...v);
  tone(v.length > 1 ? 760 : 880, 0.06, 0.03, -500);
  api.buzz('fire');
}
/** The lightning laser: one bolt straight up the column, through walls, bombs, aliens and the saucer. */
function lightning(x: number){
  const before = caps.list.slice();                  // a drop this bolt shakes loose isn't caught in it
  F.beam = { x, t: BEAM_TIME };
  tone(1900, 0.18, 0.035, -1600); tone(70, 0.26, 0.05, 140); tone(2600, 0.05, 0.02, -900, 0.06);
  api.buzz('fire');
  if (F.ufo && x >= F.ufo.x - 1 && x < F.ufo.x + 17) hitSaucer();
  for (const a of F.aliens) if (a.alive && inBeam(x, F.ox + a.c * SX, AW)) killAlien(a);
  for (const b of F.bombs) if (Math.abs(b.x - x) <= 2) b.y = 9999;
  for (const c of before) if (live(c) && !reachable(c) && inBeam(x, c.x, CAPSULE_W)) explode(c, false);
  for (let y = cannonY() - 2; y > api.HUD; y -= 2) walls.bite(x, y, 1);
}
function arm(w: Drop){
  if (w === 'nuke') {
    if (F.nuke) { score.add(500, F.px, cannonY() - 14); return; }   // only one at a time: a spare is worth 500
    F.nuke = true; api.setButtons({ boost: { label: 'nuke' } });
    play(api, { notes: [262, 330, 392, 523, 392, 523], dur: 0.12, vol: 0.05, gap: 0.09 });
    label('NUKE READY', Math.max(4, Math.min(api.LW - 60, F.px - 12)), 1.2);
    return;
  }
  if (w === 'speed') {
    ({ level: F.speed, t: F.speedT } = stackSpeed(F.speed));
    play(api, { notes: [523, 659, 784, 1047, 1319].slice(0, 2 + F.speed), dur: 0.05, vol: 0.035, gap: 0.045 });
    label('SPEED x' + F.speed, Math.max(4, Math.min(api.LW - 40, F.px - 6)), 0.9);
    return;
  }
  F.weapon = w; F.weaponT = WEAPON_TIME; F.fireCd = 0;
  play(api, { notes: [784, 988, 1175, 1568], dur: 0.07, vol: 0.04, gap: 0.06 });
  label(WEAPON_NAME[w], Math.max(4, Math.min(api.LW - 40, F.px - 6)), 0.9);
}
/** A pickup's label: above the cannon, stacked over any label still showing. */
function label(text: string, x: number, secs: number){ fx.pop(text, x, cannonY() - 14, { secs, stack: { step: 9, within: 46 } }); }
/** Bursts blink while your cannon goes up; otherwise they're gold. */
const burstRole = (t: number): Role => (api.S.mode === 'dying' && t > 0.2 && Math.floor(t * 10) % 2 ? 'spark' : 'gold');
/** A capsule goes off: a wide blast that bites the walls and takes out aliens, bombs and other capsules.
    Set off by a bomb it takes your cannon too unless the shield is up; set off by your own shot or the
    laser (`hurtsYou` false) it spares you. Returns true if it cost you a life. */
function explode(c: Pickup<Drop>, hurtsYou = true){
  const cx = c.x + CAPSULE_W / 2, cy = c.y + CAPSULE_H / 2;
  caps.remove(c);
  tone(55, 0.5, 0.07, -30); tone(160, 0.3, 0.05, -120); tone(900, 0.12, 0.03, -800);
  return blast(cx, cy, c.kind === 'nuke' ? NUKE_BLAST_R : BLAST_R, hurtsYou, true);
}
/** Launch the atomic bomb: a missile that flies up until it hits something. */
function nuke(){
  F.nuke = false; api.setButtons({ boost: null });
  F.missile = { x: Math.round(F.px) + 6, y: cannonY() - 8 };
  tone(180, 0.6, 0.05, 700); tone(90, 0.6, 0.04, 300);
  api.buzz('fire');
}
function flyMissile(dt: number){
  const m = F.missile!;
  m.y -= NUKE_SPEED * dt;
  for (const b of F.bombs) if (Math.abs(b.x - m.x) <= 2 && b.y + 4 >= m.y && b.y < m.y + 7) b.y = 9999;   // it shrugs off bombs
  for (let y = m.y; y < m.y + 7; y += 2) walls.bite(m.x, y, 1);                                         // and punches through walls
  if (F.ufo && m.y < api.HUD + 10 && m.x >= F.ufo.x && m.x < F.ufo.x + 16) return detonate(m.x, m.y, 0);
  for (const a of F.aliens) {
    if (!a.alive) continue;
    const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
    if (m.x >= ax - 3 && m.x < ax + AW + 3 && m.y <= ay + AH && m.y + 7 >= ay) return detonate(m.x, m.y, a.r);
  }
  if (m.y < api.HUD + 2) detonate(m.x, m.y, -1);
}
/** The atomic blast: a white flash that wipes out 3 or 4 whole rows around the point of impact, and every bomb. */
function detonate(x: number, y: number, hitRow: number){
  F.missile = null;
  const rows = hitRow < 0 ? [] : nukeRows(hitRow, nukeDepth(Math.random()), F.rows);
  for (const a of F.aliens) if (a.alive && rows.includes(a.r)) killAlien(a, false);
  if (F.ufo && (hitRow === 0 || y < api.HUD + 14)) hitSaucer();
  F.bombs = [];
  F.blasts.push({ x, y, t: 0.5, r: 28 });
  F.flash = 0.7;
  tone(40, 1.2, 0.09, -20); tone(90, 0.8, 0.07, -60); tone(1800, 0.3, 0.03, -1700);
  api.track('nuke', { wave: api.S.level, rows: rows.length });
}
/** Your shot and a bomb meet: a smaller blast where they collide, which can take out aliens around it. */
function clash(x: number, y: number){
  tone(120, 0.22, 0.05, -60); tone(1400, 0.06, 0.025, -1000);
  blast(x, y, CLASH_R, false, false);
}
/** A blast of radius r at (cx, cy). Returns true if it cost you a life. */
function blast(cx: number, cy: number, r: number, hurtsYou: boolean, hitsCapsules: boolean){
  F.blasts.push({ x: cx, y: cy, t: 0.5, r });
  walls.blast(cx, cy, r);
  for (const a of F.aliens) if (a.alive && inBlast(cx, cy, F.ox + a.c * SX, F.oy + a.r * SY, AW, AH, r)) killAlien(a, false);
  if (F.ufo && inBlast(cx, cy, F.ufo.x, api.HUD + 4, 16, 6, r)) hitSaucer();
  for (const b of F.bombs) if (inBlast(cx, cy, b.x - 1, b.y, 3, 4, r)) b.y = 9999;
  if (hitsCapsules) for (const o of caps.list.slice()) if (inBlast(cx, cy, o.x, o.y, CAPSULE_W, CAPSULE_H, r)) caps.remove(o);
  if (hurtsYou && inBlast(cx, cy, F.px, cannonY(), 13, 7, r)) {
    if (api.S.boostT > 0) tone(1500, 0.05, 0.03);       // the shield takes it
    else { loseLife(); return true; }
  }
  return false;
}

function update(dt: number){
  const S = api.S, LW = api.LW;
  // visual effects run down in every mode, so a flash or blast never sticks over the clear and ready screens
  fx.update(dt);
  for (const b of F.blasts) b.t -= dt;
  F.blasts = F.blasts.filter(b => b.t > 0);
  if (F.beam && (F.beam.t -= dt) <= 0) F.beam = null;
  if (F.flash > 0) F.flash -= dt;
  if (!round.tick(dt)) return;

  /* your cannon: left and right, one shot in the air at a time (more with a weapon), and a short shield */
  const dir = horizontal(api);
  if (dir) F.px = Math.max(4, Math.min(LW - 4 - 13, F.px + dir * CANNON_SPEED * dt));
  if (F.fireCd > 0) F.fireCd -= dt;
  const press = api.fireQueued || api.tapQueued || (F.weapon === 'rapid' && (api.fireHeld || api.tapHeld));
  if (press && canFire(F.weapon, F.shots.length, F.fireCd)) fire();
  api.clearFire(); api.clearTap();
  S.charge = canFire(F.weapon, F.shots.length, Math.max(0, F.fireCd)) ? 1 : 0;
  if (api.boostQueued && F.nuke) nuke();
  else if (api.boostQueued && S.boost >= 1) { S.boostT = SHIELD_TIME; S.boost = 0; tone(400, 0.25, 0.04, 600); }
  api.clearBoost();
  if (S.boostT > 0) S.boostT -= dt; else S.boost = Math.min(1, S.boost + dt / SHIELD_RECHARGE);
  const had = F.weapon;
  ({ w: F.weapon, t: F.weaponT } = tickWeapon(F.weapon, F.weaponT, dt));
  if (had !== F.weapon) [660, 440].forEach((f, i) => tone(f, 0.08, 0.035, 0, i * 0.08));   // the weapon ran out
  if (F.missile) flyMissile(dt);
  const fast = F.speed;
  ({ level: F.speed, t: F.speedT } = tickSpeed(F.speed, F.speedT, dt));
  if (fast && !F.speed) [523, 392].forEach((f, i) => tone(f, 0.08, 0.03, 0, i * 0.08));

  /* your shots */
  for (const sh of F.shots) {
    // move in small steps so fast shots can't skip over an alien or a bomb
    const dy = SHOT_SPEED * shotSpeedFactor(F.speed) * dt, n = Math.max(1, Math.ceil(dy / 3));
    for (let i = 0; i < n; i++) {
      sh.y -= dy / n; sh.x += sh.vx * (dy / SHOT_SPEED) / n;
      if (shotHits(sh.x, sh.y) || sh.y < api.HUD + 2 || sh.x < 0 || sh.x >= LW) { sh.y = -99; break; }
    }
  }
  F.shots = F.shots.filter(sh => sh.y > -99);

  /* capsules fall; catch one with the cannon to arm it */
  for (const w of caps.update(dt, { x: F.px, y: cannonY(), w: 13, h: 7 })) arm(w);

  /* the formation marches; at an edge it drops a row and turns */
  const alive = F.aliens.filter(a => a.alive);
  if (!alive.length) { round.clear(); play(api, CLEARED); return; }
  if ((F.stepT -= dt) <= 0) {
    F.stepT = stepInterval();
    const minC = Math.min(...alive.map(a => a.c)), maxC = Math.max(...alive.map(a => a.c));
    const dx = alive.length === 1 ? 3 : 2;
    const left = F.ox + minC * SX + F.dir * dx, right = F.ox + maxC * SX + AW + F.dir * dx;
    if (left < 4 || right > LW - 4) { F.oy += 6; F.dir = -F.dir; } else F.ox += F.dir * dx;
    F.frame ^= 1;
    tone([98, 87, 78, 73][F.note = (F.note + 1) % 4], 0.07, 0.06);
    // the bottom alien of a column drops a bomb, often the one nearest you
    const maxBombs = Math.min(5, 2 + Math.floor(S.level / 2));
    if (F.bombs.length < maxBombs && Math.random() < 0.35 + 0.05 * S.level) {
      const cols = [...new Set(alive.map(a => a.c))];
      const near = cols.reduce((b, c) => Math.abs(F.ox + c * SX + 5 - F.px) < Math.abs(F.ox + b * SX + 5 - F.px) ? c : b, cols[0]);
      const c = Math.random() < 0.4 ? near : cols[Math.floor(Math.random() * cols.length)];
      const a = alive.filter(q => q.c === c).reduce((p, q) => (q.r > p.r ? q : p));
      F.bombs.push({ x: F.ox + a.c * SX + 5, y: F.oy + a.r * SY + AH, v: Math.min(130, 70 + S.level * 6), k: Math.floor(Math.random() * 2) });
    }
    // aliens chew through the walls they reach; if they reach your row, the line has fallen
    const bottom = F.oy + Math.max(...alive.map(a => a.r)) * SY + AH;
    for (const a of alive) {
      const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
      if (ay + AH >= bunkerY()) walls.chew({ x: ax, y: ay, w: AW, h: AH });
    }
    if (bottom >= cannonY()) { loseLife(true); return; }
  }

  /* bombs */
  for (const b of F.bombs) {
    if (b.y >= 9999) continue;                         // already used up this step (a blast took it)
    b.y += b.v * dt;
    const hitCap = caps.list.find(c => bombHitsCapsule(b.x, b.y, asCapsule(c)));
    if (hitCap) { b.y = 9999; if (explode(hitCap)) return; continue; }
    if (walls.bite(b.x, b.y + 3, 2)) { b.y = 9999; continue; }
    const cy = cannonY();
    if (b.y + 4 >= cy && b.y < cy + 7 && b.x >= F.px && b.x < F.px + 13) {
      b.y = 9999;
      if (S.boostT > 0) { tone(1500, 0.05, 0.03); continue; }   // the shield takes it
      loseLife(); return;
    }
  }
  F.bombs = F.bombs.filter(b => b.y < api.LH - 6);

  /* the mystery saucer */
  if (!F.ufo && (F.ufoT -= dt) <= 0 && alive.length > 6) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    F.ufo = { x: dir > 0 ? -16 : LW, dir, pts: [50, 100, 150, 300][Math.floor(Math.random() * 4)], sirenT: 0 };
    F.ufoT = rnd(18, 28);
  }
  if (F.ufo) {
    F.ufo.x += F.ufo.dir * 45 * dt;
    if ((F.ufo.sirenT -= dt) <= 0) { F.ufo.sirenT = 0.22; tone(Math.floor(api.S.time * 9) % 2 ? 660 : 520, 0.09, 0.018); }
    if (F.ufo.x < -20 || F.ufo.x > LW + 4) F.ufo = null;
  }
}

/* ---------- drawing ---------- */
/** The lightning laser: a white-hot core in a glow, wrapped in crackling strands that flare where
    bright pulses race up the beam. Redrawn with fresh zigzags every frame. */
function drawBeam(){
  const { g, S } = api, b = F.beam!;
  const top = api.HUD + 2, bot = cannonY() - 2, len = bot - top;
  const pulses = [0, 1, 2].map(k => bot - ((S.time * 340 + k * len / 3) % len));
  if (b.t > BEAM_TIME * 0.45) { g.fillStyle = api.col('spark'); g.fillRect(b.x - 1, top, 3, len); }
  g.fillStyle = api.col('text'); g.fillRect(b.x, top, 1, len);
  g.fillStyle = api.col('spark');
  for (let strand = 0; strand < 2; strand++) {
    let off = 0;
    for (let y = bot; y > top; y--) {
      if (y % 3 === 0) {
        const d = Math.min(...pulses.map(p => Math.abs(p - y)));
        const amp = 1 + Math.round(4 * Math.exp(-d * d / 40));
        const next = Math.round((Math.random() * 2 - 1) * amp);
        g.fillRect(b.x + Math.min(off, next), y, Math.abs(next - off) + 1, 1);
        off = next;
      } else g.fillRect(b.x + off, y, 1, 1);
    }
  }
  g.fillStyle = api.col('text');
  for (const p of pulses) { g.fillRect(b.x - 1, Math.round(p) - 1, 3, 3); g.fillRect(b.x - 2, Math.round(p), 5, 1); }
}
/** The top bar: the weapon you hold (draining as it runs down), a NUKE and the speed boost as badges. */
function hud(){
  const badges: Badge[] = [];
  if (F.weapon !== 'basic') badges.push({ text: WEAPON_NAME[F.weapon], role: 'gold', frac: F.weaponT / WEAPON_TIME, blink: F.weaponT > 3 ? 0 : 6 });
  if (F.nuke) badges.push({ text: 'NUKE', role: 'text', blink: 3 });
  if (F.speed) badges.push({ text: '>' + F.speed, role: 'spark', frac: F.speedT / SPEED_TIME, blink: F.speedT > 5 ? 0 : 6 });
  drawHud(api, { right: 'WAVE ' + api.S.level, lives: { art: MINI, role: 'cart' }, badges });
}
function draw(){
  const { g, LW, LH, S } = api;
  walls.draw('gem');
  // the formation
  for (const a of F.aliens) if (a.alive) sprite(SPRITES[a.t][F.frame], F.ox + a.c * SX, F.oy + a.r * SY, ROLES[a.t]);
  if (F.ufo) sprite(SAUCER, F.ufo.x, api.HUD + 4, 'sun');
  // shots and bombs
  g.fillStyle = api.col('spark');
  for (const sh of F.shots) g.fillRect(Math.round(sh.x), Math.round(sh.y), 1, F.speed ? 6 : 4);   // fast shots streak
  if (F.beam) drawBeam();
  if (F.missile) {   // the atomic bomb: a fat warhead with a sputtering exhaust
    const m = F.missile, y = Math.round(m.y);
    g.fillStyle = api.col('text'); g.fillRect(m.x - 1, y, 3, 6); g.fillRect(m.x, y - 1, 1, 1);
    g.fillStyle = api.col('gold'); g.fillRect(m.x - 2, y + 4, 1, 2); g.fillRect(m.x + 2, y + 4, 1, 2);
    g.fillStyle = api.col('spark'); for (let i = 0; i < 4; i++) if (Math.random() < 0.7) g.fillRect(m.x + Math.round(Math.random() * 2 - 1), y + 7 + i * 2, 1, 1);
  }
  // capsules, blinking as they fall
  caps.draw();
  g.fillStyle = api.col('gold');
  for (const b of F.bombs) {
    const y = Math.round(b.y), w = Math.floor(S.time * 12 + b.x) % 2;
    if (b.k) { g.fillRect(b.x + w, y, 1, 1); g.fillRect(b.x + 1 - w, y + 1, 1, 1); g.fillRect(b.x + w, y + 2, 1, 1); g.fillRect(b.x + 1 - w, y + 3, 1, 1); }
    else { g.fillRect(b.x, y, 1, 4); g.fillRect(b.x - 1, y + 1 + w * 2, 3, 1); }
  }
  // your cannon (blinking while it respawns), with the shield dome when it's up
  const cy = cannonY();
  const show = S.mode !== 'dying' && !(S.mode === 'ready' && Math.floor(S.modeT * 8) % 2);
  if (show) sprite(CANNON, F.px, cy, 'cart');
  if (S.boostT > 0 && Math.floor(S.time * 20) % 3) {
    g.fillStyle = api.col('gem');
    for (let i = -9; i <= 9; i++) { const x = F.px + 6 + i, y = cy - 2 - Math.round(Math.sqrt(Math.max(0, 81 - i * i)) * 0.7); g.fillRect(x, y, 1, 1); }
  }
  // the ground
  g.fillStyle = api.col('hud'); g.fillRect(0, LH - 5, LW, 1);
  // capsule blasts: a flash of shards and a ring racing out to the edge of the blast
  for (const b of F.blasts) {
    const k = 1 - b.t / 0.5, r = b.r * Math.sqrt(k);
    if (k < 0.5) sprite(BLAST, b.x - 8, b.y - 5, Math.floor(b.t * 20) % 2 ? 'spark' : 'gold');
    g.fillStyle = api.col('gold');
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 1, 1); }
  }
  // bursts and points
  fx.draw();
  // the nuke's flash: the whole field burns white, then a shockwave sweeps up the screen
  if (F.flash > 0) {
    const k = F.flash / 0.7;
    if (k > 0.75) { g.fillStyle = api.col('text'); g.fillRect(0, api.HUD, LW, LH - api.HUD); }
    else {
      const y = Math.round(api.HUD + (LH - api.HUD) * k / 0.75);
      g.fillStyle = api.col('text'); g.fillRect(0, y, LW, 2);
      g.fillStyle = api.col('spark'); for (let x = (y % 3); x < LW; x += 3) g.fillRect(x, y + 3, 1, 1);
    }
  }
  hud();
  if (S.mode === 'ready') api.banner('WAVE ' + S.level, 'FIRE TO SHOOT · BOOST FOR SHIELD');
  if (S.mode === 'clear') api.banner('WAVE CLEARED');
  if (S.mode === 'dying' && F.invaded) api.banner('THE LINE HAS FALLEN');
}

const create: CreateGame = a => {
  api = a;
  fx = makeFx(a); walls = makeWalls(a);
  score = makeScore(a, { extraEvery: EXTRA_EVERY, fx, onExtra: () => play(a, EXTRA) });
  round = makeRound(a, {
    respawn: () => { F.bombs = []; F.px = Math.round(a.LW / 2 - 6); },
    nextLevel: newWave,
    times: { ready: 1.2, respawn: 0.9, dying: 1.4, clear: 1.8 },
  });
  caps = makePickups<Drop>(a, {
    size: { w: CAPSULE_W, h: CAPSULE_H }, speed: CAPSULE_SPEED, max: MAX_CAPSULES,
    floor: () => a.LH - 6 - 1e-9,          // gone once its top reaches 6 px above the bottom, as before
    draw: (w, x, y) => {                   // capsules blink as they fall
      sprite(CAPSULE, x, y, Math.floor(a.S.time * 6) % 2 ? 'gold' : 'sun');
      sprite(CAPSULE_MARK[w], x + 2, y + 2, 'text');
    },
  });
  return { start, update, draw, debug: {
    state: () => F,
    /** Drop a capsule just above the cannon (tests). */
    drop: (w: Drop = 'twin') => { caps.drop(Math.round(F.px) + 2, cannonY() - 20, w, true); },
    /** Arm a weapon or a speed boost straight away (tests). */
    arm: (w: Drop) => arm(w),
    /** Set off a capsule at (x, y) (tests). */
    blast: (x: number, y: number) => { caps.drop(x, y, 'twin', true); explode(caps.list[caps.list.length - 1]); },
    clash: (x: number, y: number) => clash(x, y),
    cannonY: () => cannonY(),
    /** Knock every wall down (tests). */
    clearWalls: () => walls.clear(),
    /** Drop a capsule straight above the barrel, low enough that its blast reaches you, but not yet catchable (tests). */
    target: (w: Drop = 'twin') => { caps.drop(Math.round(F.px) + 2, cannonY() - 17, w, true); },
  } };
};
export default create;

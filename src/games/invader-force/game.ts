/* Invader Force: hold the line against a marching alien formation.
   A tribute to the fixed-screen alien shooters of the late 1970s (Taito's Space Invaders, 1978).
   The aliens, cannon, art, sound and code here are original. Everything is in low-res screen pixels. */
import type { ConsoleAPI, CreateGame } from '../types';
import { useApi, sprite, JELLY, BEETLE, DRONE, CANNON, SAUCER, BURST, CAPSULE, CAPSULE_MARK, BLAST } from './art';
import {
  type Weapon, type Shot, type Capsule, WEAPON_NAME, WEAPON_TIME, CAPSULE_W, CAPSULE_H, CAPSULE_SPEED, BEAM_TIME, BLAST_R, CLASH_R,
  SPEED_TIME, stackSpeed, SAUCER_NUKE, NUKE_BLAST_R, rollNuke, nukeRows, nukeDepth, NUKE_SPEED, waveRows, rowType, shotSpeedFactor, tickSpeed, type Drop,
  volley, canFire, fireGap, rollDrop, pickDrop, catches, tickWeapon, inBeam, bombHitsCapsule, inBlast,
} from './weapons';

let api: ConsoleAPI;

const SX = 16, SY = 12, AW = 11, AH = 8;              // formation spacing; alien size
const CANNON_SPEED = 72, SHOT_SPEED = 240;
const SHIELD_TIME = 1.6, SHIELD_RECHARGE = 9, EXTRA_EVERY = 1500;
const POINTS = [30, 20, 10];                            // jelly, beetle, drone
const ROLES = ['rockjaw', 'borer', 'grub'];
const SPRITES = [JELLY, BEETLE, DRONE];

type Alien = { c: number; r: number; t: number; alive: boolean };
type Bunker = { x: number; y: number; px: Uint8Array };
const BW = 18, BH = 12;

const F = {
  aliens: [] as Alien[], cols: 11, rows: 6, total: 0, ox: 0, oy: 0, dir: 1, stepT: 0, frame: 0, note: 0,
  px: 0, shots: [] as Shot[],
  weapon: 'basic' as Weapon, weaponT: 0, fireCd: 0, speed: 0, speedT: 0, nuke: false, flash: 0, missile: null as null | { x: number; y: number },
  beam: null as null | { x: number; t: number },
  capsules: [] as Capsule[],
  blasts: [] as { x: number; y: number; t: number; r: number }[],
  bombs: [] as { x: number; y: number; v: number; k: number }[],
  bunkers: [] as Bunker[],
  ufo: null as null | { x: number; dir: number; pts: number; sirenT: number }, ufoT: 20,
  bursts: [] as { x: number; y: number; t: number; text?: string }[],
  extra: EXTRA_EVERY, invaded: false,
};

const cannonY = () => api.LH - 14;
const bunkerY = () => cannonY() - 28;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
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
  F.shots = []; F.beam = null; F.missile = null; F.capsules = []; F.blasts = []; F.flash = 0; F.fireCd = 0; F.bombs = []; F.ufo = null; F.ufoT = rnd(16, 24); F.bursts = []; F.invaded = false;
  // bunkers: castle walls with a gate, rebuilt every wave
  const n = LW >= 300 ? 4 : 3, gap = (LW - n * BW) / (n + 1);
  F.bunkers = [];
  for (let i = 0; i < n; i++) {
    const px = new Uint8Array(BW * BH);
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const merlon = y < 2 ? x % 4 < 2 : true;
      const gate = y >= BH - 3 && x >= 6 && x < 12;
      px[y * BW + x] = merlon && !gate ? 1 : 0;
    }
    F.bunkers.push({ x: Math.round(gap + i * (BW + gap)), y: bunkerY(), px });
  }
}
function stepInterval(){
  const alive = F.aliens.filter(a => a.alive).length;
  const base = Math.max(0.2, 0.62 * Math.pow(0.9, api.S.level - 1));
  return 0.016 + base * Math.pow(alive / F.total, 1.15);  // the fewer left, the faster they march
}

function start(){
  api.fitGrid();
  const S = api.S;
  S.score = 0; S.level = 1; S.lives = 3; S.charge = 1; S.boost = 1; S.boostT = 0;
  F.extra = EXTRA_EVERY; F.weapon = 'basic'; F.weaponT = 0; F.speed = 0; F.speedT = 0; F.nuke = false; F.flash = 0; api.setBoostLabel(null);
  F.px = Math.round(api.LW / 2 - 6);
  newWave();
}

/* ---------- scoring ---------- */
function addScore(n: number, x?: number, y?: number){
  const S = api.S;
  S.score += n;
  if (S.score > api.best) api.best = S.score;
  if (S.score >= F.extra) { F.extra += EXTRA_EVERY; S.lives++; [1047, 1319, 1568].forEach((f, i) => tone(f, 0.09, 0.05, 0, i * 0.08)); }
  if (x != null) F.bursts.push({ x, y: y!, t: 0.8, text: String(n) });
}

/* ---------- bunkers ---------- */
function bunkerHit(x: number, y: number, radius = 2){
  for (const b of F.bunkers) {
    const lx = Math.floor(x - b.x), ly = Math.floor(y - b.y);
    if (lx < 0 || ly < 0 || lx >= BW || ly >= BH || !b.px[ly * BW + lx]) continue;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = lx + dx, yy = ly + dy;
      if (xx < 0 || yy < 0 || xx >= BW || yy >= BH) continue;
      if (dx * dx + dy * dy <= radius * radius + 1 && Math.random() < 0.75) b.px[yy * BW + xx] = 0;   // ragged bites
    }
    return true;
  }
  return false;
}

/* ---------- the player is hit, or the line falls ---------- */
function loseLife(invaded = false){
  const S = api.S;
  F.invaded = invaded;
  S.lives = invaded ? 0 : S.lives - 1;
  S.mode = 'dying'; S.modeT = 1.4;
  F.shots = []; F.beam = null; F.weapon = 'basic'; F.weaponT = 0;
  [440, 392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 0.045, -20, i * 0.15));
  F.bursts.push({ x: F.px + 1, y: cannonY(), t: 1.2 });
}

/* ---------- shots, the laser, capsules ---------- */
function killAlien(a: Alien, drops = true){
  const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
  a.alive = false; addScore(POINTS[a.t]);
  F.bursts.push({ x: ax, y: ay, t: 0.18 }); tone(260, 0.12, 0.04, -180);
  if (!drops) return;
  if (rollNuke(Math.random(), F.capsules.length)) dropCapsule(ax + 1, ay + AH, 'nuke');
  else if (rollDrop(Math.random(), F.capsules.length)) dropCapsule(ax + 1, ay + AH);
}
function hitSaucer(){
  const u = F.ufo!;
  addScore(u.pts, u.x + 2, api.HUD + 4); tone(1200, 0.25, 0.045, -900);
  dropCapsule(u.x + 4, api.HUD + 10, Math.random() < SAUCER_NUKE ? 'nuke' : undefined);   // the saucer always carries one
  F.ufo = null;
}
function dropCapsule(x: number, y: number, w?: Drop){
  F.capsules.push({ x: Math.round(x), y, w: w ?? pickDrop(Math.random(), F.weapon) });
  tone(1568, 0.05, 0.025, 400);
}
/** A shot at (x, y): does it hit something (and is it used up)? */
function shotHits(x: number, y: number){
  if (F.ufo && y < api.HUD + 12 && x >= F.ufo.x && x < F.ufo.x + 16) { hitSaucer(); return true; }
  for (const a of F.aliens) {
    if (!a.alive) continue;
    const ax = F.ox + a.c * SX, ay = F.oy + a.r * SY;
    if (x >= ax && x < ax + AW && y + 3 >= ay && y < ay + AH) { killAlien(a); return true; }
  }
  for (const b of F.bombs) if (Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) < 4) { b.y = 9999; clash(x, y); return true; }   // shots meet and go off
  return bunkerHit(x, y, 1);
}
function fire(){
  const x = Math.round(F.px) + 6, y = cannonY() - 2;
  F.fireCd = fireGap(F.weapon);
  if (F.weapon === 'pierce') { lightning(x); return; }
  const v = volley(F.weapon, x, y);
  F.shots.push(...v);
  tone(v.length > 1 ? 760 : 880, 0.06, 0.03, -500);
}
/** The lightning laser: one bolt straight up the column, through walls, bombs, aliens and the saucer. */
function lightning(x: number){
  F.beam = { x, t: BEAM_TIME };
  tone(1900, 0.18, 0.035, -1600); tone(70, 0.26, 0.05, 140); tone(2600, 0.05, 0.02, -900, 0.06);
  if (F.ufo && x >= F.ufo.x - 1 && x < F.ufo.x + 17) hitSaucer();
  for (const a of F.aliens) if (a.alive && inBeam(x, F.ox + a.c * SX, AW)) killAlien(a);
  for (const b of F.bombs) if (Math.abs(b.x - x) <= 2) b.y = 9999;
  for (let y = cannonY() - 2; y > api.HUD; y -= 2) bunkerHit(x, y, 1);
}
function arm(w: Drop){
  if (w === 'nuke') {
    if (F.nuke) { addScore(500, F.px, cannonY() - 14); return; }   // only one at a time: a spare is worth 500
    F.nuke = true; api.setBoostLabel('nuke');
    [262, 330, 392, 523, 392, 523].forEach((f, i) => tone(f, 0.12, 0.05, 0, i * 0.09));
    F.bursts.push({ x: Math.max(4, Math.min(api.LW - 60, F.px - 12)), y: labelY(), t: 1.2, text: 'NUKE READY' });
    return;
  }
  if (w === 'speed') {
    ({ level: F.speed, t: F.speedT } = stackSpeed(F.speed));
    [523, 659, 784, 1047, 1319].slice(0, 2 + F.speed).forEach((f, i) => tone(f, 0.05, 0.035, 0, i * 0.045));
    F.bursts.push({ x: Math.max(4, Math.min(api.LW - 40, F.px - 6)), y: labelY(), t: 0.9, text: 'SPEED x' + F.speed });
    return;
  }
  F.weapon = w; F.weaponT = WEAPON_TIME; F.fireCd = 0;
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.07, 0.04, 0, i * 0.06));
  F.bursts.push({ x: Math.max(4, Math.min(api.LW - 40, F.px - 6)), y: labelY(), t: 0.9, text: WEAPON_NAME[w] });
}
/** Where a pickup's label goes: above the cannon, stacked over any label still showing. */
function labelY(){ return cannonY() - 14 - 9 * F.bursts.filter(b => b.text && b.y > cannonY() - 60).length; }
/** A bomb sets a capsule off: a wide blast that bites the walls, takes out aliens and bombs, and your
    cannon too unless the shield is up. Returns true if it cost you a life. */
function explode(c: Capsule){
  const cx = c.x + CAPSULE_W / 2, cy = c.y + CAPSULE_H / 2;
  c.y = 9999;
  tone(55, 0.5, 0.07, -30); tone(160, 0.3, 0.05, -120); tone(900, 0.12, 0.03, -800);
  return blast(cx, cy, c.w === 'nuke' ? NUKE_BLAST_R : BLAST_R, true);
}
/** Launch the atomic bomb: a missile that flies up until it hits something. */
function nuke(){
  F.nuke = false; api.setBoostLabel(null);
  F.missile = { x: Math.round(F.px) + 6, y: cannonY() - 8 };
  tone(180, 0.6, 0.05, 700); tone(90, 0.6, 0.04, 300);
}
function flyMissile(dt: number){
  const m = F.missile!;
  m.y -= NUKE_SPEED * dt;
  for (const b of F.bombs) if (Math.abs(b.x - m.x) <= 2 && b.y + 4 >= m.y && b.y < m.y + 7) b.y = 9999;   // it shrugs off bombs
  for (let y = m.y; y < m.y + 7; y += 2) bunkerHit(m.x, y, 1);                                         // and punches through walls
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
  blast(x, y, CLASH_R, false);
}
/** A blast of radius r at (cx, cy). Returns true if it cost you a life. */
function blast(cx: number, cy: number, r: number, hurtsYou: boolean){
  F.blasts.push({ x: cx, y: cy, t: 0.5, r });
  for (const b of F.bunkers) for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const dx = b.x + x - cx, dy = b.y + y - cy;
    if (b.px[y * BW + x] && dx * dx + dy * dy <= r * r && Math.random() < 0.85) b.px[y * BW + x] = 0;
  }
  for (const a of F.aliens) if (a.alive && inBlast(cx, cy, F.ox + a.c * SX, F.oy + a.r * SY, AW, AH, r)) killAlien(a, false);
  if (F.ufo && inBlast(cx, cy, F.ufo.x, api.HUD + 4, 16, 6, r)) hitSaucer();
  for (const b of F.bombs) if (inBlast(cx, cy, b.x - 1, b.y, 3, 4, r)) b.y = 9999;
  if (hurtsYou) for (const o of F.capsules) if (o.y < 9999 && inBlast(cx, cy, o.x, o.y, CAPSULE_W, CAPSULE_H, r)) o.y = 9999;
  if (hurtsYou && inBlast(cx, cy, F.px, cannonY(), 13, 7, r)) {
    if (api.S.boostT > 0) tone(1500, 0.05, 0.03);       // the shield takes it
    else { loseLife(); return true; }
  }
  return false;
}

function update(dt: number){
  const S = api.S, LW = api.LW;
  // visual effects run down in every mode, so a flash or blast never sticks over the clear and ready screens
  for (const b of F.bursts) b.t -= dt;
  for (const b of F.blasts) b.t -= dt;
  F.blasts = F.blasts.filter(b => b.t > 0);
  if (F.beam && (F.beam.t -= dt) <= 0) F.beam = null;
  if (F.flash > 0) F.flash -= dt;
  F.bursts = F.bursts.filter(b => b.t > 0);
  if (S.mode === 'ready') { if ((S.modeT -= dt) <= 0) S.mode = 'play'; api.clearFire(); api.clearTap(); return; }
  if (S.mode === 'clear') { if ((S.modeT -= dt) <= 0) { S.level++; newWave(); S.mode = 'ready'; S.modeT = 1.2; } return; }
  if (S.mode === 'dying') {
    if ((S.modeT -= dt) > 0) return;
    if (S.lives > 0) { F.bombs = []; F.px = Math.round(LW / 2 - 6); S.mode = 'ready'; S.modeT = 0.9; }
    else api.finishGame();
    return;
  }
  if (S.mode !== 'play') return;

  /* your cannon: left and right, one shot in the air at a time (more with a weapon), and a short shield */
  const sd = api.stickDir, keys = api.held.filter(d => d === 'left' || d === 'right');
  const dir = sd === 'left' || sd === 'right' ? sd : keys[keys.length - 1];
  if (dir) F.px = Math.max(4, Math.min(LW - 4 - 13, F.px + (dir === 'left' ? -1 : 1) * CANNON_SPEED * dt));
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
  for (const c of F.capsules) {
    c.y += CAPSULE_SPEED * dt;
    if (catches(c, F.px, cannonY())) { arm(c.w); c.y = 9999; }
  }
  F.capsules = F.capsules.filter(c => c.y < api.LH - 6);

  /* the formation marches; at an edge it drops a row and turns */
  const alive = F.aliens.filter(a => a.alive);
  if (!alive.length) { S.mode = 'clear'; S.modeT = 1.8; [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 0.04, 0, i * 0.09)); return; }
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
      if (ay + AH >= bunkerY()) for (let x = ax; x < ax + AW; x += 2) for (let y = ay; y < ay + AH; y += 2) bunkerHit(x, y, 1);
    }
    if (bottom >= cannonY()) { loseLife(true); return; }
  }

  /* bombs */
  for (const b of F.bombs) {
    b.y += b.v * dt;
    const hitCap = F.capsules.find(c => bombHitsCapsule(b.x, b.y, c));
    if (hitCap) { b.y = 9999; if (explode(hitCap)) return; continue; }
    if (bunkerHit(b.x, b.y + 3, 2)) { b.y = 9999; continue; }
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
const MINI = ['...#...', '..###..', '#######', '#.#.#.#'];   // a spare cannon in the HUD
function hud(){
  const { g, LW, HUD, S, txt } = api;
  g.fillStyle = api.col('bg'); g.fillRect(0, 0, LW, HUD);
  txt(String(S.score).padStart(6, '0'), 6, 6, 'text');
  if (LW >= 300) txt('HI ' + String(api.best).padStart(6, '0'), 80, 6, 'hud');
  const wave = 'WAVE ' + S.level;
  txt(wave, LW - 6, 6, 'hud', 'right');
  const lives = Math.max(0, Math.min(5, S.lives - (S.mode === 'dying' ? 0 : 1)));
  let x = LW - 12 - wave.length * 6 - lives * 10;
  for (let i = 0; i < lives; i++, x += 10) sprite(MINI, x, 6, 'cart');
  g.fillStyle = api.col('hud'); for (let i = 0; i < LW; i += 4) g.fillRect(i, HUD - 2, 2, 1);
  // the weapon you hold and the speed boost, each with a draining timer bar
  let wx = LW >= 300 ? 142 : 48;
  if (F.weapon !== 'basic') {
    const name = WEAPON_NAME[F.weapon];
    if (F.weaponT > 3 || Math.floor(S.time * 6) % 2) txt(name, wx, 6, 'gold');
    g.fillStyle = api.col('gold'); g.fillRect(wx, HUD - 4, Math.ceil(name.length * 6 * F.weaponT / WEAPON_TIME), 1);
    wx += name.length * 6 + 6;
  }
  if (F.nuke) { if (Math.floor(S.time * 3) % 2) txt('NUKE', wx, 6, 'text'); wx += 30; }
  if (F.speed) {
    const label = '>' + F.speed;
    if (F.speedT > 5 || Math.floor(S.time * 6) % 2) txt(label, wx, 6, 'spark');
    g.fillStyle = api.col('spark'); g.fillRect(wx, HUD - 4, Math.ceil(label.length * 6 * F.speedT / SPEED_TIME), 1);
  }
}
function draw(){
  const { g, LW, LH, S } = api;
  // bunkers
  g.fillStyle = api.col('gem');
  for (const b of F.bunkers) for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (b.px[y * BW + x]) g.fillRect(b.x + x, b.y + y, 1, 1);
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
  for (const c of F.capsules) {
    sprite(CAPSULE, c.x, c.y, Math.floor(S.time * 6) % 2 ? 'gold' : 'sun');
    sprite(CAPSULE_MARK[c.w], c.x + 2, c.y + 2, 'text');
  }
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
  for (const b of F.bursts) {
    if (b.text) api.txt(b.text, b.x, b.y, 'gold');
    else sprite(BURST, b.x, b.y, S.mode === 'dying' && b.t > 0.2 && Math.floor(b.t * 10) % 2 ? 'spark' : 'gold');
  }
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
  api = a; useApi(a);
  return { start, update, draw, debug: {
    state: () => F,
    /** Drop a capsule just above the cannon (tests). */
    drop: (w: Drop = 'twin') => { F.capsules.push({ x: Math.round(F.px) + 2, y: cannonY() - 20, w }); },
    /** Arm a weapon or a speed boost straight away (tests). */
    arm: (w: Drop) => arm(w),
    /** Set off a capsule at (x, y) (tests). */
    blast: (x: number, y: number) => explode({ x, y, w: 'twin' }),
    clash: (x: number, y: number) => clash(x, y),
  } };
};
export default create;

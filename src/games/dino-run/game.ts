/* Dino Run: an endless desert runner, a tribute to the offline dinosaur game in Google Chrome.
   The dinosaur, obstacles, art, sound and code here are original.
   Everything is in low-res screen pixels; heights are measured up from the ground line. */
import type { ConsoleAPI, CreateGame } from '../types';
import { useApi, drawDino, drawCactus, drawRock, drawPtero, drawCloud, drawGround } from './art';
const GRAV = 1100, JUMP_V = 330, HOLD_GRAV = 560, HOLD_MAX = 0.2, FAST_FALL = 2.6;
const BASE_SPEED = 140, MAX_SPEED = 330, ACCEL = 0.011;   // px/s, and px/s gained per px run
const PX_PER_POINT = 11, PTERO_FROM = 250;
let api: ConsoleAPI;
const DX = 26;                                             // the dinosaur's left edge

type Obs = { kind: 'cactus' | 'tall' | 'rock' | 'ptero'; x: number; w: number; h: number; y: number; vx: number };
const D = {
  y: 0, vy: 0, air: false, duck: false, hold: 0, legT: 0, dist: 0, speed: BASE_SPEED,
  obs: [] as Obs[], clouds: [] as { x: number; y: number }[], gap: 0, chime: 100, flash: 0, dead: false,
};

const groundY = () => Math.min(api.LH - 22, api.HUD + Math.round((api.LH - api.HUD) * 0.7));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function start(){
  api.fitGrid();
  Object.assign(D, { y: 0, vy: 0, air: false, duck: false, hold: 0, legT: 0, dist: 0, speed: BASE_SPEED, obs: [], gap: api.LW * 0.8, chime: 100, flash: 0, dead: false });
  D.clouds = [0, 1, 2].map(i => ({ x: api.LW * (0.2 + i * 0.35) + rnd(-20, 20), y: api.HUD + 14 + rnd(0, Math.max(10, groundY() - api.HUD - 70)) }));
  api.S.score = 0; api.S.level = 1; api.S.lives = 1; api.S.charge = 1; api.S.boost = 1; api.S.boostT = 0;
}

function spawn(){
  const x = api.LW + 10, ptero = api.S.score >= PTERO_FROM && Math.random() < 0.3;
  let span = 0;
  if (ptero) {
    const y = [3, 17, 34][Math.floor(Math.random() * 3)];   // low: jump · middle: duck · high: run under
    D.obs.push({ kind: 'ptero', x, w: 18, h: 10, y, vx: 25 }); span = 18;
  } else {
    const r = Math.random();
    if (r < 0.18) { D.obs.push({ kind: 'rock', x, w: 13, h: 8, y: 0, vx: 0 }); span = 13; }
    else {
      const tall = r > 0.62, n = 1 + Math.floor(Math.random() * (tall ? 2 : 3)), w = tall ? 9 : 7, h = tall ? 22 : 15;
      for (let i = 0; i < n; i++) D.obs.push({ kind: tall ? 'tall' : 'cactus', x: x + i * (w + 2), w, h, y: 0, vx: 0 });
      span = n * (w + 2);
    }
  }
  D.gap = D.speed * rnd(0.62, 1.15) + 70 + span;   // always room to land between
}

function hits(o: Obs){
  const [x0, x1, h] = D.duck ? [DX + 1, DX + 26, 12] : [DX + 4, DX + 20, 21];
  const b0 = D.y + 1, b1 = D.y + h;
  return x1 > o.x + 1 && x0 < o.x + o.w - 1 && b1 > o.y + 1 && b0 < o.y + o.h - 1;
}

function update(dt: number){
  D.legT += dt * (D.speed / 60);
  if (api.S.mode === 'ready') { if ((api.S.modeT -= dt) <= 0) api.S.mode = 'play'; api.clearFire(); api.clearTap(); return; }
  if (api.S.mode === 'dying') { if ((api.S.modeT -= dt) <= 0) api.finishGame(); return; }
  if (api.S.mode !== 'play') return;
  const up = api.held.includes('up') || api.stickDir === 'up';
  const jump = api.fireQueued || api.tapQueued || up, holding = api.fireHeld || api.tapHeld || up;
  const duck = api.held.includes('down') || api.stickDir === 'down' || api.boostHeld;
  api.clearFire(); api.clearTap(); api.clearBoost();
  if (!D.air && jump && !duck) { D.vy = JUMP_V; D.air = true; D.hold = 0; api.tone(392, 0.07, 0.04, 420); }
  if (D.air) {
    let gr = GRAV;
    if (holding && D.vy > 0 && D.hold < HOLD_MAX) { gr = HOLD_GRAV; D.hold += dt; }
    if (duck) gr *= FAST_FALL;
    D.vy -= gr * dt; D.y += D.vy * dt;
    if (D.y <= 0) { D.y = 0; D.vy = 0; D.air = false; }
  }
  D.duck = duck && !D.air;
  // the desert speeds up as you go
  D.speed = Math.min(MAX_SPEED, BASE_SPEED + D.dist * ACCEL);
  const step = D.speed * dt;
  D.dist += step;
  api.S.score = Math.floor(D.dist / PX_PER_POINT);
  api.S.level = 1 + Math.floor(api.S.score / 250);
  if (api.S.score > api.best) (api.best = api.S.score);
  if (api.S.score >= D.chime) { D.chime += 100; D.flash = 0.9; api.tone(1047, 0.05, 0.035); api.tone(1568, 0.08, 0.035, 0, 0.06); }
  if (D.flash > 0) D.flash -= dt;
  for (const c of D.clouds) { c.x -= step * 0.2; if (c.x < -20) { c.x = api.LW + rnd(10, 60); c.y = api.HUD + 14 + rnd(0, Math.max(10, groundY() - api.HUD - 70)); } }
  for (const o of D.obs) o.x -= step + o.vx * dt;
  D.obs = D.obs.filter(o => o.x + o.w > -4);
  if ((D.gap -= step) <= 0) spawn();
  if (D.obs.some(hits)) {
    D.dead = true; api.S.mode = 'dying'; api.S.modeT = 1.1; api.buzz('lose');
    api.tone(110, 0.18, 0.06, -40); [440, 392, 330, 262, 196].forEach((f, i) => api.tone(f, 0.16, 0.045, -20, 0.1 + i * 0.15));
  }
}

function hud(){
  api.g.fillStyle = api.col('bg'); api.g.fillRect(0, 0, api.LW, api.HUD);
  if (!(D.flash > 0 && Math.floor(D.flash * 8) % 2)) api.txt(String(api.S.score).padStart(6, '0'), 6, 6, 'text');
  if (api.LW >= 300) api.txt('HI ' + String(api.best).padStart(6, '0'), 80, 6, 'hud');
  api.txt('DINO RUN', api.LW - 6, 6, 'hud', 'right');
  api.g.fillStyle = api.col('hud'); for (let x = 0; x < api.LW; x += 4) api.g.fillRect(x, api.HUD - 2, 2, 1);
}
function draw(){
  const gy = groundY();
  for (const c of D.clouds) drawCloud(c.x, c.y);
  drawGround(gy, D.dist);
  for (const o of D.obs) {
    if (o.kind === 'ptero') drawPtero(o.x, gy - o.y, Math.floor(api.S.time * 6) % 2 === 0);
    else if (o.kind === 'rock') drawRock(o.x, gy);
    else drawCactus(o.x, gy, o.kind === 'tall');
  }
  drawDino(DX, gy - Math.round(D.y), D.duck, Math.floor(D.legT * 2) % 2, D.air, D.dead);
  hud();
  if (api.S.mode === 'ready') api.banner('DINO RUN', 'FIRE TO JUMP · BOOST TO DUCK');
}

const create: CreateGame = a => {
  api = a; useApi(a);
  return { start, update, draw, debug: { state: () => D } };
};
export default create;

/* Tunnel Raider: dig for emeralds, drop sacks of gold on the grubs, outwit them level after level.
   A tribute to Windmill Software's Digger (1983); characters, art, sound and code are original.
   Everything from the console comes through `api` (see src/games/types.ts). */
import type { ConsoleAPI, CreateGame, Dir, Role } from '../types';

let api: ConsoleAPI;

export const BOOST_MUL = 1.6, BOOST_TIME = 1.6, BOOST_RECHARGE = 7;   // a 60% burst for 1.6 s, refilling over 7 s
const tone = (...a: Parameters<ConsoleAPI['tone']>) => api.tone(...a);
export const sfx = {
  gem: (n: number) => tone(620 + n * 55, 0.06),
  chain: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.08, 0.04, 0, i * 0.07)),
  thud: () => tone(120, 0.12, 0.06, -50),
  burst: () => { tone(220, 0.2, 0.045, 500); },
  gold: () => { tone(880, 0.05); tone(1320, 0.08, 0.045, 0, 0.06); },
  zap: () => tone(1500, 0.18, 0.03, -1200),
  kill: () => tone(420, 0.2, 0.045, -320),
  eat: (n: number) => tone(500 + n * 160, 0.14, 0.045, 300),
  sun: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.07, 0.045, 0, i * 0.06)),
  die: () => [440, 392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 0.045, -20, i * 0.15)),
  clear: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 0.04, 0, i * 0.09)),
  life: () => [1047, 1319, 1568].forEach((f, i) => tone(f, 0.09, 0.05, 0, i * 0.08)),
  siren: (hi: boolean) => tone(hi ? 700 : 560, 0.1, 0.03),
  boost: () => { tone(260, 0.3, 0.05, 900); tone(130, 0.3, 0.03, 300); },
  boostReady: () => { tone(1568, 0.05, 0.03); tone(2093, 0.07, 0.03, 0, 0.05); },
};
/* dirt is drawn straight into the low-res buffer, one pattern per seam */
let dirtCanvas: HTMLCanvasElement;   // made in create(), so loading this module has no side effects
export function makeDirt(){
  if (dirtCanvas.width !== api.LW || dirtCanvas.height !== api.LH - api.HUD) { dirtCanvas.width = api.LW; dirtCanvas.height = api.LH - api.HUD; }
  const d = dirtCanvas.getContext('2d')!, w = dirtCanvas.width, h = dirtCanvas.height;
  const img = d.createImageData(w, h), px = img.data;
  const base = api.palRGB[api.palette.roles.dirt], s1 = api.palRGB[api.palette.roles.ds1], s2 = api.palRGB[api.palette.roles.ds2];
  const r = api.mulberry32(api.S.level * 31 + 5), pat = (api.S.level - 1) % 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = base;
    if (pat === 0) { const v = r(); if (v < 0.07) c = s1; else if (v < 0.085) c = s2; }
    else if (pat === 1) { if ((x + y) % 6 === 0) c = s1; else if ((x * 7 + y * 13) % 97 === 0) c = s2; }
    else if (pat === 2) { const row = (y / 6) | 0; if (y % 6 === 0 || (x + (row % 2) * 6) % 12 === 0) c = s1; }
    else { if ((y + Math.round(Math.sin(x / 7) * 2)) % 5 === 0) c = s1; else if (r() < 0.012) c = s2; }
    const o = (y * w + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  d.putImageData(img, 0, 0);
}

export function carve(x: number, y: number){ if (api.inb(x, y)) api.S.dug[api.idx(x, y)] = 1; }
export function genLevel(L: number){
  api.fitGrid();
  const r = api.mulberry32(L * 7919 + 13), ri = (n: number) => (r() * n) | 0;
  api.S.dug.fill(0); api.S.em.fill(0);
  api.S.bags = []; api.S.golds = []; api.S.monsters = []; api.S.sparks = []; api.S.parts = []; api.S.pops = [];
  const runL = 3 + ri(4);
  // the grubs' den: one block down and one in from the corner, so with wraparound on it has no edge to slip through
  for (let x = api.W - 2; x >= api.W - 2 - runL; x--) carve(x, 1);
  const mid = api.W >> 1;
  for (let x = mid - 2; x <= mid + 2; x++) carve(x, api.H - 1);
  const runs = 2 + (L > 3 ? 1 : 0);
  for (let k = 0; k < runs; k++) {
    if (r() < 0.5) { const x = ri(api.W - 2) + 1, y0 = 1 + ri(api.H - 5), len = 3 + ri(3); for (let y = y0; y < y0 + len; y++) carve(x, y); }
    else { const y = 2 + ri(api.H - 5), x0 = ri(api.W - 6), len = 4 + ri(4); for (let x = x0; x < x0 + len; x++) carve(x, y); }
  }
  const nearSpawn = (x: number, y: number) => x >= api.W - 4 && y <= 2;
  const area = (api.W * api.H) / 150;   // treasure scales with the size of the field
  const clusters = Math.max(3, Math.round((5 + Math.min(3, (L / 2) | 0)) * area));
  for (let c = 0; c < clusters; c++) {
    const w = 2 + ri(2), h = 2 + ri(2), cx = ri(api.W - w + 1), cy = 1 + ri(api.H - h - 1);
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++)
      if (api.inb(x, y) && !api.S.dug[api.idx(x, y)] && !nearSpawn(x, y)) api.S.em[api.idx(x, y)] = 1;
  }
  const want = Math.max(4, Math.round((6 + Math.min(3, (L / 2) | 0)) * area));
  let tries = 0;
  while (api.S.bags.length < want && tries++ < 400) {
    const x = ri(api.W), y = ri(api.H - 3);
    if (api.S.dug[api.idx(x, y)] || api.S.dug[api.idx(x, y + 1)] || api.S.em[api.idx(x, y)] || nearSpawn(x, y) || bagAt(x, y) || bagAt(x, y + 1) || bagAt(x, y - 1)) continue;
    api.S.bags.push({ x, y, fy: y, state: 'rest', t: 0, dist: 0, slide: 0 });
  }
  api.S.emLeft = api.S.em.reduce((a: number, b: number) => a + b, 0);
  api.S.total = 6 + L;
  api.S.maxAlive = Math.min(5, 3 + ((L - 1) / 3 | 0));
  api.S.spawned = 0; api.S.spawnT = 1.2;
  api.S.sun = { active: false, used: false, x: api.W - 2, y: 1 };
  api.S.bonusT = 0; api.S.bonusChain = 0;
  api.S.stageT = 0; api.S.allDug = false; api.S.dugMsgT = 0;   // the stage clock, and the dig-it-all 1UP (once a level)
  resetPlayer();
  makeDirt();
}
export function resetPlayer(){
  const mid = api.W >> 1;
  api.S.player = { x: mid, y: api.H - 1, tx: mid, ty: api.H - 1, t: 0, moving: false, mdx: 0, mdy: 0, face: 'right', speed: 6, collected: true, deadT: 0 };
  api.S.charge = 1; api.S.boost = 1; api.S.boostT = 0;
}

/* ---------- queries ---------- */
export function bagAt(x: number, y: number){ return api.S.bags.find((b: any) => b.x === x && b.y === y); }
export function restingBagAt(x: number, y: number){ const b = bagAt(x, y); return b && b.state !== 'fall' ? b : null; }
/* the field wraps: leave by one edge and you come back in at the opposite one */
export const wrapX = (x: number) => ((x % api.W) + api.W) % api.W, wrapY = (y: number) => ((y % api.H) + api.H) % api.H;
export const wrapD = (d: number, span: number) => d - span * Math.round(d / span);   // shortest offset across the wrap
export const wdist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(wrapD(ax - bx, api.W * api.C), wrapD(ay - by, api.H * api.C));
export function ppos(o: any){
  const fw = api.W * api.C, fh = api.H * api.C, x = (o.x + (o.tx - o.x) * o.t) * api.C + api.C / 2, y = (o.y + (o.ty - o.y) * o.t) * api.C + api.C / 2;
  return { x: ((x % fw) + fw) % fw, y: ((y % fh) + fh) % fh };
}
export function wrapSpots(p: { x: number; y: number }){   // where to draw something that is half through an edge
  const fw = api.W * api.C, fh = api.H * api.C, xs = [p.x], ys = [p.y];
  if (p.x < api.C) xs.push(p.x + fw); if (p.x > fw - api.C) xs.push(p.x - fw);
  if (p.y < api.C) ys.push(p.y + fh); if (p.y > fh - api.C) ys.push(p.y - fh);
  const out = []; for (const x of xs) for (const y of ys) out.push({ x, y }); return out;
}
export function pcell(o: any){ const p = ppos(o); return { x: Math.floor(p.x / api.C), y: Math.floor(p.y / api.C) }; }
export function monsterOnCell(x: number, y: number){ return api.S.monsters.some((m: any) => (m.x === x && m.y === y) || (m.moving && wrapX(m.tx) === x && wrapY(m.ty) === y)); }

export function addScore(n: number, x?: number, y?: number){
  api.S.score += n;
  if (x !== undefined) api.S.pops.push({ x, y, text: String(n), life: 0.9 });
  while (api.S.score >= api.S.nextLife) { api.S.lives++; api.S.nextLife += 20000; sfx.life(); }
  if (api.S.score > api.best) (api.best = api.S.score);
}
export function burst(x: number, y: number, roles: string[], n = 14){
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
    api.S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.4, role: roles[i % roles.length] });
  }
}

/* ---------- player ---------- */
export function setFace(d: { dx: number; dy: number }){ api.S.player.face = d.dx > 0 ? 'right' : d.dx < 0 ? 'left' : d.dy < 0 ? 'up' : 'down'; }
export function tryMove(d: { dx: number; dy: number }){
  const p = api.S.player; setFace(d);
  const nx = p.x + d.dx, ny = p.y + d.dy, cx = wrapX(nx), cy = wrapY(ny);   // nx/ny may sit just past an edge, for a smooth slide through it
  const bag = bagAt(cx, cy);
  if (bag) {
    if (bag.state === 'fall' || d.dy !== 0) return;
    const mx = wrapX(cx + d.dx);
    if (bagAt(mx, cy) || monsterOnCell(mx, cy) || api.S.em[api.idx(mx, cy)]) return;   // a sack can't be pushed onto an emerald
    bag.x = mx; bag.slide = Math.abs(mx - cx) === 1 ? -d.dx : 0; bag.fy = bag.y;
    if (bag.state === 'wobble') bag.state = 'rest';
  }
  const digging = !api.S.dug[api.idx(cx, cy)];
  api.S.dug[api.idx(cx, cy)] = 1;
  if (digging) checkAllDug();
  p.speed = (digging ? CART_DIG : CART_RUN) * pace();
  p.tx = nx; p.ty = ny; p.t = 0; p.moving = true; p.mdx = d.dx; p.mdy = d.dy; p.collected = false;
}
/* dig out every block of earth on a level (a sack's own block excepted) and win a spare cart */
export function checkAllDug(){
  if (api.S.allDug) return;
  const n = api.W * api.H;
  for (let i = 0; i < n; i++) if (!api.S.dug[i] && !restingBagAt(i % api.W, (i / api.W) | 0)) return;
  api.S.allDug = true; api.S.lives++; api.S.dugMsgT = 2.4; sfx.life();
  const pp = ppos(api.S.player); api.S.pops.push({ x: pp.x, y: pp.y - 10, text: '1UP', life: 1.4 });
  api.track('all_dug', { level: api.S.level, secs: Math.round(api.S.stageT) });
}
export function collectGem(x: number, y: number){
  const i = api.idx(x, y); if (!api.S.em[i]) return;
  api.S.em[i] = 0; api.S.emLeft--;
  api.S.streak = (api.S.time - api.S.lastGem < 1.6) ? api.S.streak + 1 : 1; api.S.lastGem = api.S.time;
  addScore(25);
  if (api.S.streak >= 8) { api.S.streak = 0; addScore(250, x * api.C + api.C / 2, y * api.C); sfx.chain(); } else sfx.gem(api.S.streak);
  burst(x * api.C + api.C / 2, y * api.C + api.C / 2, ['gem', 'gemHi'], 6);
}
export function updatePlayer(dt: number){
  const p = api.S.player, d = api.wantDir();
  if (p.moving) {
    if (d && d.dx === -p.mdx && d.dy === -p.mdy) {
      [p.x, p.tx] = [p.tx, p.x]; [p.y, p.ty] = [p.ty, p.y];
      p.t = 1 - p.t; p.mdx = d.dx; p.mdy = d.dy; p.collected = true; setFace(d);
    }
    p.t += dt * p.speed * (api.S.boostT > 0 ? BOOST_MUL : 1);
    if (api.S.boostT > 0 && Math.random() < 0.6) { const q = ppos(p); api.S.parts.push({ x: q.x - p.mdx * 12, y: q.y - p.mdy * 12 + 6, vx: -p.mdx * 40 + (Math.random() - .5) * 30, vy: -p.mdy * 40 - 10, life: 0.3, role: Math.random() < .5 ? 'sparkTrail' : 'track' }); }
    if (!p.collected && p.t >= 0.5) { collectGem(wrapX(p.tx), wrapY(p.ty)); p.collected = true; }
    if (p.t >= 1) { p.x = p.tx = wrapX(p.tx); p.y = p.ty = wrapY(p.ty); p.t = 0; p.moving = false; }
  }
  if (!p.moving && d) tryMove(d);
  const pp = ppos(p);
  for (let i = api.S.golds.length - 1; i >= 0; i--) {
    const gd = api.S.golds[i];
    if (wdist(gd.x * api.C + api.C / 2, gd.y * api.C + api.C / 2, pp.x, pp.y) < api.C * 0.55) {
      api.S.golds.splice(i, 1); addScore(500, pp.x, pp.y - 10); sfx.gold(); burst(pp.x, pp.y, ['gold', 'goldHi'], 10);
    }
  }
  if (api.S.sun.active && wdist(api.S.sun.x * api.C + api.C / 2, api.S.sun.y * api.C + api.C / 2, pp.x, pp.y) < api.C * 0.6) {
    api.S.sun.active = false; api.S.sun.used = true; api.track('sunstone', { level: api.S.level });
    addScore(1000, pp.x, pp.y - 10); sfx.sun();
    api.S.bonusT = Math.max(5, 15 - api.S.level); api.S.bonusChain = 0;
    api.S.monsters.forEach((m: any) => { if (m.type === 'b') { m.type = 'g'; m.morphT = 8; } });
  }
  if (api.S.sparks.length === 0) api.S.charge = Math.min(1, api.S.charge + dt / 2.6);
  if (api.boostQueued) { api.clearBoost(); if (api.S.boost >= 1 && api.S.boostT <= 0) { api.S.boostT = BOOST_TIME; api.S.boost = 0; sfx.boost(); } }
  if (api.S.boostT > 0) api.S.boostT -= dt;
  else if (api.S.boost < 1) { api.S.boost = Math.min(1, api.S.boost + dt / BOOST_RECHARGE); if (api.S.boost >= 1) sfx.boostReady(); }
  if (api.fireQueued || api.fireHeld) {
    api.clearFire();
    if (api.S.charge >= 1 && api.S.sparks.length === 0) {
      const facing: Record<string, number[]> = { right:[1,0], left:[-1,0], up:[0,-1], down:[0,1] };
      const f = facing[p.face];
      api.S.sparks.push({ x: pp.x, y: pp.y, dx: f[0], dy: f[1], trail: [], age: 0 });
      api.S.charge = 0; sfx.zap(); api.buzz('fire');
    }
  }
}

/* ---------- sacks ---------- */
export function updateBags(dt: number){
  const pp = ppos(api.S.player);
  for (let i = api.S.bags.length - 1; i >= 0; i--) {
    const b = api.S.bags[i];
    b.slide *= Math.pow(0.0005, dt); if (Math.abs(b.slide) < 0.01) b.slide = 0;
    if (b.state === 'rest' || b.state === 'wobble') {
      const can = api.inb(b.x, b.y + 1) && api.S.dug[api.idx(b.x, b.y + 1)] && !bagAt(b.x, b.y + 1);
      if (b.state === 'rest' && can) { b.state = 'wobble'; b.t = 0.6; }
      else if (b.state === 'wobble') {
        if (!can) b.state = 'rest';
        else if ((b.t -= dt) <= 0) { b.state = 'fall'; b.fy = b.y; b.dist = 0; }
      }
    } else if (b.state === 'fall') {
      b.fy += dt * 9;
      let landed = false;
      while (b.fy >= b.y + 1) {
        b.y += 1; b.dist += 1;
        const ci = api.idx(b.x, b.y);
        if (api.S.em[ci]) { api.S.em[ci] = 0; api.S.emLeft--; burst(b.x * api.C + api.C / 2, b.y * api.C + api.C / 2, ['gemDark', 'gem', 'gemHi'], 10); }   // a falling sack smashes any emerald in its way
        const below = b.y + 1;
        if (!api.inb(b.x, below) || !api.S.dug[api.idx(b.x, below)] || api.S.bags.some((o: any) => o !== b && o.x === b.x && o.y === below)) { landed = true; break; }
      }
      const bx = b.x * api.C + api.C / 2, by = b.fy * api.C + api.C / 2;
      for (let j = api.S.monsters.length - 1; j >= 0; j--) {
        const mp = ppos(api.S.monsters[j]);
        if (Math.abs(wrapD(mp.x - bx, api.W * api.C)) < api.C * 0.7 && mp.y - by > -api.C * 0.2 && mp.y - by < api.C * 0.85) {
          const m = api.S.monsters[j];
          if (b.hits && b.hits.has(m)) continue;   // one blow per sack
          if (m.hp > 1) { m.hp--; m.hitT = 0.6; (b.hits ||= new Set()).add(m); sfx.thud(); }
          else killMonster(j, 250);
        }
      }
      if (api.S.mode === 'play' && Math.abs(wrapD(pp.x - bx, api.W * api.C)) < api.C * 0.6 && pp.y - by > -api.C * 0.2 && pp.y - by < api.C * 0.8) killPlayer('sack');
      if (landed) {
        b.fy = b.y;
        if (b.dist >= 2) {
          api.S.bags.splice(i, 1); api.S.golds.push({ x: b.x, y: b.y, t: 12 });
          sfx.burst(); burst(bx, b.y * api.C + api.C / 2, ['gold', 'goldHi', 'bag'], 16);
        } else { b.state = 'rest'; sfx.thud(); }
      }
    }
  }
  for (let i = api.S.golds.length - 1; i >= 0; i--) if ((api.S.golds[i].t -= dt) <= 0) api.S.golds.splice(i, 1);
}

/* ---------- grubs ---------- */
export function computeDist(){
  const dist = api.S.dist; dist.fill(-1);
  const pc = pcell(api.S.player); if (!api.inb(pc.x, pc.y)) return;
  const q = [pc.x, pc.y]; dist[api.idx(pc.x, pc.y)] = 0;
  for (let h = 0; h < q.length; h += 2) {
    const x = q[h], y = q[h + 1], dd = dist[api.idx(x, y)];
    for (const k of Object.keys(api.DIRS) as Dir[]) {
      const nx = wrapX(x + api.DIRS[k].dx), ny = wrapY(y + api.DIRS[k].dy);
      const i = api.idx(nx, ny);
      if (dist[i] >= 0 || !api.S.dug[i] || restingBagAt(nx, ny)) continue;
      dist[i] = dd + 1; q.push(nx, ny);
    }
  }
}
export const smartness = () => Math.min(1, (api.S.level - 1) / 6);   // 0 on seam 1, full cunning by seam 7
/* speed: everything starts slow. The cart starts at 72% of full speed and the grubs at about a third of that;
   both gain every level, and the grubs are always capped just under the cart's open-tunnel speed. */
export const CART_RUN = 6.2, CART_DIG = 4.3;
// the cart starts at 72% and gains a little every level, reaching full speed around level 9, then up to 135%
export const pace = () => api.S.level <= 8 ? 0.72 + 0.035 * (api.S.level - 1) : Math.min(1.35, 1 + 0.04 * (api.S.level - 8));
export const EARLY = [1.0, 1.25, 1.55];   // levels 1 to 3 crawl, so new players can learn the sacks
export const grubSpeed = () => Math.min(api.S.level <= 3 ? EARLY[api.S.level - 1] : 1.55 + 0.4 * (api.S.level - 3), 0.92 * CART_RUN * pace());
export function spawnMonster(){
  const rock = api.S.level >= 4 && Math.random() < Math.min(0.45, 0.12 * (api.S.level - 3));
  api.S.monsters.push({ x: api.W - 2, y: 1, tx: api.W - 2, ty: 1, t: 0, moving: false, mdx: -1, mdy: 0,
    type: rock ? 'r' : 'g', hp: rock ? (api.S.level >= 7 ? 3 : 2) : 1, hitT: 0,
    morphT: (7 + Math.random() * 10) * (1 - 0.55 * smartness()), wait: 0, wob: Math.random() * 6 });
  api.S.spawned++;
}
export function killMonster(j: number, pts: number){
  const m = api.S.monsters[j], mp = ppos(m);
  if (m.type === 'r') pts *= 2;
  api.S.monsters.splice(j, 1);
  addScore(pts, mp.x, mp.y - 10); sfx.kill();
  burst(mp.x, mp.y, m.type === 'b' ? ['borer', 'borerBelly'] : ['grub', 'grubBelly'], 14);
}
export function updateMonsters(dt: number){
  const bonus = api.S.bonusT > 0;
  const base = grubSpeed() * (bonus ? 0.7 : 1);
  const pp = ppos(api.S.player), smart = smartness();
  for (const m of api.S.monsters) {
    m.wob += dt * 10;
    if (m.hitT > 0) m.hitT -= dt;
    if (!bonus && m.type !== 'r') {
      m.morphT -= dt;
      if (m.morphT <= 0 && !m.moving) {
        if (m.type === 'g') { m.type = 'b'; m.morphT = 4 + Math.random() * 3 + 5 * smart; }
        else { m.type = 'g'; m.morphT = (7 + Math.random() * 10) * (1 - 0.55 * smart); }
      }
    }
    const spd = base * (m.type === 'b' ? 0.72 + 0.12 * smart : m.type === 'r' ? 0.88 : 1);
    if (m.moving) {
      m.t += dt * spd;
      if (m.t >= 1) { m.x = m.tx = wrapX(m.tx); m.y = m.ty = wrapY(m.ty); m.t = 0; m.moving = false; }
      continue;
    }
    if ((m.wait -= dt) > 0) continue;
    let pick = null;
    if (m.type === 'g') {
      const opts = [];
      for (const k of Object.keys(api.DIRS) as Dir[]) {
        const d = api.DIRS[k], ux = m.x + d.dx, uy = m.y + d.dy, nx = wrapX(ux), ny = wrapY(uy);
        if (!api.S.dug[api.idx(nx, ny)] || restingBagAt(nx, ny)) continue;
        const dd = api.S.dist[api.idx(nx, ny)];
        opts.push({ d, nx, ny, ux, uy, dist: dd < 0 ? 999 : dd, back: d.dx === -m.mdx && d.dy === -m.mdy });
      }
      let pool = opts.filter(o => !o.back); if (!pool.length) pool = opts;
      if (pool.length) {
        if (Math.random() < 0.14 - 0.12 * smart) pick = pool[(Math.random() * pool.length) | 0];
        else { pool.sort((a, b) => bonus ? b.dist - a.dist : a.dist - b.dist); pick = pool[0]; }
      }
    } else {
      const mx = m.x * api.C + api.C / 2, my = m.y * api.C + api.C / 2;
      const sgn = bonus ? -1 : 1;   // a frightened digger burrows away from you
      const ddx = wrapD(pp.x - mx, api.W * api.C), ddy = wrapD(pp.y - my, api.H * api.C);   // the short way round, through an edge if that's nearer
      const ax = sgn * Math.sign(ddx), ay = sgn * Math.sign(ddy);
      const order = Math.abs(ddx) > Math.abs(ddy) ? [{dx:ax,dy:0},{dx:0,dy:ay}] : [{dx:0,dy:ay},{dx:ax,dy:0}];
      order.push(...Object.values(api.DIRS).sort(() => Math.random() - 0.5));   // blocked by a sack: dig round it
      // from seam 3, diggers shove sacks sideways like the cart does
      const canShove = api.S.level >= 3 && !bonus, pc = pcell(api.S.player);
      const shove = (d: { dx: number; dy: number }, nx: number, ny: number) => {
        if (!canShove || d.dy !== 0) return false;
        const b = restingBagAt(nx, ny); if (!b) return false;
        const bx = wrapX(nx + d.dx);
        if (bagAt(bx, ny) || monsterOnCell(bx, ny) || api.S.em[api.idx(bx, ny)] || (pc.x === bx && pc.y === ny)) return false;
        b.x = bx; b.slide = Math.abs(bx - nx) === 1 ? -d.dx : 0; b.fy = b.y; if (b.state === 'wobble') b.state = 'rest';
        sfx.thud();
        return true;
      };
      // the cunning part: if a sack beside me would land right above the cart, push it there
      if (canShove && pc.y > m.y) {
        for (const dx of [-1, 1]) {
          const nx = wrapX(m.x + dx);
          if (pc.x === wrapX(nx + dx) && shove({ dx, dy: 0 }, nx, m.y)) { pick = { d: { dx, dy: 0 }, nx, ny: m.y, ux: m.x + dx, uy: m.y }; break; }
        }
      }
      if (!pick) for (const d of order) {
        if (!d.dx && !d.dy) continue;
        const ux = m.x + d.dx, uy = m.y + d.dy, nx = wrapX(ux), ny = wrapY(uy);
        if (!bagAt(nx, ny) || shove(d, nx, ny)) { pick = { d, nx, ny, ux, uy }; break; }
      }
      if (pick) api.S.dug[api.idx(pick.nx, pick.ny)] = 1;
    }
    if (pick) { m.tx = pick.ux ?? pick.nx; m.ty = pick.uy ?? pick.ny; m.t = 0; m.moving = true; m.mdx = pick.d.dx; m.mdy = pick.d.dy; }
    else m.wait = 0.25;
  }
  for (let j = api.S.monsters.length - 1; j >= 0; j--) {
    const mp = ppos(api.S.monsters[j]);
    if (wdist(mp.x, mp.y, pp.x, pp.y) < api.C * 0.68) {
      if (bonus) { const v = [200, 400, 800, 1600][Math.min(3, api.S.bonusChain)]; sfx.eat(api.S.bonusChain); api.S.bonusChain++; killMonster(j, v); }
      else { const kinds: Record<string, string> = { g: 'grub', b: 'borer', r: 'rockjaw' }; killPlayer(kinds[api.S.monsters[j].type] || 'grub'); return; }
    }
  }
}

/* ---------- sparks ---------- */
export function updateSparks(dt: number){
  for (let i = api.S.sparks.length - 1; i >= 0; i--) {
    const s = api.S.sparks[i];
    s.trail.unshift({ x: s.x, y: s.y }); if (s.trail.length > 5) s.trail.pop();
    s.x += s.dx * dt * 14 * api.C; s.y += s.dy * dt * 14 * api.C; s.age = (s.age || 0) + dt;
    const fw = api.W * api.C, fh = api.H * api.C, ox = s.x, oy = s.y;
    s.x = ((s.x % fw) + fw) % fw; s.y = ((s.y % fh) + fh) % fh;
    if (s.x !== ox || s.y !== oy) s.trail.length = 0;   // jumped through an edge
    const cx = Math.floor(s.x / api.C), cy = Math.floor(s.y / api.C);
    let dead = s.age > 1.4 || !api.S.dug[api.idx(cx, cy)] || restingBagAt(cx, cy);
    for (let j = api.S.monsters.length - 1; j >= 0 && !dead; j--) {
      const mp = ppos(api.S.monsters[j]);
      if (wdist(mp.x, mp.y, s.x, s.y) < api.C * 0.6) {
        const m = api.S.monsters[j];
        if (m.hp > 1) { m.hp--; m.hitT = 0.45; sfx.thud(); } else killMonster(j, 250);
        dead = true;
      }
    }
    if (dead) { api.S.sparks.splice(i, 1); burst(s.x - s.dx * 6, s.y - s.dy * 6, ['spark', 'sparkTrail'], 6); }
  }
}

/* ---------- life and death ---------- */
export function killPlayer(cause?: string){
  if (api.S.mode !== 'play') return;
  api.track('life_lost', { level: api.S.level, cause: cause || 'grub' });
  api.S.mode = 'dying'; api.S.modeT = 1.7; sfx.die(); api.buzz('lose');
  const pp = ppos(api.S.player); burst(pp.x, pp.y, ['cart', 'drill', 'window'], 20);
}
export function afterDeath(){
  api.S.lives--;
  if (api.S.lives <= 0) {
    api.finishGame();
    return;
  }
  api.S.spawned -= api.S.monsters.length; api.S.monsters = []; api.S.sparks = [];
  api.S.bonusT = 0; api.S.spawnT = 1.5;
  resetPlayer();
  api.S.mode = 'ready'; api.S.modeT = 1.2;
}

export function update(dt: number){
  if (api.S.mode === 'ready') { if ((api.S.modeT -= dt) <= 0) api.S.mode = 'play'; return; }
  if (api.S.mode === 'dying') { api.S.player.deadT += dt; updateBags(dt); if ((api.S.modeT -= dt) <= 0) afterDeath(); return; }
  if (api.S.mode === 'clear') { if ((api.S.modeT -= dt) <= 0) { api.S.level++; genLevel(api.S.level); api.S.mode = 'ready'; api.S.modeT = 1.4; api.saveBest(); } return; }
  if (api.S.mode !== 'play') return;
  api.S.stageT += dt;
  if (api.S.dugMsgT > 0) api.S.dugMsgT -= dt;
  if ((api.S.distT -= dt) <= 0) { computeDist(); api.S.distT = 0.12; }
  updatePlayer(dt);
  updateBags(dt); if (api.S.mode !== 'play') return;
  updateSparks(dt);
  updateMonsters(dt); if (api.S.mode !== 'play') return;
  if (api.S.bonusT > 0) {
    api.S.bonusT -= dt;
    if ((api.S.sirenT -= dt) <= 0) { api.S.sirenHi = !api.S.sirenHi; sfx.siren(api.S.sirenHi); api.S.sirenT = 0.28; }
  } else if (api.S.spawned < api.S.total && api.S.monsters.length < api.S.maxAlive) {
    if ((api.S.spawnT -= dt) <= 0) { spawnMonster(); api.S.spawnT = Math.max(1.6, 6 - 0.45 * api.S.level); /* early levels: grubs arrive well apart */ }
  }
  if (api.S.spawned >= api.S.total && !api.S.sun.used && !api.S.sun.active && api.S.monsters.length) api.S.sun.active = true;
  if (api.S.emLeft <= 0 || (api.S.spawned >= api.S.total && api.S.monsters.length === 0)) { api.S.mode = 'clear'; api.S.modeT = 2.2; api.S.bonusT = 0; sfx.clear(); api.track('level_cleared', { level: api.S.level, secs: Math.round(api.S.stageT) }); }
}
export function drawTunnels(){
  api.g.fillStyle = api.col('core');
  const ins = 3;
  for (let y = 0; y < api.H; y++) for (let x = 0; x < api.W; x++) {
    if (!api.S.dug[api.idx(x, y)]) continue;
    const X = x * api.C, Y = y * api.C;
    api.g.fillRect(X + ins, Y + ins, api.C - ins * 2, api.C - ins * 2);
    if (x + 1 < api.W && api.S.dug[api.idx(x + 1, y)]) api.g.fillRect(X + api.C - ins, Y + ins, ins * 2, api.C - ins * 2);
    if (y + 1 < api.H && api.S.dug[api.idx(x, y + 1)]) api.g.fillRect(X + ins, Y + api.C - ins, api.C - ins * 2, ins * 2);
    // a tunnel that carries on at the far side is open to the edge
    if (x === api.W - 1 && api.S.dug[api.idx(0, y)]) api.g.fillRect(X + api.C - ins, Y + ins, ins, api.C - ins * 2);
    if (x === 0 && api.S.dug[api.idx(api.W - 1, y)]) api.g.fillRect(X, Y + ins, ins, api.C - ins * 2);
    if (y === api.H - 1 && api.S.dug[api.idx(x, 0)]) api.g.fillRect(X + ins, Y + api.C - ins, api.C - ins * 2, ins);
    if (y === 0 && api.S.dug[api.idx(x, api.H - 1)]) api.g.fillRect(X + ins, Y, api.C - ins * 2, ins);
  }
  api.g.fillStyle = api.col('spawn');
  api.g.fillRect((api.W - 2) * api.C + 6, api.C + 6, 4, 4); api.g.fillRect((api.W - 1) * api.C - 10, api.C + 6, 4, 4);   // marks on the den's mouth
}
export function drawGem(x: number, y: number){
  const X = x * api.C + api.C / 2, Y = y * api.C + api.C / 2;
  api.g.fillStyle = api.col('gemDark'); api.poly([X, Y - 11, X + 10, Y - 2, X, Y + 12, X - 10, Y - 2]);
  api.g.fillStyle = api.col('gem');     api.poly([X, Y - 8, X + 7, Y - 2, X, Y + 9, X - 7, Y - 2]);
  api.g.fillStyle = api.col('gemHi');   api.poly([X - 3, Y - 5, X + 3, Y - 5, X, Y - 1]);
}
export function drawBag(b: any){
  const X = (b.x + b.slide) * api.C + api.C / 2, Y = (b.state === 'fall' ? b.fy : b.y) * api.C + api.C / 2;
  api.g.save(); api.g.translate(X, Y);
  if (b.state === 'wobble') api.g.translate(Math.round(Math.sin(api.S.time * 40) * 2), 0);
  api.g.fillStyle = api.col('bagDark'); api.rr(-12, -6, 24, 19, 6); api.g.fill();
  api.g.fillStyle = api.col('bag'); api.rr(-10, -4, 20, 15, 5); api.g.fill();
  api.poly([-6, -4, -9, -12, 0, -8, 9, -12, 6, -4]);
  api.g.fillStyle = api.col('bagBand'); api.g.fillRect(-7, -6, 14, 3); api.g.fillRect(-2, 1, 4, 6); api.g.fillRect(-5, 3, 10, 2);
  api.g.restore();
}
export function drawGold(o: any){
  if (o.t < 3 && Math.floor(o.t * 8) % 2) return;
  const X = o.x * api.C + api.C / 2, Y = o.y * api.C + api.C / 2 + 4;
  for (const [dx, dy] of [[-7, 3], [0, 4], [7, 3], [-3, -3], [4, -3], [0, -8]]) {
    api.g.fillStyle = api.col('goldDark'); api.circ(X + dx, Y + dy + 1, 4.5);
    api.g.fillStyle = api.col('gold'); api.circ(X + dx, Y + dy, 3.6);
  }
}
export function drawSun(){
  if (!api.S.sun.active) return;
  const X = api.S.sun.x * api.C + api.C / 2, Y = api.S.sun.y * api.C + api.C / 2;
  api.g.save(); api.g.translate(X, Y); api.g.rotate(Math.floor(api.S.time * 6) * Math.PI / 8);
  api.g.fillStyle = api.col('sunRay'); for (let i = 0; i < 8; i++) { api.g.rotate(Math.PI / 4); api.g.fillRect(-2, -14, 4, 5); }
  api.g.restore();
  api.g.fillStyle = api.col(Math.floor(api.S.time * 6) % 2 ? 'sun' : 'sunRay'); api.circ(X, Y, 8);
  api.g.fillStyle = api.col('bg'); api.g.fillRect(X - 3, Y - 3, 2, 2); api.g.fillRect(X + 1, Y - 3, 2, 2);
}
export function drawMonster(m: any){ for (const q of wrapSpots(ppos(m))) drawMonsterAt(m, q); }
export function drawMonsterAt(m: any, p: { x: number; y: number }){
  const bonus = api.S.bonusT > 0;
  const flashing = bonus && api.S.bonusT < 2 && Math.floor(api.S.bonusT * 8) % 2;
  api.g.save(); api.g.translate(p.x, p.y);
  const bob = Math.sin(m.wob) > 0 ? -1 : 1;
  let body, belly;
  if (bonus) { body = flashing ? 'scaredFlash' : 'scared'; belly = 'scaredBelly'; }
  else if (m.type === 'b' || m.type === 'r') { body = 'borer'; belly = 'borerBelly'; }
  if (m.hitT > 0 && Math.floor(m.hitT * 20) % 2) body = 'eye';
  else { body = 'grub'; belly = 'grubBelly'; }
  // segmented grub: three humps
  api.g.fillStyle = api.col(body);
  api.circ(-7, 4 - bob, 6); api.circ(7, 4 + bob, 6); api.circ(0, -1, 10);
  api.g.fillStyle = api.col(belly as Role); api.g.fillRect(-9, 6, 18, 3);
  if (m.type === 'r' && !bonus) {
    // rockjaw: banded shell and a row of grinding teeth
    api.g.fillStyle = api.col('bg'); api.g.fillRect(-10, -2, 20, 2); api.g.fillRect(-12, 3, 24, 2);
    api.g.fillStyle = api.col('eye'); for (let i = 0; i < 4; i++) api.g.fillRect(-7 + i * 4, 9, 2, 4);
    api.g.fillStyle = api.col('horn'); api.g.fillRect(-15, 1, 4, 4); api.g.fillRect(11, 1, 4, 4);
    // remaining toughness, as pips over its head
    api.g.fillStyle = api.col('eye'); for (let i = 0; i < m.hp; i++) api.g.fillRect(-(m.hp * 5 - 1) / 2 + i * 5, -16, 3, 3);
  }
  if (m.type === 'b' && !bonus) {
    api.g.fillStyle = api.col('horn');
    api.poly([-8, -6, -12, -16, -3, -9]); api.poly([8, -6, 12, -16, 3, -9]);
  }
  const lx2 = m.mdx * 2, ly2 = m.mdy * 2;
  if (bonus) {
    api.g.fillStyle = api.col('pupil'); api.g.fillRect(-6, -4, 3, 3); api.g.fillRect(3, -4, 3, 3);
    for (let i = 0; i < 5; i++) api.g.fillRect(-7 + i * 3, 3 + (i % 2) * 2, 2, 2);
  } else {
    api.g.fillStyle = api.col('eye'); api.g.fillRect(-8, -7, 7, 6); api.g.fillRect(1, -7, 7, 6);
    api.g.fillStyle = api.col('pupil'); api.g.fillRect(-6 + lx2, -5 + ly2, 3, 3); api.g.fillRect(3 + lx2, -5 + ly2, 3, 3);
    if (m.type === 'b') api.g.fillRect(-4, 4, 8, 2);
  }
  api.g.restore();
}
export function drawPlayer(){ for (const q of wrapSpots(ppos(api.S.player))) drawPlayerAt(q); }
export function drawPlayerAt(pos: { x: number; y: number }){
  const p = api.S.player;
  if (api.S.mode === 'dying' && Math.floor(p.deadT * 10) % 2) return;
  api.g.save(); api.g.translate(pos.x, pos.y);
  if (api.S.mode === 'dying') api.g.rotate(Math.floor(p.deadT * 8) * Math.PI / 2);
  else if (p.face === 'left') api.g.scale(-1, 1);
  else if (p.face === 'up') api.g.rotate(-Math.PI / 2);
  else if (p.face === 'down') api.g.rotate(Math.PI / 2);
  api.g.fillStyle = api.col('track'); api.rr(-13, 5, 20, 8, 3); api.g.fill();
  api.g.fillStyle = api.col('wheel');
  const roll = p.moving ? Math.floor(api.S.time * 20) % 2 : 0;
  for (let i = 0; i < 3; i++) api.g.fillRect(-11 + i * 6 + roll, 8, 3, 3);
  api.g.fillStyle = api.col('cartShade'); api.rr(-13, -9, 19, 15, 3); api.g.fill();
  api.g.fillStyle = api.col('cart'); api.rr(-13, -9, 19, 11, 3); api.g.fill();
  api.g.fillStyle = api.col('window'); api.g.fillRect(-9, -6, 8, 5);
  api.g.fillStyle = api.col('lamp'); api.g.fillRect(-12, -13, 4, 4);
  api.g.fillStyle = api.col('drill'); api.poly([5, -9, 17, 0, 5, 9]);
  api.g.fillStyle = api.col('drillLine');
  const sp = p.moving ? Math.floor(api.S.time * 24) % 3 : 0;
  for (let x = 7 + sp; x < 15; x += 3) { const h = Math.max(1, 8 * (1 - (x - 5) / 12)); api.g.fillRect(x, -h, 1.5, h * 2); }
  api.g.restore();
}
export function drawSparks(){
  for (const s of api.S.sparks) {
    api.g.fillStyle = api.col('sparkTrail'); s.trail.forEach((t: any, i: number) => { if (i % 2 === 0) api.g.fillRect(t.x - 2, t.y - 2, 4, 4); });
    api.g.fillStyle = api.col('spark'); api.g.fillRect(s.x - 4, s.y - 4, 8, 8);
  }
}

/* api.HUD row and banners are drawn in screen pixels at the top of the buffer */
/** m:ss.mmm (or fewer decimals) */
export function stageClock(t: number, dp: number){
  const f = 10 ** dp, u = Math.floor(t * f), m = Math.floor(u / (60 * f)), s = (u - m * 60 * f) / f;
  return m + ':' + s.toFixed(dp).padStart(dp ? dp + 3 : 2, '0');
}
export function drawHud(){
  api.g.fillStyle = api.col('bg'); api.g.fillRect(0, 0, api.LW, api.HUD);
  api.txt(String(api.S.score).padStart(6, '0'), 6, 6, 'text');
  const wide = api.LW >= 330;
  if (wide) api.txt('HI ' + String(api.best).padStart(6, '0'), 80, 6, 'hud');
  // lives as pixel hearts, the one you're playing included
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const maxH = wide ? 6 : 3, shown = Math.min(Math.max(0, api.S.lives), maxH), hx0 = wide ? 176 : 58;
  for (let i = 0; i < shown; i++) {
    const x = hx0 + i * 10;
    for (let r = 0; r < HEART.length; r++) for (let c = 0; c < 7; c++) if (HEART[r][c] === '#') { api.g.fillStyle = api.col(r === 1 && c === 1 ? 'textDim' : 'text'); api.g.fillRect(x + c, 5 + r, 1, 1); }
  }
  if (api.S.lives > maxH) api.txt('+' + (api.S.lives - maxH), hx0 + maxH * 10 + 1, 6, 'hud');
  // tiny F and B tags for the spark (fire) and boost meters
  const GLYPH = { F: ['###', '#..', '##.', '#..', '#..'], B: ['##.', '#.#', '##.', '#.#', '##.'] };
  for (const [ch, gy] of [['F', 5], ['B', 11]] as const) GLYPH[ch].forEach((row, r) => { for (let c = 0; c < 3; c++) if (row[c] === '#') { api.g.fillStyle = api.col('hud'); api.g.fillRect(api.LW - 62 + c, gy + r, 1, 1); } });
  // the level, and the stage clock ticking beside it: as much of both as fits between the hearts and the meters
  api.g.font = '8px Silkscreen, "Courier New", monospace';
  const left = hx0 + shown * 10 + (api.S.lives > maxH ? 18 : 0) + 6, right = api.LW - 69;
  const fits = (a: string, b: string) => api.g.measureText(a).width + 6 + api.g.measureText(b).width <= right - left;
  let lv = 'LEVEL ' + api.S.level, tm = stageClock(api.S.stageT, 3);
  if (!fits(lv, tm)) lv = 'L' + api.S.level;
  if (!fits(lv, tm)) tm = stageClock(api.S.stageT, 1);
  if (!fits(lv, tm)) tm = stageClock(api.S.stageT, 0);
  api.txt(lv, right, 6, 'hud', 'right');
  if (fits(lv, tm)) api.txt(tm, right - api.g.measureText(lv).width - 6, 6, api.S.mode === 'play' ? 'text' : 'textDim', 'right');
  api.g.fillStyle = api.col('hud'); api.g.fillRect(api.LW - 56, 4, 50, 1); api.g.fillRect(api.LW - 56, 15, 50, 1); api.g.fillRect(api.LW - 56, 4, 1, 12); api.g.fillRect(api.LW - 7, 4, 1, 12);
  api.g.fillStyle = api.col(api.S.charge >= 1 ? 'text' : 'textDim'); api.g.fillRect(api.LW - 54, 6, Math.round(46 * api.S.charge), 3);
  const bl = api.S.boostT > 0 ? 1 : (api.S.boost || 0);
  if (!(api.S.boostT > 0 && Math.floor(api.S.time * 12) % 2)) { api.g.fillStyle = api.col(api.S.boostT > 0 || bl >= 1 ? 'gold' : 'textDim'); api.g.fillRect(api.LW - 54, 11, Math.round(46 * bl), 2); }
  api.g.fillStyle = api.col('hud'); for (let x = 0; x < api.LW; x += 4) api.g.fillRect(x, api.HUD - 2, 2, 1);
}
export function draw(){
  api.g.drawImage(dirtCanvas, 0, api.HUD);
  api.g.setTransform(api.K, 0, 0, api.K, 0, api.HUD);
  api.g.save(); api.g.beginPath(); api.g.rect(0, -10, api.W * api.C, api.H * api.C + 10); api.g.clip();   /* a little headroom so the cart's lamp and drill aren't trimmed in the top row */   // sprites half through an edge show on both sides, never over the score bar
  drawTunnels();
  for (let y = 0; y < api.H; y++) for (let x = 0; x < api.W; x++) if (api.S.em[api.idx(x, y)]) drawGem(x, y);
  api.S.golds.forEach(drawGold);
  api.S.bags.forEach(drawBag);
  drawSun();
  if (api.S.mode !== 'title') { api.S.monsters.forEach(drawMonster); drawPlayer(); }
  drawSparks();
  for (const q of api.S.parts) { api.g.fillStyle = api.col(q.role); api.g.fillRect(q.x - 2, q.y - 2, 4, 4); }
  api.g.restore();
  api.g.setTransform(1, 0, 0, 1, 0, 0);
  for (const q of api.S.pops) if (Math.floor(q.life * 12) % 3) api.txt(q.text, q.x * api.K, q.y * api.K + api.HUD - 4, 'text', 'center');
  if (api.S.bonusT > 0 && Math.floor(api.S.time * 4) % 2) { api.g.fillStyle = api.col('textDim'); api.g.fillRect(0, api.LH - 2, api.LW, 2); api.g.fillRect(0, api.HUD, api.LW, 2); }
  drawHud();
  if (api.S.mode === 'ready') api.banner('LEVEL ' + api.S.level, `${api.S.emLeft} EMERALDS  ·  ${api.S.total} GRUBS`);
  if (api.S.mode === 'clear') api.banner('LEVEL CLEARED', 'TIME ' + stageClock(api.S.stageT, 3) + (api.S.allDug ? '  ·  ALL DUG +1UP' : ''));
  else if (api.S.dugMsgT > 0 && api.S.mode === 'play' && Math.floor(api.S.dugMsgT * 6) % 2) api.txt('ALL EARTH DUG  ·  +1UP', api.LW / 2, api.HUD + 4, 'text', 'center');
}


const create: CreateGame = a => {
  api = a;
  dirtCanvas = document.createElement('canvas');
  return { start: () => genLevel(1), update, draw, onPalette: makeDirt, debug: {
    kill: (c?: string) => killPlayer(c),
    // dig out every block but the one left of the cart, for the all-dug test
    nearlyDug: () => { const pc = pcell(api.S.player); api.S.bags = []; api.S.dug.fill(1); api.S.dug[api.idx(wrapX(pc.x - 1), pc.y)] = 0; makeDirt(); },
  } };
};
export default create;

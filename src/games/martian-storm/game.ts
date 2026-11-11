/* Martian Storm: one skiff, eight legs of dust, a tuck on BOOST. No escorts, no bosses, no extra guns. */
import type { ConsoleAPI, CreateGame } from '../types';
import type { Fx, Round, Score } from '../../kit/play';
import { drawHud, makeFx, makeRound, makeScore, overlaps, play } from '../../kit/play';
import {
  BARB_H, BARB_W, SKIFF_H, SKIFF_MINI, SKIFF_W, SLAB_H, SLAB_W, SPORE_H, SPORE_W,
  TOKEN_H, TOKEN_W, drawBarb, drawPellet, drawSkiff, drawSlab, drawSpore, drawToken,
} from './art';
import {
  CLEAR_SECS, FLIGHT_TRIES, LEG_CLOCK, MAX_CRAFT, SHOT_COOLDOWN, SLAB_WAIT, TUCK_CAP, TUCK_SECS, TUCKS_START, TWIN_GAP,
  beatFits, beatSchedule, clampSkiff, flightOffsets, flightVelocity, grantToken, insetBox, landingBonus, touchBox,
  offerToken, onSporeGone, pelletSpeed, scrollSpeed, shotMeetsSlab, shotsThisPress, skiffVelocity, spendTuck, tokenPhase,
} from './rules';
import type { Beat, FlightShape, FlightState, TokenPhase } from './rules';

let api: ConsoleAPI;
let fx: Fx;
let score: Score;
let round: Round;

type Kind = 'spore' | 'barb' | 'slab';
interface Craft {
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  hits: number;
  flight: number;
  fired: boolean;
  leaving: boolean;
  alive: boolean;
}
interface Shot { x: number; y: number }
interface Pellet { x: number; y: number; vx: number; vy: number }
interface Token { x: number; y: number; age: number }
interface Mote { x: number; y: number; w: number; h: number; role: 'dirt' | 'textDim' }

let x = 0;
let y = 0;
let vx = 0;
let vy = 0;
let tucks = TUCKS_START;
let twin = false;
let tuckLeft = 0;
let boostLatched = false;
let blinkLeft = 0;
let cool = 0;
let shots: Shot[] = [];
let enemies: Craft[] = [];
let pellets: Pellet[] = [];
let flights = new Map<number, FlightState>();
let flightSeq = 0;
let token: Token | null = null;
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

const CLEAR_JINGLE = { notes: [392, 523, 659], dur: 0.09, vol: 0.045, gap: 0.1 };
const EXTRA_JINGLE = { notes: [523, 659, 784, 1046], dur: 0.08, vol: 0.045, gap: 0.08 };
const GROUNDED_JINGLE = { notes: [523, 392, 330, 220], dur: 0.07, vol: 0.05, gap: 0.08 };
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

function beginLeg(leg: number) {
  tucks = TUCKS_START;
  twin = false;
  tuckLeft = 0;
  boostLatched = false;
  blinkLeft = 0;
  cool = 0;
  shots = [];
  enemies = [];
  pellets = [];
  flights = new Map();
  flightSeq = 0;
  token = null;
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

function padAnchor() {
  const pad = padBox();
  return clampSkiff(pad.x + pad.w / 2 - SKIFF_W / 2, pad.y - SKIFF_H, SKIFF_W, SKIFF_H, api.LW, api.LH, api.HUD);
}

function ease(left: number, total: number) {
  const u = 1 - Math.max(0, Math.min(1, left / total));
  const e = u * u * (3 - 2 * u);
  const target = padAnchor();
  x = landFrom.x + (target.x - landFrom.x) * e;
  y = landFrom.y + (target.y - landFrom.y) * e;
  vx = 0;
  vy = 0;
}

function steer(dt: number) {
  const v = skiffVelocity(api.held, api.stickDir);
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

function guns(dt: number) {
  cool = Math.max(0, cool - dt);
  // A tap that lands and lifts between frames is queued, not held. Leave it queued through the cooldown.
  if (!(api.fireHeld || api.tapHeld || api.fireQueued || api.tapQueued) || cool > 0) return;
  const n = shotsThisPress(twin, shots.length);
  if (n === 0) return;
  const nose = x + SKIFF_W / 2;
  const sy = y - 4;
  if (n === 2) {
    shots.push({ x: nose - TWIN_GAP / 2 - 1, y: sy });
    shots.push({ x: nose + TWIN_GAP / 2 - 1, y: sy });
  } else shots.push({ x: nose - 1, y: sy });
  cool = SHOT_COOLDOWN;
  api.tone(680, 0.04, 0.035);
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
    flights.set(id, { left: 4, escaped: false });
    const vel = flightVelocity(shape, sign, scroll);
    for (const b of boxes) {
      enemies.push({
        kind: 'spore', x: b.x, y: b.y, vx: vel.vx, vy: vel.vy,
        hits: 0, flight: id, fired: false, leaving: false, alive: true,
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
    hits: 0, flight: -1, fired: false, leaving: false, alive: true,
  });
}

function spawnSlab() {
  enemies.push({
    kind: 'slab', x: Math.round(api.LW / 2 - SLAB_W / 2), y: api.HUD - SLAB_H,
    vx: 0, vy: scrollSpeed(api.S.level),
    hits: 0, flight: -1, fired: false, leaving: false, alive: true,
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

function noteSpore(craft: Craft, how: 'hit' | 'left') {
  const flight = flights.get(craft.flight);
  if (!flight) return;
  const result = onSporeGone(flight, how);
  flights.set(craft.flight, result.flight);
  if (!offerToken(token != null, result.drop)) return;
  token = { x: craft.x, y: craft.y, age: 0 };
}

function strike(craft: Craft) {
  if (craft.kind === 'slab') {
    const hit = shotMeetsSlab(craft.hits);
    craft.hits = hit.hits;
    if (!hit.gone) { api.tone(140, 0.05, 0.05); return; }
    craft.alive = false;
    score.add(80, craft.x + SLAB_W / 2, craft.y);
    play(api, SLAB_BREAK);
    return;
  }
  craft.alive = false;
  const points = craft.kind === 'spore' ? 20 : 40;
  score.add(points, craft.x, craft.y);
  api.tone(craft.kind === 'spore' ? 520 : 400, 0.04, 0.04);
  if (craft.kind === 'spore') noteSpore(craft, 'hit');
}

function hurt() {
  if (api.S.mode !== 'play' || settled) return;
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

function open() {
  return tuckLeft <= 0 && blinkLeft <= 0 && api.S.mode === 'play' && !settled;
}

function beginLanding() {
  if (settled) return;
  settled = true;
  const leg = api.S.level;
  score.add(landingBonus(tucks, leg), api.LW / 2, api.HUD + 28);
  api.track('level_cleared', { game: 'martian-storm', level: leg });
  landFrom = { x, y };
  if (leg >= 8) {
    grounding = true;
    groundT = CLEAR_SECS;
    play(api, GROUNDED_JINGLE);
    return;
  }
  play(api, CLEAR_JINGLE);
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

function combat(dt: number) {
  const speed = scrollSpeed(api.S.level);
  for (const mote of dust) {
    mote.y += speed * dt;
    if (mote.y > api.LH) mote.y = api.HUD - mote.h;
  }
  for (const shot of shots) shot.y -= 160 * dt;
  shots = shots.filter(shot => shot.y + 4 > api.HUD);
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
  shots = shots.filter(shot => {
    const box = { x: shot.x, y: shot.y, w: 2, h: 4 };
    for (const craft of enemies) {
      if (!craft.alive || craft.leaving) continue;
      const s = sizeOf(craft.kind);
      if (!overlaps(box, insetBox(craft.x, craft.y, s.w, s.h))) continue;
      strike(craft);
      return false;
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
    return false;
  });
  if (token) {
    token.age += dt;
    token.y += 40 * dt;
    const skiff = { x, y, w: SKIFF_W, h: SKIFF_H };
    const gift = { x: token.x, y: token.y, w: TOKEN_W, h: TOKEN_H };
    if (api.S.mode === 'play' && tuckLeft <= 0 && blinkLeft <= 0 && overlaps(skiff, gift)) {
      const phase: TokenPhase = tokenPhase(token.age);
      const grant = grantToken(phase, Math.min(TUCK_CAP, tucks), twin);
      tucks = grant.tucks;
      twin = grant.twin;
      if (grant.points) score.add(grant.points, token.x, token.y);
      else fx.pop(phase === 'tuck' ? 'TUCK' : 'TWIN', token.x, token.y, { role: 'gold' });
      api.tone(880, 0.06, 0.045);
      api.buzz('pickup');
      token = null;
    } else if (token.y > api.LH) token = null;
  }
  if (open()) {
    const me = insetBox(x, y, SKIFF_W, SKIFF_H);
    for (const craft of enemies) {
      if (!craft.alive || craft.leaving) continue;
      const s = sizeOf(craft.kind);
      if (overlaps(me, touchBox(craft.x, craft.y, s.w, s.h))) { hurt(); break; }
    }
  }
  if (open()) {
    const me = insetBox(x, y, SKIFF_W, SKIFF_H);
    for (const pellet of pellets) {
      if (overlaps(me, { x: pellet.x, y: pellet.y, w: 2, h: 2 })) { hurt(); break; }
    }
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
  for (const mote of dust) {
    g.fillStyle = api.col(mote.role);
    g.fillRect(Math.round(mote.x), Math.round(mote.y), mote.w, mote.h);
  }
  if (settled || S.mode === 'clear' || grounding || clock >= LEG_CLOCK) {
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
    else drawSlab(api, craft.x, craft.y, craft.hits);
  }
  for (const pellet of pellets) drawPellet(api, pellet.x, pellet.y, S.time);
  if (token) drawToken(api, token.x, token.y, tokenPhase(token.age));
  g.fillStyle = api.col('spark');
  for (const shot of shots) g.fillRect(Math.round(shot.x), Math.round(shot.y), 2, 4);
  const hidden = blinkLeft > 0 && Math.floor(S.time * 12) % 2 === 0;
  if (tuckLeft > 0) drawTuck();
  else if (S.mode !== 'dying' && !hidden) drawSkiff(api, x, y);
  fx.draw();
  drawHud(api, {
    right: 'LEG ' + S.level,
    lives: { art: SKIFF_MINI, role: 'cart', spare: true, max: 5 },
    badges: [{ text: 'TUCK ' + tucks, role: tuckLeft > 0 ? 'spark' : 'hud' }],
  });
  if (S.mode === 'ready') api.banner('LEG ' + S.level, 'FLY');
  if (S.mode === 'clear') api.banner('LEG CLEARED');
  if (S.mode === 'dying' && S.lives <= 0) api.banner('DUSTED');
  if (grounding) api.banner('GROUNDED');
}

/** The tuck count is the badge on the tube. Tunnel Raider's BOOST meter stays full and still. */
function pinMeters() {
  api.S.boost = 1;
  api.S.boostT = 0;
  api.S.charge = 1;
}

function start() {
  api.fitGrid();
  api.S.lives = 3;
  api.S.level = 1;
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

  if (api.S.mode === 'play' && !settled && tuckLeft <= 0) readTuck();
  else if (api.S.mode === 'play' && tuckLeft > 0) {
    api.clearFire();
    api.clearTap();
    if (api.boostQueued) api.clearBoost();
  }

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
  score = makeScore(a, { extraEvery: 2000, maxLives: 5, fx, onExtra: () => play(a, EXTRA_JINGLE) });
  round = makeRound(a, {
    respawn() {
      placeSkiff();
      blinkLeft = 1.2;
      twin = false;
      tuckLeft = 0;
      boostLatched = false;
      shots = [];
      cool = 0;
    },
    nextLevel() { beginLeg(a.S.level); },
    times: { ready: 1.2, respawn: 0.9, dying: 1.1, clear: CLEAR_SECS },
    clearOnReady: ['fire', 'boost'],
  });
  return {
    start, update, draw,
    debug: {
      state: () => ({
        x, y, vx, vy, tucks, twin, leg: a.S.level, lives: a.S.lives, shots: shots.length,
        /** craft wholly on screen below the HUD, so a capture can wait for something to look at */
        craft: enemies.filter(e => e.alive && e.y > a.HUD + 4).length,
      }),
      /** Hang an enemy pellet on the skiff so the next frame can overlap it. */
      pellet: () => { pellets.push({ x: x + SKIFF_W / 2 - 1, y: y + SKIFF_H / 2 - 1, vx: 0, vy: 8 }); },
    },
  };
};

export default create;

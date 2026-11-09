/* Bricks: one bat, one ember, a wall. Nothing in this file adds a second ember. */
import type { ConsoleAPI, CreateGame } from '../types';
import type { Fx, Pickups, Round, Score } from '../../kit/play';
import { clamp, consume, drawHud, horizontal, makeFx, makePickups, makeRound, makeScore, play, pressed, sweep } from '../../kit/play';
import { CAP_H, CAP_W, drawBat, drawBrick, drawDrop, drawEmber, BAT_MINI } from './art';
import {
  BAT_BOTTOM, BAT_H, EMBER, SLOT_H, SLOT_W,
  applyCatch, applySear, approachSide, bandX, baseSpeed, batSigned, batT, batTopAt, batWidth, batWidthWith,
  bendIntent, bendRise, breakableCount, brickReleasesDrop, buildWall, clampTravel, columnCount, easeBend,
  fittedRows, isBreakable, loseEmberMods, pacedSpeed, pickDrop, resolveBat, resolveBrick, velocityFromSigned,
  wallCleared, waveSpeed, DROP_LABEL, MAX_FALLING,
} from './rules';
import type { Brick, Cell, DropKind, PaceMod, Side, SizeMod } from './rules';

const BAT_SPEED = 210;

let api: ConsoleAPI;
let fx: Fx;
let score: Score;
let round: Round;

let cells: Cell[] = [];
let cols = 1;
let rows = 1;
let ox = 0;
let oy = 0;
let batX = 0;
let emberX = 0;
let emberY = 0;
let vx = 0;
let vy = 0;
let served = false;
let lastDir: -1 | 1 = 1;
let batDir: -1 | 0 | 1 = 0;
let speed = 130;
let waveStart = 1;
/** Set once a breakable goes this life, so a fresh serve is back at the wave's base speed. */
let thinLive = false;
/** −1 bowed down, +1 bowed up. Eases back to 0 when up and down are released. */
let bend = 0;
let size: SizeMod = null;
let pace: PaceMod = null;
let sear = 0;
/** A kiln Sear has already cracked and is still passing through. */
let slipping = -1;
let dropRng: () => number = () => 0;
let caps: Pickups<DropKind>;

const CLEAR_JINGLE = { notes: [392, 523, 659], dur: 0.09, vol: 0.045, gap: 0.1 };
const EXTRA_JINGLE = { notes: [523, 659, 784, 1046], dur: 0.08, vol: 0.045, gap: 0.08 };
const KILN_JINGLE = { notes: [330, 520], dur: 0.05, vol: 0.045, gap: 0.06 };

function batTop() {
  return api.LH - BAT_BOTTOM - BAT_H;
}
function liveBatW() {
  return batWidthWith(batWidth(api.LW, api.S.level), size);
}
function rise() {
  return bendRise(bend);
}
function slotOf(index: number) {
  const c = index % cols, r = Math.floor(index / cols);
  return { x: ox + c * SLOT_W, y: oy + r * SLOT_H, w: SLOT_W, h: SLOT_H };
}
function slotCentre(index: number) {
  const s = slotOf(index);
  return { x: s.x + SLOT_W / 2, y: s.y + SLOT_H / 2 };
}

function glue() {
  const w = liveBatW();
  emberX = batX + w / 2 - EMBER / 2;
  const top = batTopAt(batTop(), batT(emberX + EMBER / 2, batX, w), rise());
  emberY = top - 2 - EMBER;
  vx = 0;
  vy = 0;
}

function clampBat() {
  batX = clamp(batX, 2, api.LW - 2 - liveBatW());
}

function emberSpeed() {
  const wave = thinLive ? waveSpeed(api.S.level, breakableCount(cells), waveStart) : baseSpeed(api.S.level);
  return pacedSpeed(wave, pace);
}

function build(wave: number) {
  cols = columnCount(api.LW);
  rows = fittedRows(api.H, api.LH, api.HUD);
  ox = bandX(api.LW, cols);
  oy = api.HUD + 6;
  cells = buildWall(wave, cols, rows, api.mulberry32(wave * 10007 + 17));
  waveStart = Math.max(1, breakableCount(cells));
  thinLive = false;
  slipping = -1;
  dropRng = api.mulberry32(wave * 10007 + 91);
  speed = emberSpeed();
  served = false;
  clampBat();
  glue();
}

function moveBat(dt: number) {
  const dir = horizontal(api);
  batDir = dir;
  if (dir !== 0) lastDir = dir;
  batX += dir * BAT_SPEED * dt;
  bend = easeBend(bend, bendIntent(api.stickDir, api.held), dt);
  clampBat();
}

function serve() {
  consume(api, 'fire', true);
  speed = emberSpeed();
  const w = liveBatW();
  const signed = batSigned(emberX + EMBER / 2, batX + w / 2, w, batDir, lastDir, rise());
  const v = velocityFromSigned(signed, speed);
  vx = v.vx;
  vy = v.vy;
  served = true;
  api.tone(180, 0.06, 0.05);
  api.buzz('fire');
}

function noteRemoved() {
  thinLive = true;
  const next = emberSpeed();
  const hyp = Math.hypot(vx, vy);
  if (hyp > 0 && next > hyp + 0.01) {
    vx = vx / hyp * next;
    vy = vy / hyp * next;
  }
  if (next > speed) speed = next;
}

function maybeDrop(kind: Brick['kind'], removed: boolean, index: number) {
  if (!brickReleasesDrop(kind, removed, dropRng(), caps.falling)) return;
  const drop = pickDrop(dropRng());
  const s = slotOf(index);
  caps.drop(Math.round(s.x + (SLOT_W - CAP_W) / 2), Math.round(s.y + SLOT_H), drop);
}

function grant(kind: DropKind) {
  const prev = liveBatW();
  const centre = batX + prev / 2;
  const next = applyCatch(size, pace, sear, kind);
  const paceChanged = next.pace !== pace;
  size = next.size;
  pace = next.pace;
  sear = next.sear;
  batX = centre - liveBatW() / 2;
  clampBat();
  if (!served) glue();
  if (served && paceChanged) {
    const nextSpeed = emberSpeed();
    const hyp = Math.hypot(vx, vy);
    if (hyp > 0) {
      vx = vx / hyp * nextSpeed;
      vy = vy / hyp * nextSpeed;
    }
    speed = nextSpeed;
  }
  fx.pop(DROP_LABEL[kind], batX + liveBatW() / 2, batTop() - 12, { role: 'gold' });
  api.tone(740, 0.05, 0.045, 120);
}

function maybeClear() {
  if (api.S.mode !== 'play' || !wallCleared(cells)) return;
  const wave = api.S.level;
  score.add(100 * wave, api.LW / 2, api.HUD + 28);
  api.track('level_cleared', { game: 'bricks', level: wave });
  play(api, CLEAR_JINGLE);
  served = false;
  round.clear();
}

function miss() {
  if (api.S.mode !== 'play') return;
  const lost = loseEmberMods(size, pace, sear);
  size = lost.size;
  pace = lost.pace;
  sear = lost.sear;
  slipping = -1;
  served = false;
  api.tone(220, 0.25, 0.05, -180);
  api.track('life_lost', { game: 'bricks', level: api.S.level });
  round.lose({ secs: 1.1 });
}

function brickAt(x: number, y: number): number {
  const c0 = Math.floor((x - ox) / SLOT_W), c1 = Math.floor((x + EMBER - 0.01 - ox) / SLOT_W);
  const r0 = Math.floor((y - oy) / SLOT_H), r1 = Math.floor((y + EMBER - 0.01 - oy) / SLOT_H);
  let best = -1, bestArea = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = r * cols + c;
      if (!cells[i]) continue;
      const sx = ox + c * SLOT_W, sy = oy + r * SLOT_H;
      const iw = Math.min(x + EMBER, sx + SLOT_W) - Math.max(x, sx);
      const ih = Math.min(y + EMBER, sy + SLOT_H) - Math.max(y, sy);
      if (iw > 0 && ih > 0 && iw * ih > bestArea) { bestArea = iw * ih; best = i; }
    }
  }
  return best;
}

function outside(x: number, y: number) {
  return x < 0 || x + EMBER > api.LW || y < api.HUD;
}

function placeOutside(slot: { x: number; y: number; w: number; h: number }, side: Side) {
  if (side === 'left') emberX = slot.x - EMBER;
  else if (side === 'right') emberX = slot.x + slot.w;
  else if (side === 'top') emberY = slot.y - EMBER;
  else emberY = slot.y + slot.h;
}

function soundFor(before: Brick, removed: boolean) {
  if (before.kind === 'clay') api.tone(480, 0.03, 0.04);
  else if (before.kind === 'kiln' && !removed) api.tone(220, 0.05, 0.05);
  else if (before.kind === 'kiln') play(api, KILN_JINGLE);
  else if (before.kind === 'cinder') api.tone(200, 0.1, 0.05, -140);
  else if (before.kind === 'anvil') api.tone(90, 0.05, 0.06);
  else api.tone(880, 0.08, 0.035, 240);
}

function hitBrick(index: number, fromX: number, fromY: number) {
  const before = cells[index];
  if (!before) return;
  const slot = slotOf(index);
  const side = approachSide(fromX, fromY, slot, vx, vy);
  const hit = resolveBrick(cells, cols, index, vx, vy, side);
  cells[index] = hit.cell;
  const at = slotCentre(index);
  if (hit.points) score.add(hit.points, at.x, at.y);
  if (hit.clay >= 0 && cells[hit.clay]?.kind === 'clay') {
    const c = slotCentre(hit.clay);
    cells[hit.clay] = null;
    score.add(10, c.x, c.y);
    maybeDrop('clay', true, hit.clay);
  }
  if (hit.bounced) {
    vx = hit.vx;
    vy = hit.vy;
    speed = Math.hypot(vx, vy) || speed;
    placeOutside(slot, side);
  }
  soundFor(before, hit.cell == null);
  if (isBreakable(before) && (hit.cell == null || hit.clay >= 0)) noteRemoved();
  maybeDrop(before.kind, hit.cell == null, index);
  maybeClear();
}

/** Sear: the ember keeps going. A charge is spent only when the brick is gone. */
function strikeThrough(index: number) {
  const before = cells[index];
  if (!before) return;
  const slot = slotOf(index);
  const side = approachSide(emberX, emberY, slot, vx, vy);
  const hit = resolveBrick(cells, cols, index, vx, vy, side);
  const removed = hit.cell == null;
  const powered = applySear(before.kind, removed, sear, { vx, vy }, hit);
  cells[index] = hit.cell;
  sear = powered.charges;
  vx = powered.vx;
  vy = powered.vy;
  const at = slotCentre(index);
  if (hit.points) score.add(hit.points, at.x, at.y);
  if (hit.clay >= 0 && cells[hit.clay]?.kind === 'clay') {
    const c = slotCentre(hit.clay);
    cells[hit.clay] = null;
    score.add(10, c.x, c.y);
    maybeDrop('clay', true, hit.clay);
  }
  soundFor(before, removed);
  if (isBreakable(before) && (removed || hit.clay >= 0)) noteRemoved();
  if (removed) maybeDrop(before.kind, true, index);
  maybeClear();
}

function breakGlass(index: number) {
  const before = cells[index];
  if (!before || before.kind !== 'glass') return;
  const hit = resolveBrick(cells, cols, index, vx, vy, 'top');
  cells[index] = hit.cell;
  const at = slotCentre(index);
  score.add(hit.points, at.x, at.y);
  soundFor(before, true);
  noteRemoved();
  maybeDrop('glass', true, index);
  maybeClear();
}

function batBody() {
  return { x: batX, y: batTop(), w: liveBatW() };
}

function hitBat(x: number, y: number) {
  const hit = resolveBat({ x, y, vx, vy }, batBody(), batDir, lastDir, speed, rise());
  if (hit.kind === 'miss') return;
  emberX = hit.x;
  emberY = hit.y;
  const steered = clampTravel(hit.vx, hit.vy);
  vx = steered.vx;
  vy = steered.vy;
  speed = Math.hypot(vx, vy) || speed;
  if (hit.kind === 'bounce') api.tone(320, 0.04, 0.05);
}

function hitWall(x: number, y: number) {
  if (x < 0) { emberX = 0; vx = Math.abs(vx); }
  else if (x + EMBER > api.LW) { emberX = api.LW - EMBER; vx = -Math.abs(vx); }
  else emberX = x;
  if (y < api.HUD) { emberY = api.HUD; vy = Math.abs(vy); }
  else emberY = y;
  const steered = clampTravel(vx, vy);
  vx = steered.vx;
  vy = steered.vy;
  speed = Math.hypot(vx, vy) || speed;
}

function fly(dt: number) {
  let remain = speed * dt;
  for (let guard = 0; guard < 8 && remain > 0.001 && served && api.S.mode === 'play'; guard++) {
    const hyp = Math.hypot(vx, vy) || 1;
    const seg = Math.min(2, remain);
    const dx = vx / hyp * seg, dy = vy / hyp * seg;
    const x0 = emberX, y0 = emberY;
    const end = sweep({ x: emberX, y: emberY }, dx, dy, 2, (x, y) => {
      const idx = brickAt(x, y);
      if (idx >= 0 && idx === slipping) {
        const slot = slotOf(idx);
        const still = x < slot.x + slot.w && x + EMBER > slot.x && y < slot.y + slot.h && y + EMBER > slot.y;
        if (still) return false;
        slipping = -1;
      }
      if (idx >= 0 && cells[idx]?.kind === 'glass') {
        breakGlass(idx);
        return api.S.mode !== 'play';
      }
      if (idx >= 0 && cells[idx] && cells[idx].kind !== 'anvil' && sear > 0) {
        strikeThrough(idx);
        if (cells[idx]) slipping = idx;
        return api.S.mode !== 'play';
      }
      if (idx >= 0) return true;
      if (outside(x, y)) return true;
      const bat = resolveBat({ x, y, vx, vy }, batBody(), batDir, lastDir, speed, rise());
      return bat.kind !== 'miss';
    });
    if (api.S.mode !== 'play') return;
    if (!end.hit) {
      emberX = end.x;
      emberY = end.y;
      remain -= seg;
      if (emberY > api.LH) { miss(); return; }
      continue;
    }
    const idx = brickAt(end.x, end.y);
    if (idx >= 0) hitBrick(idx, x0, y0);
    else if (resolveBat({ x: end.x, y: end.y, vx, vy }, batBody(), batDir, lastDir, speed, rise()).kind !== 'miss') hitBat(end.x, end.y);
    else hitWall(end.x, end.y);
    remain -= seg;
    if (emberY > api.LH) { miss(); return; }
  }
  if (served && api.S.mode === 'play' && emberY > api.LH) miss();
}

function start() {
  api.fitGrid();
  api.S.lives = 3;
  api.S.level = 1;
  score.reset();
  fx.clear();
  lastDir = 1;
  batDir = 0;
  bend = 0;
  size = null;
  pace = null;
  sear = 0;
  slipping = -1;
  caps.clear();
  batX = (api.LW - batWidth(api.LW, 1)) / 2;
  build(1);
}

function update(dt: number) {
  fx.update(dt);
  const playing = round.tick(dt);
  const mode = api.S.mode;
  if (mode === 'ready' || mode === 'play') moveBat(dt);
  if (!served && (mode === 'ready' || mode === 'play')) glue();
  if (mode === 'ready' || mode === 'play' || mode === 'dying' || mode === 'clear') {
    const canCatch = mode === 'ready' || mode === 'play';
    const w = liveBatW();
    const lifted = Math.max(0, rise());
    const dipped = Math.max(0, -rise());
    const caught = caps.update(dt, canCatch ? { x: batX, y: batTop() - lifted, w, h: BAT_H + lifted + dipped } : null);
    for (const kind of caught) grant(kind);
  }
  if (!playing) return;
  if (!served) {
    if (pressed(api, 'fire', true)) serve();
    return;
  }
  api.clearFire();
  api.clearTap();
  fly(dt);
}

function draw() {
  const { g, LW, LH, HUD, S } = api;
  g.fillStyle = api.col('bg');
  g.fillRect(0, HUD, LW, LH - HUD);
  g.fillStyle = api.col('hud');
  g.fillRect(0, HUD, LW, 1);
  g.fillRect(0, HUD, 1, LH - HUD);
  g.fillRect(LW - 1, HUD, 1, LH - HUD);
  for (let i = 0; i < cells.length; i++) {
    const brick = cells[i];
    if (!brick) continue;
    const c = i % cols, r = Math.floor(i / cols);
    drawBrick(api, brick, ox + c * SLOT_W, oy + r * SLOT_H);
  }
  caps.draw();
  drawBat(api, batX, batTop(), liveBatW(), rise());
  if (emberY < LH) drawEmber(api, emberX, emberY);
  fx.draw();
  drawHud(api, { right: 'WAVE ' + S.level, lives: { art: BAT_MINI, role: 'cart', spare: true, max: 5 } });
  if (S.mode === 'ready') api.banner('WAVE ' + S.level, 'SERVE');
  if (S.mode === 'clear') api.banner('CLEARED');
}

function kinds() {
  const tally = { clay: 0, kiln: 0, glass: 0, cinder: 0, anvil: 0 };
  for (const c of cells) if (c) tally[c.kind] += 1;
  return tally;
}

const create: CreateGame = a => {
  api = a;
  fx = makeFx(a);
  score = makeScore(a, { extraEvery: 2000, maxLives: 6, fx, onExtra: () => play(a, EXTRA_JINGLE) });
  caps = makePickups(a, {
    size: { w: CAP_W, h: CAP_H },
    speed: 72,
    max: MAX_FALLING,
    draw: (kind, x, y) => drawDrop(a, kind, x, y),
  });
  round = makeRound(a, {
    respawn() {
      served = false;
      thinLive = false;
      slipping = -1;
      speed = emberSpeed();
      glue();
    },
    nextLevel() { build(a.S.level); },
    times: { ready: 1.2, respawn: 0.8, dying: 1.1, clear: 1.6 },
  });
  return {
    start, update, draw,
    debug: {
      state: () => ({
        served,
        bx: emberX, by: emberY,
        vx: served ? vx : 0, vy: served ? vy : 0,
        px: batX, py: batTop(),
        bw: liveBatW(),
        bend,
        size, pace, sear,
        bricks: breakableCount(cells),
        lives: a.S.lives,
        wave: a.S.level,
        kinds: kinds(),
        drops: caps.list.map(p => ({ kind: p.kind, x: p.x, y: p.y })),
        left: cells.flatMap((cell, i) => cell && isBreakable(cell) ? [{ c: i % cols, r: Math.floor(i / cols), kind: cell.kind, hits: cell.hits }] : []),
      }),
      /** Hang a capsule just above the bat so the next frame can catch it. */
      drop: (kind: DropKind) => {
        caps.drop(Math.round(batX + liveBatW() / 2 - CAP_W / 2), Math.round(batTop() - CAP_H - 1), kind, true);
      },
    },
  };
};

export default create;

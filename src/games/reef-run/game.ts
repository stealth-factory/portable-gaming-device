/* Reef Run: a fish swims a reef current. A kick lifts it; otherwise it sinks.
   The fish, the reef, the art, the sound and the code are original. */
import type { CreateGame } from '../types';
import { drawBed, drawBubble, drawCurrents, drawFish, drawKelp, drawReef, drawSurface } from './art';
import {
  FISH_H, FISH_W, GATE_W, applyKick, clearedGate, currentSpeed, driftFor, firstGateX, gateKind, gateSpacing,
  hitsBound, hitsReef, laneOf, openingHeight, placeGapY, startY, stepFish, wantKick, type Gate, type Lane,
} from './rules';

const create: CreateGame = api => {
  let lane: Lane = laneOf(240, 188, 20);
  let fishY = 0;
  let fishVy = 0;
  let gates: Gate[] = [];
  let spawned = 0;
  let travel = 0;
  let leg = 0;
  let flash = 0;
  let over = false;
  let fireLatch = false;
  let tapLatch = false;
  let upLatch = false;
  let bubbles: { x: number; y: number; v: number; big: boolean }[] = [];

  const readLane = () => laneOf(api.LW, api.LH, api.HUD);

  function ensureGates() {
    let guard = 0;
    while (gates.length < 3 && (gates.length === 0 || gates[gates.length - 1].x < api.LW + 8) && guard++ < 6) {
      const prev = gates.length ? gates[gates.length - 1] : null;
      const x = prev ? prev.x + gateSpacing(api.S.score) : firstGateX(lane.fishX, api.LW);
      const gapH = openingHeight(lane.height, api.S.score);
      const prevCentre = prev ? prev.gapY + prev.gapH / 2 : (lane.top + lane.bottom) / 2;
      const gapY = placeGapY(prevCentre, gapH, lane.top, lane.bottom, Math.random, prev ? driftFor(api.S.score) : 0);
      gates.push({ x, gapY, gapH, w: GATE_W, scored: false, kind: gateKind(spawned) });
      spawned += 1;
    }
  }

  function die() {
    if (api.S.mode !== 'play') return;
    api.S.mode = 'dying';
    api.S.modeT = 1.4;
    api.S.lives = 0;
    api.buzz('lose');
    api.tone(196, 0.12, 0.05, -80);
    api.tone(146, 0.16, 0.04, -40, 0.1);
    api.tone(98, 0.2, 0.035, -20, 0.24);
  }

  function start() {
    api.fitGrid();
    lane = readLane();
    fishY = startY(lane.top, lane.bottom);
    fishVy = 0;
    gates = [];
    spawned = 0;
    travel = 0;
    leg = 0;
    flash = 0;
    over = false;
    fireLatch = false;
    tapLatch = false;
    upLatch = false;
    api.S.score = 0;
    api.S.level = 1;
    api.S.lives = 1;
    api.S.charge = 1;
    api.S.boost = 0;
    api.S.boostT = 0;
    const span = Math.max(1, lane.bottom - lane.top);
    bubbles = Array.from({ length: 7 }, (_, i) => ({
      x: (i + 0.5) * api.LW / 7,
      y: lane.top + (i * 37) % span,
      v: 14 + (i % 3) * 8,
      big: i % 3 === 0,
    }));
    ensureGates();
  }

  function driftBubbles(dt: number, dist: number) {
    for (const b of bubbles) {
      b.y -= b.v * dt;
      b.x -= dist * 0.2;
      if (b.y < lane.top - 4) {
        b.y = lane.bottom - 6;
        b.x = Math.random() * api.LW;
      }
      if (b.x < -6) b.x += api.LW + 12;
    }
  }

  function update(dt: number) {
    lane = readLane();
    leg += dt;
    if (api.S.mode === 'ready') {
      fireLatch = api.fireHeld;
      tapLatch = api.tapHeld;
      upLatch = api.held.includes('up') || api.stickDir === 'up';
      if ((api.S.modeT -= dt) <= 0) api.S.mode = 'play';
      api.clearFire();
      api.clearTap();
      return;
    }
    if (api.S.mode === 'dying') {
      const sunk = stepFish(fishY, fishVy, dt);
      fishY = sunk.y;
      fishVy = sunk.vy;
      driftBubbles(dt, 0);
      if ((api.S.modeT -= dt) <= 0 && !over) {
        over = true;
        api.finishGame();
      }
      return;
    }
    if (api.S.mode !== 'play') return;

    // FIRE and screen taps latch separately, so holding one never blocks a press of the other
    const fire = wantKick(api.fireQueued, api.fireHeld, fireLatch);
    const tap = wantKick(api.tapQueued, api.tapHeld, tapLatch);
    const up = wantKick(false, api.held.includes('up') || api.stickDir === 'up', upLatch);
    fireLatch = fire.latched;
    tapLatch = tap.latched;
    upLatch = up.latched;
    if (fire.kick || tap.kick || up.kick) {
      fishVy = applyKick();
      api.tone(294, 0.045, 0.035, 240);
      api.buzz('fire');
    }
    api.clearFire();
    api.clearTap();

    const stepped = stepFish(fishY, fishVy, dt);
    fishY = stepped.y;
    fishVy = stepped.vy;
    const speed = currentSpeed(api.S.score);
    const dist = speed * dt;
    travel += dist;
    for (const g of gates) g.x -= dist;
    driftBubbles(dt, dist);

    const bound = hitsBound(fishY, lane.top, lane.bottom);
    if (bound) { die(); return; }
    for (const g of gates) if (hitsReef(lane.fishX, fishY, g)) { die(); return; }

    let gained = 0;
    for (const g of gates) if (clearedGate(lane.fishX, g)) { g.scored = true; gained += 1; }
    if (gained) {
      api.S.score += gained;
      api.S.level = Math.max(1, api.S.score);
      if (api.S.score > api.best) api.best = api.S.score;
      flash = 0.35;
      api.tone(698, 0.04, 0.03);
      api.tone(880, 0.06, 0.028, 40, 0.045);
    }
    if (flash > 0) flash -= dt;
    gates = gates.filter(g => g.x + g.w > -8);
    ensureGates();
  }

  function hud() {
    api.g.fillStyle = api.col('bg');
    api.g.fillRect(0, 0, api.LW, api.HUD);
    if (!(flash > 0 && Math.floor(flash * 12) % 2 === 0)) api.txt(String(api.S.score).padStart(4, '0'), 6, 6, 'text');
    if (api.LW >= 300) api.txt('HI ' + String(api.best).padStart(4, '0'), 52, 6, 'hud');
    api.txt('REEF RUN', api.LW - 6, 6, 'hud', 'right');
    api.g.fillStyle = api.col('hud');
    for (let x = 0; x < api.LW; x += 4) api.g.fillRect(x, api.HUD - 2, 2, 1);
  }

  function draw() {
    if (lane.top > api.HUD + 12) {
      for (let i = 0; i < 5; i++) drawKelp(api, 8 + i * (api.LW / 5), lane.top - 1, 8 + (i % 3) * 4, api.S.time);
    }
    if (api.LH - lane.bottom > 12) {
      for (let i = 0; i < 5; i++) drawKelp(api, 16 + i * (api.LW / 5), api.LH - 2, 10 + (i % 2) * 6, api.S.time + 1);
    }
    drawSurface(api, lane.top, api.S.time);
    drawCurrents(api, lane.top, lane.bottom, travel);
    for (const b of bubbles) drawBubble(api, b.x, b.y, b.big);
    for (const g of gates) drawReef(api, g.x, g.gapY, g.gapH, g.w, lane.top, lane.bottom, g.kind);
    drawBed(api, lane.bottom - 3, travel);
    const bob = api.S.mode === 'ready' ? Math.round(Math.sin(api.S.time * 3) * 3) : 0;
    drawFish(api, lane.fishX, fishY + bob, fishVy, Math.floor(leg * 8), api.S.mode === 'dying');
    hud();
    if (api.S.mode === 'ready') {
      api.txt('REEF RUN', api.LW / 2, lane.top + 8, 'text', 'center', 16);
      api.txt('FIRE TO KICK', api.LW / 2, lane.top + 26, 'hud', 'center');
    }
  }

  return {
    start, update, draw,
    debug: {
      state: () => ({
        y: fishY, vy: fishVy, score: api.S.score, mode: api.S.mode,
        fishX: lane.fishX, fishH: FISH_H, fishW: FISH_W,
        laneTop: lane.top, laneBottom: lane.bottom,
        gates: gates.map(g => ({ x: g.x, gapY: g.gapY, gapH: g.gapH, w: g.w, scored: g.scored, kind: g.kind })),
      }),
      snag() { die(); },
    },
  };
};

export default create;

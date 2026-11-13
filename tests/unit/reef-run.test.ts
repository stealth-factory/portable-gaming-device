import { describe, expect, it } from 'vitest';
import {
  FISH_H, FISH_W, FALL_MAX, GATE_W, GRAVITY, KICK_VY, SPEED_MAX, SPEED_START,
  applyKick, clearedGate, currentSpeed, driftFor, firstGateX, gateKind, gateSpacing, hitsBound, hitsReef,
  laneOf, openingHeight, placeGapY, startY, stepFish, wantKick, type Gate,
} from '../../src/games/reef-run/rules';

/** How far one kick lifts the fish, in px. A kick from the lower half of an opening stays inside it. */
const RISE = (KICK_VY * KICK_VY) / (2 * GRAVITY);

function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Kick from the lower half of the next opening, and not when that hop would leave the top. */
function flap(y: number, vy: number, gapY: number, gapH: number) {
  if (vy < KICK_VY * 0.5) return false;
  if (y - RISE < gapY + 3) return false;
  return y + FISH_H / 2 > gapY + gapH * 0.62;
}

/** Swim until `seconds` or a crash. Returns how many openings cleared. */
function swim(lw: number, lh: number, hud: number, seed: number, seconds: number) {
  const lane = laneOf(lw, lh, hud);
  const rng = mulberry32(seed);
  let y = startY(lane.top, lane.bottom);
  let vy = 0;
  let score = 0;
  let spawned = 0;
  let dead: string | null = null;
  const gates: Gate[] = [];
  const dt = 1 / 60;
  const spawn = () => {
    const prev = gates.length ? gates[gates.length - 1] : null;
    const x = prev ? prev.x + gateSpacing(score) : firstGateX(lane.fishX, lw);
    const gapH = openingHeight(lane.height, score);
    const prevCentre = prev ? prev.gapY + prev.gapH / 2 : (lane.top + lane.bottom) / 2;
    const gapY = placeGapY(prevCentre, gapH, lane.top, lane.bottom, rng, prev ? driftFor(score) : 0);
    gates.push({ x, gapY, gapH, w: GATE_W, scored: false, kind: gateKind(spawned) });
    spawned += 1;
  };
  spawn();
  for (let f = 0; f < seconds * 60 && !dead; f++) {
    const upcoming = gates.find(g => g.x + g.w >= lane.fishX);
    const aim = upcoming ?? gates[gates.length - 1];
    if (aim && flap(y, vy, aim.gapY, aim.gapH)) vy = applyKick();
    ({ y, vy } = stepFish(y, vy, dt));
    const bound = hitsBound(y, lane.top, lane.bottom);
    if (bound) { dead = bound; break; }
    const dist = currentSpeed(score) * dt;
    for (const g of gates) g.x -= dist;
    for (const g of gates) if (hitsReef(lane.fishX, y, g)) { dead = 'reef'; break; }
    if (dead) break;
    for (const g of gates) if (clearedGate(lane.fishX, g)) { g.scored = true; score += 1; }
    for (let i = gates.length - 1; i >= 0; i--) if (gates[i].x + gates[i].w < -8) gates.splice(i, 1);
    if (!gates.length || gates[gates.length - 1].x < lw + 8) spawn();
  }
  return { score, dead, y };
}

describe('Reef Run rules', () => {
  it('kicks upward once per press and ignores a held repeat', () => {
    expect(applyKick()).toBe(KICK_VY);
    expect(wantKick(true, false, false)).toEqual({ kick: true, latched: false });
    expect(wantKick(true, true, false)).toEqual({ kick: true, latched: true });
    expect(wantKick(true, true, true)).toEqual({ kick: false, latched: true });
    expect(wantKick(false, false, true)).toEqual({ kick: false, latched: false });
    expect(wantKick(false, true, false)).toEqual({ kick: true, latched: true });
  });

  it('sinks under gravity and does not fall faster than the cap', () => {
    const still = stepFish(100, 0, 1 / 60);
    expect(still.vy).toBeGreaterThan(0);
    expect(still.y).toBeGreaterThan(100);
    const dropped = stepFish(0, FALL_MAX, 1);
    expect(dropped.vy).toBe(FALL_MAX);
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('a fish that never kicks hits the seabed before it scores', () => {
    const lane = laneOf(240, 188, 20);
    let y = startY(lane.top, lane.bottom);
    let vy = 0;
    let dead: string | null = null;
    const gateX = firstGateX(lane.fishX, 240);
    for (let f = 0; f < 180 && !dead; f++) {
      ({ y, vy } = stepFish(y, vy, 1 / 60));
      dead = hitsBound(y, lane.top, lane.bottom);
    }
    expect(dead).toBe('floor');
    expect(y + FISH_H).toBeGreaterThan(lane.bottom);
    expect(gateX).toBeGreaterThan(lane.fishX + FISH_W);
  });

  it('treats the opening as clear and the coral, the surface and the seabed as fatal', () => {
    const gate = { x: 70, w: GATE_W, gapY: 80, gapH: 50, scored: false };
    const fishX = 72;
    expect(hitsReef(fishX, 90, gate)).toBe(false);
    expect(hitsReef(fishX, 70, gate)).toBe(true);
    expect(hitsReef(fishX, 128, gate)).toBe(true);
    expect(hitsReef(20, 90, gate)).toBe(false);
    expect(hitsBound(10, 22, 180)).toBe('ceiling');
    expect(hitsBound(170, 22, 180)).toBe('floor');
    expect(hitsBound(80, 22, 180)).toBeNull();
  });

  it('scores an opening once, when the nose clears it', () => {
    const gate = { x: 40, w: GATE_W, scored: false };
    expect(clearedGate(40, gate)).toBe(false);
    expect(clearedGate(40 + GATE_W - FISH_W, gate)).toBe(false);
    expect(clearedGate(40 + GATE_W - FISH_W + 1, gate)).toBe(true);
    expect(clearedGate(80, { ...gate, scored: true })).toBe(false);
  });

  it('keeps every opening inside the lane and tall enough for the fish', () => {
    const rng = mulberry32(3);
    for (const [lw, lh] of [[240, 188], [360, 260], [240, 548]] as const) {
      const lane = laneOf(lw, lh, 20);
      expect(lane.top).toBeGreaterThanOrEqual(20);
      expect(lane.bottom).toBeLessThanOrEqual(lh);
      expect(lane.height).toBeLessThanOrEqual(176);
      let centre = (lane.top + lane.bottom) / 2;
      for (let score = 0; score < 40; score++) {
        const gapH = openingHeight(lane.height, score);
        expect(gapH).toBeGreaterThanOrEqual(FISH_H + 8);
        expect(gapH).toBeLessThan(lane.height);
        const gapY = placeGapY(centre, gapH, lane.top, lane.bottom, rng, score === 0 ? 0 : driftFor(score));
        expect(gapY).toBeGreaterThanOrEqual(lane.top + 8);
        expect(gapY + gapH).toBeLessThanOrEqual(lane.bottom - 8);
        centre = gapY + gapH / 2;
      }
    }
  });

  it('speeds up, then holds, and marks every fifth barrier as a wreck', () => {
    expect(currentSpeed(0)).toBe(SPEED_START);
    expect(currentSpeed(4)).toBeGreaterThan(currentSpeed(0));
    expect(currentSpeed(80)).toBe(SPEED_MAX);
    expect(gateSpacing(10)).toBeLessThan(gateSpacing(0));
    expect(openingHeight(160, 10)).toBeLessThan(openingHeight(160, 0));
    expect([0, 1, 2, 3].map(gateKind)).toEqual(['coral', 'coral', 'coral', 'coral']);
    expect(gateKind(4)).toBe('wreck');
    expect(gateKind(9)).toBe('wreck');
  });

  it('a fish that kicks toward each opening clears several of them', () => {
    const short = swim(240, 188, 20, 1, 18);
    const desk = swim(360, 260, 20, 2, 18);
    const tall = swim(240, 548, 20, 3, 18);
    expect(short.score).toBeGreaterThanOrEqual(5);
    expect(desk.score).toBeGreaterThanOrEqual(5);
    expect(tall.score).toBeGreaterThanOrEqual(5);
    expect(short.dead).toBeNull();
    expect(desk.dead).toBeNull();
    expect(tall.dead).toBeNull();
  });
});

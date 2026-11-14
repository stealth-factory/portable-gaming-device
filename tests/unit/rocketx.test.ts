import { describe, expect, it } from 'vitest';
import {
  G, GROUND, LAND_VY, MAIN_FUEL, MAIN_THRUST, RCS_FUEL, inboundSpeed, landingScore, padFor, startRocket,
  stepRocket, touchdown, windFor, type Rocket,
} from '../../src/games/rocketx/rules';

const NONE = { main: false, rcs: 0 as const, level: false };
const still = (over: Partial<Rocket> = {}): Rocket => ({ x: 0.5, y: 0.5, vx: 0, vy: 0, a: 0, w: 0, fuel: 1, ...over });

describe('rocketx rules', () => {
  it('falls under gravity when nothing burns', () => {
    const r = stepRocket(still(), NONE, 0.1, 0);
    expect(r.vy).toBeCloseTo(G * 0.1, 6);
    expect(r.y).toBeGreaterThan(0.5);
    expect(r.fuel).toBe(1);
  });

  it('the main engine climbs when upright and burns fuel', () => {
    const r = stepRocket(still({ y: 0.6 }), { ...NONE, main: true }, 0.1, 0);
    expect(r.vy).toBeLessThan(0);
    expect(r.fuel).toBeCloseTo(1 - MAIN_FUEL * 0.1, 6);
  });

  it('the main engine pushes sideways when the rocket is tilted', () => {
    const r = stepRocket(still({ a: 0.3, y: 0.6 }), { ...NONE, main: true }, 0.1, 0);
    expect(r.vx).toBeLessThan(0);
    expect(Math.abs(r.vx)).toBeGreaterThan(0);
  });

  it('an empty tank gives no thrust: the rocket just falls', () => {
    const r = stepRocket(still({ fuel: 0, y: 0.6 }), { ...NONE, main: true }, 0.1, 0);
    expect(r.vy).toBeCloseTo(G * 0.1, 6);
  });

  it('side thrusters turn the rocket and burn a little fuel', () => {
    const r = stepRocket(still(), { ...NONE, rcs: 1 }, 0.1, 0);
    expect(r.w).toBeGreaterThan(0);
    expect(r.a).toBeGreaterThan(0);
    expect(r.fuel).toBeCloseTo(1 - RCS_FUEL * 0.1, 6);
  });

  it('attitude hold pulls a tilted rocket back to upright', () => {
    let r = still({ a: 0.25 });
    for (let i = 0; i < 60; i++) r = stepRocket(r, { ...NONE, level: true }, 1 / 60, 0);
    expect(Math.abs(r.a)).toBeLessThan(0.05);
  });

  it('the inbound rocket comes in faster on every level, up to a cap', () => {
    expect(inboundSpeed(2)).toBeGreaterThan(inboundSpeed(1));
    expect(inboundSpeed(3)).toBeGreaterThan(inboundSpeed(2));
    expect(inboundSpeed(40)).toBeCloseTo(0.22, 6);
    expect(startRocket(0.5, 4).vy).toBeCloseTo(inboundSpeed(4), 6);
  });

  it('a soft, upright, centred touchdown on the pad lands', () => {
    const r = still({ x: 0.5, y: GROUND, vy: LAND_VY * 0.5, vx: 0, a: 0 });
    expect(touchdown(r, 1)).toBe('landed');
  });

  it('a fast, tilted or off-pad touchdown crashes', () => {
    expect(touchdown(still({ y: GROUND, vy: LAND_VY * 2 }), 1)).toBe('crashed');
    expect(touchdown(still({ y: GROUND, a: 0.4 }), 1)).toBe('crashed');
    expect(touchdown(still({ y: GROUND, x: 0.2 }), 1)).toBe('crashed');
  });

  it('the pad narrows as levels go up, and wind grows', () => {
    expect(padFor(5).half).toBeLessThan(padFor(1).half);
    expect(Math.abs(windFor(6))).toBeGreaterThan(0);
    expect(Math.abs(windFor(6))).toBeLessThanOrEqual(0.03);
  });

  it('a landing is worth more with fuel left and a centred touchdown', () => {
    const good = landingScore(still({ x: 0.5, fuel: 1, vy: 0 }), 1);
    const poor = landingScore(still({ x: 0.5, fuel: 0.1, vy: LAND_VY * 0.9 }), 1);
    expect(good).toBeGreaterThan(poor);
    expect(landingScore(still({ x: 0.5, fuel: 1, vy: 0 }), 3)).toBeGreaterThan(good);
  });

  it('the thrust is more than gravity, so a full tank can always stop the inbound rocket', () => {
    expect(MAIN_THRUST).toBeGreaterThan(G);
  });
});

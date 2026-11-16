import { describe, expect, it } from 'vitest';
import {
  G, GROUND, LAND_VY, MAIN_FUEL, MAIN_THRUST, RCS_FUEL, inboundSpeed, landingScore, padFor, startRocket,
  stepRocket, touchdown, windFor, speedMeter, landingVy, landingVx, windMeter, type Rocket,
  CONTROLS, DEFAULT_CONTROL, FIN_MIN, ROCKETS, autoFin, finBite, gateLevel, levelUses, setupMove,
  SEA_LEVEL, atSea, deckAt, landDeck, seaFor, shipHalf,
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
    expect(r.vx).toBeGreaterThan(0);   // leaning right pushes right
    expect(Math.abs(r.vx)).toBeGreaterThan(0);
  });

  it('an empty tank gives no thrust: the rocket just falls', () => {
    const r = stepRocket(still({ fuel: 0, y: 0.6 }), { ...NONE, main: true }, 0.1, 0);
    expect(r.vy).toBeCloseTo(G * 0.1, 6);
  });

  it('holding right tilts the rocket right, and the engine then pushes right', () => {
    let r = still({ y: 0.6 });
    for (let i = 0; i < 30; i++) r = stepRocket(r, { main: true, rcs: 1, level: false }, 1 / 60, 0);
    expect(r.a).toBeGreaterThan(0);
    expect(r.vx).toBeGreaterThan(0);
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

  it('the sideways and downward limits tighten as the levels go up', () => {
    expect(landingVx(1)).toBeGreaterThan(landingVx(10));
    expect(landingVy(1)).toBeGreaterThan(landingVy(10));
    expect(touchdown(still({ y: GROUND, vx: landingVx(9) * 1.2 }), 9)).toBe('crashed');
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

describe('speed meter', () => {
  it('reads climbing as negative, falling as positive, and clamps at full scale', () => {
    expect(speedMeter(0).fill).toBe(0);
    expect(speedMeter(-0.1).fill).toBeLessThan(0);
    expect(speedMeter(0.1).fill).toBeGreaterThan(0);
    expect(speedMeter(5).fill).toBe(1);
    expect(speedMeter(-5).fill).toBe(-1);
  });

  it('the landing band is the speeds a touchdown allows, in both directions', () => {
    expect(speedMeter(0).inZone).toBe(true);
    expect(speedMeter(landingVy(1)).inZone).toBe(true);
    expect(speedMeter(-landingVy(1)).inZone).toBe(true);
    expect(speedMeter(landingVy(1) * 1.5).inZone).toBe(false);
    expect(speedMeter(-landingVy(1) * 1.5).inZone).toBe(false);
    expect(speedMeter(landingVy(8) * 1.1, 8).inZone).toBe(false);
    expect(landingVy(1)).toBeGreaterThan(landingVy(5));
    expect(landingVy(5)).toBeGreaterThan(landingVy(40));
  });
});

describe('wind meter', () => {
  it('shows the direction and the force of the wind, up to full scale', () => {
    expect(windMeter(0)).toEqual({ dir: 0, fill: 0 });
    expect(windMeter(0.01).dir).toBe(1);
    expect(windMeter(-0.01).dir).toBe(-1);
    expect(windMeter(0.015).fill).toBeCloseTo(0.5, 6);
    expect(windMeter(1).fill).toBe(1);
  });
});

describe('grid fins', () => {
  it('bite only while the rocket falls fast, and cost no fuel', () => {
    expect(finBite(0)).toBe(0);
    expect(finBite(-0.2)).toBe(0);
    expect(finBite(FIN_MIN)).toBe(0);
    expect(finBite(0.12)).toBeGreaterThan(0);
    expect(finBite(1)).toBe(1);
    const fast = stepRocket(still({ vy: 0.25 }), { ...NONE, fin: 1 }, 0.1, 0);
    expect(fast.w).toBeGreaterThan(0);
    expect(fast.fuel).toBe(1);
    const slow = stepRocket(still({ vy: 0 }), { ...NONE, fin: 1 }, 0.1, 0);
    expect(slow.w).toBe(0);
  });

  it("STICK's fins lean back against a tilt, and rest when upright or slow", () => {
    expect(autoFin(still({ vy: 0.25, a: 0.2 }))).toBe(-1);
    expect(autoFin(still({ vy: 0.25, a: -0.2 }))).toBe(1);
    expect(autoFin(still({ vy: 0.25, a: 0 }))).toBe(0);
    expect(autoFin(still({ vy: 0, a: 0.2 }))).toBe(0);
  });
});

describe('controls', () => {
  it('STICK, PILOT and ENGINEER pay x1, x1.5 and x2, and only STICK keeps the stick', () => {
    expect(CONTROLS.map(c => c.id)).toEqual(['stick', 'pilot', 'engineer']);
    expect(CONTROLS.map(c => c.mult)).toEqual([1, 1.5, 2]);
    expect(CONTROLS.map(c => c.buttons)).toEqual([false, true, true]);
    expect(CONTROLS[DEFAULT_CONTROL].id).toBe('pilot');
    const r = still({ x: 0.5, fuel: 1, vy: 0 });
    expect(landingScore(r, 2, 2)).toBe(landingScore(r, 2) * 2);
    expect(Number.isInteger(landingScore(r, 3, 1.5))).toBe(true);
  });

  it("ENGINEER's turn keeps going until a thruster stops it; the others settle", () => {
    let settled = still({ w: 1 }), kept = still({ w: 1 });
    for (let i = 0; i < 60; i++) {
      settled = stepRocket(settled, NONE, 1 / 60, 0);
      kept = stepRocket(kept, NONE, 1 / 60, 0, { settle: false });
    }
    expect(Math.abs(settled.w)).toBeLessThan(0.5);
    expect(kept.w).toBeCloseTo(1, 6);
  });

  it('LEVEL: always for STICK, three a rocket for PILOT from level 4, never for ENGINEER', () => {
    expect(levelUses('stick', 9)).toBe(Infinity);
    expect(levelUses('pilot', 3)).toBe(Infinity);
    expect(levelUses('pilot', 4)).toBe(3);
    expect(levelUses('engineer', 1)).toBe(0);
  });

  it('a press spends one use and holds while down; none left means no LEVEL', () => {
    let g = { left: 1, active: false };
    let s = gateLevel(g, true); expect(s.on).toBe(true); expect(s.gate.left).toBe(0); g = s.gate;
    s = gateLevel(g, true); expect(s.on).toBe(true); expect(s.gate.left).toBe(0); g = s.gate;
    s = gateLevel(g, false); expect(s.on).toBe(false); g = s.gate;
    s = gateLevel(g, true); expect(s.on).toBe(false);
  });
});

describe('setup card', () => {
  it('up and down pick the row; left and right cycle the controls', () => {
    const c = { row: 1 as const, rocket: 0, control: 1 };
    expect(setupMove(c, 'up').row).toBe(0);
    expect(setupMove(c, 'right').control).toBe(2);
    expect(setupMove(c, 'left').control).toBe(0);
    expect(setupMove({ ...c, control: 2 }, 'right').control).toBe(0);
  });

  it('skips rockets that are not built yet', () => {
    const c = { row: 0 as const, rocket: 0, control: 1 };
    const ready = ROCKETS.filter(r => r.ready).length;
    expect(ready).toBeGreaterThan(0);
    const next = setupMove(c, 'right');
    expect(ROCKETS[next.rocket].ready).toBe(true);
  });
});

describe('at sea', () => {
  it('the first levels land ashore; from the sea level on, the ship', () => {
    expect(atSea(SEA_LEVEL - 1)).toBe(false);
    expect(atSea(SEA_LEVEL)).toBe(true);
    expect(deckAt(1, 3)).toEqual(landDeck(1));
    expect(deckAt(SEA_LEVEL, 0).ship).toBe(true);
  });

  it('the swell builds each sea level, to a cap', () => {
    const a = seaFor(SEA_LEVEL), b = seaFor(SEA_LEVEL + 3), z = seaFor(99);
    expect(b.heave).toBeGreaterThan(a.heave);
    expect(b.roll).toBeGreaterThan(a.roll);
    expect(z.heave).toBeLessThanOrEqual(0.03);
    expect(z.roll).toBeLessThan(0.18);
    expect(shipHalf(99)).toBeGreaterThanOrEqual(0.06);
    expect(shipHalf(SEA_LEVEL)).toBeLessThan(landDeck(1).half);
  });

  it('the deck moves, and its speed is the slope of its path', () => {
    const lvl = SEA_LEVEL + 2, t = 1.3, h = 1e-4;
    const d = deckAt(lvl, t), d2 = deckAt(lvl, t + h);
    expect((d2.y - d.y) / h).toBeCloseTo(d.vy, 3);
    expect((d2.centre - d.centre) / h).toBeCloseTo(d.vx, 3);
    expect(deckAt(lvl, 0.7).y).not.toBe(deckAt(lvl, 2.1).y);
  });

  it('a touchdown is judged against the deck: its speed and its roll', () => {
    const lvl = SEA_LEVEL + 3;
    const d = { ...deckAt(lvl, 0), vy: -0.1, roll: 0.1 };
    // falling at 0.05 onto a deck rising at 0.1 meets it at 0.15: too fast at this level
    const meet = still({ x: d.centre, y: d.y, vy: 0.05, vx: d.vx, a: d.roll });
    expect(touchdown(meet, lvl, d)).toBe('crashed');
    // riding down with it: lands
    const match = still({ x: d.centre, y: d.y, vy: d.vy + 0.02, vx: d.vx, a: d.roll });
    expect(touchdown(match, lvl, d)).toBe('landed');
    // upright on a rolled deck is fine while the difference is inside the limit; tilted against the roll is not
    expect(touchdown({ ...match, a: d.roll + 0.25 }, lvl, d)).toBe('crashed');
  });

  it('missing the ship is a splash; above the deck height nothing happens yet', () => {
    const lvl = SEA_LEVEL;
    const d = deckAt(lvl, 0);
    expect(touchdown(still({ x: d.centre + d.half + 0.05, y: d.y + 0.01 }), lvl, d)).toBe(null);
    expect(touchdown(still({ x: d.centre + d.half + 0.05, y: GROUND }), lvl, d)).toBe('splashed');
  });

  it('a landing at sea scores against the deck it landed on', () => {
    const lvl = SEA_LEVEL;
    const d = { ...deckAt(lvl, 0), centre: 0.6, vy: 0.05 };
    const r = still({ x: 0.6, vy: 0.05 });
    expect(landingScore(r, lvl, 1, d)).toBeGreaterThan(landingScore(still({ x: 0.5, vy: 0.05 }), lvl, 1, d));
  });
});

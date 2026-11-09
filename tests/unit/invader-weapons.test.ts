import { describe, it, expect } from 'vitest';
import {
  DROPS, WEAPON_TIME, MAX_CAPSULES, DROP_CHANCE, RAPID_SHOTS, SPEED_TIME, SPEED_MAX, BLAST_R, CLASH_R,
  volley, canFire, fireGap, rollDrop, pickDrop, catches, tickWeapon, inBeam, bombHitsCapsule, inBlast,
  stackSpeed, tickSpeed, shotSpeedFactor, rollNuke, nukeRows, nukeDepth, NUKE_CHANCE, NUKE_MIN, NUKE_MAX, waveRows, rowType, ROWS_MIN, ROWS_MAX,
} from '../../src/games/invader-force/weapons';

describe('Invader Force weapons', () => {
  it('fires the right volley for each weapon', () => {
    expect(volley('basic', 50, 100)).toHaveLength(1);
    expect(volley('twin', 50, 100).map(s => s.x)).toEqual([47, 53]);
    expect(volley('spread', 50, 100).map(s => Math.sign(s.vx))).toEqual([-1, 0, 1]);
    expect(volley('rapid', 50, 100)).toHaveLength(1);
    expect(volley('pierce', 50, 100)).toHaveLength(0);   // the laser is a beam
  });
  it('keeps one volley in the air, except Rapid', () => {
    for (const w of ['basic', 'twin', 'spread'] as const) {
      expect(canFire(w, 0, 0)).toBe(true);
      expect(canFire(w, 1, 0)).toBe(false);
    }
    expect(canFire('rapid', RAPID_SHOTS - 1, 0)).toBe(true);
    expect(canFire('rapid', RAPID_SHOTS, 0)).toBe(false);
    expect(canFire('rapid', 0, fireGap('rapid'))).toBe(false);
    expect(canFire('pierce', 0, fireGap('pierce'))).toBe(false);
    expect(canFire('pierce', 0, 0)).toBe(true);
  });
  it('drops capsules rarely, and never more than the cap at once', () => {
    expect(rollDrop(0, 0)).toBe(true);
    expect(rollDrop(DROP_CHANCE + 0.001, 0)).toBe(false);
    expect(rollDrop(0, MAX_CAPSULES)).toBe(false);
    expect(55 * DROP_CHANCE).toBeGreaterThan(1);
    expect(55 * DROP_CHANCE).toBeLessThan(2);
  });
  it('never drops the weapon you already hold, but can drop any other', () => {
    const seen = new Set<string>();
    for (let r = 0; r < 1; r += 0.01) { const w = pickDrop(r, 'spread'); expect(w).not.toBe('spread'); seen.add(w); }
    expect(seen.size).toBe(DROPS.length - 1);
    expect(pickDrop(0.9999, 'basic')).toBe(DROPS[DROPS.length - 1]);
  });
  it('catches a capsule that touches the cannon', () => {
    expect(catches({ x: 52, y: 95, w: 'twin' }, 50, 100)).toBe(true);
    expect(catches({ x: 52, y: 80, w: 'twin' }, 50, 100)).toBe(false);   // still above
    expect(catches({ x: 70, y: 98, w: 'twin' }, 50, 100)).toBe(false);   // off to the side
  });
  it('runs a weapon down to the basic cannon after its time', () => {
    let s = tickWeapon('twin', WEAPON_TIME, 1);
    expect(s).toEqual({ w: 'twin', t: WEAPON_TIME - 1 });
    s = tickWeapon(s.w, s.t, WEAPON_TIME);
    expect(s).toEqual({ w: 'basic', t: 0 });
  });
  it('lights every alien in the laser column', () => {
    expect(inBeam(55, 50, 11)).toBe(true);
    expect(inBeam(49, 50, 11)).toBe(true);
    expect(inBeam(70, 50, 11)).toBe(false);
  });
  it('stacks speed boosts, resets the clock each time and caps the stack', () => {
    let s = stackSpeed(0);
    expect(s).toEqual({ level: 1, t: SPEED_TIME });
    s = tickSpeed(s.level, s.t, 30);
    s = stackSpeed(s.level);
    expect(s).toEqual({ level: 2, t: SPEED_TIME });
    for (let i = 0; i < 10; i++) s = stackSpeed(s.level);
    expect(s.level).toBe(SPEED_MAX);
    expect(shotSpeedFactor(2)).toBeGreaterThan(shotSpeedFactor(1));
    expect(tickSpeed(s.level, s.t, SPEED_TIME + 1)).toEqual({ level: 0, t: 0 });
  });
  it('sets off a capsule when a bomb hits it, with a wider blast than a shot clash', () => {
    const c = { x: 40, y: 60, w: 'rapid' as const };
    expect(bombHitsCapsule(44, 58, c)).toBe(true);
    expect(bombHitsCapsule(60, 58, c)).toBe(false);
    expect(BLAST_R).toBeGreaterThan(CLASH_R);
    expect(inBlast(50, 50, 50 + BLAST_R - 1, 45, 11, 8)).toBe(true);
    expect(inBlast(50, 50, 50 + BLAST_R + 2, 45, 11, 8)).toBe(false);
    expect(inBlast(50, 50, 50 + CLASH_R + 2, 45, 11, 8, CLASH_R)).toBe(false);
  });
  it('keeps the atomic bomb rare and out of the ordinary capsule pool', () => {
    expect(DROPS).not.toContain('nuke');
    expect(NUKE_CHANCE).toBeLessThan(DROP_CHANCE / 4);
    expect(rollNuke(0, 0)).toBe(true);
    expect(rollNuke(NUKE_CHANCE, 0)).toBe(false);
  });
  it('wipes out 3 or 4 whole rows around where the nuke hits', () => {
    expect(nukeRows(3, 3, 8)).toEqual([2, 3, 4]);
    expect(nukeRows(3, 4, 8)).toEqual([2, 3, 4, 5]);
    expect(nukeRows(0, 4, 8)).toEqual([0, 1, 2, 3]);   // hit the top row
    expect(nukeRows(7, 4, 8)).toEqual([4, 5, 6, 7]);   // hit the bottom row
    expect(new Set([0, 0.3, 0.6, 0.99].map(nukeDepth))).toEqual(new Set([3, 4]));
    expect(NUKE_MAX).toBeLessThan(ROWS_MIN);
    expect(NUKE_MIN).toBe(3);
  });
  it('grows the formation a row every two waves, within what fits', () => {
    expect(waveRows(1, 999)).toBe(ROWS_MIN);
    expect(waveRows(3, 999)).toBe(ROWS_MIN + 1);
    expect(waveRows(20, 999)).toBe(ROWS_MAX);
    expect(waveRows(20, 60 + 12 * 6)).toBe(6);     // a short screen caps it
    expect(waveRows(20, 10)).toBe(5);               // but never below five
  });
  it('puts a jelly row on top, then beetles, then drones', () => {
    expect([0, 1, 2, 3, 4].map(r => rowType(r, 5))).toEqual([0, 1, 1, 2, 2]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(r => rowType(r, 8))).toEqual([0, 1, 1, 1, 1, 2, 2, 2]);
  });
});

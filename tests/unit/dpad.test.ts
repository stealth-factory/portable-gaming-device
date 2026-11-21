import { describe, it, expect } from 'vitest';
import { DPad, PAD_DEAD, PAD_TILT, nextPadMode, isPadMode, PAD_MODES } from '../../src/console/dpad';

describe('D-pad', () => {
  it('reads the finger against a fixed centre, with a dead spot in the middle', () => {
    const p = new DPad();
    expect(p.down(1, 100, 100, 100 + PAD_DEAD - 1, 100).dir).toBeNull();
    expect(p.move(1, 140, 100).dirs).toEqual(['right']);
    expect(p.move(1, 100, 60).dirs).toEqual(['up']);
    expect(p.move(1, 60, 100).dirs).toEqual(['left']);
    expect(p.move(1, 100, 140).dirs).toEqual(['down']);
  });

  it('does not move with the finger: far past an arm still reads that arm', () => {
    const p = new DPad();
    p.down(1, 0, 0, 300, 0);
    expect(p.move(1, 300, 10).dir).toBe('right');
    expect(p.move(1, -5, 0).dir).toBeNull();   // back in the dead spot
  });

  it('holds two directions between the arms the stronger axis first', () => {
    const p = new DPad();
    p.down(1, 0, 0, 40, 0);
    expect(p.view().dirs).toEqual(['right']);
    expect(p.move(1, 40, -10).dirs).toEqual(['right']);          // about 14°: still one arm
    expect(p.move(1, 40, -30).dirs).toEqual(['right', 'up']);    // about 37°: a diagonal, the arm already held stays first
    expect(p.move(1, 10, -40).dirs).toEqual(['up']);
    const q = new DPad();
    expect(q.down(2, 0, 0, -20, 30).dirs).toEqual(['down', 'left']);
  });

  it('keeps a diagonal near its boundary (hysteresis) but drops it well inside an arm', () => {
    const p = new DPad();
    p.down(1, 0, 0, 40, 30);
    expect(p.view().dirs).toEqual(['right', 'down']);
    expect(p.move(1, 40, 15).dirs).toEqual(['right', 'down']);   // tan ≈ 0.375: under ON, over OFF
    expect(p.move(1, 40, 10).dirs).toEqual(['right']);           // 0.25: under OFF
    expect(p.move(1, 40, 15).dirs).toEqual(['right']);           // has to pass ON again
  });

  it('tilts the cross toward the held arms, never past the limit', () => {
    const p = new DPad();
    const v = p.down(1, 0, 0, 40, 40);
    expect(Math.hypot(v.tx, v.ty)).toBeCloseTo(PAD_TILT);
    expect(v.tx).toBeGreaterThan(0); expect(v.ty).toBeGreaterThan(0);
  });

  it('follows one finger, and a new one takes over', () => {
    const p = new DPad();
    p.down(1, 0, 0, 40, 0);
    expect(p.move(2, -40, 0).dir).toBe('right');
    expect(p.up(2)).toBe(false);
    p.down(3, 0, 0, -40, 0);
    expect(p.dir).toBe('left');
    expect(p.up(3)).toBe(true);
    expect(p.dirs).toEqual([]);
  });

  it('switches STICK ↔ D-PAD; the old 4-WAY and 8-WAY values are not settings any more', () => {
    expect(nextPadMode('stick')).toBe('dpad');
    expect(nextPadMode('dpad')).toBe('stick');
    expect(PAD_MODES.every(isPadMode)).toBe(true);
    expect(isPadMode('dpad8')).toBe(false);
    expect(isPadMode('x')).toBe(false);
  });

  it('reads one diagonal-free direction near an arm, so a game reading stickDir still gets four directions', () => {
    const p = new DPad();
    p.down(1, 0, 0, 40, 30);                                     // a diagonal: right is the stronger axis
    expect(p.dirs).toEqual(['right', 'down']);
    expect(p.dir).toBe('right');
  });
});

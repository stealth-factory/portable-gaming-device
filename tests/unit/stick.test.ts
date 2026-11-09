import { describe, it, expect } from 'vitest';
import { Stick, RIM, DEAD } from '../../src/console/stick';

describe('thumb-stick', () => {
  it('centres where the thumb lands and snaps to four directions past the dead zone', () => {
    const s = new Stick();
    expect(s.down(1, 100, 100).dir).toBeNull();
    expect(s.move(1, 100 + DEAD - 1, 100).dir).toBeNull();
    expect(s.move(1, 130, 100).dir).toBe('right');
    expect(s.move(1, 100, 70).dir).toBe('up');
  });

  it('keeps its axis through diagonal wobble', () => {
    const s = new Stick();
    s.down(1, 0, 0);
    expect(s.move(1, 30, 0).dir).toBe('right');
    expect(s.move(1, 30, 32).dir).toBe('right');   // not far enough off the axis to flip
    expect(s.move(1, 20, 40).dir).toBe('down');
  });

  it('drags the base along once the thumb passes the rim', () => {
    const s = new Stick();
    s.down(1, 0, 0);
    const v = s.move(1, 200, 0);
    expect(v.dx).toBeCloseTo(RIM);
    expect(v.ox).toBeCloseTo(200 - RIM);
    expect(s.move(1, 200 - RIM - 20, 0).dir).toBe('left');
  });

  it('ignores other fingers until its own lifts', () => {
    const s = new Stick();
    s.down(1, 0, 0); s.move(1, 30, 0);
    expect(s.move(2, 0, 50).dir).toBe('right');
    expect(s.up(2)).toBe(false);
    expect(s.dir).toBe('right');
    expect(s.up(1)).toBe(true);
    expect(s.view()).toMatchObject({ id: null, dir: null, dx: 0, dy: 0 });
  });

  it('never locks up when a release is missed: a new touch takes over', () => {
    const s = new Stick();
    s.down(1, 0, 0); s.move(1, 0, 40);
    expect(s.dir).toBe('down');
    // finger 1 slid off the edge and its pointerup never arrived; the next touch must still steer
    const v = s.down(5, 300, 300);
    expect(v).toMatchObject({ id: 5, dir: null, ox: 300, oy: 300 });
    expect(s.move(5, 260, 300).dir).toBe('left');
    expect(s.move(1, 0, 90).dir).toBe('left');   // the lost finger can't steer any more
  });

  it('reset centres it whatever finger was down', () => {
    const s = new Stick();
    s.down(3, 0, 0); s.move(3, 40, 0);
    s.reset();
    expect(s.active).toBe(false);
    expect(s.dir).toBeNull();
  });
});

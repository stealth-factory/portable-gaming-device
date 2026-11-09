import { describe, it, expect, vi } from 'vitest';
import { makeRound, makePickups, roll, pickFrom, makeTimer, makeStack } from '../../../src/kit/play';
import { catches, rollDrop, pickDrop, DROP_CHANCE, MAX_CAPSULES, DROPS, CAPSULE_W, CAPSULE_H } from '../../../src/games/invader-force/weapons';
import { fakeApi } from './fake-api';

describe('round', () => {
  const setup = (times?: object) => {
    const f = fakeApi(), respawn = vi.fn(), nextLevel = vi.fn();
    const round = makeRound(f.api, { respawn, nextLevel, times, clearOnReady: ['fire', 'boost'] });
    return { f, round, respawn, nextLevel };
  };
  it('counts ready down to play, dropping presses on the way', () => {
    const { f, round } = setup();
    f.S.mode = 'ready'; f.S.modeT = 0.5;
    expect(round.tick(0.3)).toBe(false);
    expect(f.cleared).toEqual(['fire', 'boost', 'tap']);
    expect(round.phase).toBe('ready');
    expect(round.tick(0.3)).toBe(false);
    expect(round.phase).toBe('play');
    expect(round.tick(0.016)).toBe(true);
  });
  it('clears to the next level after the clear time', () => {
    const { f, round, nextLevel } = setup();
    round.clear();
    expect([f.S.mode, f.S.modeT]).toEqual(['clear', 1.8]);
    round.tick(1.9);
    expect([f.S.mode, f.S.modeT, f.S.level, nextLevel.mock.calls.length]).toEqual(['ready', 1.2, 2, 1]);
    round.clear({ secs: 2.2 });
    expect(f.S.modeT).toBe(2.2);
  });
  it('respawns after a lost life, and ends the game on the last', () => {
    const { f, round, respawn } = setup({ dying: 1.6 });
    round.lose();
    expect([f.S.mode, f.S.modeT, f.S.lives]).toEqual(['dying', 1.6, 2]);
    expect(round.tick(1)).toBe(false);
    round.tick(1);
    expect([f.S.mode, f.S.modeT, respawn.mock.calls.length]).toEqual(['ready', 0.9, 1]);
    round.lose({ fatal: true });
    expect(f.S.lives).toBe(0);
    round.tick(2);
    expect(f.state.finished).toBe(1);
  });
  it('does nothing outside its own modes', () => {
    const { f, round } = setup();
    f.S.mode = 'over';
    expect(round.tick(1)).toBe(false);
    expect(round.phase).toBe(null);
  });
});

describe('pickups', () => {
  const make = () => {
    const f = fakeApi({ LH: 200 }), drawn: string[] = [];
    const p = makePickups<string>(f.api, { size: { w: CAPSULE_W, h: CAPSULE_H }, speed: 32, max: MAX_CAPSULES, draw: k => drawn.push(k) });
    return { f, p, drawn };
  };
  it('drops up to max, unless forced', () => {
    const { p } = make();
    expect([p.drop(0, 0, 'a'), p.drop(0, 0, 'b'), p.drop(0, 0, 'c')]).toEqual([true, true, false]);
    expect(p.drop(0, 0, 'saucer', true)).toBe(true);
    expect(p.falling).toBe(3);
  });
  it('catches exactly when Invader Force\'s catches() does', () => {
    const cannon = { x: 50, y: 186, w: 13, h: 7 };
    for (const x of [36, 37, 42, 62, 63]) for (const y of [170, 179, 180, 186, 192, 193]) {
      const { p } = make();
      p.drop(x, y, 'twin');
      expect(p.update(0, cannon).length > 0).toBe(catches({ x, y, w: 'twin' }, cannon.x, cannon.y));
    }
  });
  it('falls, drops off the floor, draws, and can be taken by a box', () => {
    const { p, drawn } = make();
    p.drop(10, 100, 'a'); p.drop(40, 195, 'b');
    expect(p.update(0.25, null)).toEqual([]);
    expect(p.list.map(q => q.y)).toEqual([108]);
    p.draw(); expect(drawn).toEqual(['a']);
    expect(p.take({ x: 0, y: 0, w: 5, h: 5 })).toEqual([]);
    expect(p.take({ x: 12, y: 110, w: 2, h: 2 }).map(q => q.kind)).toEqual(['a']);
    p.drop(0, 0, 'c'); p.remove(p.list[0]); expect(p.falling).toBe(0);
    p.drop(0, 0, 'd'); p.clear(); expect(p.falling).toBe(0);
  });
  it('rolls and picks like Invader Force\'s weapons.ts', () => {
    for (const r of [0, 0.01, 0.0279, 0.03, 0.5]) for (const n of [0, 1, 2]) expect(roll(r, DROP_CHANCE, n, MAX_CAPSULES)).toBe(rollDrop(r, n));
    for (const r of [0, 0.2, 0.5, 0.99]) for (const w of ['basic', 'twin', 'pierce'] as const) expect(pickFrom(DROPS, r, w)).toBe(pickDrop(r, w));
    expect(pickFrom(['x', 'y'], 0.99)).toBe('y');
  });
});

describe('timers', () => {
  it('runs a timed power-up out', () => {
    const t = makeTimer();
    expect(t.tick(1)).toBe('idle');
    t.set(12);
    expect(t.tick(6)).toBe('running');
    expect(t.frac(12)).toBe(0.5);
    expect(t.tick(6)).toBe('expired');
    expect([t.left, t.tick(1)]).toEqual([0, 'idle']);
    t.set(5); t.stop(); expect(t.left).toBe(0);
    expect(t.frac(0)).toBe(0);
  });
  it('stacks up to max on one clock that every bump resets', () => {
    const s = makeStack(5, 60);
    expect(s.tick(1)).toBe('idle');
    for (let i = 0; i < 7; i++) s.bump();
    expect([s.level, s.left]).toEqual([5, 60]);
    s.tick(30); s.bump();
    expect(s.left).toBe(60);
    expect(s.tick(61)).toBe('expired');
    expect(s.level).toBe(0);
    s.bump(); s.stop(); expect([s.level, s.left]).toEqual([0, 0]);
  });
});

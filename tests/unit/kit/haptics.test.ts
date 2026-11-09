import { describe, it, expect } from 'vitest';
import { makeHaptics, toPattern, patternLength, PATTERNS, MAX_STEP, MAX_STEPS } from '../../../src/kit/platform/haptics';
import { makeRound, makePickups } from '../../../src/kit/play';
import { fakeApi } from './fake-api';

function rig(opts: { on?: boolean; can?: boolean } = {}){
  const played: number[][] = [], clock = { t: 1000 }, sw = { on: opts.on ?? true };
  const h = makeHaptics({
    vibrate: p => { if (opts.can === false) return false; played.push(p); return true; },
    enabled: () => sw.on,
    now: () => clock.t,
  });
  return { h, played, clock, sw };
}

describe('haptics patterns', () => {
  it('names the console\'s buzzes: a tick, a short shot, a double buzz on a catch, a long one for a life and the game', () => {
    expect(toPattern('tick')).toEqual([...PATTERNS.tick]);
    expect(patternLength(toPattern('fire')!)).toBeLessThan(patternLength(toPattern('lose')!));
    expect(toPattern('pickup')).toHaveLength(3);
    expect(patternLength(toPattern('over')!)).toBeGreaterThan(patternLength(toPattern('lose')!));
  });
  it('takes a length or a pattern, and tidies it', () => {
    expect(toPattern(30)).toEqual([30]);
    expect(toPattern([10.4, 20, 30])).toEqual([10, 20, 30]);
    expect(toPattern([5000])).toEqual([MAX_STEP]);
    expect(toPattern([-4, 10, 20])).toEqual([0, 10, 20]);
    expect(toPattern([10, 50])).toEqual([10]);              // a trailing pause is dropped
    expect(toPattern(Array(20).fill(5))!.length).toBeLessThanOrEqual(MAX_STEPS);
  });
  it('has nothing to feel for zero, an empty pattern or an unknown name', () => {
    expect(toPattern(0)).toBeNull();
    expect(toPattern([])).toBeNull();
    expect(toPattern([0, 40, 0])).toBeNull();
    expect(toPattern('nope' as any)).toBeNull();
    expect(toPattern(NaN)).toBeNull();
  });
});

describe('haptics rules', () => {
  it('buzzes when SOUND is on', () => {
    const { h, played } = rig();
    expect(h.buzz('fire')).toBe(true);
    expect(played).toEqual([[...PATTERNS.fire]]);
  });
  it('stays still with SOUND off', () => {
    const { h, played, sw } = rig({ on: false });
    expect(h.buzz('lose')).toBe(false);
    sw.on = true;
    expect(h.buzz('lose')).toBe(true);
    expect(played).toHaveLength(1);
  });
  it('does nothing where the hardware can\'t vibrate, or throws', () => {
    expect(rig({ can: false }).h.buzz('over')).toBe(false);
    const h = makeHaptics({ vibrate: () => { throw new Error('no'); }, enabled: () => true, now: () => 0 });
    expect(h.buzz('tick')).toBe(false);
  });
  it('never cuts a longer buzz short with a shorter one, but lets one through once it has run', () => {
    const { h, played, clock } = rig();
    h.buzz('lose');
    clock.t += 20; expect(h.buzz('fire')).toBe(false);     // a shot during the lost life's buzz
    expect(h.buzz('over')).toBe(true);                     // a longer one takes over
    clock.t += patternLength(toPattern('over')!) + 1;
    expect(h.buzz('fire')).toBe(true);
    expect(played.map(p => patternLength(p))).toEqual([160, patternLength(toPattern('over')!), 14]);
  });
  it('keeps no state between two instances', () => {
    const a = rig(), b = rig();
    a.h.buzz('over');
    expect(b.h.buzz('tick')).toBe(true);
  });
});

describe('the play layer buzzes through the api', () => {
  it('buzzes on a lost life', () => {
    const f = fakeApi();
    const round = makeRound(f.api, { respawn(){}, nextLevel(){} });
    round.lose();
    expect(f.buzzes).toEqual(['lose']);
  });
  it('buzzes once on a catch, not on a miss', () => {
    const f = fakeApi();
    const caps = makePickups<string>(f.api, { size: { w: 4, h: 4 }, speed: 10, max: 3, draw(){} });
    caps.drop(10, 10, 'twin');
    caps.update(0.01, { x: 100, y: 100, w: 10, h: 4 });
    expect(f.buzzes).toEqual([]);
    caps.drop(12, 10, 'spread');
    caps.update(0.01, { x: 0, y: 8, w: 30, h: 8 });
    expect(f.buzzes).toEqual(['pickup']);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { clamp, rnd, pick, blink, overlaps, pointIn, boxInCircle, sweep, drawSprite, spriteW, spriteH, sprites, play, horizontal, pressed, consume } from '../../../src/kit/play';
import { inBlast } from '../../../src/games/invader-force/weapons';
import { fakeApi } from './fake-api';

afterEach(() => { vi.restoreAllMocks(); });

describe('maths', () => {
  it('clamps', () => { expect(clamp(5, 0, 3)).toBe(3); expect(clamp(-1, 0, 3)).toBe(0); expect(clamp(2, 0, 3)).toBe(2); });
  it('rnd spans a..b', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(rnd(2, 4)).toBe(3);
  });
  it('pick takes an element by Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(pick(['a', 'b', 'c'])).toBe('c');
  });
  it('blinks on the even half', () => { expect(blink(0.1, 2)).toBe(true); expect(blink(0.6, 2)).toBe(false); });
});

describe('collide', () => {
  const b = { x: 10, y: 10, w: 5, h: 5 };
  it('overlaps, but not on touching edges', () => {
    expect(overlaps(b, { x: 14, y: 14, w: 2, h: 2 })).toBe(true);
    expect(overlaps(b, { x: 15, y: 10, w: 2, h: 2 })).toBe(false);
  });
  it('pointIn takes the left/top edge and not the right/bottom', () => {
    expect(pointIn(10, 10, b)).toBe(true);
    expect(pointIn(15, 12, b)).toBe(false);
  });
  it('boxInCircle matches Invader Force\'s inBlast', () => {
    for (const [cx, cy, r] of [[0, 0, 5], [12, 30, 16], [20, 20, 3], [8, 12, 2]]) {
      expect(boxInCircle(cx, cy, r, b)).toBe(inBlast(cx, cy, b.x, b.y, b.w, b.h, r));
    }
  });
  it('sweep stops at the first hit and never skips a thin target', () => {
    const r = sweep({ x: 0, y: 100 }, 0, -100, 2, (_x, y) => y <= 50.5 && y >= 49.5);
    expect(r.hit).toBe(true);
    expect(r.y).toBeCloseTo(50, 0);
    expect(sweep({ x: 0, y: 0 }, 10, 0, 3, () => false)).toEqual({ x: 10, y: 0, hit: false });
  });
});

describe('sprite', () => {
  const ART = ['#.#', '.#.'];
  it('draws one pixel per ink character, rounded, in the role\'s colour', () => {
    const f = fakeApi();
    drawSprite(f.api, ART, 1.4, 2.6, 'gold');
    expect(f.rects.map(r => [r.x, r.y, r.style])).toEqual([[1, 3, 'c:gold'], [3, 3, 'c:gold'], [2, 4, 'c:gold']]);
  });
  it('draws a multi-colour sprite from a role map', () => {
    const f = fakeApi();
    drawSprite(f.api, ['#o', 'o#'], 0, 0, { '#': 'cart', o: 'text' });
    expect(f.pixels('c:cart')).toEqual(new Set(['0,0', '1,1']));
    expect(f.pixels('c:text')).toEqual(new Set(['1,0', '0,1']));
  });
  it('measures, and binds to the api', () => {
    expect([spriteW(ART), spriteH(ART), spriteW([])]).toEqual([3, 2, 0]);
    const f = fakeApi();
    sprites(f.api).sprite(ART, 0, 0, 'gold');
    expect(f.rects).toHaveLength(3);
  });
});

describe('jingles', () => {
  it('plays each note a gap apart', () => {
    const f = fakeApi();
    play(f.api, { notes: [523, 659, 784], dur: 0.08, vol: 0.05, gap: 0.07 });
    expect(f.tones).toEqual([[523, 0.08, 0.05, 0, 0], [659, 0.08, 0.05, 0, 0.07], [784, 0.08, 0.05, 0, 0.14]]);
  });
});

describe('controls', () => {
  it('reads the stick before the newest left/right key', () => {
    const f = fakeApi();
    expect(horizontal(f.api)).toBe(0);
    f.state.held.push('left', 'up', 'right');
    expect(horizontal(f.api)).toBe(1);
    f.state.stickDir = 'left';
    expect(horizontal(f.api)).toBe(-1);
    f.state.stickDir = 'up';
    expect(horizontal(f.api)).toBe(1);
  });
  it('sees presses on any of the slots, and taps when asked, then consumes them', () => {
    const f = fakeApi();
    expect(pressed(f.api, ['fireL', 'fire'])).toBe(false);
    f.press('fireL');
    expect(pressed(f.api, ['fire', 'fireL'])).toBe(true);
    expect(pressed(f.api, 'fire')).toBe(false);
    f.state.tapQueued = true;
    expect(pressed(f.api, 'fire', true)).toBe(true);
    consume(f.api, ['fire', 'fireL'], true);
    expect(f.cleared).toEqual(['fire', 'fireL', 'tap']);
    expect(pressed(f.api, ['fire', 'fireL'], true)).toBe(false);
  });
});

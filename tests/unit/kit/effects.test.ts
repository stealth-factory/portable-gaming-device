import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeFx, makeWalls, makeScore, drawHud, badgesWidth } from '../../../src/kit/play';
import { fakeApi } from './fake-api';

afterEach(() => { vi.restoreAllMocks(); });
const DOT = ['#'];

describe('fx', () => {
  it('runs bursts and pops down and drops them when their time is up', () => {
    const f = fakeApi(), fx = makeFx(f.api);
    fx.burst(1, 1, 0.2, DOT); fx.pop('100', 5, 5);
    expect(fx.count).toBe(2);
    fx.update(0.3);
    expect(fx.count).toBe(1);
    fx.update(0.6);
    expect(fx.count).toBe(0);
  });
  it('blinks a burst between spark and gold by default, or uses the role given', () => {
    const f = fakeApi(), fx = makeFx(f.api);
    fx.burst(0, 0, 0.1, DOT); fx.burst(2, 0, 0.5, DOT, 'cart'); fx.burst(4, 0, 0.5, DOT, t => (t > 0.2 ? 'text' : 'gem'));
    fx.draw();
    expect(f.rects.map(r => r.style)).toEqual(['c:spark', 'c:cart', 'c:text']);
  });
  it('draws pops as text, and stacks them over labels still showing', () => {
    const f = fakeApi(), fx = makeFx(f.api);
    const stack = { step: 9, within: 46 };
    expect(fx.pop('TWIN', 10, 100, { stack })).toBe(100);
    expect(fx.pop('SPEED x1', 10, 100, { stack })).toBe(91);
    expect(fx.pop('far', 10, 10)).toBe(10);
    expect(fx.pop('NUKE', 10, 100, { stack, role: 'text' })).toBe(82);
    fx.draw();
    expect(f.texts.map(t => [t.s, t.y, t.role])).toEqual([['TWIN', 100, 'gold'], ['SPEED x1', 91, 'gold'], ['far', 10, 'gold'], ['NUKE', 82, 'text']]);
  });
  it('races a ring out to its radius, under everything else', () => {
    const f = fakeApi(), fx = makeFx(f.api);
    fx.burst(0, 0, 1, DOT, 'spark');
    fx.ring(50, 50, 16, 0.5, 'gold', 4);
    fx.update(0.0001);
    fx.draw();
    expect(f.rects[0].style).toBe('c:gold');
    expect(f.rects.at(-1)!.style).toBe('c:spark');
    f.reset(); fx.update(0.4999 - 0.0001); fx.draw();
    const xs = f.rects.filter(r => r.style === 'c:gold').map(r => r.x);
    expect(Math.max(...xs)).toBe(66);
    fx.clear(); expect(fx.count).toBe(0);
  });
});

describe('walls', () => {
  const BLOCK = ['####', '####', '####', '####'];
  it('builds walls from string art and lays a row evenly across the tube', () => {
    const f = fakeApi({ LW: 100 }), w = makeWalls(f.api);
    w.add(0, 0, ['#.', '.#']);
    expect([w.solid(0, 0), w.solid(1, 0), w.solid(1, 1), w.solid(5, 5)]).toEqual([true, false, true, false]);
    w.clear();
    w.row(3, 50, BLOCK);
    expect(w.list.map(x => x.x)).toEqual([22, 48, 74]);   // gap (100 - 12) / 4 = 22, then every 4 + 22
    expect(w.list.every(x => x.y === 50)).toBe(true);
  });
  it('bites a hole round a hit on solid wall, and misses open air', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const f = fakeApi(), w = makeWalls(f.api);
    w.add(10, 10, ['########', '########', '########', '########', '########']);
    expect(w.bite(5, 5)).toBe(false);
    expect(w.bite(13, 12, 1)).toBe(true);
    expect([w.solid(13, 12), w.solid(12, 11), w.solid(14, 13), w.solid(15, 12)]).toEqual([false, false, false, true]);
    expect(w.bite(13, 12)).toBe(false);            // already a hole
  });
  it('spares pixels when the dice say so', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const f = fakeApi(), w = makeWalls(f.api);
    w.add(0, 0, BLOCK);
    expect(w.bite(1, 1)).toBe(true);
    expect(w.solid(1, 1)).toBe(true);
  });
  it('blasts a disc out of every wall and chews through a box', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const f = fakeApi(), w = makeWalls(f.api);
    w.add(0, 0, BLOCK); w.add(10, 0, BLOCK);
    w.blast(7, 1, 4);
    expect([w.solid(3, 1), w.solid(0, 3), w.solid(10, 1), w.solid(13, 3)]).toEqual([false, true, false, true]);
    w.chew({ x: 10, y: 0, w: 4, h: 4 });
    expect([10, 11, 12, 13].some(x => [0, 1, 2, 3].some(y => w.solid(x, y)))).toBe(false);
  });
  it('draws each solid pixel in the role\'s colour', () => {
    const f = fakeApi(), w = makeWalls(f.api);
    w.add(3, 4, ['#.', '##']);
    w.draw('gem');
    expect(f.pixels('c:gem')).toEqual(new Set(['3,4', '3,5', '4,5']));
  });
});

describe('score', () => {
  it('adds points, keeps the best and gives a life at each threshold', () => {
    const f = fakeApi(), onExtra = vi.fn(), fx = makeFx(f.api);
    const sc = makeScore(f.api, { extraEvery: 1500, fx, onExtra });
    sc.reset();
    expect([f.S.score, sc.nextLife]).toEqual([0, 1500]);
    sc.add(1000);
    expect([f.S.score, f.api.best, f.S.lives]).toEqual([1000, 1000, 3]);
    sc.add(600, 10, 20);
    expect([f.S.lives, sc.nextLife, f.S.nextLife, onExtra.mock.calls.length, fx.count]).toEqual([4, 3000, 3000, 1, 1]);
    f.api.best = 99999; sc.add(10);
    expect(f.api.best).toBe(99999);
  });
  it('stops at maxLives but still moves the threshold', () => {
    const f = fakeApi(), sc = makeScore(f.api, { extraEvery: 100, maxLives: 3 });
    sc.reset(); sc.add(100);
    expect([f.S.lives, sc.nextLife]).toEqual([3, 200]);
  });
});

describe('hud', () => {
  const MINI = ['#'];
  it('draws score, HI, the right text, spare lives and the rule', () => {
    const f = fakeApi({ LW: 320 });
    f.S.score = 42; f.api.best = 900; f.S.lives = 3;
    drawHud(f.api, { right: 'WAVE 2', lives: { art: MINI, role: 'cart' } });
    expect(f.texts.map(t => t.s)).toEqual(['000042', 'WAVE 2', 'HI 000900']);
    expect(f.texts[1]).toMatchObject({ x: 314, align: 'right' });
    expect([...f.pixels('c:cart')]).toEqual(['252,6', '262,6']);   // LW − 12 − 36 − 20, two spares
    expect(f.rects.filter(r => r.style === 'c:hud' && r.y === 16)).toHaveLength(80);
  });
  it('shows every life while dying, and no HI on a narrow tube', () => {
    const f = fakeApi({ LW: 240 });
    f.S.mode = 'dying'; f.S.lives = 2;
    drawHud(f.api, { right: 'W', lives: { art: MINI, role: 'cart' } });
    expect(f.pixels('c:cart').size).toBe(2);
    expect(f.texts.some(t => t.s.startsWith('HI'))).toBe(false);
  });
  it('fits badges after HI, or in its place when they would reach the lives', () => {
    const f = fakeApi({ LW: 320 });
    drawHud(f.api, { right: 'WAVE 1', badges: [{ text: 'TWIN', role: 'gold', frac: 0.5 }] });
    expect(f.texts.find(t => t.s === 'TWIN')!.x).toBe(142);
    expect(f.texts.some(t => t.s.startsWith('HI'))).toBe(true);
    expect(f.rects.find(r => r.style === 'c:gold')).toMatchObject({ x: 142, y: 14, w: 12 });
    f.reset();
    drawHud(f.api, { right: 'WAVE 1', badges: [{ text: 'SPREAD', role: 'gold' }, { text: 'NUKE', role: 'text' }, { text: '>5', role: 'spark' }, { text: 'XXXXXXXXXX', role: 'gem' }] });
    expect(f.texts.some(t => t.s.startsWith('HI'))).toBe(false);
    expect(f.texts.find(t => t.s === 'SPREAD')!.x).toBe(48);
    expect(f.texts.find(t => t.s === 'NUKE')!.x).toBe(48 + 42);
    expect(badgesWidth([{ text: 'AB', role: 'x' }])).toBe(18);
  });
  it('leaves out badges that would run into the lives on a narrow tube', () => {
    const f = fakeApi({ LW: 240 });
    f.S.lives = 6;
    drawHud(f.api, { right: 'WAVE 1', lives: { art: MINI, role: 'cart' }, badges: [{ text: 'SPREAD', role: 'gold' }, { text: 'NUKE', role: 'text' }, { text: 'SHIELD', role: 'gem' }] });
    const livesX = Math.min(...[...f.pixels('c:cart')].map(p => Number(p.split(',')[0])));
    expect(livesX).toBe(142);
    expect(f.texts.map(t => t.s)).toEqual(['000000', 'WAVE 1', 'SPREAD', 'NUKE']);
    for (const t of f.texts.filter(t => t.s === 'SPREAD' || t.s === 'NUKE')) expect(t.x + t.s.length * 6).toBeLessThanOrEqual(livesX - 4);
  });
  it('blinks a badge', () => {
    const f = fakeApi();
    f.S.time = 0.1; drawHud(f.api, { right: 'X', badges: [{ text: 'NUKE', role: 'text', blink: 3 }] });
    expect(f.texts.some(t => t.s === 'NUKE')).toBe(false);
    f.reset(); f.S.time = 0.4; drawHud(f.api, { right: 'X', badges: [{ text: 'NUKE', role: 'text', blink: 3 }] });
    expect(f.texts.some(t => t.s === 'NUKE')).toBe(true);
  });
});

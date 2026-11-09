import { describe, expect, it } from 'vitest';
import create from '../../src/games/bricks/game';
import type { ConsoleAPI, Dir } from '../../src/games/types';

function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function harness() {
  const buttons: Record<string, { label: string; enabled: boolean; queued: boolean; held: boolean }> = {};
  const held: Dir[] = [];
  const S = { mode: 'ready', modeT: 1.2, time: 0, score: 0, level: 1, lives: 3, nextLife: 20000 };
  const g = { fillStyle: '', fillRect() {} };
  const api = {
    g, LW: 360, LH: 260, HUD: 20, W: 15, H: 10, C: 32, K: 24 / 32, S, best: 0,
    col: () => '#fff',
    txt() {}, banner() {}, tone() {}, buzz() {}, track() {}, fitGrid() {},
    mulberry32, finishGame() { S.mode = 'over'; },
    get held() { return held; },
    stickDir: null as Dir | null,
    get fireQueued() { return !!buttons.fire?.queued; },
    get tapQueued() { return false; },
    button: (id: string) => buttons[id] ?? { label: id, enabled: false, queued: false, held: false },
    clearButton(id: string) { if (buttons[id]) buttons[id].queued = false; },
    clearFire() { if (buttons.fire) buttons.fire.queued = false; },
    clearTap() {}, clearBoost() {},
    setButtons() {},
  } as unknown as ConsoleAPI;
  const runtime = create(api);
  const pressFire = () => { buttons.fire = { label: 'serve', enabled: true, queued: true, held: false }; };
  return { api, S, runtime, held, pressFire };
}

describe('a played wave', () => {
  it('waits to serve, then breaks clay and can drop the ember', () => {
    const { S, runtime, held, pressFire } = harness();
    runtime.start();
    S.mode = 'ready'; S.modeT = 1.2;
    for (let i = 0; i < 80; i++) runtime.update(1 / 60);
    const sitting = runtime.debug!.state();
    expect(S.mode).toBe('play');
    expect(sitting.served).toBe(false);
    expect(sitting.vx).toBe(0);
    expect(sitting.kinds.clay).toBeGreaterThan(0);
    expect(sitting.kinds.kiln).toBe(0);
    pressFire();
    runtime.update(1 / 60);
    const flying = runtime.debug!.state();
    expect(flying.served).toBe(true);
    expect(flying.vy).toBeLessThan(0);
    held.push('left');
    let broke = false;
    for (let i = 0; i < 60 * 20 && !broke; i++) {
      runtime.update(1 / 60);
      const s = runtime.debug!.state();
      if (s.bricks < sitting.bricks) broke = true;
    }
    expect(broke).toBe(true);
    held.length = 0;
    const park = runtime.debug!.state();
    // park the bat in a corner and let the ember fall
    for (let i = 0; i < 60 * 8; i++) {
      const s = runtime.debug!.state();
      if (s.px > 3) held.splice(0, held.length, 'left');
      else held.length = 0;
      runtime.update(1 / 60);
      if (runtime.debug!.state().lives < park.lives) break;
    }
    expect(runtime.debug!.state().lives).toBeLessThan(park.lives);
  });

  it('breaks a kiln once the second wave is up', () => {
    const { S, runtime, held, pressFire } = harness();
    runtime.start();
    S.mode = 'ready'; S.modeT = 0.05;
    const follow = (frame: number) => {
      const s = runtime.debug!.state();
      held.length = 0;
      const centre = s.px + s.bw / 2;
      const falling = s.served && s.vy > 0;
      const land = falling ? s.bx + 2 + s.vx * Math.max(0, (s.py - (s.by + 4)) / s.vy) : s.bx + 2;
      const mean = s.left.length
        ? s.left.reduce((sum: number, b: { c: number }) => sum + b.c, 0) / s.left.length
        : 7;
      const want = 12 + mean * 24 + 12;
      const nudge = (want - land) * 0.15 + Math.sin(frame / 25) * 18;
      const target = falling ? land - nudge : land;
      if (target < centre - 3) held.push('left');
      else if (target > centre + 3) held.push('right');
    };
    let served = false;
    let kilnAtWave = -1;
    let brokeKiln = false;
    for (let i = 0; i < 60 * 300 && !brokeKiln; i++) {
      follow(i);
      const before = runtime.debug!.state();
      if (S.mode === 'play' && !before.served && !served) { pressFire(); served = true; }
      if (S.mode !== 'play') served = false;
      runtime.update(1 / 60);
      const after = runtime.debug!.state();
      if (after.wave >= 2 && kilnAtWave < 0) kilnAtWave = after.kinds.kiln;
      if (kilnAtWave > 0 && after.wave >= 2 && after.kinds.kiln < kilnAtWave) brokeKiln = true;
    }
    expect(kilnAtWave).toBeGreaterThan(0);
    expect(brokeKiln).toBe(true);
  });

  it('bows while up or down is held, slides only left and right, and eases back', () => {
    const { S, runtime, held } = harness();
    runtime.start();
    S.mode = 'play';
    const parked = runtime.debug!.state();
    held.push('up');
    for (let i = 0; i < 40; i++) runtime.update(1 / 60);
    const up = runtime.debug!.state();
    expect(up.bend).toBeGreaterThan(0.8);
    expect(up.px).toBeCloseTo(parked.px, 1);
    held.splice(0, held.length, 'down');
    for (let i = 0; i < 40; i++) runtime.update(1 / 60);
    expect(runtime.debug!.state().bend).toBeLessThan(-0.8);
    held.length = 0;
    const full = runtime.debug!.state().bend;
    for (let i = 0; i < 8; i++) runtime.update(1 / 60);
    const easing = runtime.debug!.state().bend;
    expect(easing).toBeGreaterThan(full);
    expect(easing).toBeLessThan(-0.15);
    for (let i = 0; i < 90; i++) runtime.update(1 / 60);
    expect(runtime.debug!.state().bend).toBe(0);
    held.push('right');
    runtime.update(1 / 60);
    expect(runtime.debug!.state().px).toBeGreaterThan(parked.px);
  });

  it('catches a capsule and lets a new size replace the last', () => {
    const { S, runtime } = harness();
    runtime.start();
    S.mode = 'play';
    const base = runtime.debug!.state().bw;
    runtime.debug!.drop('broad');
    runtime.update(1 / 60);
    const wide = runtime.debug!.state();
    expect(wide.size).toBe('broad');
    expect(wide.bw).toBe(Math.round(base * 1.5));
    expect(wide.drops).toEqual([]);
    runtime.debug!.drop('slim');
    runtime.update(1 / 60);
    const slim = runtime.debug!.state();
    expect(slim.size).toBe('slim');
    expect(slim.bw).toBe(Math.round(base * 0.6));
    runtime.debug!.drop('sear');
    runtime.update(1 / 60);
    expect(runtime.debug!.state().sear).toBe(3);
    expect(runtime.debug!.state().size).toBe('slim');
  });
});

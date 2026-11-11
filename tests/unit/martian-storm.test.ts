import { describe, expect, it } from 'vitest';
import create from '../../src/games/martian-storm/game';
import { strings } from '../../src/games/martian-storm/strings';
import { disk } from '../../src/games/martian-storm/disk';
import type { ConsoleAPI, Dir } from '../../src/games/types';
import {
  BARB_HP, BOMB_CAP, BOMB_DMG, BOMBS_START, SPEED_MAX, HEART_CAP, HEARTS_START, LEG_CLOCK, LIFE_CAP, SHOT_CAP, SKIFF_SPEED, SLAB_HP, SLAB_WAIT, TUCK_CAP, TUCK_SECS,
  WEAPON_MAX, barbCount, beatFits, beatGap, beatSchedule, capsuleWeapon, arsenalLabel, catchGift, catchGun, damage, dropFor, gunsOf, skiffSpeed, spendBomb,
  flightCount, flightOffsets, flightVelocity, hpFor, landingBonus, legReward, missileSalvo, offerToken, onSporeGone,
  pelletSpeed, scrollSpeed, insetBox, skiffVelocity, slabCount, spendTuck, steerMissile, takeHit, touchBox, tuckCovers,
  volley, volleyFits,
} from '../../src/games/martian-storm/rules';
import type { Weapon } from '../../src/games/martian-storm/rules';
import {
  BARB, BARB_H, BARB_W, SKIFF_H, SKIFF_W, SLAB, SLAB_H, SLAB_W, SPORE, SPORE_H, SPORE_W,
} from '../../src/games/martian-storm/art';
import type { BeatKind, FlightState } from '../../src/games/martian-storm/rules';

/** The console's generator, copied so these tests never import src/console. */
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
  let stick: Dir | null = null;
  const S = { mode: 'ready', modeT: 1.2, time: 0, score: 0, level: 1, lives: 3, nextLife: 20000, boost: 0, boostT: 1, charge: 0 };
  const g = { fillStyle: '', fillRect() {} };
  const api = {
    g, LW: 360, LH: 260, HUD: 20, W: 15, H: 10, C: 32, K: 24 / 32, S, best: 0,
    col: () => '#fff',
    txt() {}, banner() {}, tone() {}, buzz() {}, track() {}, fitGrid() {},
    mulberry32,
    finishGame() { S.mode = 'over'; },
    get held() { return held; },
    get stickDir() { return stick; },
    get fireHeld() { return !!buttons.fire?.held; },
    get fireQueued() { return !!buttons.fire?.queued; },
    get boostQueued() { return !!buttons.boost?.queued; },
    get boostHeld() { return !!buttons.boost?.held; },
    get tapHeld() { return false; },
    get tapQueued() { return false; },
    button: (id: string) => buttons[id] ?? { label: id, enabled: false, queued: false, held: false },
    clearButton(id: string) { if (buttons[id]) buttons[id].queued = false; },
    clearFire() { if (buttons.fire) buttons.fire.queued = false; },
    clearBoost() { if (buttons.boost) buttons.boost.queued = false; },
    clearTap() {},
    setButtons() {},
  } as unknown as ConsoleAPI;
  const runtime = create(api);
  const pressBoost = () => { buttons.boost = { label: 'msLoop', enabled: true, queued: true, held: true }; };
  const releaseBoost = () => { if (buttons.boost) { buttons.boost.held = false; buttons.boost.queued = false; } };
  const repeatBoost = () => { if (buttons.boost) buttons.boost.queued = true; };
  const tapFire = () => { buttons.fire = { label: 'spark', enabled: true, queued: true, held: false }; };
  const tapBomb = () => { buttons.fireR = { label: 'msBomb', enabled: true, queued: true, held: false }; };
  return { api, S, runtime, held, pressBoost, releaseBoost, repeatBoost, tapFire, tapBomb, setStick: (d: Dir | null) => { stick = d; } };
}

function play(runtime: ReturnType<typeof harness>['runtime'], S: { mode: string; modeT: number }) {
  runtime.start();
  S.mode = 'ready';
  S.modeT = 0.05;
  for (let i = 0; i < 8; i++) runtime.update(1 / 60);
}

describe('skiff movement', () => {
  it('scales a keyboard diagonal so it is no faster than one axis', () => {
    const diagonal = skiffVelocity(['right', 'up'], null);
    expect(diagonal.vx).toBeCloseTo(SKIFF_SPEED / Math.SQRT2);
    expect(diagonal.vy).toBeCloseTo(-SKIFF_SPEED / Math.SQRT2);
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(SKIFF_SPEED);
    expect(skiffVelocity(['down'], null)).toEqual({ vx: 0, vy: SKIFF_SPEED });
  });

  it('flies faster with each speed pickup, up to three', () => {
    expect(skiffSpeed(0)).toBe(SKIFF_SPEED);
    expect(skiffSpeed(1)).toBeGreaterThan(SKIFF_SPEED);
    expect(skiffSpeed(SPEED_MAX + 2)).toBe(skiffSpeed(SPEED_MAX));
    expect(skiffVelocity(['left'], null, 120)).toEqual({ vx: -120, vy: 0 });
    expect(skiffVelocity([], 'up', 120)).toEqual({ vx: 0, vy: -120 });
  });

  it('lets the 4-way stick win, one axis at a time', () => {
    expect(skiffVelocity(['up', 'right'], 'left')).toEqual({ vx: -SKIFF_SPEED, vy: 0 });
  });
});

describe('the tuck', () => {
  it('spends one tuck for 0.6 s, and does nothing at zero', () => {
    expect(spendTuck(3)).toEqual({ ok: true, tucks: 2 });
    expect(spendTuck(0)).toEqual({ ok: false, tucks: 0 });
    expect(tuckCovers(0)).toBe(true);
    expect(tuckCovers(0.599)).toBe(true);
    expect(tuckCovers(TUCK_SECS)).toBe(false);
  });

  it('shrugs off a pellet while the tuck is up', () => {
    const { S, runtime, pressBoost } = harness();
    play(runtime, S);
    expect(S.mode).toBe('play');
    expect(S.nextLife).toBe(5000);
    expect(S.boost).toBe(1);
    expect(S.boostT).toBe(0);
    expect(runtime.debug!.state().tucks).toBe(3);
    pressBoost();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().tucks).toBe(2);
    runtime.debug!.pellet();
    for (let i = 0; i < 8; i++) runtime.update(1 / 60);
    expect(S.lives).toBe(3);
    expect(S.mode).toBe('play');
  });

  it('does not chain a tuck while BOOST stays held', () => {
    const { S, runtime, pressBoost, releaseBoost, repeatBoost } = harness();
    play(runtime, S);
    pressBoost();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().tucks).toBe(2);
    for (let i = 0; i < 40; i++) { repeatBoost(); runtime.update(1 / 60); }
    expect(runtime.debug!.state().tucks).toBe(2);
    releaseBoost();
    runtime.update(1 / 60);
    pressBoost();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().tucks).toBe(1);
  });

  it('keeps the tucks left when a skiff is replaced', () => {
    const { S, runtime, pressBoost } = harness();
    play(runtime, S);
    pressBoost();
    runtime.update(1 / 60);
    for (let i = 0; i < 40; i++) runtime.update(1 / 60);
    for (let n = 0; n < HEARTS_START; n++) {
      runtime.debug!.unblink();
      runtime.debug!.pellet();
      runtime.update(1 / 60);
    }
    expect(S.mode).toBe('dying');
    expect(runtime.debug!.state().tucks).toBe(2);
    for (let i = 0; i < 80; i++) runtime.update(1 / 60);
    expect(S.mode).toBe('ready');
    expect(S.lives).toBe(2);
    expect(runtime.debug!.state().tucks).toBe(2);
  });

  it('fires a tap that is already up before the frame', () => {
    const { S, runtime, tapFire } = harness();
    play(runtime, S);
    tapFire();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().shots).toBe(1);
  });

  it('takes a heart, not the skiff, when the same pellet lands with no tuck', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.pellet();
    runtime.update(1 / 60);
    expect(S.lives).toBe(3);
    expect(S.mode).toBe('play');
    expect(runtime.debug!.state().hearts).toBe(HEARTS_START - 1);
    // the blink after a hit shrugs off the next shot
    runtime.debug!.pellet();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().hearts).toBe(HEARTS_START - 1);
  });

  it('loses the skiff, and the gun, on the last heart; the next skiff has three hearts', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.arm('spread', 3);
    for (let n = 0; n < HEARTS_START; n++) {
      runtime.debug!.unblink();
      runtime.debug!.pellet();
      runtime.update(1 / 60);
    }
    expect(S.mode).toBe('dying');
    expect(S.lives).toBe(2);
    for (let i = 0; i < 80; i++) runtime.update(1 / 60);
    const st = runtime.debug!.state();
    expect([st.weapon, st.level, st.hearts]).toEqual(['blaster', 1, HEARTS_START]);
  });
});

describe('a flight of four', () => {
  it('is four spores on one velocity', () => {
    expect(flightOffsets('v', 1)).toHaveLength(4);
    expect(flightOffsets('file', -1)).toHaveLength(4);
    const file = flightOffsets('file', 1);
    expect(file[1]!.x - file[0]!.x).toBe(-16);
    expect(flightVelocity('v', 1, 20)).toEqual({ vx: 0, vy: 56 });
    expect(flightVelocity('file', -1, 20)).toEqual({ vx: -20, vy: 56 });
  });

  it('drops a capsule on the third spore shot from a flight, and only if none is already falling', () => {
    let flight: FlightState = { left: 4, hits: 0 };
    flight = onSporeGone(flight, 'left').flight;
    const drops: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const step = onSporeGone(flight, 'hit');
      flight = step.flight;
      drops.push(step.drop);
    }
    expect(drops).toEqual([false, false, true]);
    expect(offerToken(false, true)).toBe(true);
    expect(offerToken(true, true)).toBe(false);

    let thin: FlightState = { left: 4, hits: 0 };
    thin = onSporeGone(thin, 'left').flight;
    thin = onSporeGone(thin, 'left').flight;
    let late = false;
    for (let i = 0; i < 2; i++) {
      const step = onSporeGone(thin, 'hit');
      thin = step.flight;
      late = late || step.drop;
    }
    expect(late).toBe(false);
  });
});

describe('weapons (GAM-59)', () => {
  it('cycles S, L, M, W on a capsule', () => {
    expect(capsuleWeapon(0)).toBe('spread');
    expect(capsuleWeapon(0.5)).toBe('laser');
    expect(capsuleWeapon(1.0)).toBe('missile');
    expect(capsuleWeapon(1.5)).toBe('wave');
    expect(capsuleWeapon(2.0)).toBe('spread');
    expect(capsuleWeapon(0, 2)).toBe('missile');
  });

  it('stacks a new gun beside the others and levels up one you have', () => {
    expect(gunsOf({})).toEqual([{ weapon: 'blaster', level: 1 }]);
    let a = catchGun({}, 'spread');
    expect(a).toEqual({ arsenal: { spread: 1 }, level: 1, points: 0 });
    a = catchGun(a.arsenal, 'laser');
    a = catchGun(a.arsenal, 'spread');
    expect(a.arsenal).toEqual({ spread: 2, laser: 1 });
    expect(gunsOf(a.arsenal)).toEqual([{ weapon: 'spread', level: 2 }, { weapon: 'laser', level: 1 }]);
    expect(arsenalLabel({})).toBe('BLAST');
    expect(arsenalLabel({ wave: 1, spread: 3, missile: 2 })).toBe('S3M2W1');
    expect(arsenalLabel({ spread: 3, laser: 3, missile: 3, wave: 3 }).length).toBeLessThanOrEqual('MISSILE 3'.length);
    expect(catchGun({ laser: WEAPON_MAX }, 'laser')).toEqual({ arsenal: { laser: WEAPON_MAX }, level: WEAPON_MAX, points: 200 });
  });

  it('sprays more with each level, and fits under the shot cap', () => {
    const guns: Weapon[] = ['blaster', 'spread', 'laser', 'missile', 'wave'];
    for (const w of guns) {
      const sizes = [1, 2, 3].map(lv => volley(w, lv).length);
      expect(sizes[2]).toBeGreaterThanOrEqual(sizes[0]!);
      for (const spec of volley(w, 3)) expect(spec.vy).toBeLessThan(0);
    }
    expect(volley('spread', 3)).toHaveLength(7);
    expect(volley('laser', 1).every(s => s.pierce)).toBe(true);
    expect(volley('blaster', 3).some(s => s.pierce)).toBe(false);
    expect(missileSalvo(1)).toHaveLength(1);
    expect(missileSalvo(3)).toHaveLength(4);
    expect(volleyFits(SHOT_CAP - 7, 7)).toBe(true);
    expect(volleyFits(SHOT_CAP - 6, 7)).toBe(false);
  });

  it('turns a missile toward its target, no faster than the turn rate', () => {
    const v = steerMissile(0, -100, 100, 0, 0.1, 100);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(100);
    expect(v.vx).toBeGreaterThan(0);
    expect(Math.atan2(v.vy, v.vx)).toBeCloseTo(-Math.PI / 2 + 0.1);
  });

  it('fires every gun in the stack at once', () => {
    const { S, runtime, tapFire } = harness();
    play(runtime, S);
    runtime.debug!.arm('spread', 3);
    runtime.debug!.arm('laser', 3);
    tapFire();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().shots).toBe(7 + 3);
  });

  it('puts a whole volley in the air from the game', () => {
    const { S, runtime, tapFire } = harness();
    play(runtime, S);
    runtime.debug!.arm('spread', 3);
    tapFire();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().shots).toBe(7);
  });
});

describe('hearts, lives and pickups (GAM-59)', () => {
  it('takes one heart a hit and loses the skiff on the last', () => {
    expect(takeHit(3)).toEqual({ hearts: 2, lost: false });
    expect(takeHit(1)).toEqual({ hearts: 0, lost: true });
  });

  it('caps hearts at five, tucks at five and skiffs at nine', () => {
    const have = { hearts: 2, tucks: 3, lives: 3, speed: 0, bombs: 2 };
    expect(catchGift('heart', have)).toEqual({ ...have, hearts: 3, points: 0 });
    expect(catchGift('heart', { ...have, hearts: HEART_CAP })).toEqual({ ...have, hearts: HEART_CAP, points: 200 });
    expect(catchGift('tuck', { ...have, tucks: TUCK_CAP }).points).toBe(200);
    expect(catchGift('life', have).lives).toBe(4);
    expect(catchGift('life', { ...have, lives: LIFE_CAP })).toEqual({ ...have, lives: LIFE_CAP, points: 200 });
  });

  it('caps speed at three and bombs at five', () => {
    const have = { hearts: 3, tucks: 3, lives: 3, speed: 0, bombs: BOMBS_START };
    expect(catchGift('speed', have).speed).toBe(1);
    expect(catchGift('speed', { ...have, speed: SPEED_MAX }).points).toBe(200);
    expect(catchGift('bomb', have).bombs).toBe(BOMBS_START + 1);
    expect(catchGift('bomb', { ...have, bombs: BOMB_CAP }).points).toBe(200);
    expect(spendBomb(1)).toEqual({ ok: true, bombs: 0 });
    expect(spendBomb(0)).toEqual({ ok: false, bombs: 0 });
  });

  it('gives a skiff for each leg cleared, up to nine', () => {
    expect(legReward(3)).toBe(4);
    expect(legReward(LIFE_CAP)).toBe(LIFE_CAP);
  });

  it('has a slab always leave something, and a barb sometimes', () => {
    for (let r = 0; r < 1; r += 0.01) expect(dropFor('slab', r)).not.toBeNull();
    expect(dropFor('barb', 0.01)).toBe('life');
    expect(dropFor('barb', 0.1)).toBe('heart');
    expect(dropFor('barb', 0.9)).toBeNull();
    // four barbs in five leave something, a weapon capsule most often
    const n = 1000, got = Array.from({ length: n }, (_, i) => dropFor('barb', i / n));
    expect(got.filter(k => k !== null).length / n).toBeCloseTo(0.8, 2);
    expect(got.filter(k => k === 'weapon').length / n).toBeGreaterThan(0.3);
    for (const k of ['speed', 'bomb', 'tuck'] as const) expect(got).toContain(k);
    const slab = Array.from({ length: n }, (_, i) => dropFor('slab', i / n));
    for (const k of ['speed', 'bomb', 'weapon', 'heart', 'life'] as const) expect(slab).toContain(k);
  });

  it('catches a heart and a 1UP in the game', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.pellet();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().hearts).toBe(HEARTS_START - 1);
    runtime.debug!.give('heart');
    runtime.debug!.give('life');
    runtime.update(1 / 60);
    expect(runtime.debug!.state().hearts).toBe(HEARTS_START);
    expect(S.lives).toBe(4);
  });

  it('sets off a bomb per press, sweeps the pellets and keeps the skiff safe while it lasts', () => {
    const { S, runtime, tapBomb } = harness();
    play(runtime, S);
    expect(runtime.debug!.state().bombs).toBe(BOMBS_START);
    runtime.debug!.pellet();
    tapBomb();
    runtime.update(1 / 60);
    let st = runtime.debug!.state();
    expect([st.bombs, st.bombing, st.hearts]).toEqual([BOMBS_START - 1, true, HEARTS_START]);
    runtime.debug!.pellet();
    runtime.update(1 / 60);
    expect(runtime.debug!.state().hearts).toBe(HEARTS_START);
    // the blast runs out even when play stops under it (a leg ending, a pause of the round)
    S.mode = 'clear';
    for (let i = 0; i < 45; i++) runtime.update(1 / 60);
    expect(runtime.debug!.state().bombing).toBe(false);
    S.mode = 'play';
    for (let i = 0; i < 60; i++) runtime.update(1 / 60);
    tapBomb();
    runtime.update(1 / 60);
    tapBomb();
    for (let i = 0; i < 60; i++) runtime.update(1 / 60);
    tapBomb();
    runtime.update(1 / 60);
    st = runtime.debug!.state();
    expect(st.bombs).toBe(0);
    expect(BOMB_DMG).toBeGreaterThanOrEqual(BARB_HP);
  });

  it('catches SPEED and BOMB in the game, and loses speed with the skiff', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.give('speed');
    runtime.debug!.give('bomb');
    runtime.update(1 / 60);
    let st = runtime.debug!.state();
    expect([st.speed, st.bombs]).toEqual([1, BOMBS_START + 1]);
    for (let n = 0; n < HEARTS_START; n++) {
      runtime.debug!.unblink();
      runtime.debug!.pellet();
      runtime.update(1 / 60);
    }
    for (let i = 0; i < 80; i++) runtime.update(1 / 60);
    st = runtime.debug!.state();
    expect([st.speed, st.bombs]).toEqual([0, BOMBS_START]);
  });

  it('carries guns, speed, bombs and extra tucks into the next leg, through a warp', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.untouchable(true);
    runtime.debug!.arm('spread', 2);
    runtime.debug!.arm('wave', 1);
    runtime.debug!.give('speed');
    runtime.debug!.give('bomb');
    runtime.debug!.give('tuck');
    runtime.debug!.give('tuck');
    runtime.update(1 / 60);
    let warped = 0;
    for (let i = 0; i < 60 * 40 && S.level === 1; i++) {
      runtime.update(1 / 60);
      if (S.mode === 'clear') warped = Math.max(warped, runtime.debug!.state().warp);
    }
    expect(S.level).toBe(2);
    expect(S.mode).toBe('ready');
    expect(warped).toBeGreaterThan(0.8);
    expect(runtime.debug!.state().warp).toBeGreaterThan(0.5);
    const st = runtime.debug!.state();
    expect(st.guns).toEqual({ spread: 2, wave: 1 });
    expect([st.speed, st.bombs, st.tucks]).toEqual([1, BOMBS_START + 1, 5]);
    for (let i = 0; i < 90; i++) runtime.update(1 / 60);
    expect([S.mode, runtime.debug!.state().warp]).toEqual(['play', 0]);
  });

  it('gives craft hit points so the bigger guns have work to do', () => {
    expect(hpFor('spore')).toBe(1);
    expect(hpFor('barb')).toBe(BARB_HP);
    expect(hpFor('slab')).toBe(SLAB_HP);
    expect(damage(3, 1)).toEqual({ hp: 2, gone: false });
    expect(damage(2, 2)).toEqual({ hp: 0, gone: true });
  });
});

describe('slabs and the leg clock', () => {
  it('has no slab before leg 3, and keeps every beat inside 24 s', () => {
    expect(LEG_CLOCK).toBe(24);
    expect(SLAB_WAIT).toBe(6);
    expect(slabCount(1)).toBe(0);
    expect(slabCount(2)).toBe(0);
    expect(slabCount(3)).toBe(1);
    expect(slabCount(8)).toBe(3);
    expect(scrollSpeed(1)).toBe(20);
    expect(scrollSpeed(8)).toBe(41);
    expect(beatGap(1)).toBeCloseTo(1.6);
    expect(beatGap(8)).toBeCloseTo(0.9);
    expect(pelletSpeed(1)).toBe(70);
    expect(pelletSpeed(8)).toBe(112);
    expect(landingBonus(2, 4)).toBe(520);
    expect(beatFits(13, 4)).toBe(false);
    expect(beatFits(12, 4)).toBe(true);
    for (let leg = 1; leg <= 8; leg++) {
      const beats = beatSchedule(leg, mulberry32(leg * 10007 + 17));
      const kinds = beats.map(b => b.kind);
      const tally = (k: BeatKind) => kinds.filter(kind => kind === k).length;
      expect(tally('flight')).toBe(flightCount(leg));
      expect(tally('barb')).toBe(barbCount(leg));
      expect(tally('slab')).toBe(slabCount(leg));
      expect(Math.max(...beats.map(b => b.t))).toBeLessThan(LEG_CLOCK);
      const first = kinds.findIndex(k => k !== 'gap');
      let last = -1;
      kinds.forEach((k, i) => { if (k !== 'gap') last = i; });
      expect(kinds.slice(first, last + 1)).toContain('gap');
    }
  });
});

describe('the leaflet', () => {
  it('names 1942 only in the about line', () => {
    expect(disk.page.description).not.toMatch(/1942|2042/);
    expect(disk.title).toBe('MARTIAN STORM');
    expect(disk.loadSecs).toBe(3.8);
    for (const lang of ['en', 'zh-hant', 'zh-hans'] as const) {
      expect(strings[lang].msCred).toContain('1942');
      for (const [key, value] of Object.entries(strings[lang])) {
        if (key === 'msCred') continue;
        expect(String(value)).not.toMatch(/1942|2042|一九四二|空戰|空战/);
      }
    }
    expect(strings.en.msOver).toBe('STORM OVER');
    expect(strings['zh-hant'].msOver).toBe('塵暴過了');
    expect(strings['zh-hans'].msOver).toBe('尘暴过了');
    expect(strings['zh-hant'].msName).toBe('Martian Storm 火星塵暴');
    expect(strings['zh-hans'].msName).toBe('Martian Storm 火星尘暴');
    expect(strings.en.msLoop).toBe('LOOP');
    expect(strings['zh-hant'].msLoop).toBe('筋斗');
    expect(strings['zh-hans'].msLoop).toBe('筋斗');
  });
});

describe('craft you can read (GAM-54)', () => {
  it('draws every craft at its declared size', () => {
    for (const [art, w, h] of [[SPORE, SPORE_W, SPORE_H], [BARB, BARB_W, BARB_H], [SLAB, SLAB_W, SLAB_H]] as const) {
      expect(art).toHaveLength(h);
      for (const row of art) expect(row).toHaveLength(w);
    }
  });

  it('keeps every craft close to the skiff in size, and far bigger than a 2 px pellet', () => {
    for (const [w, h] of [[SPORE_W, SPORE_H], [BARB_W, BARB_H], [SLAB_W, SLAB_H]]) {
      expect(w).toBeGreaterThanOrEqual(SKIFF_W - 2);
      expect(h).toBeGreaterThanOrEqual(SKIFF_H - 1);
    }
  });

  it('is easy to hit but forgiving to brush past', () => {
    const shot = insetBox(0, 0, SPORE_W, SPORE_H);
    const ram = touchBox(0, 0, SPORE_W, SPORE_H);
    expect(shot).toEqual({ x: 1, y: 1, w: SPORE_W - 2, h: SPORE_H - 2 });
    expect(ram).toEqual({ x: 2, y: 2, w: SPORE_W - 4, h: SPORE_H - 4 });
    expect(touchBox(0, 0, 3, 3)).toEqual({ x: 2, y: 2, w: 0, h: 0 });
  });

  it('leaves a clear gap between the spores of a flight', () => {
    for (const shape of ['v', 'file'] as const) {
      const offs = flightOffsets(shape, 1);
      for (let i = 0; i < offs.length; i++) for (let j = i + 1; j < offs.length; j++) {
        const dx = Math.abs(offs[i]!.x - offs[j]!.x), dy = Math.abs(offs[i]!.y - offs[j]!.y);
        expect(dx >= SPORE_W + 4 || dy >= SPORE_H + 4).toBe(true);
      }
    }
  });
});

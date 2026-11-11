import { describe, expect, it } from 'vitest';
import create from '../../src/games/martian-storm/game';
import { strings } from '../../src/games/martian-storm/strings';
import { disk } from '../../src/games/martian-storm/disk';
import type { ConsoleAPI, Dir } from '../../src/games/types';
import {
  BARB_HP, HEART_CAP, HEARTS_START, LEG_CLOCK, LIFE_CAP, SHOT_CAP, SKIFF_SPEED, SLAB_HP, SLAB_WAIT, TUCK_CAP, TUCK_SECS,
  WEAPON_MAX, barbCount, beatFits, beatGap, beatSchedule, capsuleWeapon, catchGift, catchWeapon, damage, dropFor,
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
  return { api, S, runtime, held, pressBoost, releaseBoost, repeatBoost, tapFire, setStick: (d: Dir | null) => { stick = d; } };
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

  it('drops a token only when all four were hit, and only if none is already falling', () => {
    let flight: FlightState = { left: 4, escaped: false };
    let drop = false;
    for (let i = 0; i < 4; i++) {
      const step = onSporeGone(flight, 'hit');
      flight = step.flight;
      drop = step.drop;
    }
    expect(drop).toBe(true);
    expect(offerToken(false, true)).toBe(true);
    expect(offerToken(true, true)).toBe(false);

    let spoiled: FlightState = { left: 4, escaped: false };
    spoiled = onSporeGone(spoiled, 'left').flight;
    let late = false;
    for (let i = 0; i < 3; i++) {
      const step = onSporeGone(spoiled, 'hit');
      spoiled = step.flight;
      late = late || step.drop;
    }
    expect(spoiled.escaped).toBe(true);
    expect(late).toBe(false);
    expect(offerToken(false, false)).toBe(false);
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

  it('levels up your own gun and switches to another at the same level', () => {
    expect(catchWeapon('blaster', 1, 'spread')).toEqual({ weapon: 'spread', level: 1, points: 0 });
    expect(catchWeapon('spread', 1, 'spread')).toEqual({ weapon: 'spread', level: 2, points: 0 });
    expect(catchWeapon('spread', 2, 'laser')).toEqual({ weapon: 'laser', level: 2, points: 0 });
    expect(catchWeapon('laser', WEAPON_MAX, 'laser')).toEqual({ weapon: 'laser', level: WEAPON_MAX, points: 200 });
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
    const have = { hearts: 2, tucks: 3, lives: 3 };
    expect(catchGift('heart', have)).toEqual({ ...have, hearts: 3, points: 0 });
    expect(catchGift('heart', { ...have, hearts: HEART_CAP })).toEqual({ ...have, hearts: HEART_CAP, points: 200 });
    expect(catchGift('tuck', { ...have, tucks: TUCK_CAP }).points).toBe(200);
    expect(catchGift('life', have).lives).toBe(4);
    expect(catchGift('life', { ...have, lives: LIFE_CAP })).toEqual({ ...have, lives: LIFE_CAP, points: 200 });
  });

  it('gives a skiff for each leg cleared, up to nine', () => {
    expect(legReward(3)).toBe(4);
    expect(legReward(LIFE_CAP)).toBe(LIFE_CAP);
  });

  it('has a slab always leave something, and a barb sometimes', () => {
    for (let r = 0; r < 1; r += 0.01) expect(dropFor('slab', r)).not.toBeNull();
    expect(dropFor('barb', 0.01)).toBe('life');
    expect(dropFor('barb', 0.2)).toBe('heart');
    expect(dropFor('barb', 0.9)).toBeNull();
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

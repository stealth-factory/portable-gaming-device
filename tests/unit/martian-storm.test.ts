import { describe, expect, it } from 'vitest';
import create from '../../src/games/martian-storm/game';
import { strings } from '../../src/games/martian-storm/strings';
import { disk } from '../../src/games/martian-storm/disk';
import type { ConsoleAPI, Dir } from '../../src/games/types';
import {
  LEG_CLOCK, SKIFF_SPEED, SLAB_WAIT, TUCK_CAP, TUCK_SECS,
  barbCount, beatFits, beatGap, beatSchedule, flightCount, flightOffsets, flightVelocity,
  grantToken, landingBonus, offerToken, onSporeGone, pelletSpeed, scrollSpeed, shotMeetsSlab,
  shotsThisPress, skiffVelocity, slabCount, spendTuck, tokenPhase, tuckCovers,
} from '../../src/games/martian-storm/rules';
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
    expect(S.nextLife).toBe(2000);
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
    runtime.debug!.pellet();
    runtime.update(1 / 60);
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

  it('loses a skiff when the same pellet lands with no tuck', () => {
    const { S, runtime } = harness();
    play(runtime, S);
    runtime.debug!.pellet();
    runtime.update(1 / 60);
    expect(S.lives).toBe(2);
    expect(S.mode).toBe('dying');
  });
});

describe('a flight of four', () => {
  it('is four spores on one velocity', () => {
    expect(flightOffsets('v', 1)).toHaveLength(4);
    expect(flightOffsets('file', -1)).toHaveLength(4);
    const file = flightOffsets('file', 1);
    expect(file[1]!.x - file[0]!.x).toBe(-14);
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

describe('the token', () => {
  it('cycles points, tuck, twin, and respects the cap', () => {
    expect(tokenPhase(0)).toBe('points');
    expect(tokenPhase(0.349)).toBe('points');
    expect(tokenPhase(0.35)).toBe('tuck');
    expect(tokenPhase(0.7)).toBe('twin');
    expect(tokenPhase(1.05)).toBe('points');
    expect(grantToken('points', 1, false)).toEqual({ tucks: 1, twin: false, points: 200 });
    expect(grantToken('tuck', 4, false)).toEqual({ tucks: 5, twin: false, points: 0 });
    expect(grantToken('tuck', TUCK_CAP, false)).toEqual({ tucks: TUCK_CAP, twin: false, points: 200 });
    expect(grantToken('twin', 2, false)).toEqual({ tucks: 2, twin: true, points: 0 });
    expect(grantToken('twin', 2, true)).toEqual({ tucks: 2, twin: true, points: 200 });
  });
});

describe('slabs and the leg clock', () => {
  it('stops a shot, and breaks on the fourth hit', () => {
    expect(shotMeetsSlab(0)).toEqual({ hits: 1, gone: false, points: 0, stopped: true });
    expect(shotMeetsSlab(3)).toEqual({ hits: 4, gone: true, points: 80, stopped: true });
    expect(shotsThisPress(false, 5)).toBe(1);
    expect(shotsThisPress(false, 6)).toBe(0);
    expect(shotsThisPress(true, 4)).toBe(2);
    expect(shotsThisPress(true, 5)).toBe(0);
  });

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
    expect(beatFits(9, 4)).toBe(false);
    expect(beatFits(8, 4)).toBe(true);
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

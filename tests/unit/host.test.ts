import { describe, it, expect } from 'vitest';
import { bindHost, host, type ConsoleHost } from '../../src/console/program/host';
import type { Platform } from '../../src/console/program/platform';
import { loadGame, playDisk, pressSelect, progress, startConsole } from '../../src/console/program/loader';
import { scores, loadScores, saveBest, readBest, qualifies, forgetScores, lastName } from '../../src/console/program/scores';
import { startEntry, entryKey, entryTap, updateOver, drawEntry, keyRects, NKEYS } from '../../src/console/program/entry';

/** A platform that records what the program asks of it. `sounding` turns on at the first wakeAudio. */
function fakePlatform(over: Partial<Platform> = {}){
  const calls: string[] = [], tones: number[] = [], clicks: number[] = [], motors: [number, number][] = [], stored: Record<string, string> = {};
  let awake = false, clock = 1000;
  const P: Platform = {
    now: () => clock,
    store: { get: k => stored[k] ?? null, set: (k, v) => { stored[k] = v; }, remove: k => { delete stored[k]; }, keys: () => Object.keys(stored) },
    wakeAudio(){ awake = true; },
    get sounding(){ return awake; },
    tone(f){ tones.push(f); },
    click(delay){ clicks.push(delay); },
    motor(start, dur){ motors.push([start, dur]); },
    buzz(h){ calls.push('buzz:' + h); },
    loadCode: () => Promise.resolve(() => ({ start(){ calls.push('start'); }, update(){ calls.push('update'); }, draw(){ calls.push('draw'); } })),
    track(name){ calls.push('track:' + name); },
    layoutName: () => 'desk',
    reducedMotion: false,
    hideCard(){ calls.push('hideCard'); },
    showPauseCard(){ calls.push('pauseCard'); },
    showOverCard(level, score){ calls.push(`over:${level}:${score}`); },
    showHold(on){ calls.push('hold:' + on); },
    showGame(id){ calls.push('game:' + id); },
    setManual(ctx){ calls.push('manual:' + ctx); },
    flash(c){ calls.push('flash:' + c); },
    autoloadId: () => null,
    oldList: false,
    onOnline(){ calls.push('onOnline'); },
    onSettings(){ calls.push('onSettings'); },
    ...over,
  };
  return { P, calls, tones, clicks, motors, stored, tick(ms: number){ clock += ms; } };
}

function bind(P: Platform, extra: Partial<ConsoleHost> = {}){
  bindHost({
    platform: P,
    S: {},
    age: { dipLeft: 0 },
    setAccReset(){}, clearInput(){}, releaseKeys(){},
    get tvOn(){ return true; },
    ...extra,
  } as unknown as ConsoleHost);
}

describe('console host', () => {
  it('keeps getters live so a screen sees a value that changes', () => {
    let width = 360;
    bindHost({ get LW(){ return width; } } as ConsoleHost);
    expect(host.LW).toBe(360);
    width = 240;
    expect(host.LW).toBe(240);
  });

  it('hears sound that wakeAudio has just made possible', () => {
    const f = fakePlatform();
    bind(f.P);
    loadGame(0);
    expect(f.tones).toContain(1200);
  });
});

describe('the loader on its platform', () => {
  it('remembers the disk, times the load on the platform clock and runs the drive for the load', () => {
    const f = fakePlatform();
    const S: any = {};
    bind(f.P, { S } as Partial<ConsoleHost>);
    loadGame(0);
    expect(S.mode).toBe('load');
    expect(S.loadAt).toBe(1000);
    expect(Object.keys(f.stored)).toEqual(['gg-last']);
    expect(f.motors).toEqual([[0.05, S.loadLen - 0.05]]);
    expect(f.calls).toContain('track:game_load');
  });

  it('keeps the drive quiet when nothing can be heard', () => {
    const f = fakePlatform({ wakeAudio(){} });
    bind(f.P);
    playDisk(0, 3);
    expect(f.motors).toEqual([]);
    expect(f.clicks).toEqual([]);
  });

  it('clicks the head inside the motor run and parks it 0.2 s before the end', () => {
    const f = fakePlatform();
    bind(f.P);
    f.P.wakeAudio();
    playDisk(0.5, 2);
    expect(f.motors).toEqual([[0.5, 2]]);
    expect(Math.min(...f.clicks)).toBeGreaterThanOrEqual(0.5);
    expect(f.clicks[f.clicks.length - 1]).toBeCloseTo(2.3);
  });

  it('boots by taking the card down, letting go of HOLD and listening once for the network and settings', () => {
    const f = fakePlatform();
    const S: any = {};
    bind(f.P, { S } as Partial<ConsoleHost>);
    startConsole('cold');
    startConsole('warm');
    expect(S.mode).toBe('boot');
    expect(f.calls.filter(c => c === 'hideCard').length).toBe(2);
    expect(f.calls).toContain('hold:false');
    expect(f.calls.filter(c => c === 'onOnline').length).toBe(1);
    expect(f.calls.filter(c => c === 'onSettings').length).toBe(1);
  });

  it('flashes SELECT on a press and warm-boots only with the set on', () => {
    const f = fakePlatform();
    const S: any = { mode: 'menu' };
    let on = false;
    bind(f.P, { S } as Partial<ConsoleHost>);
    bindHost({ get tvOn(){ return on; } } as ConsoleHost);   // after bind: a spread would freeze the getter
    pressSelect();
    expect(f.calls).toContain('flash:select');
    expect(S.mode).toBe('menu');
    on = true;
    pressSelect();
    expect(S.mode).toBe('boot');
    expect(S.bootKind).toBe('warm');
  });
});

describe('load progress', () => {
  const steps: [number, number][] = [[0, 0], [0.5, 0.2], [1, 1]];

  it('moves in the disk\'s steps and clamps at either end', () => {
    expect(progress(steps, 0)).toBe(0);
    expect(progress(steps, 0.25)).toBeCloseTo(0.1);
    expect(progress(steps, 1)).toBe(1);
    expect(progress(steps, 2)).toBe(1);
    expect(progress(steps, -1)).toBe(0);
  });
});

describe('scores', () => {
  it('reads a cleaned table and keeps the best through the store', () => {
    const f = fakePlatform();
    f.stored['gg-board-x'] = JSON.stringify([{ n: 'ab1c', s: 50, l: 2 }, { n: 'zed', s: 90, l: 0 }, { n: 'bad', s: -1 }]);
    bind(f.P);
    loadScores('x');
    expect(scores.board).toEqual([{ n: 'ZED', s: 90, l: 1 }, { n: 'ABC', s: 50, l: 2 }]);
    expect(scores.best).toBe(90);
    scores.best = 120; saveBest();
    expect(f.stored['gg-best-x']).toBe('120');
    expect(qualifies(10)).toBe(true);
    expect(qualifies(0)).toBe(false);
  });

  it('falls back to the standalone game\'s keys for Tunnel Raider', () => {
    const f = fakePlatform();
    f.stored['eb-best'] = '777'; f.stored['tr-name'] = 'old';
    bind(f.P);
    forgetScores();
    expect(readBest('tunnel')).toBe(777);
    expect(lastName()).toBe('');   // forgetting also forgets the name
  });
});

describe('name entry', () => {
  function entryHost(){
    const f = fakePlatform(), S: any = { mode: 'over', score: 300, level: 3 };
    f.P.wakeAudio();
    bind(f.P, { S, stickDir: null } as any);
    forgetScores(); loadScores('x');
    return { f, S };
  }

  it('types a name, files it in the table and shows the table first', () => {
    const { f, S } = entryHost();
    startEntry();
    expect(S.mode).toBe('entry');
    for (const c of ['KeyA', 'KeyC', 'Backspace', 'KeyE']) entryKey(c);
    expect(S.entry.name).toBe('AE');
    entryKey('Enter');
    expect(S.mode).toBe('over');
    expect(S.showBoard).toBe(true);
    expect(scores.board[0]).toEqual({ n: 'AE', s: 300, l: 3 });
    expect(f.stored['gg-name']).toBe('AE');
    expect(f.calls).toContain('track:high_score');
    expect(f.calls.at(-1)).toBe('hideCard');
  });

  it('swaps the card and the table in the attract loop', () => {
    const { f, S } = entryHost();
    startEntry(); entryKey('Enter');
    updateOver(7.5);
    expect(S.showBoard).toBe(false);
    expect(f.calls.at(-1)).toBe('over:3:000300');
  });

  it('picks the key under a tap', () => {
    const { S } = entryHost();
    const g = { fillStyle: '', fillRect(){} };
    bindHost({ g, col: () => '#fff', txt(){}, LW: 240, LH: 200, HUD: 20 } as unknown as ConsoleHost);
    startEntry(); S.entry.name = '';
    drawEntry();
    expect(entryTap(-100, -100)).toBe(true);
    expect(S.entry.name).toBe('');
    const b = keyRects.find(q => NKEYS[q.i].k === 'B')!;
    entryTap(b.x + b.w / 2, b.y + b.h / 2);
    expect(S.entry.name).toBe('B');
  });
});

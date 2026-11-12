/* The console's mode machine and the api it gives games (GAM-39), run on a fake platform with no browser. */
import { describe, it, expect } from 'vitest';
import { bindHost, type ConsoleHost } from '../../src/console/program/host';
import type { Platform } from '../../src/console/program/platform';
import { loadGame } from '../../src/console/program/loader';
import { scores, forgetScores, loadScores } from '../../src/console/program/scores';
import { game, runtimeReady, startGame, finishGame, togglePause, clearScores, menuFire, update, draw, inGame, S as BAG } from '../../src/console/program/machine';
import { makeConsoleAPI, mulberry32, type ApiIO } from '../../src/console/program/api';

/** What the program asked of the platform and the game. The program keeps a game's runtime once made, so this list is shared and emptied per test. */
const calls: string[] = [];

function setup(over: Partial<ConsoleHost> = {}){
  calls.length = 0;
  const stored: Record<string, string> = {};
  let on = true;
  const P = {
    now: () => 0,
    store: { get: (k: string) => stored[k] ?? null, set: (k: string, v: string) => { stored[k] = v; }, remove: (k: string) => { delete stored[k]; }, keys: () => Object.keys(stored) },
    wakeAudio(){ calls.push('wake'); }, sounding: false,
    tone(){}, click(){}, motor(){},
    buzz(h: unknown){ calls.push('buzz:' + h); },
    loadCode: () => Promise.resolve(() => ({ start(){ calls.push('start'); }, update(){ calls.push('update'); }, draw(){ calls.push('draw'); } })),
    track(name: string){ calls.push('track:' + name); },
    layoutName: () => 'desk', reducedMotion: false,
    hideCard(){ calls.push('hideCard'); },
    showPauseCard(){ calls.push('pauseCard'); },
    showOverCard(level: number, score: string){ calls.push(`over:${level}:${score}`); },
    showHold(v: boolean){ calls.push('hold:' + v); },
    showGame(id: string | null){ calls.push('game:' + id); },
    setManual(ctx: string){ calls.push('manual:' + ctx); },
    flash(){}, autoloadId: () => null, oldList: false, onOnline(){}, onSettings(){},
  } as Platform;
  const S: any = { parts: [], pops: [], time: 0 };
  bindHost({
    platform: P, S, age: { dipLeft: 0 },
    setAccReset(){}, clearInput(){ calls.push('clearInput'); }, releaseKeys(){ calls.push('releaseKeys'); },
    get tvOn(){ return on; },
    ...over,
  } as unknown as ConsoleHost);
  forgetScores();
  return { P, S, calls, stored, setOn(v: boolean){ on = v; } };
}

/** Load the first disk and wait for its (fake) code, so startGame has a runtime. */
async function loaded(){
  const t = setup();
  loadGame(0);
  await Promise.resolve(); await Promise.resolve();
  expect(runtimeReady(game.id)).toBe(true);
  return t;
}

describe('the mode machine', () => {
  it('has its own state bag for the host to bind', () => {
    expect(BAG.mode).toBe('title');
    expect(BAG.lives).toBe(3);
  });

  it('starts the loaded game: fresh score, its runtime, the card down, ready to play', async () => {
    const { S, calls } = await loaded();
    S.score = 99; S.level = 4;
    calls.length = 0;
    startGame();
    expect(S.mode).toBe('ready');
    expect(S.score).toBe(0); expect(S.level).toBe(1); expect(S.lives).toBe(3);
    expect(calls).toEqual(['wake', 'game:' + game.id, 'manual:' + game.id, 'start', 'track:game_start', 'hideCard', 'clearInput']);
    expect(inGame()).toBe(true);
  });

  it('hands ready, play, dying and clear to the game, and nothing while off', async () => {
    const { S, calls } = await loaded();
    startGame(); calls.length = 0;
    for (const m of ['ready', 'play', 'dying', 'clear', 'paused', 'off']) { S.mode = m; update(1 / 60); }
    expect(calls.filter(c => c === 'update').length).toBe(4);
    S.mode = 'play'; draw(); S.mode = 'off'; draw();
    expect(calls.filter(c => c === 'draw').length).toBe(1);
    expect(S.time).toBeCloseTo(6 / 60);
  });

  it('holds only a game in play, and lets it go where it was', async () => {
    const { S, calls, setOn } = await loaded();
    S.mode = 'menu'; togglePause();
    expect(S.mode).toBe('menu');
    S.mode = 'play'; togglePause();
    expect(S.mode).toBe('paused');
    expect(calls.slice(-3)).toEqual(['releaseKeys', 'hold:true', 'pauseCard']);
    togglePause(true);
    expect(S.mode).toBe('paused');
    togglePause();
    expect(S.mode).toBe('play');
    expect(calls.slice(-2)).toEqual(['hideCard', 'hold:false']);
    setOn(false); togglePause();
    expect(S.mode).toBe('play');
  });

  it('finishes a game: saves the best, buzzes, then name entry for a table score', async () => {
    const { S, calls, stored } = await loaded();
    startGame(); S.score = 500; S.bestAtStart = 0; scores.best = 500;
    finishGame();
    expect(stored['gg-best-' + game.id]).toBe('500');
    expect(calls).toContain('buzz:over');
    expect(calls).toContain('track:game_over');
    expect(calls).toContain('track:new_best');
    expect(S.mode).toBe('entry');
  });

  it('goes to the attract loop when the score makes no table', async () => {
    const { S, calls } = await loaded();
    startGame(); S.score = 0;
    finishGame();
    expect(S.mode).toBe('over');
    expect(calls).not.toContain('track:new_best');
  });

  it('clears every score key, and puts the game-over card back over a cleared table', () => {
    const { S, calls, stored } = setup();
    Object.assign(stored, { 'gg-best-x': '9', 'gg-board-x': '[]', 'gg-name': 'A', 'eb-mode': 'greenP1' });
    loadScores('x');
    Object.assign(S, { mode: 'over', showBoard: true, level: 2, score: 40 });
    clearScores();
    expect(Object.keys(stored)).toEqual(['eb-mode']);
    expect(S.showBoard).toBe(false);
    expect(S.bestAtStart).toBe(0);
    expect(calls).toContain('over:2:000040');
    expect(calls).toContain('track:scores_cleared');
  });

  it('lets FIRE load from the menu and swallows it while the drive runs', () => {
    const { S } = setup();
    S.mode = 'menu'; S.menuSel = 0;
    expect(menuFire()).toBe(true);
    expect(S.mode).toBe('load');
    expect(menuFire()).toBe(true);
    S.mode = 'play';
    expect(menuFire()).toBe(false);
  });
});

describe('the api games get', () => {
  it('reads the picture and input live from the host, and the rest from the program', () => {
    const { S, calls } = setup();
    let LW = 360, tapX = 5;
    const io = { get LW(){ return LW; }, get tapX(){ return tapX; }, clearTap(){ tapX = 0; } } as unknown as ApiIO;
    const api = makeConsoleAPI(io);
    expect(api.LW).toBe(360); LW = 240; expect(api.LW).toBe(240);
    expect(api.tapX).toBe(5); api.clearTap(); expect(api.tapX).toBe(0);
    expect(api.S).toBe(S);
    api.best = 77; expect(scores.best).toBe(77);
    api.buzz('fire'); api.track('x');
    expect(calls).toEqual(['buzz:fire', 'track:x']);
    expect(mulberry32(1)()).toBe(api.mulberry32(1)());
  });
});

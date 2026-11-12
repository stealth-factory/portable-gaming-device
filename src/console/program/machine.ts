/* The console's mode machine (GAM-39): the state bag, which game is loaded, and what runs each frame.

   `S.mode` is one of off, boot, menu, load, ready, play, dying, clear, paused, entry and over. The console
   program runs boot, menu and load (loader.ts) and entry and over (entry.ts); the loaded game's runtime runs
   ready, play, dying and clear. This file decides which of them gets the frame, starts and finishes a game,
   holds it (HOLD), and clears the scores. Part of the console program: no DOM, no Web Audio, no storage.
   Console state that is still in core.ts comes through `host`, the machine through `host.platform`. */
import { host } from './host';
import type { GameDisk, GameRuntime } from '../../games/types';
import { DISKS } from '../../games/registry';
import * as Btn from '../buttons';
import { scoreKeys } from '../settings';
import { scores, loadScores, saveBest, qualifies, forgetScores } from './scores';
import { startEntry, enterOver, entryPick, updateEntry, updateOver, drawEntry, drawBoard } from './entry';
import { updateBoot, updateMenu, updateLoad, drawBoot, drawMenu, drawLoad, loadGame, startConsole } from './loader';

/* ---------- the state bag: the console's fields, and room for each game's own ----------
   Made here; the host binds it as `host.S`, and everything in the program reads it from there (tests bind their own). */
const W0 = 15, H0 = 10;   // the grid core starts with, before it fits the tube
export const S: any = {
  mode: 'title', prevMode: null, modeT: 0, time: 0,
  level: 1, score: 0, lives: 3, nextLife: 20000,
  dug: new Uint8Array(W0 * H0), em: new Uint8Array(W0 * H0), emLeft: 0,
  bags: [], golds: [], monsters: [], sparks: [], parts: [], pops: [],
  spawned: 0, total: 0, maxAlive: 3, spawnT: 0,
  sun: { active: false, used: false, x: W0 - 2, y: 1 },
  bonusT: 0, bonusChain: 0, sirenT: 0, sirenHi: false,
  charge: 1, streak: 0, lastGem: -9,
  player: null, dist: new Int16Array(W0 * H0), distT: 0,
};

/** The modes the loaded game's runtime updates. */
export const GAME_MODES = ['ready', 'play', 'dying', 'clear'];
/** The loaded game's runtime is in charge (its pad and its own keys apply), as opposed to the console's screens. */
export const inGame = () => ['ready', 'play', 'dying', 'clear', 'paused'].includes(host.S.mode);

/* ---------- the loaded game (its scores are in scores.ts) ---------- */
export let game: GameDisk = DISKS[0];
/* the loaded game's code: fetched while its disk loads, then kept (one runtime per game) */
export let runtime: GameRuntime | null = null;
// a Map, so a disk id can never collide with an Object.prototype name (`constructor`); a disk replaced while its code was
// still on the way bumps its generation, so the old code is dropped and the new disk's fetched instead
const runtimes = new Map<string, GameRuntime>();
const generations = new Map<string, number>();
export const runtimeReady = (id: string) => runtimes.has(id);
/** Drop a game's runtime, so its next load makes a fresh one (a disk replaced at run time, or one that crashed). */
export function forgetRuntime(id: string){ runtimes.delete(id); generations.set(id, (generations.get(id) || 0) + 1); }
export function fetchRuntime(d: GameDisk): Promise<GameRuntime> {
  const have = runtimes.get(d.id);
  if (have) return Promise.resolve(have);
  const gen = generations.get(d.id) || 0;
  return host.platform.loadCode(d.id).then(create => {
    if ((generations.get(d.id) || 0) !== gen) return fetchRuntime(d);   // replaced while loading: fetch the new one
    let rt = runtimes.get(d.id);
    if (!rt) { rt = create(host.api); runtimes.set(d.id, rt); }
    return rt;
  });
}

/** The loaded game: its scores, its buttons and its instructions (null for the console's own screens, which set their own buttons). */
export function setGame(d: GameDisk | null){
  if (d) { game = d; loadScores(d.id); Btn.useButtons(d.buttons); }
  host.platform.showGame(d ? d.id : null);
  if (d) host.platform.setManual(d.id);
}

export function startGame(){
  const S = host.S;
  host.platform.wakeAudio();
  S.level = 1; S.score = 0; S.lives = 3; S.nextLife = 20000; S.streak = 0; S.bestAtStart = scores.best; S.showBoard = false; S.boardHi = -1;
  S.parts.length = 0; S.pops.length = 0;
  setGame(game);
  const rt = runtimes.get(game.id);
  if (!rt) { startConsole('warm'); return; }   // dropped since its load finished (its disk was replaced): back to the menu
  runtime = rt;
  runtime.start();
  host.platform.track('game_start', { game: game.id, layout: host.platform.layoutName() });
  host.platform.hideCard(); host.clearInput();
  S.mode = 'ready'; S.modeT = game.id === 'tunnel' ? 1.4 : 1.2;
}
/* the end of a game: save the best, then name entry if it made the table, otherwise the attract loop */
export function finishGame(){
  const S = host.S;
  const P = host.platform;
  saveBest(); P.buzz('over');
  P.track('game_over', { game: game.id, score: S.score });
  if (S.score > 0 && S.score > (S.bestAtStart || 0)) P.track('new_best', { game: game.id, score: S.score });
  if (qualifies(S.score)) startEntry(); else enterOver(false);
}

/** HOLD: freeze the game in play (only while a game runs), or let it go. `forceOn` only ever holds. */
export function togglePause(forceOn?: boolean){
  const S = host.S;
  const P = host.platform;
  if (!host.tvOn) return;
  if (S.mode === 'paused') { if (forceOn) return; S.mode = S.prevMode; P.hideCard(); P.showHold(false); return; }
  if (!GAME_MODES.includes(S.mode)) return;
  S.prevMode = S.mode; S.mode = 'paused'; host.releaseKeys();
  P.showHold(true);
  P.showPauseCard();
}

/** The leaflet's "clear scores": this device's tables and bests wiped, for every game. */
export function clearScores(){
  const S = host.S;
  const store = host.platform.store;
  for (const k of scoreKeys(store.keys())) store.remove(k);
  forgetScores(); S.bestAtStart = 0;
  // the attract loop only swaps views while there is a table: back to the game-over card
  if (S.mode === 'over' && S.showBoard) { S.showBoard = false; S.boardHi = -1; host.platform.showOverCard(S.level, String(S.score).padStart(6, '0')); }
  host.platform.track('scores_cleared', { game: game.id });
}

/** FIRE (the button, Space, Z or X) on the console's own screens. True when the console used it. */
export function menuFire(){
  const S = host.S;
  if (S.mode === 'menu') { loadGame(S.menuSel); return true; }
  if (S.mode === 'boot' || S.mode === 'load') return true;
  if (S.mode === 'entry') { entryPick(); return true; }
  if (S.mode === 'over' && S.overT > 0.8) { startGame(); return true; }
  return false;
}

/* ---------- each frame ---------- */
/** One fixed step of the machine (core steps it at most 1/60 s at a time, and not at all while held). */
export function update(dt: number){
  const S = host.S;
  S.time += dt;
  for (let i = S.parts.length - 1; i >= 0; i--) { const q = S.parts[i]; q.life -= dt; q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) S.parts.splice(i, 1); }
  for (let i = S.pops.length - 1; i >= 0; i--) { const q = S.pops[i]; q.life -= dt; q.y -= 24 * dt; if (q.life <= 0) S.pops.splice(i, 1); }
  if (S.mode === 'entry') { updateEntry(dt); return; }
  if (S.mode === 'over') { updateOver(dt); return; }   // attract loop: the game-over card and the high-score table take turns
  if (S.mode === 'boot') { updateBoot(); return; }
  if (S.mode === 'menu') { updateMenu(dt); return; }
  if (S.mode === 'load') { updateLoad(dt); return; }
  if (runtime && GAME_MODES.includes(S.mode)) runtime.update(dt);
}
/** Draw the current screen into the low-res buffer, already cleared to the background. */
export function draw(){
  const S = host.S;
  if (S.mode === 'off') return;   // nothing on the tube
  if (S.mode === 'boot') drawBoot(); else if (S.mode === 'menu') drawMenu(); else if (S.mode === 'load') drawLoad(); else {
    if (runtime) runtime.draw();
    if (S.mode === 'entry') drawEntry();
    if (S.mode === 'over' && S.showBoard) drawBoard();
  }
}

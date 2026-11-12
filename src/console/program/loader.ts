/* The console's own screens: cold and warm boot, the disk menu, and loading a game off the floppy.
   Every load plays the drive (motor, recalibrate, head steps, park) for exactly as long as it takes.
   Part of the console program: no DOM, no Web Audio, no storage. Console state comes through `host`,
   which core binds before a screen runs, and the machine through `host.platform` (platform.ts). */
import { host } from './host';
import { I18N } from '../i18n';
import { createLauncher, type Launcher, type LauncherSystem } from '../launcher';
import { DISKS as GAMES, loadPreviews } from '../../games/registry';
import type { GameDisk } from '../../games/types';
import { useButtons } from '../buttons';
import { BOOT_BUTTONS, MENU_BUTTONS } from '../console-buttons';
import { bootScript, PROMPT } from '../boot';
import { menuRows } from '../menu-layout';
import { readBest, readBoard } from './scores';

export const BOOT_LEN = 4.0, WARM_LEN = 2.3, MAX_LOAD = 5;

/* ---------- drive sounds ---------- */
/** The floppy drive running for `dur` seconds, starting `start` seconds from now. */
export function playDisk(start: number, dur: number){
  const P = host.platform;
  if (!P.sounding || dur <= 0.2) return;
  P.motor(start, dur);   // a low filtered rumble with a hum underneath
  // recalibrate: the head rattles back to track 0
  const recal = Math.min(0.3, dur * 0.12);
  for (let t = 0.12; t < 0.12 + recal; t += 0.013) P.click(start + t, 0.18, 1900);
  // reading: steps out track by track, with pauses while sectors stream in
  let t = 0.2 + recal;
  while (t < dur - 0.4) {
    const run = 1 + ((Math.random() * 4) | 0);
    for (let k = 0; k < run; k++) { P.click(start + t, 0.2, 2400 + Math.random() * 600); t += 0.03; }
    t += 0.08 + Math.random() * 0.2;
  }
  P.click(start + dur - 0.2, 0.25, 1500);   // the head parks
}
export function playBoot(kind: 'cold' | 'warm'){
  const P = host.platform;
  if (!P.sounding) return;
  if (kind === 'cold') { P.tone(1000, 0.2, 0.05, 0, 0.85); playDisk(1.0, BOOT_LEN - 1.45); }
  else { P.tone(1000, 0.12, 0.045, 0, 0.1); playDisk(0.35, WARM_LEN - 0.75); }
}

/* ---------- progress in fits and starts ---------- */
export function progress(steps: [number, number][], f: number){
  f = Math.min(1, Math.max(0, f));
  for (let i = 1; i < steps.length; i++) if (f <= steps[i][0]) { const [a, pa] = steps[i - 1], [b, pb] = steps[i]; return pa + (pb - pa) * ((f - a) / (b - a || 1)); }
  return 1;
}
/** The sector bar: LOADING <FILE>, a framed bar of cells, the percentage and the head's track and sector. Returns the y below it. */
export function sectorBar(x: number, y: number, p: number, t: number, file: string, size: number){
  const { LW, txt, g, col } = host;
  const CELLS = LW < 330 ? 16 : 24, bytes = Math.floor(p * size / 512) * 512, done = p >= 1;
  txt('LOADING ' + file, x, y, 'text'); y += 14;
  const bw = CELLS * 9 + 3, bh = 11;
  g.fillStyle = col('hud'); g.fillRect(x, y, bw, 1); g.fillRect(x, y + bh - 1, bw, 1); g.fillRect(x, y, 1, bh); g.fillRect(x + bw - 1, y, 1, bh);
  const filled = Math.floor(p * CELLS);
  for (let c = 0; c < CELLS; c++) {
    g.fillStyle = col(c < filled ? 'text' : 'textDim');
    g.fillRect(x + 2 + c * 9, y + 2, 8, c < filled ? bh - 4 : 1);
    if (c >= filled) g.fillRect(x + 2 + c * 9 + 3, y + bh - 4, 2, 1);
  }
  txt(String(Math.round(p * 100)).padStart(3, ' ') + '%', x + bw + 8, y + 2, 'text');
  y += 18;
  const spin = '|/-\\'[Math.floor(t * 12) % 4];
  const trk = String(Math.min(39, Math.floor(p * 40))).padStart(2, '0'), sec = 1 + (Math.floor(t * 9) % 9);
  if (!done) txt(LW < 330 ? `${spin} TRK ${trk} SEC ${sec}  ${String(bytes).padStart(5, ' ')}/${size}` : `${spin} TRACK ${trk} SECTOR ${sec}   ${String(bytes).padStart(5, ' ')} / ${size} BYTES`, x, y, 'hud');
  else txt(`${size} BYTES LOADED  ·  RUNNING...`, x, y, 'text');
  return y + 14;
}
/** The sector bar for a game's own loading screen, centred under its artwork. */
export function diskInfo(y: number, p: number, t: number, d: GameDisk){
  const { LW } = host;
  const CELLS = LW < 330 ? 16 : 24, w = CELLS * 9 + 3 + 40;
  return sectorBar(Math.max(10, Math.round(LW / 2 - w / 2)), y, p, t, d.file, d.size);
}

/* ---------- boot ---------- */
export function startConsole(kind: 'cold' | 'warm'){
  const { S, platform: P, clearInput, age, setAccReset, setGame, setManual } = host;
  wire(); P.wakeAudio();
  S.mode = 'boot'; S.bootT = 0; S.bootAt = P.now(); S.bootKind = kind; S.bootLen = kind === 'cold' ? BOOT_LEN : WARM_LEN;
  P.hideCard(); clearInput();
  P.showHold(false);
  if (kind === 'cold') { age.dipLeft = 0.2; setAccReset(); }
  setGame(null); setManual('console'); useButtons(BOOT_BUTTONS);
  playBoot(kind);
}
export function drawBoot(){
  const { S, txt, g, col } = host;
  const t = S.bootT, warm = S.bootKind === 'warm', t1 = S.bootLen - 0.4;
  if (t < 0.05) return;
  const { lines, enterAt } = bootScript(t, warm), t0 = Math.max(enterAt, warm ? 0.7 : 2.1);
  lines.forEach((s, i) => txt(s, 12, 14 + i * 14, 'text'));
  let y = 14 + lines.length * 14, cx = 12, cy = y + 6;
  if (t <= enterAt && lines[lines.length - 1].startsWith(PROMPT)) {
    // the cursor waits at the end of the command being typed
    g.font = '8px Silkscreen, "Courier New", monospace';
    cx = 12 + Math.ceil(g.measureText(lines[lines.length - 1]).width) + 1; cy = y - 14 + 7;
  } else if (t > t0) { y = sectorBar(12, y, Math.min(1, (t - t0) / (t1 - t0)), t, 'MENU.COM', 6144); cy = y + 6; }
  if (Math.floor(t * 3) % 2 === 0) { g.fillStyle = col('text'); g.fillRect(cx, cy, 7, 2); }
}

/* ---------- the disk launcher: the cover carousel (src/console/launcher/) ---------- */
/* ?menu=list keeps the old list for one release, in case the carousel gives trouble (GAM-50; goes in GAM-52) */
const oldList = () => host.platform.oldList;
// disks whose code couldn't be fetched (offline before they were cached): NOT ON DEVICE until the set is back online
const unreachable = new Set<string>();
const lastId = () => host.platform.store.get('gg-last');
// the launcher asks for every disk's best on every frame, so read storage once per visit to the menu:
// scores only change while a game runs, or when the leaflet's Settings clears them
const bests = new Map<string, { score: number; name: string | null }>();
const readBestOf = (id: string) => { const score = readBest(id), top = readBoard(id)[0]; return { score, name: top && top.s === score ? top.n : null }; };
// the platform is bound after this module loads, so listen on the first boot rather than at load time
let wired = false;
function wire(){
  if (wired) return;
  wired = true;
  host.platform.onOnline(() => unreachable.clear());
  host.platform.onSettings(() => bests.clear());
}
const system: LauncherSystem = {
  disks: () => GAMES,
  state: id => unreachable.has(id) ? { kind: 'missing', size: GAMES.find(d => d.id === id)?.size ?? 0 } : { kind: 'ready' },
  best: id => bests.get(id) ?? bests.set(id, readBestOf(id)).get(id)!,
  load: i => loadGame(i),
  download: () => {},
  lastDiskId: lastId,
  reducedMotion: () => host.platform.reducedMotion,
  tick: () => { const P = host.platform; if (P.sounding) P.tone(660, 0.02, 0.03); },
  seek: () => { const P = host.platform; if (P.sounding) { P.click(0.02, 0.18, 2300); P.click(0.07, 0.18, 2500); } },
  label: key => String(I18N.en?.[key] ?? GAMES.map(d => d.strings.en?.[key]).find(v => typeof v === 'string') ?? key),
};
// made on first use: core.ts (and its api) imports this module, so api isn't ready while this file loads
let made: Launcher | null = null;
const launcher = () => (made ??= createLauncher(host.api, system));
/** Where a tap lands on the launcher now, for tests/flow.cjs (`__gg.launcherTargets()`). */
export const launcherTargets = () => oldList() ? [] : launcher().targets();

export function enterMenu(){
  const { S, platform: P, setGame, setManual } = host;
  wire();
  S.mode = 'menu'; S.menuT = 0; S.menuDir = null; S.menuRep = 0;
  bests.clear();
  if (S.menuSel == null) { const i = Math.max(0, GAMES.findIndex(d => d.id === lastId())); S.menuSel = i; }
  launcher().enter(S.menuSel);
  loadPreviews();
  P.hideCard(); setGame(null); setManual('console'); useButtons(MENU_BUTTONS);
}

/* ---------- the old disk list (?menu=list) ---------- */
let menuRects: { x: number; y: number; w: number; h: number; i: number }[] = [];
export function menuMove(d: string){
  const { S, platform: P } = host;
  const n = GAMES.length;
  S.menuSel = (S.menuSel + (d === 'down' || d === 'right' ? 1 : n - 1)) % n;
  if (P.sounding) P.tone(660, 0.02, 0.03);
}
/** A key pressed on the menu, by its `KeyboardEvent.code`. True when the menu used it. */
export function menuKey(code: string){
  const { S } = host;
  if (!oldList()) { const used = launcher().key(code); S.menuSel = launcher().sel; return used; }
  const KEYS: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  if (KEYS[code]) { menuMove(KEYS[code]); return true; }
  if (['Space', 'Enter', 'NumpadEnter', 'KeyZ', 'KeyX'].includes(code)) { loadGame(S.menuSel); return true; }
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (m && +m[1] <= GAMES.length) { S.menuSel = +m[1] - 1; loadGame(S.menuSel); return true; }
  return false;
}
export function updateMenu(dt: number){
  const { S, stickDir } = host;
  if (!oldList()) { S.menuT += dt; launcher().update(dt, stickDir); S.menuSel = launcher().sel; return; }
  S.menuT += dt; S.menuRep -= dt;
  if (stickDir !== S.menuDir) { S.menuDir = stickDir; if (stickDir) { menuMove(stickDir); S.menuRep = 0.4; } }
  else if (stickDir && S.menuRep <= 0) { menuMove(stickDir); S.menuRep = 0.18; }
}
export function menuTap(x: number, y: number){
  const { S } = host;
  if (!oldList()) { launcher().tap(x, y); S.menuSel = launcher().sel; return; }
  const hit = menuRects.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  if (hit) { S.menuSel = hit.i; loadGame(hit.i); }
}
function floppy(x: number, y: number, on: boolean){
  const { g, col } = host;
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x, y, 14, 15);
  g.fillStyle = col('bg'); g.fillRect(x + 13, y, 1, 1);                              // clipped corner
  g.fillStyle = col(on ? 'bg' : 'textDim'); g.fillRect(x + 3, y, 8, 5);              // shutter
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x + 8, y + 1, 2, 3);
  g.fillStyle = col(on ? 'bg' : 'textDim'); g.fillRect(x + 2, y + 7, 10, 7);          // label
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x + 3, y + 9, 8, 1); g.fillRect(x + 3, y + 11, 6, 1);
}
export function drawMenu(){
  const { S, LH, LW, txt, g, col } = host;
  if (!oldList()) {
    if (S.diskError > 0) S.diskError -= 1 / 60;
    launcher().draw(S.diskError > 0 ? 'DISK ERROR · CONNECT AND TRY AGAIN' : null);
    return;
  }
  const t = S.menuT, n = GAMES.length;
  // rows shrink (and drop their second line) when the disks don't all fit on a short tube
  const { rowH, gap, top } = menuRows(n, LH), tall = rowH >= 30;
  const bw = Math.min(LW - 16, 300), x0 = Math.round(LW / 2 - bw / 2);
  txt('PGD-01', LW / 2, top, 'text', 'center', 16);
  txt('P O R T A B L E', LW / 2, top + 20, 'gold', 'center');
  g.fillStyle = col('hud'); for (let x = x0; x < x0 + bw; x += 4) g.fillRect(x, top + 34, 2, 1);
  txt('A:\\> SELECT A DISK', x0, top + 42, 'hud');
  menuRects = [];
  GAMES.forEach((d, i) => {
    const y = top + 60 + i * (rowH + gap), on = i === S.menuSel, ty = tall ? y + 7 : Math.round(y + rowH / 2 - 4);
    menuRects.push({ x: x0, y, w: bw, h: rowH, i });
    g.fillStyle = col(on ? 'text' : 'textDim');
    g.fillRect(x0, y, bw, 1); g.fillRect(x0, y + rowH - 1, bw, 1); g.fillRect(x0, y, 1, rowH); g.fillRect(x0 + bw - 1, y, 1, rowH);
    if (on && Math.floor(t * 3) % 2 === 0) txt('>', x0 + 5, tall ? y + 14 : ty, 'text');
    if (tall) floppy(x0 + 14, y + 10, on);
    txt(`${i + 1} ${d.title}`, x0 + (tall ? 36 : 16), ty, on ? 'text' : 'hud');
    const hi = readBest(d.id);
    txt('HI ' + String(hi).padStart(6, '0'), x0 + bw - 6, ty, on ? 'gold' : 'hud', 'right');
    if (tall) {
      txt(d.blurb, x0 + 36, y + 20, 'textDim');
      txt(`${Math.round(d.size / 1024)}K`, x0 + bw - 6, y + 20, 'textDim', 'right');
    }
  });
  const by = top + 60 + n * (rowH + gap) + 6;
  if (Math.floor(t * 2) % 2 === 0) txt('STICK TO CHOOSE · SELECT TO LOAD', LW / 2, by, 'hud', 'center');
  if (S.diskError > 0) { S.diskError -= 1 / 60; txt('DISK ERROR · CONNECT AND TRY AGAIN', LW / 2, by + 14, 'gold', 'center'); }
  else txt(`DRIVE A: ${n} DISKS`, LW / 2, by + 14, 'textDim', 'center');
}

/* ---------- loading a game ---------- */
export function loadGame(i: number){
  const { platform: P, setGame, S, fetchRuntime, clearInput } = host;
  const d = GAMES[i]; if (!d) return;
  P.wakeAudio();
  setGame(d);
  P.store.set('gg-last', d.id);
  S.mode = 'load'; S.loadT = 0; S.loadAt = P.now(); S.loadLen = Math.min(MAX_LOAD, d.loadSecs);
  // the game's code arrives while the drive reads; the bar waits at the last sector if it's late
  S.loadErr = null;
  fetchRuntime(d).catch(err => { S.loadErr = err; });
  clearInput();
  // after wakeAudio: the output may have just been created, so read it now
  if (P.sounding) P.tone(1200, 0.03, 0.04);
  playDisk(0.05, S.loadLen - 0.05);
  P.track('game_load', { game: d.id, layout: P.layoutName() });
}
// boots and loads run on the wall clock, like the drive sounds, so a slow frame rate can't stretch them
export function updateBoot(){
  const { S, platform: P } = host;
  S.bootT = (P.now() - S.bootAt) / 1000;
  if (S.bootT < S.bootLen) return;
  // a game's own page (/dino-run …) boots straight into its disk the first time; RESET and SELECT go to the menu
  const auto = P.autoloadId(), i = auto && !S.autoDone ? GAMES.findIndex(d => d.id === auto) : -1;
  S.autoDone = true;
  if (i >= 0) { S.menuSel = i; loadGame(i); } else enterMenu();
}
export function updateLoad(_dt: number){
  const { S, platform: P, runtimeReady, game, startGame } = host;
  S.loadT = (P.now() - S.loadAt) / 1000;
  if (S.loadT < S.loadLen + 0.35) return;
  if (runtimeReady(game.id)) { unreachable.delete(game.id); startGame(); }   // it loaded, so it's on the device after all
  else if (S.loadErr) { S.diskError = 2.5; unreachable.add(game.id); enterMenu(); }   // couldn't fetch the game (offline before it was cached)
}
export function drawLoad(){
  const { game, S, api, runtimeReady } = host;
  let p = progress(game.steps, S.loadT / S.loadLen);
  if (p >= 1 && !runtimeReady(game.id)) p = 0.99;
  game.drawLoad(api, p, S.loadT);
}

/* ---------- SELECT: back to the disk menu through a warm boot ---------- */
export function pressSelect(){
  const { platform: P, tvOn, game, S } = host;
  P.wakeAudio();
  if (P.sounding) P.tone(1100, 0.015, 0.06);
  P.flash('select');
  if (!tvOn) return;
  P.track('select', { game: game ? game.id : 'menu', level: S.level });
  startConsole('warm');
}

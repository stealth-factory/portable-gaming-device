/* The console's own screens: cold and warm boot, the disk menu, and loading a game off the floppy.
   Every load plays the drive (motor, recalibrate, head steps, park) for exactly as long as it takes. */
import {
  S, g, col, txt, LW, LH, HUD, ac, muted, tone, noise, headClick, ensureAudio, stickDir, held,
  overlay, $, tvOn, age, setAccReset, track, layoutName, startGame, setGame, game, readBest, setManual,
  clearInput, ordinal, api, fetchRuntime, runtimeReady,
} from './core';
import { DISKS as GAMES } from '../games/registry';
import type { ButtonMap, GameDisk } from '../games/types';
import { useButtons } from './buttons';

export const BOOT_LEN = 4.0, WARM_LEN = 2.3, MAX_LOAD = 5;

/* ---------- drive sounds ---------- */
/** The floppy drive running for `dur` seconds, starting `start` seconds from now. */
export function playDisk(start: number, dur: number){
  if (!ac || muted || dur <= 0.2) return;
  const t0 = ac.currentTime + start, end = t0 + dur;
  // motor: a low filtered rumble with a hum underneath
  const m = noise(), lp = ac.createBiquadFilter(), mg = ac.createGain(), hum = ac.createOscillator(), hg = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 220;
  const up = Math.min(0.25, dur * 0.15), down = Math.min(0.35, dur * 0.15);
  mg.gain.setValueAtTime(0.0001, t0); mg.gain.exponentialRampToValueAtTime(0.16, t0 + up);
  mg.gain.setValueAtTime(0.16, end - down); mg.gain.exponentialRampToValueAtTime(0.0001, end);
  hum.type = 'sawtooth'; hum.frequency.setValueAtTime(40, t0); hum.frequency.linearRampToValueAtTime(75, t0 + Math.min(0.4, dur * 0.2));
  hg.gain.setValueAtTime(0.0001, t0); hg.gain.exponentialRampToValueAtTime(0.012, t0 + up);
  hg.gain.setValueAtTime(0.012, end - down); hg.gain.exponentialRampToValueAtTime(0.0001, end);
  m.connect(lp).connect(mg).connect(ac.destination); hum.connect(hg).connect(ac.destination);
  m.start(t0); m.stop(end + 0.05); hum.start(t0); hum.stop(end + 0.05);
  // recalibrate: the head rattles back to track 0
  const recal = Math.min(0.3, dur * 0.12);
  for (let t = 0.12; t < 0.12 + recal; t += 0.013) headClick(t0 + t, 0.18, 1900);
  // reading: steps out track by track, with pauses while sectors stream in
  let t = 0.2 + recal;
  while (t < dur - 0.4) {
    const run = 1 + ((Math.random() * 4) | 0);
    for (let k = 0; k < run; k++) { headClick(t0 + t, 0.2, 2400 + Math.random() * 600); t += 0.03; }
    t += 0.08 + Math.random() * 0.2;
  }
  headClick(end - 0.2, 0.25, 1500);   // the head parks
}
export function playBoot(kind: 'cold' | 'warm'){
  if (!ac || muted) return;
  if (kind === 'cold') { tone(1000, 0.2, 0.05, 0, 0.85); playDisk(1.0, BOOT_LEN - 1.45); }
  else { tone(1000, 0.12, 0.045, 0, 0.1); playDisk(0.35, WARM_LEN - 0.75); }
}

/* ---------- progress in fits and starts ---------- */
export function progress(steps: [number, number][], f: number){
  f = Math.min(1, Math.max(0, f));
  for (let i = 1; i < steps.length; i++) if (f <= steps[i][0]) { const [a, pa] = steps[i - 1], [b, pb] = steps[i]; return pa + (pb - pa) * ((f - a) / (b - a || 1)); }
  return 1;
}
/** The sector bar: LOADING <FILE>, a framed bar of cells, the percentage and the head's track and sector. Returns the y below it. */
export function sectorBar(x: number, y: number, p: number, t: number, file: string, size: number){
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
  const CELLS = LW < 330 ? 16 : 24, w = CELLS * 9 + 3 + 40;
  return sectorBar(Math.max(10, Math.round(LW / 2 - w / 2)), y, p, t, d.file, d.size);
}

/* ---------- the console's own buttons: the boot and the disk menu are apps like any game ---------- */
// booting: nothing to press yet
export const BOOT_BUTTONS: ButtonMap = { fire: { label: 'spark', enabled: false }, boost: { label: 'boost', enabled: false } };
// the disk menu: FIRE loads the highlighted disk; BOOST has no job here, so it stays dark
export const MENU_BUTTONS: ButtonMap = { fire: { label: 'menuSel' }, boost: { label: 'boost', enabled: false } };

/* ---------- boot ---------- */
export function startConsole(kind: 'cold' | 'warm'){
  ensureAudio();
  S.mode = 'boot'; S.bootT = 0; S.bootAt = performance.now(); S.bootKind = kind; S.bootLen = kind === 'cold' ? BOOT_LEN : WARM_LEN;
  overlay.hidden = true; clearInput();
  $('pauseBtn').setAttribute('aria-pressed', 'false');
  if (kind === 'cold') { age.dipLeft = 0.2; setAccReset(); }
  setGame(null); setManual('console'); useButtons(BOOT_BUTTONS);
  playBoot(kind);
}
export function drawBoot(){
  const t = S.bootT, warm = S.bootKind === 'warm', lines: string[] = [];
  const t0 = warm ? 0.7 : 2.1, t1 = S.bootLen - 0.4;
  if (warm) {
    if (t > 0.05) lines.push('GAME GUY 3000 DELUXE   BIOS 1.0');
    if (t > 0.15) lines.push('WARM BOOT');
    if (t > 0.3) lines.push('');
    if (t > 0.45) lines.push('A>MENU');
  } else {
    if (t > 0.05) lines.push('GAME GUY 3000 DELUXE   BIOS 1.0');
    if (t > 0.2) { const k = Math.min(640, Math.floor((t - 0.2) / 0.6 * 40) * 16); lines.push(`MEMORY TEST  ${String(k).padStart(3, ' ')}K${t > 0.82 ? '  OK' : ''}`); }
    if (t > 1.0) lines.push('DRIVE A:  360K FLOPPY');
    if (t > 1.15) lines.push('');
    if (t > 1.2) lines.push('BOOTING FROM DRIVE A:');
    if (t > 1.9) lines.push('A>MENU');
  }
  lines.forEach((s, i) => txt(s, 12, 14 + i * 14, 'text'));
  let y = 14 + lines.length * 14;
  if (t > t0) y = sectorBar(12, y, Math.min(1, (t - t0) / (t1 - t0)), t, 'MENU.COM', 6144);
  if (Math.floor(t * 3) % 2 === 0) { g.fillStyle = col('text'); g.fillRect(12, y + 6, 7, 2); }
}

/* ---------- the disk menu ---------- */
let menuRects: { x: number; y: number; w: number; h: number; i: number }[] = [];
export function enterMenu(){
  S.mode = 'menu'; S.menuT = 0; S.menuDir = null; S.menuRep = 0;
  if (S.menuSel == null) { let i = 0; try { i = Math.max(0, GAMES.findIndex(d => d.id === localStorage.getItem('gg-last'))); } catch (_) {} S.menuSel = i; }
  overlay.hidden = true; setGame(null); setManual('console'); useButtons(MENU_BUTTONS);
}
export function menuMove(d: string){
  const n = GAMES.length;
  S.menuSel = (S.menuSel + (d === 'down' || d === 'right' ? 1 : n - 1)) % n;
  if (ac && !muted) tone(660, 0.02, 0.03);
}
export function menuKey(e: KeyboardEvent){
  const KEYS: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  if (KEYS[e.code]) { menuMove(KEYS[e.code]); return true; }
  if (['Space', 'Enter', 'NumpadEnter', 'KeyZ', 'KeyX'].includes(e.code)) { loadGame(S.menuSel); return true; }
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (m && +m[1] <= GAMES.length) { S.menuSel = +m[1] - 1; loadGame(S.menuSel); return true; }
  return false;
}
export function updateMenu(dt: number){
  S.menuT += dt; S.menuRep -= dt;
  if (stickDir !== S.menuDir) { S.menuDir = stickDir; if (stickDir) { menuMove(stickDir); S.menuRep = 0.4; } }
  else if (stickDir && S.menuRep <= 0) { menuMove(stickDir); S.menuRep = 0.18; }
}
export function menuTap(x: number, y: number){
  const hit = menuRects.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  if (hit) { S.menuSel = hit.i; loadGame(hit.i); }
}
function floppy(x: number, y: number, on: boolean){
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x, y, 14, 15);
  g.fillStyle = col('bg'); g.fillRect(x + 13, y, 1, 1);                              // clipped corner
  g.fillStyle = col(on ? 'bg' : 'textDim'); g.fillRect(x + 3, y, 8, 5);              // shutter
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x + 8, y + 1, 2, 3);
  g.fillStyle = col(on ? 'bg' : 'textDim'); g.fillRect(x + 2, y + 7, 10, 7);          // label
  g.fillStyle = col(on ? 'text' : 'hud'); g.fillRect(x + 3, y + 9, 8, 1); g.fillRect(x + 3, y + 11, 6, 1);
}
export function drawMenu(){
  const t = S.menuT, n = GAMES.length;
  // rows shrink (and drop their second line) when the disks don't all fit on a short tube
  const rowH = Math.max(18, Math.min(36, Math.floor((LH - 16 - 64 - 36) / n) - 6)), tall = rowH >= 30, gap = tall ? 6 : 3;
  const bw = Math.min(LW - 16, 300), x0 = Math.round(LW / 2 - bw / 2);
  const block = 64 + n * (rowH + gap) + 36, top = Math.max(8, Math.round((LH - block) / 2));
  txt('GAME GUY 3000', LW / 2, top, 'text', 'center', 16);
  txt('D E L U X E', LW / 2, top + 20, 'gold', 'center');
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
  const d = GAMES[i]; if (!d) return;
  ensureAudio();
  setGame(d);
  try { localStorage.setItem('gg-last', d.id); } catch (_) {}
  S.mode = 'load'; S.loadT = 0; S.loadAt = performance.now(); S.loadLen = Math.min(MAX_LOAD, d.loadSecs);
  // the game's code arrives while the drive reads; the bar waits at the last sector if it's late
  S.loadErr = null;
  fetchRuntime(d).catch(err => { S.loadErr = err; });
  clearInput();
  if (ac && !muted) tone(1200, 0.03, 0.04);
  playDisk(0.05, S.loadLen - 0.05);
  track('game_load', { game: d.id, layout: layoutName() });
}
// boots and loads run on the wall clock, like the drive sounds, so a slow frame rate can't stretch them
export function updateBoot(){
  S.bootT = (performance.now() - S.bootAt) / 1000;
  if (S.bootT < S.bootLen) return;
  // a game's own page (/dino-run …) boots straight into its disk the first time; RESET and SELECT go to the menu
  const auto = document.documentElement.dataset.autoload, i = auto && !S.autoDone ? GAMES.findIndex(d => d.id === auto) : -1;
  S.autoDone = true;
  if (i >= 0) { S.menuSel = i; loadGame(i); } else enterMenu();
}
export function updateLoad(_dt: number){
  S.loadT = (performance.now() - S.loadAt) / 1000;
  if (S.loadT < S.loadLen + 0.35) return;
  if (runtimeReady(game.id)) startGame();
  else if (S.loadErr) { S.diskError = 2.5; enterMenu(); }   // couldn't fetch the game (offline before it was cached)
}
export function drawLoad(){
  let p = progress(game.steps, S.loadT / S.loadLen);
  if (p >= 1 && !runtimeReady(game.id)) p = 0.99;
  game.drawLoad(api, p, S.loadT);
}

/* ---------- SELECT: back to the disk menu through a warm boot ---------- */
export function pressSelect(){
  ensureAudio(); if (ac) tone(1100, 0.015, 0.06);
  const b = $('selectBtn'); if (b) { b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 140); }
  if (!tvOn) return;
  track('select', { game: game ? game.id : 'menu', level: S.level });
  startConsole('warm');
}

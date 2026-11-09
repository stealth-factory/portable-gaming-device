import { track as vaTrack } from '@vercel/analytics';
import { DISKS, loadGameCode } from "../games/registry";
import type { GameDisk, GameRuntime, ConsoleAPI } from "../games/types";
import { bus } from "./bus";
import * as Btn from "./buttons";
import { Stick } from "./stick";
import { makeHaptics, type Haptic } from "../kit/platform/haptics";
import { DEFAULTS, scoreKeys, SETTINGS_EVENT } from "./settings";
import { diskInfo, startConsole, drawBoot, updateBoot, enterMenu, updateMenu, drawMenu, menuKey, menuTap, updateLoad, drawLoad, pressSelect, loadGame } from "./loader";
export let W = 15, H = 10;
export const C = 32, CELL = 24, HUD = 20, K = CELL / C;   // game units per cell, low-res pixels per cell
export let LW = W * CELL, LH = H * CELL + HUD;              // low-res frame buffer, like a 1980s graphics mode; resized to fit the screen
export const $ = (id: string): any => document.getElementById(id);
export const cv = $('cv'), ctx = cv.getContext('2d');
export const lo = document.createElement('canvas'); lo.width = LW; lo.height = LH;
export const lx = lo.getContext('2d', { willReadFrequently: true });
export const glow = document.createElement('canvas'); glow.width = 120; glow.height = 87;   // resized with the grid
export const gx = glow.getContext('2d');
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const acc = document.createElement('canvas'); acc.width = LW; acc.height = LH;   // what the phosphor is still glowing with
export const ax = acc.getContext('2d');
export let accImg = ax.createImageData(LW, LH), A = new Float32Array(LW * LH * 4);
export let accReset = true, warmT = 0, frameDt = 1 / 60, mask = null;
export const WARM = 0.75;
/* an old tube's quirks: magnetised patches, burn-in, dust, the odd tear or brown-out */
export const age = { dg: 99, next: 6, tearLeft: 0, tearY: 0, tearH: 0, tearDx: 0, dipLeft: 0,
  stains: [
    { x: 0.08 + Math.random() * 0.18, y: 0.08 + Math.random() * 0.2, r: 0.36, tint: '#ff92e8', k: 0.85 },
    { x: 0.74 + Math.random() * 0.2, y: 0.62 + Math.random() * 0.26, r: 0.3, tint: '#9effb6', k: 0.7 },
  ] };
export let burn = null;
export const dust = document.createElement('canvas'); dust.width = 720; dust.height = 520;
(() => {
  const d = dust.getContext('2d');
  for (let i = 0; i < 16; i++) {
    d.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.3})`;
    d.beginPath(); d.arc(Math.random() * 720, Math.random() * 520, 0.6 + Math.random() * 1.6, 0, Math.PI * 2); d.fill();
  }
  for (let i = 0; i < 6; i++) { d.fillStyle = 'rgba(255,255,255,.07)'; d.fillRect(Math.random() * 720, Math.random() * 520, 1.5, 1.5); }
  d.strokeStyle = 'rgba(0,0,0,.16)'; d.lineWidth = 0.8; d.beginPath();
  const hx = 520 + Math.random() * 150, hy = 60 + Math.random() * 100;
  d.moveTo(hx, hy); d.bezierCurveTo(hx + 20, hy + 30, hx - 15, hy + 50, hx + 12, hy + 80); d.stroke();   // a stray hair on the glass
})();
export function buildBurn(){
  // years of the same title screen wore the phosphor: those spots now glow a little less
  burn = document.createElement('canvas'); burn.width = LW; burn.height = LH;
  const b = burn.getContext('2d');
  b.fillStyle = '#fff'; b.fillRect(0, 0, LW, LH);
  b.fillStyle = '#d0d0d0'; b.font = '16px Silkscreen, "Courier New", monospace'; b.textAlign = 'center'; b.textBaseline = 'middle';
  b.fillText('GAME GUY 3000', LW / 2, LH * 0.42);
  b.fillStyle = '#dadada'; b.font = '8px Silkscreen, "Courier New", monospace'; b.textAlign = 'left'; b.textBaseline = 'top';
  b.fillText('000000', 6, 6); b.fillText('HI 000000', 80, 6);
}

/* ---------- display modes ---------- */
export const CGA_ROLES = { bg:0, dirt:2, ds1:0, ds2:1, core:0, spawn:1, gemDark:0, gem:1, gemHi:3, bagDark:0, bag:3, bagBand:2, gold:3, goldDark:2, goldHi:1,
  cart:3, cartShade:1, window:2, lamp:3, drill:1, drillLine:0, track:2, wheel:3, grub:1, grubBelly:3, borer:2, borerBelly:3, horn:3, eye:3, pupil:0,
  scared:3, scaredBelly:1, scaredFlash:2, sun:3, sunRay:1, spark:3, sparkTrail:1, text:3, textDim:1, hud:1 };
export const MONO_ROLES = { bg:0, dirt:1, ds1:0, ds2:2, core:0, spawn:1, gemDark:0, gem:2, gemHi:3, bagDark:0, bag:2, bagBand:1, gold:3, goldDark:1, goldHi:2,
  cart:3, cartShade:2, window:1, lamp:3, drill:2, drillLine:0, track:1, wheel:2, grub:2, grubBelly:3, borer:3, borerBelly:2, horn:3, eye:3, pupil:0,
  scared:1, scaredBelly:2, scaredFlash:3, sun:3, sunRay:2, spark:3, sparkTrail:2, text:3, textDim:2, hud:2 };
/* half: seconds for the phosphor glow to halve after the beam moves on. bezel: highlight, body, shadow, plate ink, unlit glass */
export const MODES = {
  greenP1:  { name:'GREEN P1', pal:['#140e09','#0f5a1d','#2fbf4b','#b2ffbd'], roles:MONO_ROLES, phos:3, phos2:2, half:0.045, bloom:0.36, mask:false,
              bezel:['#43473f','#2c2f2a','#1d1f1b','#8f978a','#1a120c'] },
  greenP39: { name:'LONG GREEN P39', pal:['#120c08','#0b4416','#33e05a','#c6ffd0'], roles:MONO_ROLES, phos:3, phos2:2, half:0.17, bloom:0.44, mask:false,
              bezel:['#3a3f3a','#252925','#171a17','#86907f','#180f0a'] },
  /* the radar tube: a fast blue-white flash where the beam writes, then a long yellow-green afterglow. sweep: the beam is visible, top to bottom */
  radarP7:  { name:'RADAR P7', pal:['#0b0d0b','#3d5a0e','#a9d22c','#e4f1ff'], roles:MONO_ROLES, phos:2, phos2:3, half:0.32, bloom:0.46, mask:false, sweep:2.4,
              bezel:['#3b3f40','#26292a','#181a1b','#8c949a','#0e100f'] },
  amberP3:  { name:'AMBER P3', pal:['#170d07','#6b3900','#de8c12','#ffd890'], roles:MONO_ROLES, phos:3, phos2:2, half:0.065, bloom:0.4, mask:false,
              bezel:['#403a33','#2a2622','#1b1815','#9a8f80','#1c120b'] },
  whiteP4:  { name:'PAPER WHITE P4', pal:['#15100c','#3a404e','#9aa3b6','#eef2ff'], roles:MONO_ROLES, phos:3, phos2:2, half:0.02, bloom:0.28, mask:false,
              bezel:['#e3dcc8','#cfc6b0','#a9a08a','#5a5446','#1b140f'] },
  cga1:     { name:'CGA COLOUR 1', pal:['#140e0a','#55ffff','#ff55ff','#ffffff'], roles:CGA_ROLES, phos:1, phos2:2, half:0.012, bloom:0.3, mask:true,
              bezel:['#ddd4bd','#c9bfa6','#a39a82','#574f40','#1a120d'] },
  cga0:     { name:'CGA COLOUR 0', pal:['#140e0a','#55ff55','#ff5555','#ffff55'], roles:CGA_ROLES, phos:1, phos2:3, half:0.012, bloom:0.3, mask:true,
              bezel:['#ddd4bd','#c9bfa6','#a39a82','#574f40','#1a120d'] },
};
export const MODE_ORDER = Object.keys(MODES);
export const LEGACY = { green:'greenP1', amber:'amberP3', white:'whiteP4' };
export let modeKey = 'greenP1', fx = true;
try { let m = localStorage.getItem('eb-mode'); m = LEGACY[m] || m; if (MODES[m]) modeKey = m; fx = localStorage.getItem('eb-fx') !== '0'; } catch (e) {}
export let M = MODES[modeKey], palRGB = [];
export const col = role => M.pal[M.roles[role]];
document.querySelectorAll('#modes [data-mode]').forEach(b => {
  b.querySelector('.sw4').innerHTML = MODES[b.dataset.mode].pal.map(c => `<i style="background:${c}"></i>`).join('');
});
export function setMode(k){
  modeKey = k; M = MODES[k];
  palRGB = M.pal.map(h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]);
  document.querySelectorAll('#modes [data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === k)));
  const R = document.documentElement.style, [hi, mid, low, ink, glass] = M.bezel;
  R.setProperty('--phos', M.pal[M.phos]); R.setProperty('--phos2', M.pal[M.phos2]);
  R.setProperty('--plastic-hi', hi); R.setProperty('--plastic', mid); R.setProperty('--plastic-lo', low);
  R.setProperty('--bezel-ink', ink); R.setProperty('--glass', glass);
  $('plate').textContent = 'GG-3000 DX · ' + M.name;
  updateDial(MODE_ORDER.indexOf(k));
  try { localStorage.setItem('eb-mode', k); } catch (e) {}
  accReset = true; warmT = 0; age.dg = 0;
  if (ac && !muted && (typeof tvOn === 'undefined' || tvOn)) { tone(58, 0.9, 0.04, 14); tone(15000, 0.4, 0.006, 0); }   // degauss "boinng" and flyback whine
  if (runtime && runtime.onPalette) runtime.onPalette();
}
/* the phosphor dial: seven detents, turned by dragging, clicking (next), scrolling, arrow keys or the labels */
export const SHORT = { greenP1:'GREEN', greenP39:'P39', radarP7:'P7', amberP3:'AMBER', whiteP4:'WHITE', cga1:'CGA 1', cga0:'CGA 0' };
export const ANG = [-135, -90, -45, 0, 45, 90, 135];
export function updateDial(i){
  const cap = $('dialCap'), dial = $('dial'); if (!cap) return;
  cap.style.transform = `rotate(${ANG[i]}deg)`;
  dial.setAttribute('aria-valuenow', String(i)); dial.setAttribute('aria-valuetext', MODES[MODE_ORDER[i]].name);
  document.querySelectorAll('#dialLabels .dl').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
}
/* ---------- analytics: Vercel Web Analytics custom events, at most two properties each (the Pro plan limit) ---------- */
export function track(name: string, data?: Record<string, string | number | boolean | null>){
  try { vaTrack(name, data); } catch (_) {}
}
export const layoutName = () => document.documentElement.getAttribute('data-layout') || 'desk';
export function turnTo(i){
  i = Math.max(0, Math.min(MODE_ORDER.length - 1, i));
  if (MODE_ORDER[i] === modeKey) return;
  ensureAudio(); tone(2400, 0.012, 0.05); buzz('tick');   // detent click
  setMode(MODE_ORDER[i]);
  track('theme', { theme: MODE_ORDER[i], via: 'dial' });
}
(() => {
  const wrap = $('dialLabels'), dial = $('dial');
  MODE_ORDER.forEach((k, i) => {
    const a = ANG[i] * Math.PI / 180;
    const t = document.createElement('span'); t.className = 'tk'; t.style.transform = `rotate(${ANG[i]}deg) translateY(-48px)`; wrap.appendChild(t);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dl'; b.textContent = SHORT[k];
    b.setAttribute('aria-label', MODES[k].name);
    b.style.left = (50 + 50 * Math.sin(a)) + '%'; b.style.top = (50 - 44 * Math.cos(a)) + '%';   // a little wider at the sides, so the side labels clear the knob
    b.addEventListener('click', () => turnTo(i));
    wrap.appendChild(b);
  });
  let pid = null, moved = false, sx = 0, sy = 0, wheelT = 0;
  dial.addEventListener('pointerdown', e => {
    pid = e.pointerId; moved = false; sx = e.clientX; sy = e.clientY;
    try { dial.setPointerCapture(pid); } catch (_) {}
    dial.classList.add('grabbing'); e.preventDefault(); dial.focus({ preventScroll: true });
  });
  dial.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) moved = true;
    if (!moved) return;
    const r = dial.getBoundingClientRect();
    const ang = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
    if (Math.abs(ang) > 150) return;   // past the end stops
    let near = 0; ANG.forEach((a, i) => { if (Math.abs(a - ang) < Math.abs(ANG[near] - ang)) near = i; });
    turnTo(near);
  });
  dial.addEventListener('pointerup', e => {
    if (e.pointerId !== pid) return;
    pid = null; dial.classList.remove('grabbing');
    if (!moved) turnTo((MODE_ORDER.indexOf(modeKey) + 1) % MODE_ORDER.length === 0 ? 0 : MODE_ORDER.indexOf(modeKey) + 1);
  });
  dial.addEventListener('pointercancel', () => { pid = null; dial.classList.remove('grabbing'); });
  dial.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now(); if (now - wheelT < 180) return; wheelT = now;
    turnTo(MODE_ORDER.indexOf(modeKey) + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  dial.addEventListener('keydown', e => {
    const i = MODE_ORDER.indexOf(modeKey);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') turnTo(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') turnTo(i - 1);
    else if (e.key === 'Home') turnTo(0);
    else if (e.key === 'End') turnTo(MODE_ORDER.length - 1);
    else return;
    e.preventDefault(); e.stopPropagation();
  });
})();
export function setFx(v){ fx = v; accReset = true; $('fxBtn').setAttribute('aria-pressed', String(v)); try { localStorage.setItem('eb-fx', v ? '1' : '0'); } catch (e) {} }

/* ---------- utilities ---------- */
export const idx = (x, y) => y * W + x;
export const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const DIRS = { up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0} };

/* ---------- scores: each game keeps its own best and top-ten table on this device (localStorage only) ---------- */
export let game: GameDisk = DISKS[0];
/* the loaded game's code: fetched while its disk loads, then kept (one runtime per game) */
export let runtime: GameRuntime | null = null;
const runtimes: Record<string, GameRuntime> = {};
export const runtimeReady = (id: string) => !!runtimes[id];
export function fetchRuntime(d: GameDisk){
  if (runtimes[d.id]) return Promise.resolve(runtimes[d.id]);
  return loadGameCode(d.id).then(create => (runtimes[d.id] = runtimes[d.id] || create(api)));
}
export let best = 0;
export const BOARD_MAX = 10, NAME_MAX = 9;
const bestKey = (id: string) => 'gg-best-' + id, boardKey = (id: string) => 'gg-board-' + id;
const OLD_KEYS: Record<string, { best: string; board: string }> = { tunnel: { best: 'eb-best', board: 'tr-board' } };   // from the standalone Tunnel Raider
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_) {} };
export const cleanName = v => String(v || '').toUpperCase().replace(/[^A-Z ]/g, '').slice(0, NAME_MAX);
export function readBoard(id: string){
  const raw = lsGet(boardKey(id)) ?? (OLD_KEYS[id] ? lsGet(OLD_KEYS[id].board) : null);
  try {
    const b = JSON.parse(raw || '[]');
    if (Array.isArray(b)) return b.filter(e => e && Number.isFinite(e.s) && e.s > 0).map(e => ({ n: cleanName(e.n).trim() || 'RAIDER', s: Math.floor(e.s), l: Math.max(1, e.l | 0) })).sort((a, b) => b.s - a.s).slice(0, BOARD_MAX);
  } catch (_) {}
  return [];
}
const bestCache: Record<string, number> = {};
export function readBest(id: string){
  if (bestCache[id] != null) return bestCache[id];
  const raw = lsGet(bestKey(id)) ?? (OLD_KEYS[id] ? lsGet(OLD_KEYS[id].best) : null);
  const b = readBoard(id);
  return (bestCache[id] = Math.max(parseInt(raw || '0', 10) || 0, b.length ? b[0].s : 0));
}
export function saveBest(){ bestCache[game.id] = best; lsSet(bestKey(game.id), String(best)); }
export let board = [], lastName = cleanName(lsGet('gg-name') ?? lsGet('tr-name'));
export function loadScores(id: string){ board = readBoard(id); best = readBest(id); }
loadScores(game.id);
export function saveBoard(){ lsSet(boardKey(game.id), JSON.stringify(board)); lsSet('gg-name', lastName); }
export const boardRank = sc => { const i = board.findIndex(e => sc > e.s); return i < 0 ? board.length : i; };   // ties go below the older score
export const qualifies = sc => sc > 0 && boardRank(sc) < BOARD_MAX;
export const ordinal = n => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

/* ---------- audio (PC-speaker style square waves) ---------- */
export let ac = null, muted = false;
export function ensureAudio(){
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume().catch(()=>{});
}
/* every sound goes out through one gain node, so hush() can cut whatever is still ringing or already scheduled
   (the drive, a game's effects) by dropping it; the next sound makes a fresh one */
let outNode = null;
export function out(){ if (!outNode) { outNode = ac.createGain(); outNode.connect(ac.destination); } return outNode; }
export function hush(){
  if (!outNode) return;
  const b = outNode; outNode = null;
  try { b.gain.cancelScheduledValues(0); b.gain.value = 0; b.disconnect(); } catch (_) {}
}
export function tone(f, dur, vol=0.045, slide=0, delay=0){
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.setValueAtTime(vol, t0 + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out()); o.start(t0); o.stop(t0 + dur + 0.02);
}

/* ---------- haptics: buzzes on phones that can vibrate, silent with SOUND off (rules in src/kit/platform/haptics.ts) ---------- */
const haptics = makeHaptics({
  vibrate: p => typeof navigator.vibrate === 'function' && navigator.vibrate(p.length === 1 ? p[0] : p),
  enabled: () => !muted,
  now: () => performance.now(),
});
export function buzz(h: Haptic){ haptics.buzz(h); }

/* ---------- state ---------- */
export const S: any = {
  mode: 'title', prevMode: null, modeT: 0, time: 0,
  level: 1, score: 0, lives: 3, nextLife: 20000,
  dug: new Uint8Array(W * H), em: new Uint8Array(W * H), emLeft: 0,
  bags: [], golds: [], monsters: [], sparks: [], parts: [], pops: [],
  spawned: 0, total: 0, maxAlive: 3, spawnT: 0,
  sun: { active: false, used: false, x: W - 2, y: 1 },
  bonusT: 0, bonusChain: 0, sirenT: 0, sirenHi: false,
  charge: 1, streak: 0, lastGem: -9,
  player: null, dist: new Int16Array(W * H), distT: 0,
};

/* ---------- input ---------- */
export const held = [];
export let stickDir = null, fireCool = false, boostShown = '';
export let tapQueued = false, tapHeld = false, tapX = 0;
export const KEYMAP = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right' };
export const press = d => { if (!held.includes(d)) held.push(d); };
export const release = d => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
export const wantDir = () => stickDir ? DIRS[stickDir] : held.length ? DIRS[held[held.length - 1]] : null;

/** Bricks labels FIRE `serve`. Enter queues that button only then, so other disks keep their own keys. */
function serveKey() {
  const fire = Btn.button('fire');
  return fire.enabled && fire.label === 'serve';
}
addEventListener('keydown', e => {
  if ((e.target as Element)?.closest?.('.manual')) return;   // keys pressed on the leaflet's own buttons (Settings) are theirs, not the game's
  if (S.mode === 'entry' && !e.metaKey && !e.ctrlKey && !e.altKey) { if (entryKey(e)) e.preventDefault(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (S.mode === 'menu' && menuKey(e)) { e.preventDefault(); return; }
  if (e.code === 'KeyG') { pressSelect(); e.preventDefault(); return; }
  { const sl = Btn.slotForKey(e.code); if (sl?.optional && inGame()) { if (Btn.press(sl.id) && S.mode !== 'play') Btn.clearQueued(sl.id); e.preventDefault(); return; } }   // an extra button the game maps takes its keys first while it plays (I Invade's pad: arrows, Z X C, A S)
  const d = KEYMAP[e.code];
  if (d) { press(d); e.preventDefault(); return; }
  if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') { if (!Btn.button('fire').enabled || menuFire()) e.preventDefault(); else if (S.mode !== 'title' && S.mode !== 'over') { Btn.press('fire'); e.preventDefault(); } return; }   // held like the FIRE button
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyF') { setFull(!full); return; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyB') { if (Btn.press('boost') && S.mode !== 'play') Btn.clearQueued('boost'); e.preventDefault(); return; }
  { const sl = Btn.slotForKey(e.code); if (sl && (!sl.optional || inGame())) { Btn.press(sl.id); e.preventDefault(); return; } }   // any further slots
  if (e.code === 'KeyC') { setMode(MODE_ORDER[(MODE_ORDER.indexOf(modeKey) + 1) % MODE_ORDER.length]); track('theme', { theme: modeKey, via: 'key' }); return; }
  if (e.code === 'Enter' && !tvOn) { ensureAudio(); powerOn(); e.preventDefault(); return; }
  if (e.code === 'Enter' && (S.mode === 'title' || S.mode === 'over')) { startGame(); e.preventDefault(); return; }
  // Bricks' leaflet says Enter serves. Only while that disk's FIRE is labelled serve, and only in
  // ready or play: the two branches above keep Enter for power-on and for restarting a finished game.
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && (S.mode === 'ready' || S.mode === 'play') && serveKey()) { Btn.press('fire'); e.preventDefault(); }
});
addEventListener('keyup', e => {
  const d = KEYMAP[e.code]; if (d) release(d);
  const sl = Btn.slotForKey(e.code); if (sl) Btn.release(sl.id);
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && serveKey()) Btn.release('fire');
});
addEventListener('blur', () => { held.length = 0; for (const id of Btn.slotIds()) if (id !== 'boost') Btn.release(id); if (S.mode === 'play' || S.mode === 'ready') togglePause(true); });
/* the tab or app goes into the background mid-game (another tab, the phone's home screen, an app switch): HOLD goes on
   and stays on when the page comes back, so the player resumes deliberately, and any sound still ringing stops.
   Boot, the menu, loading, name entry and game over carry on as they are. */
export const GAME_MODES = ['ready', 'play', 'dying', 'clear'];
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  held.length = 0; for (const id of Btn.slotIds()) if (id !== 'boost') Btn.release(id);
  if (!GAME_MODES.includes(S.mode) && S.mode !== 'paused') return;
  togglePause(true); hush();
});

/* floating thumb-stick: the logic lives in stick.ts; this wires it to the pad. A dropped finger must never leave the
   stick held or deaf to the next touch, so it lets go on every sign the finger has gone, and a new touch takes over. */
(() => {
  const zone = $('stickzone'), base = $('stickbase'), knob = $('knob');
  const stick = new Stick();
  let zr = null, touchFinger = false;   // touchGone only applies to a finger: a mouse or pen never shows in e.touches
  function setDir(d){
    if (d === stickDir) return;
    stickDir = d;
    zone.querySelectorAll('.tick').forEach(t => t.classList.toggle('on', t.dataset.d === d));
    if (d) buzz(6);   // a tiny nudge on each new direction, silent with SOUND off like every buzz
  }
  function show(v){
    base.style.left = (v.ox - zr.left) + 'px'; base.style.top = (v.oy - zr.top) + 'px';
    knob.style.transform = `translate(${v.dx}px,${v.dy}px)`;
    setDir(v.dir);
  }
  function centre(){
    stick.reset(); setDir(null);
    zone.classList.remove('active');
    base.style.left = '50%'; base.style.top = '50%'; knob.style.transform = '';
  }
  function end(e){
    if (stick.id === null || e.pointerId !== stick.id) return;
    const id = stick.id;
    centre();
    try { if (zone.hasPointerCapture(id)) zone.releasePointerCapture(id); } catch (_) {}
  }
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); ensureAudio();
    if (padShown) return;   // the button pad has the zone: no stick under it
    const old = stick.id;
    if (old !== null && old !== e.pointerId) { try { zone.releasePointerCapture(old); } catch (_) {} }
    zr = zone.getBoundingClientRect();
    touchFinger = e.pointerType === 'touch';
    show(stick.down(e.pointerId, e.clientX, e.clientY));
    try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    zone.classList.add('active');
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === stick.id) show(stick.move(e.pointerId, e.clientX, e.clientY)); });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
  // the release went somewhere other than the pad (capture failed or was taken away)
  addEventListener('pointerup', end, true);
  addEventListener('pointercancel', end, true);
  // older iOS can drop the pointer events of a finger it hands to a system gesture, but still ends the touch:
  // once no touch that started on the pad is left, the stick's finger has gone
  const touchGone = e => {
    if (stick.id === null || !touchFinger) return;
    for (const t of e.touches) if (t.target instanceof Node && zone.contains(t.target)) return;
    centre();
  };
  addEventListener('touchend', touchGone, true);
  addEventListener('touchcancel', touchGone, true);
  addEventListener('blur', centre);
  document.addEventListener('visibilitychange', () => { if (document.hidden) centre(); });
  zone.addEventListener('contextmenu', e => e.preventDefault());

  // the set's action buttons, as slots any app can map (src/console/buttons.ts); a third button is one more line here
  Btn.defineSlot('fire', ['Space', 'KeyZ', 'KeyX'], 'spark', $('fireBtn'), null, true);
  Btn.defineSlot('boost', ['ShiftLeft', 'ShiftRight', 'KeyB'], 'boost', $('boostBtn'), $('boostBtn').querySelector('span'), true);
  const fire = $('fireBtn');
  fire.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); buzz('tick'); if (!Btn.button('fire').enabled) return; if (menuFire()) { fire.classList.add('on'); return; } Btn.press('fire'); try { fire.setPointerCapture(e.pointerId); } catch (_) {} });
  const off = () => Btn.release('fire');
  fire.addEventListener('pointerup', off); fire.addEventListener('pointercancel', off); fire.addEventListener('lostpointercapture', off);
  fire.addEventListener('contextmenu', e => e.preventDefault());
  const boost = $('boostBtn');
  boost.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); buzz('tick'); if (!Btn.press('boost')) return; if (S.mode !== 'play') Btn.clearQueued('boost'); try { boost.setPointerCapture(e.pointerId); } catch (_) {} });
  const boff = () => Btn.release('boost');
  boost.addEventListener('pointerup', boff); boost.addEventListener('pointercancel', boff); boost.addEventListener('lostpointercapture', boff);
  boost.addEventListener('contextmenu', e => e.preventDefault());
  // extra fire keys either side of FIRE, shown only while an app maps them (I Invade's left and right bomb bays)
  for (const [id, keys, elId] of [['fireL', ['KeyZ'], 'fireLBtn'], ['fireR', ['KeyV'], 'fireRBtn']] as const) {
    const el = $(elId);
    Btn.defineSlot(id, [...keys], 'spark', el, null, true, true);
    el.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); buzz('tick'); if (!Btn.press(id)) return; if (S.mode !== 'play') Btn.clearQueued(id); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const up = () => Btn.release(id);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // the button pad that stands in for the stick in a game that has none (`controls: 'pad'`): two rows of three, each
  // with its own keys, shown only while the game maps it. It sits inside the stick's zone, so the stick ignores it.
  const PAD_KEYS = [['ArrowLeft', 'KeyZ'], ['ArrowUp', 'KeyX'], ['ArrowRight', 'KeyC'], ['KeyA'], ['KeyS'], ['KeyD']];
  PAD_KEYS.forEach((keys, i) => {
    const id = 'pad' + (i + 1), el = $(id + 'Btn');
    Btn.defineSlot(id, keys, 'spark', el, null, true, true);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ensureAudio(); buzz('tick'); if (!Btn.press(id)) return; if (S.mode !== 'play') Btn.clearQueued(id); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const up = () => Btn.release(id);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  });
})();
/** The loaded game's runtime is in charge (its pad and its own keys apply), as opposed to the console's screens. */
export const inGame = () => ['ready', 'play', 'dying', 'clear', 'paused'].includes(S.mode);
/* a game with no stick (`controls: 'pad'`) gets the button pad in the stick's place while it plays; the stick is back
   for the console's own screens (menu, loading, name entry, high scores), so SELECT and RESET restore it too */
export let padShown = false;
export function syncPad(){
  const on = !!game && game.controls === 'pad' && inGame() && tvOn;
  if (on === padShown) return;
  padShown = on;
  document.documentElement.toggleAttribute('data-pad', on);
  if (on) { stickDir = null; $('stickzone').querySelectorAll('.tick').forEach(t => t.classList.remove('on')); }
}

/* ---------- UI ---------- */
export const overlay = $('overlay');
/* ---------- languages: English (default) and Traditional Chinese, carried in the link as #en / #zh-hant ---------- */
import { I18N, LANGS, LANG_ALIAS, hashLang, kb } from './i18n';
export { I18N, LANGS, LANG_ALIAS, hashLang, kb };
export let lang = 'en', ovKind = 'title', ovVars: any = {};
Btn.setTranslator(k => I18N[lang][k] ?? k);
/* ---------- instructions: the console's while the menu is up, the loaded game's otherwise (rendered by the React leaflet) ---------- */
export let manCtx = 'console';
export function setManual(ctx: string){ manCtx = ctx; bus.set({ manual: ctx }); }
/* the loaded game: its scores, its buttons and its instructions (null for the console's own screens, which set their own buttons) */
export function setGame(d: GameDisk | null){
  if (d) { game = d; loadScores(d.id); Btn.useButtons(d.buttons); }
  document.documentElement.setAttribute('data-game', d ? d.id : 'menu');
  if (d) setManual(d.id);
}
/** @deprecated games use api.setButtons({ boost: { label } }); kept so older game code still runs */
export function setBoostLabel(key: string | null){ Btn.setButtons({ boost: key ? { label: key } : null }); }
export function renderOverlay(){
  const T = I18N[lang];
  const v = { title: ['TUNNEL RAIDER', T.titleText, T.start], paused: [T.paused, T.pausedText, T.resume], over: [T[game.overKey], T.overText(ovVars.n, ovVars.s), T[game.againKey]] }[ovKind];
  $('ovTitle').textContent = v[0]; $('ovText').innerHTML = v[1]; $('ovBtn').innerHTML = '<span class="blink">▶</span> ' + v[2];
}
export function showOverlay(kind, vars: any = {}){ ovKind = kind; ovVars = vars; renderOverlay(); overlay.hidden = false; }
export function applyLang(l, writeHash){
  lang = LANGS.includes(l) ? l : 'en';
  document.documentElement.lang = { en: 'en', 'zh-hant': 'zh-Hant', 'zh-hans': 'zh-Hans' }[lang];
  const T = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T[el.dataset.i18n]; if (typeof v === 'string') el.innerHTML = v; });
  $('manualLbl').textContent = $('manualBtn').getAttribute('aria-expanded') === 'true' ? T.manualHide : T.manual;
  document.querySelectorAll('#langSeg [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('exitFull').setAttribute('aria-label', T.exitFull);
  Btn.relabel(); renderOverlay(); bus.set({ lang });
  try { localStorage.setItem('tr-lang', lang); } catch (_) {}
  if (writeHash && hashLang() !== lang) location.hash = lang;
}
document.querySelectorAll('#langSeg [data-lang]').forEach(b => b.addEventListener('click', () => { const was = lang; applyLang(b.dataset.lang, true); if (lang !== was) track('language', { lang }); }));
addEventListener('hashchange', () => { const h = hashLang(); if (h && h !== lang) applyLang(h, false); });
$('manualBtn').addEventListener('click', () => {
  const m = $('manual'), open = m.hidden;
  m.hidden = !open; $('manualBtn').setAttribute('aria-expanded', String(open));
  $('manualLbl').textContent = open ? I18N[lang].manualHide : I18N[lang].manual;
  if (open) track('instructions_open', { layout: layoutName() });
});
{ let stored = null; try { stored = localStorage.getItem('tr-lang'); } catch (_) {} applyLang(hashLang() || stored || 'en', false); }

/* ---------- status badge: network changes (5 s) and, in the installed app, offline-ready and update notices ---------- */
export let badgeTimer = 0;
export function trToast(text, opts: any = {}){
  const box = $('netToast'), btn = $('netBtn');
  clearTimeout(badgeTimer); box.classList.remove('leaving');
  box.dataset.state = opts.state || 'info'; $('netMsg').textContent = text;
  btn.hidden = !opts.button;
  if (opts.button) { btn.textContent = opts.button; btn.onclick = () => { hide(); opts.onClick && opts.onClick(); }; }
  box.hidden = true; void box.offsetWidth; box.hidden = false;   // restart the slide-in
  function hide(){ box.classList.add('leaving'); badgeTimer = window.setTimeout(() => { box.hidden = true; box.classList.remove('leaving'); }, 360); }
  if (opts.ms) badgeTimer = window.setTimeout(hide, opts.ms);
}
window.trToast = trToast;
/* backstop for older iOS: a second tap on the set within 350 ms never becomes a zoom */
{ let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = e.timeStamp || Date.now();
    if (now - lastTap < 350 && e.target.closest && e.target.closest('.tv, .netbadge')) e.preventDefault();
    lastTap = now;
  }, { passive: false });
  document.addEventListener('dblclick', e => { if (e.target.closest && e.target.closest('.tv')) e.preventDefault(); }, { passive: false });
}
/* backstop for browsers that ignore touch-action: a finger moving on the set never drags the page, and a mouse drag never picks up a piece of it */
{ const set = document.querySelector('.tv');
  if (set) {
    set.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    set.addEventListener('dragstart', e => e.preventDefault());
  }
}
window.trT = k => I18N[lang][k];
addEventListener('offline', () => trToast(I18N[lang].netOff, { state: 'off', ms: 5000 }));
addEventListener('online', () => trToast(I18N[lang].netOn, { state: 'on', ms: 5000 }));

/* ---------- full screen: the picture alone, browser full screen where the page allows it ---------- */
export let full = false;
export function setFull(v){
  if (v !== full) track('fullscreen', { on: v, layout: layoutName() });
  full = v;
  if (v) document.documentElement.setAttribute('data-full', ''); else document.documentElement.removeAttribute('data-full');
  $('fullBtn').setAttribute('aria-pressed', String(v));
  try {
    if (v && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (!v && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (_) {}
}
$('fullBtn').addEventListener('click', () => setFull(!full));
document.querySelectorAll('.rocker').forEach(b => b.addEventListener('pointerdown', () => { ensureAudio(); if (ac) tone(1700, 0.012, 0.05); buzz('tick'); }));   // switch clack
$('exitFull').addEventListener('click', () => setFull(false));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && full) setFull(false); });
$('ovBtn').addEventListener('click', () => { ensureAudio(); if (S.mode === 'paused') togglePause(); else startGame(); });
$('pauseBtn').addEventListener('click', () => togglePause());
$('muteBtn').addEventListener('click', () => toggleMute());
$('fxBtn').addEventListener('click', () => setFx(!fx));
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
export function toggleMute(){ muted = !muted; $('muteBtn').setAttribute('aria-pressed', String(!muted)); }
/* ---------- the leaflet's reset buttons: the set back to factory settings, and (separately) this device's scores wiped ---------- */
export function resetSettings(){
  if (modeKey !== DEFAULTS.mode) setMode(DEFAULTS.mode);
  setFx(DEFAULTS.fx);
  if (muted !== !DEFAULTS.sound) toggleMute();
  if (S.mode === 'paused' && !DEFAULTS.hold) togglePause();
  setFull(DEFAULTS.full);
  applyLang(DEFAULTS.lang, true);
  track('settings_reset', { layout: layoutName() });
}
export function clearScores(){
  try { for (const k of scoreKeys(Object.keys(localStorage))) localStorage.removeItem(k); } catch (_) {}
  for (const id of Object.keys(bestCache)) delete bestCache[id];
  lastName = ''; S.bestAtStart = 0;
  loadScores(game.id);
  if (S.mode === 'over' && S.showBoard) { S.showBoard = false; S.boardHi = -1; overlay.hidden = false; }   // the attract loop only swaps views while there is a table
  track('scores_cleared', { game: game.id });
}
addEventListener(SETTINGS_EVENT, (e: Event) => {
  const what = (e as CustomEvent).detail;
  if (what === 'reset') resetSettings(); else if (what === 'scores') clearScores();
});
export function togglePause(forceOn?){
  if (typeof tvOn !== 'undefined' && !tvOn) return;
  if (S.mode === 'paused') { if (forceOn) return; S.mode = S.prevMode; overlay.hidden = true; $('pauseBtn').setAttribute('aria-pressed', 'false'); return; }
  if (!GAME_MODES.includes(S.mode)) return;
  S.prevMode = S.mode; S.mode = 'paused'; held.length = 0;
  $('pauseBtn').setAttribute('aria-pressed', 'true');
  showOverlay('paused');
}
export function startGame(){
  ensureAudio();
  S.level = 1; S.score = 0; S.lives = 3; S.nextLife = 20000; S.streak = 0; S.bestAtStart = best; S.showBoard = false; S.boardHi = -1;
  S.parts.length = 0; S.pops.length = 0;
  setGame(game);
  runtime = runtimes[game.id];
  runtime.start();
  track('game_start', { game: game.id, layout: layoutName() });
  overlay.hidden = true; clearInput();
  S.mode = 'ready'; S.modeT = game.id === 'tunnel' ? 1.4 : 1.2;
}
/* the end of a game: save the best, then name entry if it made the table, otherwise the attract loop */
export function finishGame(){
  saveBest(); buzz('over');
  track('game_over', { game: game.id, score: S.score });
  if (S.score > 0 && S.score > (S.bestAtStart || 0)) track('new_best', { game: game.id, score: S.score });
  if (qualifies(S.score)) startEntry(); else enterOver(false);
}
export function clearInput(){ held.length = 0; stickDir = null; Btn.releaseAll(); tapQueued = false; tapHeld = false; }
/* power: off collapses the picture to a line, then a dot that fades; on warms up, degausses and boots */
export let tvOn = false, offT = 99;   // the set starts switched off
S.mode = 'off';
document.documentElement.setAttribute('data-off', ''); document.documentElement.setAttribute('data-fresh', '');
export function powerOff(){
  document.documentElement.setAttribute('data-off', '');
  tvOn = false; offT = 0; S.mode = 'off'; held.length = 0; stickDir = null; Btn.releaseAll();
  overlay.hidden = true; saveBest();
  $('pauseBtn').setAttribute('aria-pressed', 'false');
  $('powerBtn').setAttribute('aria-checked', 'false');
  if (ac && !muted) { tone(90, 0.09, 0.06, -40); tone(12000, 0.5, 0.008, -11000); }
}
export function powerOn(){
  document.documentElement.removeAttribute('data-off');
  tvOn = true; warmT = 0; age.dg = 0; accReset = true;
  $('powerBtn').setAttribute('aria-checked', 'true'); document.documentElement.removeAttribute('data-fresh');
  if (ac && !muted) { tone(58, 0.9, 0.04, 14); tone(15000, 0.4, 0.006, 0); }
  track('power_on', { theme: modeKey, layout: layoutName() });
  startConsole('cold');
}
export function flipPower(){ ensureAudio(); buzz('tick'); if (ac) { tone(700, 0.03, 0.06, -200); tone(1400, 0.015, 0.05, 0, 0.06); } if (tvOn) powerOff(); else powerOn(); }
// tap to toggle, or flick the knob: right for on, left for off
{ let sx = null, flicked = false;
  $('powerBtn').addEventListener('pointerdown', e => { sx = e.clientX; flicked = false; });
  $('powerBtn').addEventListener('pointerup', e => {
    if (sx === null) return; const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 12) { flicked = true; if ((dx > 0) !== tvOn) flipPower(); }
  });
  $('powerBtn').addEventListener('click', () => { if (flicked) { flicked = false; return; } flipPower(); });
}
/* reset: reboots on the press itself, straight back into the BIOS and floppy load (does nothing with the set switched off) */
/* after a mouse click or tap on the set's buttons, let go of keyboard focus: otherwise Space (jump, fire) or Enter
   would press that button again, e.g. switch the set off. A keyboard press (detail 0) keeps focus for keyboard users. */
document.addEventListener('click', e => {
  const b = (e.target as Element).closest?.('button');
  if (b && e.detail > 0 && b.closest('.tv')) setTimeout(() => b.blur(), 0);
});
$('resetBtn').addEventListener('pointerdown', e => {
  e.preventDefault(); ensureAudio(); if (ac) tone(1300, 0.015, 0.06); buzz('tick');
  const b = $('resetBtn'); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 140);
  if (!tvOn) return;
  track('reset', { game: game.id, mode: S.mode });
  startConsole('cold');
});
$('selectBtn').addEventListener('pointerdown', e => { e.preventDefault(); buzz('tick'); pressSelect(); });
$('selectBtn').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pressSelect(); } });
$('resetBtn').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); $('resetBtn').dispatchEvent(new PointerEvent('pointerdown')); } });

/* ---------- cold boot: POST beep, then the floppy drive spins up, recalibrates and reads ---------- */
export let noiseBuf = null;
export function noise(){
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
export function headClick(t, vol = 0.22, freq = 2600){
  const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  s.connect(f).connect(g).connect(out()); s.start(t, Math.random()); s.stop(t + 0.03);
}
/* ---------- main update ---------- */
export function update(dt){
  S.time += dt;
  for (let i = S.parts.length - 1; i >= 0; i--) { const q = S.parts[i]; q.life -= dt; q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) S.parts.splice(i, 1); }
  for (let i = S.pops.length - 1; i >= 0; i--) { const q = S.pops[i]; q.life -= dt; q.y -= 24 * dt; if (q.life <= 0) S.pops.splice(i, 1); }
  if (S.mode === 'entry') { updateEntry(dt); return; }
  if (S.mode === 'over') {   // attract loop: CAVE-IN card and the high-score table take turns
    S.overT += dt;
    if (board.length) { const sb = ((S.overT + (S.boardFirst ? 0 : 7)) % 12) < 7; if (sb !== S.showBoard) { S.showBoard = sb; overlay.hidden = sb; } }
    return;
  }
  if (S.mode === 'boot') { updateBoot(); return; }
  if (S.mode === 'menu') { updateMenu(dt); return; }
  if (S.mode === 'load') { updateLoad(dt); return; }
  if (runtime && ['ready', 'play', 'dying', 'clear'].includes(S.mode)) runtime.update(dt);
}

/* ---------- drawing into the low-res buffer (game units, C = 32) ---------- */
export const g = lx;
export function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function poly(pts){ g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
export function circ(x, y, r){ g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

export function txt(s, x, y, role, align = 'left', size = 8){
  g.font = `${size}px Silkscreen, "Courier New", monospace`; g.textAlign = align as CanvasTextAlign; g.textBaseline = 'top';
  g.fillStyle = col(role); g.fillText(s, x, y);
}
export function banner(t1, t2?){
  const y = HUD + Math.round((LH - HUD) / 2) - 23;
  g.fillStyle = col('bg'); g.fillRect(0, y, LW, t2 ? 46 : 32);
  g.fillStyle = col('hud'); g.fillRect(0, y, LW, 1); g.fillRect(0, y + (t2 ? 45 : 31), LW, 1);
  txt(t1, LW / 2, y + 8, 'text', 'center', 16);
  if (t2) txt(t2, LW / 2, y + 30, 'hud', 'center', 8);
}

/* ---------- name entry and the table, drawn on the tube like an arcade cabinet ---------- */
export const NKEYS = [];
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((k, i) => NKEYS.push({ k, r: Math.floor(i / 10), c: i % 10, w: 1 }));
NKEYS.push({ k: ' ', r: 2, c: 6, w: 1 }, { k: 'DEL', r: 2, c: 7, w: 1 }, { k: 'END', r: 2, c: 8, w: 2 });
export let keyRects = [];
export function startEntry(){
  S.mode = 'entry'; overlay.hidden = true;
  S.entry = { name: lastName, cur: lastName ? NKEYS.length - 1 : 0, rank: boardRank(S.score), dir: null, rep: 0, t: 0 };
  held.length = 0;
  if (ac && !muted) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, 0.04, 0, i * 0.09));
}
export function enterOver(boardFirst){
  S.mode = 'over'; S.overT = 0; S.boardFirst = boardFirst;
  showOverlay('over', { n: S.level, s: String(S.score).padStart(6, '0') });
  S.showBoard = boardFirst && board.length > 0; overlay.hidden = S.showBoard;
}
export function entryMove(d){
  const E = S.entry, k = NKEYS[E.cur];
  if (d === 'left' || d === 'right') { const n = NKEYS.length; E.cur = (E.cur + (d === 'right' ? 1 : n - 1)) % n; }
  else {
    const r = (k.r + (d === 'down' ? 1 : 2)) % 3, col = Math.min(k.c, 9);
    E.cur = NKEYS.findIndex(q => q.r === r && col >= q.c && col < q.c + q.w);
    if (E.cur < 0) E.cur = NKEYS.findIndex(q => q.r === r && q.c + q.w > 8);
  }
  if (ac && !muted) tone(660, 0.02, 0.03);
}
export function entryType(k){
  const E = S.entry;
  if (k === 'END') return entryFinish();
  if (k === 'DEL') { if (E.name) { E.name = E.name.slice(0, -1); if (ac && !muted) tone(330, 0.04, 0.04, -80); } return; }
  if (E.name.length >= NAME_MAX || (k === ' ' && !E.name)) { if (ac && !muted) tone(140, 0.08, 0.04); return; }
  E.name += k; if (ac && !muted) tone(1175, 0.03, 0.04);
  if (E.name.length >= NAME_MAX) E.cur = NKEYS.length - 1;   // full: jump to END
}
export function entryFinish(){
  const E = S.entry, name = E.name.trim() || 'RAIDER', rank = boardRank(S.score);
  board.splice(rank, 0, { n: name, s: S.score, l: S.level }); board = board.slice(0, BOARD_MAX);
  lastName = name; saveBoard();
  track('high_score', { game: game.id, rank: rank + 1 });
  S.boardHi = rank;
  if (ac && !muted) [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.07, 0.04, 0, i * 0.07));
  enterOver(true);
}
export function entryKey(e){
  const dir = KEYMAP[e.code];
  if (dir && e.code.startsWith('Arrow')) { entryMove(dir); return true; }
  if (e.code === 'Space') { entryType(NKEYS[S.entry.cur].k); return true; }
  if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape') { entryFinish(); return true; }
  if (e.code === 'Backspace' || e.code === 'Delete') { entryType('DEL'); return true; }
  const m = /^Key([A-Z])$/.exec(e.code);
  if (m) { S.entry.cur = NKEYS.findIndex(q => q.k === m[1]); entryType(m[1]); return true; }
  return false;
}
export function updateEntry(dt){
  const E = S.entry; E.t += dt; E.rep -= dt;
  if (stickDir !== E.dir) { E.dir = stickDir; if (stickDir) { entryMove(stickDir); E.rep = 0.4; } }
  else if (stickDir && E.rep <= 0) { entryMove(stickDir); E.rep = 0.15; }
}
// FIRE (button or Space) picks a letter, or starts a new game from the attract loop
export function menuFire(){
  if (S.mode === 'menu') { loadGame(S.menuSel); return true; }
  if (S.mode === 'boot' || S.mode === 'load') return true;
  if (S.mode === 'entry') { entryType(NKEYS[S.entry.cur].k); return true; }
  if (S.mode === 'over' && S.overT > 0.8) { startGame(); return true; }
  return false;
}
addEventListener('pointerup', () => { tapHeld = false; });
addEventListener('pointercancel', () => { tapHeld = false; });
cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * LW, y = (e.clientY - r.top) / r.height * LH;
  if (S.mode === 'menu') { e.preventDefault(); ensureAudio(); menuTap(x, y); return; }
  if (game.tap && (S.mode === 'play' || S.mode === 'ready')) { e.preventDefault(); tapQueued = true; tapHeld = true; tapX = x; return; }   // games that take taps (jump, fire)
  if (S.mode !== 'entry' && !(S.mode === 'over' && S.showBoard)) return;
  e.preventDefault(); ensureAudio();
  if (S.mode === 'over') { if (S.overT > 0.8) startGame(); return; }
  const hit = keyRects.find(q => x >= q.x - 1 && x < q.x + q.w + 1 && y >= q.y - 1 && y < q.y + q.h + 1);
  if (hit) { S.entry.cur = hit.i; entryType(NKEYS[hit.i].k); }
});
export function panel(){
  g.fillStyle = col('bg'); g.fillRect(0, HUD, LW, LH - HUD);
  g.fillStyle = col('hud'); for (let x = 4; x < LW - 4; x += 4) { g.fillRect(x, HUD + 4, 2, 1); g.fillRect(x, LH - 5, 2, 1); }
}
export function drawEntry(){
  const E = S.entry, blink = Math.floor(E.t * 3) % 2 === 0;
  panel();
  const cw = Math.min(24, Math.floor((LW - 12) / 10)), ch = 17, gw = cw * 10;
  const top = HUD + Math.max(10, Math.round((LH - HUD - 158) / 2));
  txt('NEW HIGH SCORE', LW / 2, top, blink ? 'gold' : 'text', 'center', 16);
  txt(`${ordinal(E.rank + 1)}  ${String(S.score).padStart(6, '0')}  L${S.level}`, LW / 2, top + 22, 'hud', 'center');
  // nine name slots with a flashing cursor
  const sw = Math.min(14, Math.floor((LW - 20) / NAME_MAX)), sx = Math.round(LW / 2 - sw * NAME_MAX / 2), sy = top + 40;
  for (let i = 0; i < NAME_MAX; i++) {
    const x = sx + i * sw, ch1 = E.name[i];
    if (ch1 && ch1 !== ' ') txt(ch1, x + sw / 2, sy, 'text', 'center', 16);
    const cursor = i === E.name.length && E.name.length < NAME_MAX;
    if (!cursor || blink) { g.fillStyle = col(cursor ? 'gold' : 'hud'); g.fillRect(x + 2, sy + 17, sw - 4, cursor ? 2 : 1); }
  }
  // the letter grid: stick or arrows to move, FIRE to pick
  const gx = Math.round(LW / 2 - gw / 2), gy = sy + 30;
  keyRects = [];
  NKEYS.forEach((q, i) => {
    const x = gx + q.c * cw, y = gy + q.r * ch, w = q.w * cw - 2, h = ch - 3, on = i === E.cur;
    keyRects.push({ x, y, w, h, i });
    if (on) { g.fillStyle = col('text'); g.fillRect(x, y, w, h); }
    const role = on ? 'bg' : (q.k.length > 1 ? 'hud' : 'text'), cx = Math.round(x + w / 2), cy = y + Math.round(h / 2);
    g.fillStyle = col(role);
    if (q.k === ' ') { g.fillRect(cx - 4, cy + 1, 9, 1); g.fillRect(cx - 4, cy - 1, 1, 2); g.fillRect(cx + 4, cy - 1, 1, 2); }
    else if (q.k === 'DEL') { for (let j = 0; j < 4; j++) g.fillRect(cx - 3 + j, cy - j, 1, j * 2 + 1); g.fillRect(cx + 1, cy - 1, 4, 3); }
    else txt(q.k, cx, cy - 4, role, 'center');
  });
  txt('STICK TO MOVE · FIRE TO PICK', LW / 2, gy + ch * 3 + 6, 'textDim', 'center');
}
export function drawBoard(){
  panel();
  const blink = Math.floor(S.overT * 4) % 2 === 0, AH = LH - HUD;
  const rh = Math.max(11, Math.min(15, Math.floor((AH - 62) / BOARD_MAX))), wide = LW >= 300;
  const top = HUD + Math.max(10, Math.round((AH - (42 + rh * BOARD_MAX + 18)) / 2));
  txt('HIGH SCORES', LW / 2, top, 'text', 'center', 16);
  const bw = Math.min(LW - 20, wide ? 240 : 200), x0 = Math.round(LW / 2 - bw / 2), y0 = top + 30;
  for (let i = 0; i < BOARD_MAX; i++) {
    const e = board[i], y = y0 + i * rh, hi = i === S.boardHi;
    if (hi && !blink) continue;
    const role = hi ? 'gold' : i < 3 ? 'text' : 'hud';
    txt(ordinal(i + 1), x0 + 24, y, role, 'right');
    txt(e ? e.n : '.........', x0 + 34, y, e ? role : 'textDim');
    if (wide) txt(e ? 'L' + e.l : '', x0 + bw - 58, y, role, 'right');
    txt(e ? String(e.s).padStart(6, '0') : '------', x0 + bw, y, e ? role : 'textDim', 'right');
  }
  if (Math.floor(S.overT * 2) % 2 === 0) txt('PRESS FIRE TO ' + game.verb, LW / 2, y0 + rh * BOARD_MAX + 8, 'hud', 'center');
}

export function renderFrame(){
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = col('bg'); g.fillRect(0, 0, LW, LH);
  if (S.mode === 'off') { /* nothing on the tube */ }
  else if (S.mode === 'boot') drawBoot(); else if (S.mode === 'menu') drawMenu(); else if (S.mode === 'load') drawLoad(); else {
  if (runtime) runtime.draw();
  if (S.mode === 'entry') drawEntry();
  if (S.mode === 'over' && S.showBoard) drawBoard();
  }
  // snap every pixel to the four colours the hardware could show
  const img = g.getImageData(0, 0, LW, LH), d = img.data, P = palRGB;
  const useAcc = fx, decay = Math.pow(0.5, frameDt / M.half), ad = accImg.data, bg = P[0], reset = accReset;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    let bi = 0, bd = 1e9;
    for (let k = 0; k < 4; k++) { const p = P[k], dr = r - p[0], dg = gg - p[1], db = b - p[2], dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; bi = k; } }
    const p = P[bi]; d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2];
    if (useAcc) {
      // phosphor afterglow: each channel keeps the brighter of the new beam and the fading old glow
      for (let c = 0; c < 3; c++) {
        let v = reset ? p[c] : bg[c] + (A[i + c] - bg[c]) * decay;
        if (v < p[c]) v = p[c];
        A[i + c] = v; ad[i + c] = v;
      }
      ad[i + 3] = 255;
    }
  }
  accReset = false;
  g.putImageData(img, 0, 0);
  if (useAcc) ax.putImageData(accImg, 0, 0);
}

/* ---------- CRT presentation ---------- */
export function tickAge(dt){
  age.dg += dt;
  if (age.tearLeft > 0) age.tearLeft -= dt;
  if (age.dipLeft > 0) age.dipLeft -= dt;
  if ((age.next -= dt) <= 0) {
    if (Math.random() < 0.65) {
      age.tearLeft = 0.06 + Math.random() * 0.14; age.tearY = (Math.random() * LH) | 0;
      age.tearH = 4 + ((Math.random() * 26) | 0); age.tearDx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 7);
    } else age.dipLeft = 0.08 + Math.random() * 0.12;
    // every 3 to 10 s, and now and then a quick second one, as a tired tube does
    age.next = Math.random() < 0.18 ? 0.35 + Math.random() * 0.5 : 3 + Math.random() * 7;
  }
}
export function drawOff(w, h){
  const t = reduceMotion ? 9 : offT, hi = M.pal[3], cx = w / 2, cy = h / 2;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = M.bezel[4]; ctx.fillRect(0, 0, w, h);
  if (t < 0.16) {
    // the vertical scan collapses: the picture squeezes into a bright band
    const k = t / 0.16, sy = Math.max(0.006, 1 - k * k), y = h * (1 - sy) / 2;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, y, w, h * sy);
    ctx.globalAlpha = 0.25 + k * 0.75; ctx.fillStyle = hi; ctx.fillRect(0, y, w, h * sy); ctx.globalAlpha = 1;
  } else if (t < 0.42) {
    // then the line pulls in from both sides
    const k = (t - 0.16) / 0.26, sx = Math.max(0.012, 1 - Math.pow(k, 0.7)), lh = Math.max(2, h * 0.008);
    ctx.shadowColor = hi; ctx.shadowBlur = h * 0.04; ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - w * sx / 2, cy - lh / 2, w * sx, lh);
    ctx.fillStyle = hi; ctx.globalAlpha = 0.7; ctx.fillRect(cx - w * sx / 2, cy - lh * 1.5, w * sx, lh * 3); ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  } else if (t < 2.2) {
    // and the last of the charge lingers as a dot that slowly dies
    const k = (t - 0.42) / 1.78, r = w * (0.016 - 0.008 * k), a = Math.pow(1 - k, 2);
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.25, hexA(hi, a * 0.9)); gr.addColorStop(1, hexA(hi, 0));
    ctx.fillStyle = gr; ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
  }
  if (vig) ctx.drawImage(vig, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(dust, 0, 0, w, h);
}
export function hexA(hex, a){ return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`; }
export function drawPicture(src, oy, dh){
  const w = cv.width, live = fx && !reduceMotion;
  const wob = live ? Math.max(0, 1 - age.dg / 0.9) : 0;      // degauss wobble, dying away
  const tearing = live && age.tearLeft > 0;
  if (!wob && !tearing) { ctx.drawImage(src, 0, oy, w, dh); return; }
  const strip = 4, sh = dh / LH, ux = w / LW;
  for (let y = 0; y < LH; y += strip) {
    let dx = 0;
    if (wob) dx += Math.sin(y * 0.09 + age.dg * 40) * 10 * wob * ux;
    if (tearing && y >= age.tearY && y < age.tearY + age.tearH) dx += age.tearDx * ux;
    ctx.drawImage(src, 0, y, LW, strip, dx, oy + y * sh, w, strip * sh);
  }
}
export function drawAged(w, h){
  if (burn) { ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true; ctx.drawImage(burn, 0, 0, w, h); }
  const k = Math.min(1, age.dg / 6);   // magnetisation creeps back after each degauss
  if (k > 0) {
    for (const st of age.stains) {
      const x = st.x * w, y = st.y * h, gr = ctx.createRadialGradient(x, y, 0, x, y, st.r * w);
      gr.addColorStop(0, M.mask ? st.tint : '#a6a6a6'); gr.addColorStop(1, '#ffffff');
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k * st.k;
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
export let scan = null, vig = null;
/* ---------- the field adapts to the screen: pick a grid whose shape matches the box the layout gives the tube ---------- */
export function targetGrid(){
  const r = cv.parentElement.getBoundingClientRect();
  if (r.width < 60 || r.height < 60) return [15, 10];
  const ar = r.width / r.height, fit = w => Math.round((w * CELL / ar - HUD) / CELL);
  if (ar >= 1) { const w = ar > 1.75 ? 17 : 15; return [w, Math.min(14, Math.max(7, fit(w)))]; }
  const w = r.width >= 520 ? 13 : r.width < 350 ? 10 : 11;   // upright: fewer, larger cells, more rows
  return [w, Math.min(22, Math.max(9, fit(w)))];
}
export function setGrid(w, h){
  if (w === W && h === H) return false;
  W = w; H = h; LW = W * CELL; LH = H * CELL + HUD;
  lo.width = LW; lo.height = LH; acc.width = LW; acc.height = LH;
  accImg = ax.createImageData(LW, LH); A = new Float32Array(LW * LH * 4); accReset = true;
  glow.width = Math.round(LW / 3); glow.height = Math.round(LH / 3);
  S.dug = new Uint8Array(W * H); S.em = new Uint8Array(W * H); S.dist = new Int16Array(W * H);
  buildBurn(); fitCanvas();
  return true;
}
export function fitGrid(){ const [w, h] = targetGrid(); setGrid(w, h); }
export function fitCanvas(){
  // the picture fills the tube, letterboxed in glass if the current field doesn't quite match
  const box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (box.width < 10 || box.height < 10) return;
  const sc = Math.min(box.width / LW, box.height / LH), cw = Math.floor(LW * sc), ch = Math.floor(LH * sc);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.max(LW, Math.round(cw * dpr)); cv.height = Math.round(cv.width * LH / LW);
  scan = document.createElement('canvas'); scan.width = cv.width; scan.height = cv.height;
  const s = scan.getContext('2d'), rowH = cv.height / LH;
  s.fillStyle = `rgba(0,0,0,${rowH >= 2.5 ? 0.5 : 0.32})`;
  for (let y = 0; y < LH; y++) s.fillRect(0, Math.round(y * rowH + rowH * 0.55), cv.width, Math.max(1, Math.round(rowH * 0.45)));
  vig = document.createElement('canvas'); vig.width = cv.width; vig.height = cv.height;
  const v = vig.getContext('2d'), gr = v.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
  v.fillStyle = gr; v.fillRect(0, 0, cv.width, cv.height);
  // colour-tube stripe mask: repeating red, green, blue columns
  mask = document.createElement('canvas'); mask.width = cv.width; mask.height = 1;
  const mk = mask.getContext('2d'), mw = Math.max(1, Math.round(cv.width / (LW * 3))), stripes = ['#ff7a7a', '#7aff7a', '#7a7aff'];
  for (let x = 0, i = 0; x < cv.width; x += mw, i++) { mk.fillStyle = stripes[i % 3]; mk.fillRect(x, 0, mw, 1); }
}
/* upright layouts: the set fills the phone from just under the title to the bottom edge */
export function sizeTv(){
  const root = document.documentElement;
  if (!/portrait/.test(root.getAttribute('data-layout') || '')) { root.style.removeProperty('--tv-h'); return; }
  const vh = window.visualViewport ? visualViewport.height : innerHeight;
  const top = document.querySelector('.tv').getBoundingClientRect().top + window.scrollY;
  const below = getComputedStyle(document.querySelector('.feet')).display === 'none' ? 8 : 22;
  root.style.setProperty('--tv-h', Math.max(440, Math.floor(vh - top - below)) + 'px');
}
export function resize(){
  sizeTv();
  // while nothing is being played, re-deal the field to suit the new screen shape; mid-game it keeps its shape until the next seam
  if (['off', 'title', 'boot', 'menu', 'load'].includes(S.mode)) fitGrid();
  fitCanvas();
}
new ResizeObserver(() => resize()).observe(cv.parentElement);
addEventListener('resize', resize);

export function present(){
  const w = cv.width, h = cv.height, src = fx ? acc : lo;
  if (!tvOn) { drawOff(w, h); return; }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = M.bezel[4]; ctx.fillRect(0, 0, w, h);
  // power-on: the picture opens from a bright line and brightens as the tube warms
  let sy = 1, dim = 0;
  if (warmT < WARM && !reduceMotion) {
    const t = warmT / WARM;
    sy = t < 0.35 ? 0.008 + 0.992 * (1 - Math.pow(1 - t / 0.35, 3)) : 1;
    dim = Math.max(0, 1 - t * 1.15);
  }
  const oy = h * (1 - sy) / 2, dh = h * sy;
  ctx.imageSmoothingEnabled = false;
  drawPicture(src, oy, dh);
  if (sy < 1) { ctx.fillStyle = M.pal[3]; ctx.globalAlpha = 0.8 * (1 - sy); ctx.fillRect(0, h / 2 - Math.max(1, dh / 2), w, Math.max(2, dh)); ctx.globalAlpha = 1; }
  if (fx) {
  // phosphor bloom: a blurred copy added on top
  gx.imageSmoothingEnabled = true; gx.clearRect(0, 0, glow.width, glow.height); gx.drawImage(src, 0, 0, glow.width, glow.height);
  ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true; ctx.globalAlpha = M.bloom;
  ctx.drawImage(glow, 0, oy, w, dh);
  ctx.globalAlpha = 0.16; ctx.drawImage(src, 1.5, oy, w, dh);    // slight horizontal smear, like an analogue signal
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (M.mask && mask) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.28; ctx.drawImage(mask, 0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  if (scan) ctx.drawImage(scan, 0, 0);
  if (!reduceMotion) {
    // the rolling refresh band every tube shows: a soft bright bar with a thin line through it, every few seconds
    const by = ((S.time * 0.19) % 1.3 - 0.15) * h, gr = ctx.createLinearGradient(0, by - h * 0.08, 0, by + h * 0.08);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, by - h * 0.08, w, h * 0.16);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, by - h * 0.003, w, Math.max(1, h * 0.006));
    if (M.sweep) drawSweep(w, h);
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; ctx.fillRect(0, 0, w, h);
  }
  drawAged(w, h);
  if (vig) ctx.drawImage(vig, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(dust, 0, 0, w, h);
  }
  if (fx && !reduceMotion && age.dipLeft > 0) dim = Math.max(dim, 0.28);   // brown-out
  if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim * 0.85})`; ctx.fillRect(0, 0, w, h); }
}

/* the P7 radar sweep: a bright beam writes down the tube; just behind it the picture flashes blue-white,
   and the further behind it falls, the more it fades into the long yellow-green afterglow */
function drawSweep(w, h){
  const k = (S.time / M.sweep) % 1, y = k * h;
  // the afterglow: darker the longer since the beam passed (above the beam it's this sweep, below it the last one)
  const fade = ctx.createLinearGradient(0, 0, 0, h), a = n => `rgba(0,0,0,${(0.5 * n).toFixed(3)})`;
  const ageAt = yy => (yy <= y ? (y - yy) / h : (y + h - yy) / h);
  for (let i = 0; i <= 8; i++) fade.addColorStop(i / 8, a(ageAt(i / 8 * h)));
  ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
  if (y > 0) { const f2 = ctx.createLinearGradient(0, y - 1, 0, y + 1); f2.addColorStop(0, a(0)); f2.addColorStop(1, a(1)); ctx.fillStyle = f2; ctx.fillRect(0, y - 1, w, 2); }
  // the blue-white flash trailing the beam, and the beam itself
  ctx.globalCompositeOperation = 'lighter';
  const tail = h * 0.14, fl = ctx.createLinearGradient(0, y - tail, 0, y);
  fl.addColorStop(0, 'rgba(150,190,255,0)'); fl.addColorStop(1, 'rgba(170,205,255,.22)');
  ctx.fillStyle = fl; ctx.fillRect(0, y - tail, w, tail);
  ctx.shadowColor = '#cfe2ff'; ctx.shadowBlur = h * 0.02; ctx.fillStyle = 'rgba(225,238,255,.75)';
  ctx.fillRect(0, y - Math.max(1, h * 0.002), w, Math.max(2, h * 0.004));
  ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
}

/* ---------- loop ---------- */
export let last = performance.now();
export function frame(now){
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  frameDt = Math.max(0.001, dt); warmT += dt; tickAge(dt);
  if (!tvOn) offT += dt;
  if (S.mode !== 'paused') { while (dt > 0) { const step = Math.min(dt, 1 / 60); update(step); dt -= step; } }
  syncPad();
  renderFrame(); present();
  const cool = S.charge < 1; if (cool !== fireCool) { fireCool = cool; $('fireBtn').classList.toggle('cool', cool); }
  const bk = (S.boostT > 0 ? 'a' : '') + Math.round((S.boost || 0) * 40);
  if (bk !== boostShown) { boostShown = bk; const bb = $('boostBtn'); $('boostFill').style.width = ((S.boost || 0) * 100) + '%'; bb.classList.toggle('active', S.boostT > 0); bb.classList.toggle('cool', S.boostT <= 0 && (S.boost || 0) < 1); }
  requestAnimationFrame(frame);
}

setMode(modeKey); setFx(fx);
sizeTv();
fitGrid();
resize();
buildBurn();
if (document.fonts && document.fonts.load) document.fonts.load('16px Silkscreen').then(buildBurn).catch(()=>{});
requestAnimationFrame(frame);

/* setters for state the game modules change (an imported binding can't be assigned from outside its module) */
export function setBest(v){ best = v; }
export function clearFireQueued(){ Btn.clearQueued('fire'); }
export function clearBoostQueued(){ Btn.clearQueued('boost'); }
export function clearTap(){ tapQueued = false; }
export function setAccReset(){ accReset = true; }

/* test hook for the Playwright checks; only with ?test in the address */
if (/[?&]test\b/.test(location.search)) (window as any).__gg = { S, get board(){ return board; }, get keyRects(){ return keyRects; }, NKEYS, cv, get LW(){ return LW; }, get LH(){ return LH; }, overlay, killPlayer: (c?: string) => runtime?.debug?.kill?.(c), loadGame, DISKS, get game(){ return game; }, get runtime(){ return runtime; }, finishGame, get audioOut(){ return outNode; }, tone };

/* ---------- the API games get (see src/games/types.ts): live getters over the console's state ---------- */
export const api: ConsoleAPI = {
  get g(){ return g; }, get LW(){ return LW; }, get LH(){ return LH; }, get HUD(){ return HUD; },
  get W(){ return W; }, get H(){ return H; }, get C(){ return C; }, get K(){ return K; },
  fitGrid, col, get palRGB(){ return palRGB; }, get palette(){ return M; },
  txt, banner, rr, poly, circ, idx, inb, DIRS,
  get S(){ return S; },
  get held(){ return held as any; }, get stickDir(){ return stickDir as any; }, wantDir: () => wantDir() as any,
  button: Btn.button, clearButton: Btn.clearQueued, setButtons: Btn.setButtons,
  get fireQueued(){ return Btn.button('fire').queued; }, get fireHeld(){ return Btn.button('fire').held; },
  get boostQueued(){ return Btn.button('boost').queued; }, get boostHeld(){ return Btn.button('boost').held; },
  get tapQueued(){ return tapQueued; }, get tapHeld(){ return tapHeld; }, get tapX(){ return tapX; },
  clearFire: clearFireQueued, clearBoost: clearBoostQueued, clearTap, setBoostLabel,
  tone, buzz,
  get best(){ return best; }, set best(v: number){ best = v; },
  saveBest, finishGame, track, mulberry32,
  diskInfo: (y, p, t, d) => diskInfo(y, p, t, d),
};

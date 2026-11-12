import { MODES, MODE_ORDER, LEGACY } from '../kit/platform/palettes';
export { CGA_ROLES, MONO_ROLES, MODES, MODE_ORDER, LEGACY } from '../kit/platform/palettes';
import { track as vaTrack } from '@vercel/analytics';
import { DISKS, loadGameCode } from "../games/registry";
import type { Dir, GameDisk, GameRuntime, ConsoleAPI } from "../games/types";
import { bus } from "./bus";
import * as Btn from "./buttons";
import { Stick } from "./stick";
import { makeHaptics, type Haptic } from "../kit/platform/haptics";
import { DEFAULTS, scoreKeys, SETTINGS_EVENT } from "./settings";
import { COVER_W, COVER_H, encodeCover, shrink, cropTo } from "./launcher/cover";
import { diskInfo, startConsole, drawBoot, updateBoot, updateMenu, drawMenu, menuKey, menuTap, updateLoad, drawLoad, pressSelect, loadGame, launcherTargets } from "./program/loader";
import { bindHost } from "./program/host";
import { scores, loadScores, saveBest, qualifies, forgetScores } from "./program/scores";
import { NKEYS, keyRects, startEntry, enterOver, entryKey, entryTap, entryPick, updateEntry, updateOver, drawEntry, drawBoard } from "./program/entry";
import { makeWebPlatform } from "./web/platform";
import { ac, muted, setMuted, ensureAudio, hush, tone, audioOut } from "./web/audio";
export { ac, muted, ensureAudio, hush, tone };
import { makeScreen2D } from "./screen";
import { makePixelFont } from "./font";
import pixelFontURL from "../../tools/fonts/Silkscreen-Regular.ttf?url";
import { layer, makeStamp } from "./layers";
// Inputs and audio stay synchronous; only booting waits for the pinned drawing face.
let powerQueued = false;
const pixelFont = makePixelFont(pixelFontURL, {
  ready(){ buildBurn(); if (powerQueued) powerOn(); },
  failed(){ powerQueued = false; $('powerBtn').setAttribute('aria-checked', 'false'); showOverlay('font'); },
});
export let W = 15, H = 10;
export const C = 32, CELL = 24, HUD = 20, K = CELL / C;   // game units per cell, low-res pixels per cell
export let LW = W * CELL, LH = H * CELL + HUD;              // low-res frame buffer, like a 1980s graphics mode; resized to fit the screen
export const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
export const cv = $('cv') as HTMLCanvasElement, ctx = cv.getContext('2d')!;
export const lo = document.createElement('canvas'); lo.width = LW; lo.height = LH;
export const lx = lo.getContext('2d', { willReadFrequently: true })!;
export const glow = document.createElement('canvas'); glow.width = 120; glow.height = 87;   // resized with the grid
export const gx = glow.getContext('2d')!;
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const acc = document.createElement('canvas'); acc.width = LW; acc.height = LH;   // what the phosphor is still glowing with
export const ax = acc.getContext('2d')!;
export let accImg = ax.createImageData(LW, LH), A = new Float32Array(LW * LH * 4);
export let accReset = true, warmT = 0, frameDt = 1 / 60, mask: HTMLCanvasElement | null = null;
export const WARM = 0.75;
/* an old tube's quirks: magnetised patches, burn-in, dust, the odd tear or brown-out */
export const age = { dg: 99, next: 6, tearLeft: 0, tearY: 0, tearH: 0, tearDx: 0, dipLeft: 0,
  stains: [
    { x: 0.08 + Math.random() * 0.18, y: 0.08 + Math.random() * 0.2, r: 0.36, tint: '#ff92e8', k: 0.85 },
    { x: 0.74 + Math.random() * 0.2, y: 0.62 + Math.random() * 0.26, r: 0.3, tint: '#9effb6', k: 0.7 },
  ] };
export let burn: HTMLCanvasElement | null = null;
export const dust = document.createElement('canvas'); dust.width = 720; dust.height = 520;
(() => {
  const d = dust.getContext('2d')!;
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
  if (pixelFont.state !== 'ready') return;
  // years of the same title screen wore the phosphor: those spots now glow a little less
  burn = document.createElement('canvas'); burn.width = LW; burn.height = LH;
  const b = burn.getContext('2d')!;
  b.fillStyle = '#fff'; b.fillRect(0, 0, LW, LH);
  b.fillStyle = '#d0d0d0'; b.font = '16px Silkscreen, "Courier New", monospace'; b.textAlign = 'center'; b.textBaseline = 'middle';
  b.fillText('PGD-01', LW / 2, LH * 0.42);
  b.fillStyle = '#dadada'; b.font = '8px Silkscreen, "Courier New", monospace'; b.textAlign = 'left'; b.textBaseline = 'top';
  b.fillText('000000', 6, 6); b.fillText('HI 000000', 80, 6);
}

/* ---------- display modes ---------- */
export let modeKey = 'greenP1', fx = true;
try { let m = localStorage.getItem('eb-mode'); if (m) m = LEGACY[m] || m; if (m && MODES[m]) modeKey = m; fx = localStorage.getItem('eb-fx') !== '0'; } catch (e) {}
export let M = MODES[modeKey] as (typeof MODES)[keyof typeof MODES], palRGB: number[][] = [];
// Older disks name an unmapped role; Canvas kept the previous ink for that assignment.
export const col = (role: string) => M.pal[M.roles[role]] ?? String(lx.fillStyle);
document.querySelectorAll('#modes [data-mode]').forEach(b => {
  const el = b as HTMLElement;
  (el.querySelector('.sw4') as HTMLElement).innerHTML = MODES[el.dataset.mode!].pal.map(c => `<i style="background:${c}"></i>`).join('');
});
export function setMode(k: string){
  modeKey = k; M = MODES[k];
  palRGB = M.pal.map(h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]);
  document.querySelectorAll('#modes [data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === k)));
  const R = document.documentElement.style, [hi, mid, low, ink, glass] = M.bezel;
  R.setProperty('--phos', M.pal[M.phos]); R.setProperty('--phos2', M.pal[M.phos2]);
  R.setProperty('--plastic-hi', hi); R.setProperty('--plastic', mid); R.setProperty('--plastic-lo', low);
  R.setProperty('--bezel-ink', ink); R.setProperty('--glass', glass);
  $('plate').textContent = 'PGD-01 · ' + M.name;
  updateDial(MODE_ORDER.indexOf(k));
  try { localStorage.setItem('eb-mode', k); } catch (e) {}
  accReset = true; warmT = 0; age.dg = 0;
  if (ac && !muted && (typeof tvOn === 'undefined' || tvOn)) { tone(58, 0.9, 0.04, 14); tone(15000, 0.4, 0.006, 0); }   // degauss "boinng" and flyback whine
  if (runtime && runtime.onPalette) runtime.onPalette();
}
/* the phosphor dial: seven detents, turned by dragging, clicking (next), scrolling, arrow keys or the labels */
export const SHORT: Record<string, string> = { greenP1:'GREEN', greenP39:'P39', radarP7:'P7', amberP3:'AMBER', whiteP4:'WHITE', cga1:'CGA 1', cga0:'CGA 0' };
export const ANG = [-135, -90, -45, 0, 45, 90, 135];
export function updateDial(i: number){
  const cap = $('dialCap'), dial = $('dial'); if (!cap) return;
  cap.style.transform = `rotate(${ANG[i]}deg)`;
  dial.setAttribute('aria-valuenow', String(i)); dial.setAttribute('aria-valuetext', MODES[MODE_ORDER[i]].name);
  document.querySelectorAll('#dialLabels .dl').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
}
/* ---------- analytics: Vercel Web Analytics custom events, at most two properties each (the Pro plan limit) ---------- */
type TrackData = Record<string, string | number | boolean | null>;
const trackSubs = new Set<(name: string, data?: TrackData) => void>();
export function track(name: string, data?: TrackData){
  try { vaTrack(name, data); } catch (_) {}
  trackSubs.forEach(f => { try { f(name, data); } catch (_) {} });
}
/** Hear every tracked event as it happens (the embed bridge passes them to the page around the console). */
export function onTrack(fn: (name: string, data?: TrackData) => void){ trackSubs.add(fn); return () => { trackSubs.delete(fn); }; }
export const layoutName = () => document.documentElement.getAttribute('data-layout') || 'desk';
export function turnTo(i: number){
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
  let pid: number | null = null, moved = false, sx = 0, sy = 0, wheelT = 0;
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
export function setFx(v: boolean){ fx = v; accReset = true; $('fxBtn').setAttribute('aria-pressed', String(v)); try { localStorage.setItem('eb-fx', v ? '1' : '0'); } catch (e) {} }

/* ---------- utilities ---------- */
export const idx = (x: number, y: number) => y * W + x;
export const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
export function mulberry32(a: number){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const DIRS = { up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0} };

/* ---------- the loaded game (its scores are in program/scores.ts) ---------- */
export let game: GameDisk = DISKS[0];
/* the loaded game's code: fetched while its disk loads, then kept (one runtime per game) */
export let runtime: GameRuntime | null = null;
const runtimes: Record<string, GameRuntime> = {};
export const runtimeReady = (id: string) => !!runtimes[id];
/** Drop a game's runtime, so its next load makes a fresh one (a disk replaced at run time, or one that crashed). */
export function forgetRuntime(id: string){ delete runtimes[id]; }
export function fetchRuntime(d: GameDisk){
  if (runtimes[d.id]) return Promise.resolve(runtimes[d.id]);
  return loadGameCode(d.id).then(create => (runtimes[d.id] = runtimes[d.id] || create(api)));
}

/* ---------- audio: PC-speaker square waves and the floppy drive, in web/audio.ts ---------- */

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
export const held: Dir[] = [];
export let stickDir: Dir | null = null, fireCool = false, boostShown = '';
export let tapQueued = false, tapHeld = false, tapX = 0;
export const KEYMAP: Record<string, Dir> = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right' };
export const press = (d: Dir) => { if (!held.includes(d)) held.push(d); };
export const release = (d: Dir) => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
export const wantDir = () => stickDir ? DIRS[stickDir] : held.length ? DIRS[held[held.length - 1]] : null;

/** Enter fires only where a leaflet promises it: Bricks (FIRE reads SERVE) and Martian Storm. */
function serveKey() {
  const fire = Btn.button('fire');
  if (!fire.enabled) return false;
  return fire.label === 'serve' || game?.id === 'martian-storm';
}
addEventListener('keydown', e => {
  if ((e.target as Element)?.closest?.('.manual')) return;   // keys pressed on the leaflet's own buttons (Settings) are theirs, not the game's
  if (S.mode === 'entry' && !e.metaKey && !e.ctrlKey && !e.altKey) { if (entryKey(e.code)) e.preventDefault(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (S.mode === 'menu' && menuKey(e.code)) { e.preventDefault(); return; }
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
  // Bricks' leaflet says Enter serves, and Martian Storm's says Enter shoots. Only in ready or play:
  // the two branches above keep Enter for power-on and for restarting a finished game.
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
  let zr: DOMRect | null = null, touchFinger = false;   // touchGone only applies to a finger: a mouse or pen never shows in e.touches
  function setDir(d: Dir | null){
    if (d === stickDir) return;
    stickDir = d;
    zone.querySelectorAll('.tick').forEach(t => t.classList.toggle('on', t.dataset.d === d));
    if (d) buzz(6);   // a tiny nudge on each new direction, silent with SOUND off like every buzz
  }
  function show(v: { ox: number; oy: number; dx: number; dy: number; dir: Dir | null }){
    base.style.left = (v.ox - zr!.left) + 'px'; base.style.top = (v.oy - zr!.top) + 'px';
    knob.style.transform = `translate(${v.dx}px,${v.dy}px)`;
    setDir(v.dir);
  }
  function centre(){
    stick.reset(); setDir(null);
    zone.classList.remove('active');
    base.style.left = '50%'; base.style.top = '50%'; knob.style.transform = '';
  }
  function end(e: PointerEvent){
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
  const touchGone = (e: TouchEvent) => {
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
  Btn.defineSlot('boost', ['ShiftLeft', 'ShiftRight', 'KeyB'], 'boost', $('boostBtn'), $('boostBtn').querySelector('span') as HTMLElement | null, true);
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
export let lang = 'en', ovKind: 'title' | 'paused' | 'over' | 'font' = 'title', ovVars: any = {};
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
  const v = { font: [T.fontError, T.fontErrorText, T.fontRetry], title: ['TUNNEL RAIDER', T.titleText, T.start], paused: [T.paused, T.pausedText, T.resume], over: [T[game.overKey], T.overText(ovVars.n, ovVars.s), T[game.againKey]] }[ovKind];
  $('ovTitle').textContent = v[0]; $('ovText').innerHTML = v[1]; $('ovBtn').innerHTML = '<span class="blink">▶</span> ' + v[2];
}
export function showOverlay(kind: 'title' | 'paused' | 'over' | 'font', vars: any = {}){ ovKind = kind; ovVars = vars; renderOverlay(); overlay.hidden = false; }
export function applyLang(l: string | null | undefined, writeHash: boolean){
  lang = l && LANGS.includes(l) ? l : 'en';
  const htmlLang: Record<string, string> = { en: 'en', 'zh-hant': 'zh-Hant', 'zh-hans': 'zh-Hans' };
  document.documentElement.lang = htmlLang[lang] || lang;
  const T = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = (el as HTMLElement).dataset.i18n; const v = key ? T[key] : undefined; if (typeof v === 'string') (el as HTMLElement).innerHTML = v; });
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
export function trToast(text: string, opts: any = {}){
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
    const t = e.target as Element;
    if (now - lastTap < 350 && t.closest && t.closest('.tv, .netbadge')) e.preventDefault();
    lastTap = now;
  }, { passive: false });
  document.addEventListener('dblclick', e => { const t = e.target as Element; if (t.closest && t.closest('.tv')) e.preventDefault(); }, { passive: false });
}
/* backstop for browsers that ignore touch-action: a finger moving on the set never drags the page, and a mouse drag never picks up a piece of it */
{ const set = document.querySelector('.tv');
  if (set) {
    set.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    set.addEventListener('dragstart', e => e.preventDefault());
  }
}
window.trT = (k: string) => I18N[lang][k];
addEventListener('offline', () => trToast(I18N[lang].netOff, { state: 'off', ms: 5000 }));
addEventListener('online', () => trToast(I18N[lang].netOn, { state: 'on', ms: 5000 }));

/* ---------- full screen: the picture alone, browser full screen where the page allows it ---------- */
export let full = false;
export function setFull(v: boolean){
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
$('ovBtn').addEventListener('click', () => { ensureAudio(); if (pixelFont.state === 'failed') powerOn(); else if (S.mode === 'paused') togglePause(); else startGame(); });
$('pauseBtn').addEventListener('click', () => togglePause());
$('muteBtn').addEventListener('click', () => toggleMute());
$('fxBtn').addEventListener('click', () => setFx(!fx));
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => setMode((b as HTMLElement).dataset.mode!)));
export function toggleMute(){ setMuted(!muted); $('muteBtn').setAttribute('aria-pressed', String(!muted)); }
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
  forgetScores(); S.bestAtStart = 0;
  if (S.mode === 'over' && S.showBoard) { S.showBoard = false; S.boardHi = -1; overlay.hidden = false; }   // the attract loop only swaps views while there is a table
  track('scores_cleared', { game: game.id });
}
addEventListener(SETTINGS_EVENT, (e: Event) => {
  const what = (e as CustomEvent).detail;
  if (what === 'reset') resetSettings(); else if (what === 'scores') clearScores();
});
export function togglePause(forceOn?: boolean){
  if (typeof tvOn !== 'undefined' && !tvOn) return;
  if (S.mode === 'paused') { if (forceOn) return; S.mode = S.prevMode; overlay.hidden = true; $('pauseBtn').setAttribute('aria-pressed', 'false'); return; }
  if (!GAME_MODES.includes(S.mode)) return;
  S.prevMode = S.mode; S.mode = 'paused'; held.length = 0;
  $('pauseBtn').setAttribute('aria-pressed', 'true');
  showOverlay('paused');
}
export function startGame(){
  ensureAudio();
  S.level = 1; S.score = 0; S.lives = 3; S.nextLife = 20000; S.streak = 0; S.bestAtStart = scores.best; S.showBoard = false; S.boardHi = -1;
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
  powerQueued = false;
  document.documentElement.setAttribute('data-off', '');
  tvOn = false; offT = 0; S.mode = 'off'; held.length = 0; stickDir = null; Btn.releaseAll();
  overlay.hidden = true; saveBest();
  $('pauseBtn').setAttribute('aria-pressed', 'false');
  $('powerBtn').setAttribute('aria-checked', 'false');
  if (ac && !muted) { tone(90, 0.09, 0.06, -40); tone(12000, 0.5, 0.008, -11000); }
}
export function powerOn(){
  if (pixelFont.state !== 'ready') {
    powerQueued = true; $('powerBtn').setAttribute('aria-checked', 'true');
    if (pixelFont.state === 'failed') { overlay.hidden = true; pixelFont.load(); }
    return;
  }
  powerQueued = false;
  document.documentElement.removeAttribute('data-off');
  tvOn = true; warmT = 0; age.dg = 0; accReset = true;
  $('powerBtn').setAttribute('aria-checked', 'true'); document.documentElement.removeAttribute('data-fresh');
  if (ac && !muted) { tone(58, 0.9, 0.04, 14); tone(15000, 0.4, 0.006, 0); }
  track('power_on', { theme: modeKey, layout: layoutName() });
  startConsole('cold');
}
export function flipPower(){ ensureAudio(); buzz('tick'); if (ac) { tone(700, 0.03, 0.06, -200); tone(1400, 0.015, 0.05, 0, 0.06); } if (tvOn || powerQueued) powerOff(); else powerOn(); }
// tap to toggle, or flick the knob: right for on, left for off
{ let sx: number | null = null, flicked = false;
  $('powerBtn').addEventListener('pointerdown', e => { sx = e.clientX; flicked = false; });
  $('powerBtn').addEventListener('pointerup', e => {
    if (sx === null) return; const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 12) { flicked = true; if ((dx > 0) !== (tvOn || powerQueued)) flipPower(); }
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

/* ---------- main update ---------- */
export function update(dt: number){
  S.time += dt;
  for (let i = S.parts.length - 1; i >= 0; i--) { const q = S.parts[i]; q.life -= dt; q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) S.parts.splice(i, 1); }
  for (let i = S.pops.length - 1; i >= 0; i--) { const q = S.pops[i]; q.life -= dt; q.y -= 24 * dt; if (q.life <= 0) S.pops.splice(i, 1); }
  if (S.mode === 'entry') { updateEntry(dt); return; }
  if (S.mode === 'over') { updateOver(dt); return; }   // attract loop: the game-over card and the high-score table take turns
  if (S.mode === 'boot') { updateBoot(); return; }
  if (S.mode === 'menu') { updateMenu(dt); return; }
  if (S.mode === 'load') { updateLoad(dt); return; }
  if (runtime && ['ready', 'play', 'dying', 'clear'].includes(S.mode)) runtime.update(dt);
}

/* ---------- drawing into the low-res buffer (game units, C = 32) ---------- */
export const g = lx;
export function rr(x: number, y: number, w: number, h: number, r: number){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function poly(pts: number[]){ g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
export function circ(x: number, y: number, r: number){ g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

export function txt(s: string, x: number, y: number, role: string, align: CanvasTextAlign = 'left', size = 8){
  g.font = `${size}px Silkscreen, "Courier New", monospace`; g.textAlign = align; g.textBaseline = 'top';
  g.fillStyle = col(role); g.fillText(s, x, y);
}
export function banner(t1: string, t2?: string){
  const y = HUD + Math.round((LH - HUD) / 2) - 23;
  g.fillStyle = col('bg'); g.fillRect(0, y, LW, t2 ? 46 : 32);
  g.fillStyle = col('hud'); g.fillRect(0, y, LW, 1); g.fillRect(0, y + (t2 ? 45 : 31), LW, 1);
  txt(t1, LW / 2, y + 8, 'text', 'center', 16);
  if (t2) txt(t2, LW / 2, y + 30, 'hud', 'center', 8);
}

// FIRE (button or Space) picks a letter, or starts a new game from the attract loop
export function menuFire(){
  if (S.mode === 'menu') { loadGame(S.menuSel); return true; }
  if (S.mode === 'boot' || S.mode === 'load') return true;
  if (S.mode === 'entry') { entryPick(); return true; }
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
  entryTap(x, y);
});
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
export function tickAge(dt: number){
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
export function drawOff(w: number, h: number){
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
export function hexA(hex: string, a: number){ return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`; }
export function drawPicture(src: CanvasImageSource, oy: number, dh: number){
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
export function drawAged(w: number, h: number){
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
export let scan: HTMLCanvasElement | null = null, vig: HTMLCanvasElement | null = null;
/* ---------- the field adapts to the screen: pick a grid whose shape matches the box the layout gives the tube ---------- */
export function targetGrid(){
  const r = cv.parentElement!.getBoundingClientRect();
  if (r.width < 60 || r.height < 60) return [15, 10];
  const ar = r.width / r.height, fit = (w: number) => Math.round((w * CELL / ar - HUD) / CELL);
  if (ar >= 1) { const w = ar > 1.75 ? 17 : 15; return [w, Math.min(14, Math.max(7, fit(w)))]; }
  const w = r.width >= 520 ? 13 : r.width < 350 ? 10 : 11;   // upright: fewer, larger cells, more rows
  return [w, Math.min(22, Math.max(9, fit(w)))];
}
export function setGrid(w: number, h: number){
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
  const box = cv.parentElement!.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (box.width < 10 || box.height < 10) return;
  const sc = Math.min(box.width / LW, box.height / LH), cw = Math.floor(LW * sc), ch = Math.floor(LH * sc);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.max(LW, Math.round(cw * dpr)); cv.height = Math.round(cv.width * LH / LW);
  scan = document.createElement('canvas'); scan.width = cv.width; scan.height = cv.height;
  const s = scan.getContext('2d')!, rowH = cv.height / LH;
  s.fillStyle = `rgba(0,0,0,${rowH >= 2.5 ? 0.5 : 0.32})`;
  for (let y = 0; y < LH; y++) s.fillRect(0, Math.round(y * rowH + rowH * 0.55), cv.width, Math.max(1, Math.round(rowH * 0.45)));
  vig = document.createElement('canvas'); vig.width = cv.width; vig.height = cv.height;
  const v = vig.getContext('2d')!, gr = v.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
  v.fillStyle = gr; v.fillRect(0, 0, cv.width, cv.height);
  // colour-tube stripe mask: repeating red, green, blue columns
  mask = document.createElement('canvas'); mask.width = cv.width; mask.height = 1;
  const mk = mask.getContext('2d')!, mw = Math.max(1, Math.round(cv.width / (LW * 3))), stripes = ['#ff7a7a', '#7aff7a', '#7a7aff'];
  for (let x = 0, i = 0; x < cv.width; x += mw, i++) { mk.fillStyle = stripes[i % 3]; mk.fillRect(x, 0, mw, 1); }
}
/* upright layouts: the set fills the phone from just under the title to the bottom edge */
export function sizeTv(){
  const root = document.documentElement;
  if (!/portrait/.test(root.getAttribute('data-layout') || '')) { root.style.removeProperty('--tv-h'); return; }
  const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
  const top = document.querySelector('.tv')!.getBoundingClientRect().top + window.scrollY;
  const below = getComputedStyle(document.querySelector('.feet')!).display === 'none' ? 8 : 22;
  root.style.setProperty('--tv-h', Math.max(440, Math.floor(vh - top - below)) + 'px');
}
export function resize(){
  sizeTv();
  // while nothing is being played, re-deal the field to suit the new screen shape; mid-game it keeps its shape until the next seam
  if (['off', 'title', 'boot', 'menu', 'load'].includes(S.mode)) fitGrid();
  fitCanvas();
}
new ResizeObserver(() => resize()).observe(cv.parentElement!);
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
function drawSweep(w: number, h: number){
  const k = (S.time / M.sweep!) % 1, y = k * h;
  // the afterglow: darker the longer since the beam passed (above the beam it's this sweep, below it the last one)
  const fade = ctx.createLinearGradient(0, 0, 0, h), a = (n: number) => `rgba(0,0,0,${(0.5 * n).toFixed(3)})`;
  const ageAt = (yy: number) => (yy <= y ? (y - yy) / h : (y + h - yy) / h);
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
export function frame(now: number){
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
pixelFont.load();
requestAnimationFrame(frame);

/* setters for state the game modules change (an imported binding can't be assigned from outside its module) */
export function setBest(v: number){ scores.best = v; }
export function clearFireQueued(){ Btn.clearQueued('fire'); }
export function clearBoostQueued(){ Btn.clearQueued('boost'); }
export function clearTap(){ tapQueued = false; }
export function setAccReset(){ accReset = true; }

/* test hook for the Playwright checks; only with ?test in the address */
if (/[?&]test\b/.test(location.search)) (window as any).__gg = { S, get board(){ return scores.board; }, get keyRects(){ return keyRects; }, NKEYS, cv, get LW(){ return LW; }, get LH(){ return LH; }, overlay, killPlayer: (c?: string) => runtime?.debug?.kill?.(c), loadGame, DISKS, get game(){ return game; }, get runtime(){ return runtime; }, finishGame, get audioOut(){ return audioOut(); }, tone, lowres, cover: captureCover, launcherTargets, setGrid };

/** Test builds: the low-res buffer as it was last shown, one palette index (0 to 3) per pixel, before the CRT pass. */
function lowres(){
  const d = lx.getImageData(0, 0, LW, LH).data, P = palRGB, idx = new Uint8Array(LW * LH);
  for (let i = 0; i < idx.length; i++) {
    let bi = 0, bd = 1e9;
    for (let k = 0; k < 4; k++) { const dr = d[i * 4] - P[k][0], dg = d[i * 4 + 1] - P[k][1], db = d[i * 4 + 2] - P[k][2], dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; bi = k; } }
    idx[i] = bi;
  }
  return { w: LW, h: LH, idx };
}
/** Test builds: the playfield under the status bar, cropped to 4:3 and shrunk to a launcher cover (see make.cjs --covers). */
function captureCover(){
  const { w, h, idx } = lowres(), ph = h - HUD, [cx, cy, cw, ch] = cropTo(w, ph, COVER_W / COVER_H), crop = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop[y * cw + x] = idx[(HUD + cy + y) * w + cx + x];
  return { w: COVER_W, h: COVER_H, data: encodeCover(shrink(crop, cw, ch, COVER_W, COVER_H), COVER_W, COVER_H) };
}

/* ---------- the API games get (see src/games/types.ts): live getters over the console's state ---------- */
const screen = makeScreen2D(g, () => M);
const stamp = makeStamp(g, () => palRGB);
export const api: ConsoleAPI = {
  layer, stamp,
  get g(){ return screen; }, get LW(){ return LW; }, get LH(){ return LH; }, get HUD(){ return HUD; },
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
  get best(){ return scores.best; }, set best(v: number){ scores.best = v; },
  saveBest, finishGame, track, mulberry32,
  diskInfo: (y, p, t, d) => diskInfo(y, p, t, d),
};

/* The loader reads the console through this seam (see host.ts). It has to be bound before the first
   frame, and the requestAnimationFrame above does not run until this module has finished. */
const platform = makeWebPlatform({ track, layoutName, reducedMotion: reduceMotion, overlay, showOverCard: (n, sc) => showOverlay('over', { n, s: sc }) });
bindHost({
  platform,
  S, g, col, txt, age, api,
  setAccReset, startGame, setGame, setManual, clearInput, releaseKeys: () => { held.length = 0; },
  HUD,
  fetchRuntime, runtimeReady,
  get LW(){ return LW; },
  get LH(){ return LH; },
  get stickDir(){ return stickDir; },
  get tvOn(){ return tvOn; },
  get game(){ return game; },
});
loadScores(game.id);   // the first disk's, until a game is loaded

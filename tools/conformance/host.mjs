const DT = 1 / 60, HUD = 20, CELL = 24, C = 32;
const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
const SLOTS = ['fire', 'boost', 'fireL', 'fireR', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];
const METHODS = ['fillRect', 'beginPath', 'rect', 'moveTo', 'lineTo', 'arc', 'arcTo', 'closePath', 'fill', 'clip', 'translate', 'rotate', 'scale', 'setTransform'];

/** Parse the JSON boundary once, before any disk code runs. */
export function parseScript(value) {
  object(value, 'script');
  keys(value, ['frames', 'seed', 'grid', 'palette', 'events'], 'script');
  const frames = integer(value.frames ?? 360, 1, 36000, 'frames');
  const seed = integer(value.seed ?? 1, 0, 0xffffffff, 'seed');
  const grid = value.grid ?? { w: 15, h: 10 };
  object(grid, 'grid'); keys(grid, ['w', 'h'], 'grid');
  integer(grid.w, 10, 17, 'grid.w'); integer(grid.h, 7, 22, 'grid.h');
  const palette = value.palette ?? 'greenP1';
  if (typeof palette !== 'string') throw new Error('palette must be a mode name');
  const events = value.events ?? [];
  if (!Array.isArray(events)) throw new Error('events must be an array');
  let previous = -1;
  for (const event of events) {
    object(event, 'event'); keys(event, ['frame', 'held', 'stickDir', 'buttons', 'press', 'tap'], 'event');
    integer(event.frame, 0, frames - 1, 'event.frame');
    if (event.frame < previous) throw new Error('events must be ordered by frame');
    previous = event.frame;
    if (event.held !== undefined && (!Array.isArray(event.held) || event.held.some(d => !Object.hasOwn(DIRS, d)) || new Set(event.held).size !== event.held.length)) throw new Error('held must contain distinct directions, newest last');
    if (event.stickDir !== undefined && event.stickDir !== null && !Object.hasOwn(DIRS, event.stickDir)) throw new Error('stickDir must be a direction or null');
    if (event.buttons !== undefined) {
      object(event.buttons, 'buttons'); keys(event.buttons, SLOTS, 'buttons');
      if (Object.values(event.buttons).some(v => typeof v !== 'boolean')) throw new Error('button values must be booleans');
    }
    if (event.press !== undefined && (!Array.isArray(event.press) || event.press.some(id => !SLOTS.includes(id)))) throw new Error('press must contain button slot names');
    if (event.tap !== undefined) {
      object(event.tap, 'tap'); keys(event.tap, ['held', 'x'], 'tap');
      if (typeof event.tap.held !== 'boolean' || !Number.isFinite(event.tap.x) || event.tap.x < 0 || event.tap.x >= grid.w * CELL) throw new Error('tap needs held and an x within the tube');
    }
  }
  return { frames, seed, grid, palette, events };
}
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`); }
function keys(value, allowed, name) { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${name} field: ${key}`); }
function integer(value, min, max, name) { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`); return value; }

export function makeHost({ disk, script, palette, measurePixelText }) {
  const W = script.grid.w, H = script.grid.h, LW = W * CELL, LH = H * CELL + HUD;
  const S = { mode: 'ready', prevMode: null, modeT: 0, time: 0, level: 1, score: 0, lives: 3, nextLife: 20000,
    dug: new Uint8Array(W * H), em: new Uint8Array(W * H), dist: new Int16Array(W * H), emLeft: 0,
    bags: [], golds: [], monsters: [], sparks: [], parts: [], pops: [], spawned: 0, total: 0, maxAlive: 3, spawnT: 0,
    sun: { active: false, used: false, x: W - 2, y: 1 }, bonusT: 0, bonusChain: 0, sirenT: 0, sirenHi: false,
    charge: 1, streak: 0, lastGem: -9, player: null, distT: 0, boost: 1, boostT: 0, bestAtStart: 0 };
  let commands = [], fillStyle = palette.pal[0], font = '8px Silkscreen, "Courier New", monospace';
  let held = [], stickDir = null, tapQueued = false, tapHeld = false, tapX = 0, nextLayer = 0;
  const stack = [], layers = new WeakMap(), buttons = {};
  const record = (name, ...args) => commands.push([name, ...args]);
  const colourIndex = colour => { const n = palette.pal.indexOf(colour); if (n < 0) throw new Error(`Colour outside palette: ${colour}`); return n; };
  // Match the web's previous ink for legacy unmapped roles, notably rockjaw.
  const col = role => palette.pal[palette.roles[role]] ?? fillStyle;
  const g = {};
  for (const method of METHODS) g[method] = (...args) => record(method, ...args);
  Object.defineProperties(g, {
    fillStyle: { get: () => fillStyle, set: value => { const index = colourIndex(value); fillStyle = value; record('fillStyle', index); } },
    font: { get: () => font, set: value => { measurePixelText('', value); font = value; record('font', value); } },
  });
  g.measureText = text => { const result = measurePixelText(text, font); record('measureText', text, result.width); return result; };
  g.save = () => { stack.push({ fillStyle, font }); record('save'); };
  g.restore = () => { const state = stack.pop(); if (state) ({ fillStyle, font } = state); record('restore'); };
  const screen = new Proxy(g, { get(target, key) { if (!Object.hasOwn(target, key)) throw new Error(`Not in Screen2D: ${String(key)}`); return target[key]; }, set(target, key, value) { if (!['fillStyle', 'font'].includes(key)) throw new Error(`Not writable in Screen2D: ${String(key)}`); target[key] = value; return true; } });
  const B = id => {
    if (!SLOTS.includes(id)) return { label: '', enabled: false, held: false, queued: false };
    if (!buttons[id]) buttons[id] = { label: '', enabled: false, held: false, queued: false };
    return buttons[id];
  };
  // The web keeps FIRE's countdown press; BOOST and optional slots only queue during play.
  const queuePress = id => { const button = B(id); if (button.enabled) button.queued = id === 'fire' || S.mode === 'play'; };
  for (const id of SLOTS) { const spec = disk.buttons[id]; Object.assign(B(id), spec ? { label: spec.label, enabled: spec.enabled ?? true } : { label: '', enabled: false }); }
  const txt = (text, x, y, role = 'text', align = 'left', size = 8) => {
    g.font = `${size}px Silkscreen, "Courier New", monospace`; g.fillStyle = col(role);
    record('txt', text, x, y, colourIndex(fillStyle), align, size);
  };
  const api = {
    g: screen, LW, LH, HUD, W, H, C, K: CELL / C, S, best: 0,
    fitGrid() {}, col, palette, palRGB: palette.pal.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))),
    txt,
    banner(title, sub) { const y = HUD + Math.round((LH - HUD) / 2) - 23; g.fillStyle = col('bg'); g.fillRect(0, y, LW, sub ? 46 : 32); g.fillStyle = col('hud'); g.fillRect(0, y, LW, 1); g.fillRect(0, y + (sub ? 45 : 31), LW, 1); txt(title, LW / 2, y + 8, 'text', 'center', 16); if (sub) txt(sub, LW / 2, y + 30, 'hud', 'center', 8); },
    rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
    poly(points) { g.beginPath(); g.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]); g.closePath(); g.fill(); },
    circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); },
    layer(w, h) { integer(w, 1, 4096, 'layer.w'); integer(h, 1, 4096, 'layer.h'); return { w, h, px: new Uint8Array(w * h) }; },
    stamp(layer, x, y) { if (layer.px.length !== layer.w * layer.h || layer.px.some(n => n > 3)) throw new Error('Invalid layer pixels'); let cached = layers.get(layer); if (!cached) { cached = { id: nextLayer++, data: null }; layers.set(layer, cached); } const data = Buffer.from(layer.px).toString('base64'); if (cached.data !== data) { record('layer', cached.id, layer.w, layer.h, data); cached.data = data; } record('stamp', cached.id, x, y); },
    idx: (x, y) => y * W + x, inb: (x, y) => x >= 0 && y >= 0 && x < W && y < H, DIRS,
    get held() { return held; }, get stickDir() { return stickDir; }, wantDir: () => DIRS[stickDir ?? held.at(-1)] ?? null,
    button: id => ({ ...B(id) }), clearButton(id) { B(id).queued = false; },
    setButtons(changes) {
      for (const [id, value] of Object.entries(changes)) if (SLOTS.includes(id)) {
        const button = B(id), spec = value === null ? (disk.buttons[id] ?? { label: button.label, enabled: false }) : value;
        button.label = spec.label ?? button.label; button.enabled = spec.enabled ?? (value === null ? true : button.enabled);
        if (!button.enabled) button.queued = button.held = false;
      }
      record('buttons', changes);
    },
    get fireHeld() { return B('fire').held; }, get fireQueued() { return B('fire').queued; },
    get boostHeld() { return B('boost').held; }, get boostQueued() { return B('boost').queued; },
    clearFire() { B('fire').queued = false; }, clearBoost() { B('boost').queued = false; },
    get tapHeld() { return tapHeld; }, get tapQueued() { return tapQueued; }, get tapX() { return tapX; }, clearTap() { tapQueued = false; },
    setBoostLabel(label) { api.setButtons({ boost: label === null ? null : { label } }); },
    tone: (...args) => record('tone', ...args), buzz: pattern => record('buzz', pattern), track() {},
    saveBest() { record('best', api.best); }, finishGame() { S.mode = 'over'; api.saveBest(); record('finishGame'); },
    mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
    diskInfo() { throw new Error('Loading screens need a system-disk host; this runner records game play'); },
  };
  return {
    api,
    takeCommands() { const out = commands; commands = []; return out; },
    state() { return { mode: S.mode, modeT: S.modeT, time: S.time, score: S.score, level: S.level, lives: S.lives, best: api.best }; },
    input(event) {
      if (event.held !== undefined) held = [...event.held];
      if (event.stickDir !== undefined) stickDir = event.stickDir;
      for (const [id, down] of Object.entries(event.buttons ?? {})) { const button = B(id); if (!button.enabled) continue; if (down && !button.held) queuePress(id); button.held = down; }
      for (const id of event.press ?? []) queuePress(id);
      if (event.tap && disk.tap) { if (event.tap.held && !tapHeld) tapQueued = true; tapHeld = event.tap.held; tapX = event.tap.x; }
    },
    step(runtime) {
      S.time += DT;
      // The console owns Tunnel Raider's legacy particles and score pop-ups.
      for (let i = S.parts.length - 1; i >= 0; i--) { const q = S.parts[i]; q.life -= DT; q.vy += 220 * DT; q.x += q.vx * DT; q.y += q.vy * DT; if (q.life <= 0) S.parts.splice(i, 1); }
      for (let i = S.pops.length - 1; i >= 0; i--) { const q = S.pops[i]; q.life -= DT; q.y -= 24 * DT; if (q.life <= 0) S.pops.splice(i, 1); }
      if (['ready', 'play', 'dying', 'clear'].includes(S.mode)) runtime.update(DT);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col('bg'); g.fillRect(0, 0, LW, LH); runtime.draw();
    },
  };
}

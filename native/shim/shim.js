// The disk contract shim (GAM-36): builds the `api` a game disk is handed, and records everything the disk draws
// or asks for into one flat command buffer per frame. A plain script with no imports, exports or host globals, so
// QuickJS (the apps), JavaScriptCore and Node all run it the same way. It defines one global, `PGDShim`.
// The buffer layout is in native/shim/README.md; tools/conformance/host.mjs decodes it back into stream format 1.
var PGDShim = (function () {
  'use strict';
  var VERSION = 1;
  // Opcodes. Keep in step with native/shim/README.md; never renumber one, only add.
  var OPS = ['', 'fillRect', 'beginPath', 'rect', 'moveTo', 'lineTo', 'arc', 'arcTo', 'closePath', 'fill', 'clip',
    'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'fillStyle', 'font', 'measureText', 'txt',
    'layer', 'stamp', 'tone', 'buzz', 'buttons', 'best', 'finishGame'];
  var OP = {};
  for (var n = 1; n < OPS.length; n++) OP[OPS[n]] = n;
  // Argument tags: every argument is two numbers, its tag and its value.
  var TAG = { number: 0, boolean: 1, string: 2, null: 3, undefined: 4, json: 5, blob: 6 };
  var DT = 1 / 60, HUD = 20, CELL = 24, C = 32;
  var DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  var SLOTS = ['fire', 'boost', 'fireL', 'fireR', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];
  var METHODS = ['fillRect', 'beginPath', 'rect', 'moveTo', 'lineTo', 'arc', 'arcTo', 'closePath', 'fill', 'clip',
    'translate', 'rotate', 'scale', 'setTransform'];

  // JSON would quietly turn NaN and Infinity into null; a disk that sends one is wrong, so say so.
  function finite(key, item) {
    if (typeof item === 'number' && !isFinite(item)) throw new Error('A disk sent a non-finite number in ' + (key || 'an argument'));
    return item;
  }

  /** The command buffer: numbers in a growing Float64Array, strings and layer pixels in side tables. */
  function makeBuffer() {
    var ops = new Float64Array(4096), length = 0, strings = [], stringAt = new Map(), blobs = [];
    function room(count) {
      if (length + count <= ops.length) return;
      var size = ops.length * 2;
      while (size < length + count) size *= 2;
      var grown = new Float64Array(size);
      grown.set(ops.subarray(0, length));
      ops = grown;
    }
    function string(text) {
      var at = stringAt.get(text);
      if (at === undefined) { at = strings.length; strings.push(text); stringAt.set(text, at); }
      return at;
    }
    function value(item) {
      var type = typeof item;
      if (type === 'number') { ops[length++] = TAG.number; ops[length++] = item; }
      else if (type === 'boolean') { ops[length++] = TAG.boolean; ops[length++] = item ? 1 : 0; }
      else if (type === 'string') { ops[length++] = TAG.string; ops[length++] = string(item); }
      else if (item === null) { ops[length++] = TAG.null; ops[length++] = 0; }
      else if (item === undefined) { ops[length++] = TAG.undefined; ops[length++] = 0; }
      else if (item instanceof Uint8Array) { ops[length++] = TAG.blob; ops[length++] = blobs.length; blobs.push(item); }
      else { ops[length++] = TAG.json; ops[length++] = string(JSON.stringify(item, finite)); }
    }
    return {
      /** One command: its opcode, its argument count, then each argument as a tag and a value. */
      push: function (op, args) {
        room(2 + args.length * 2);
        ops[length++] = op; ops[length++] = args.length;
        for (var i = 0; i < args.length; i++) value(args[i]);
      },
      /** Hand over this frame's commands and start an empty one. */
      take: function () {
        var frame = { version: VERSION, ops: ops.slice(0, length), strings: strings, blobs: blobs };
        length = 0; strings = []; stringAt = new Map(); blobs = [];
        return frame;
      },
    };
  }

  function integer(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(name + ' must be an integer from ' + min + ' to ' + max);
    return value;
  }

  /**
   * One loaded disk's api. `grid` is { w, h } in cells, `palette` is { pal: four colour strings, roles }, and
   * `measurePixelText(text, font)` answers { width } from the shared Silkscreen table (the native font on the apps).
   */
  function createShim(options) {
    var disk = options.disk, palette = options.palette, measurePixelText = options.measurePixelText;
    var W = options.grid.w, H = options.grid.h, LW = W * CELL, LH = H * CELL + HUD;
    var S = { mode: 'ready', prevMode: null, modeT: 0, time: 0, level: 1, score: 0, lives: 3, nextLife: 20000,
      dug: new Uint8Array(W * H), em: new Uint8Array(W * H), dist: new Int16Array(W * H), emLeft: 0,
      bags: [], golds: [], monsters: [], sparks: [], parts: [], pops: [], spawned: 0, total: 0, maxAlive: 3, spawnT: 0,
      sun: { active: false, used: false, x: W - 2, y: 1 }, bonusT: 0, bonusChain: 0, sirenT: 0, sirenHi: false,
      charge: 1, streak: 0, lastGem: -9, player: null, distT: 0, boost: 1, boostT: 0, bestAtStart: 0 };
    var buffer = makeBuffer();
    var fillStyle = palette.pal[0], font = '8px Silkscreen, "Courier New", monospace';
    var held = [], stickDir = null, tapDown = false, tapQueued = false, tapHeld = false, tapX = 0, nextLayer = 0;
    var stack = [], layers = new WeakMap(), buttons = {};
    function record(name) { buffer.push(OP[name], Array.prototype.slice.call(arguments, 1)); }
    function colourIndex(colour) {
      var index = palette.pal.indexOf(colour);
      if (index < 0) throw new Error('Colour outside palette: ' + colour);
      return index;
    }
    // Match the web's previous ink for legacy unmapped roles, notably rockjaw.
    function col(role) { var c = palette.pal[palette.roles[role]]; return c == null ? fillStyle : c; }

    var g = {};
    METHODS.forEach(function (method) { g[method] = function () { buffer.push(OP[method], Array.prototype.slice.call(arguments)); }; });
    Object.defineProperties(g, {
      fillStyle: { get: function () { return fillStyle; }, set: function (value) { var index = colourIndex(value); fillStyle = value; record('fillStyle', index); } },
      font: { get: function () { return font; }, set: function (value) { measurePixelText('', value); font = value; record('font', value); } },
    });
    g.measureText = function (text) { var result = measurePixelText(text, font); record('measureText', text, result.width); return result; };
    g.save = function () { stack.push({ fillStyle: fillStyle, font: font }); record('save'); };
    g.restore = function () { var state = stack.pop(); if (state) { fillStyle = state.fillStyle; font = state.font; } record('restore'); };
    var screen = new Proxy(g, {
      get: function (target, key) { if (!Object.prototype.hasOwnProperty.call(target, key)) throw new Error('Not in Screen2D: ' + String(key)); return target[key]; },
      set: function (target, key, value) { if (key !== 'fillStyle' && key !== 'font') throw new Error('Not writable in Screen2D: ' + String(key)); target[key] = value; return true; },
    });

    function B(id) {
      if (SLOTS.indexOf(id) < 0) return { label: '', enabled: false, held: false, queued: false };
      if (!buttons[id]) buttons[id] = { label: '', enabled: false, held: false, queued: false };
      return buttons[id];
    }
    // The web keeps FIRE's countdown press; BOOST and optional slots only queue during play.
    function queuePress(id) { var button = B(id); if (button.enabled) button.queued = id === 'fire' || S.mode === 'play'; }
    SLOTS.forEach(function (id) {
      var spec = disk.buttons[id], button = B(id);
      if (spec) { button.label = spec.label; button.enabled = spec.enabled == null ? true : spec.enabled; }
      else { button.label = ''; button.enabled = false; }
    });
    function copy(button) { return { label: button.label, enabled: button.enabled, held: button.held, queued: button.queued }; }
    function txt(text, x, y, role, align, size) {
      if (role === undefined) role = 'text';
      if (align === undefined) align = 'left';
      if (size === undefined) size = 8;
      g.font = size + 'px Silkscreen, "Courier New", monospace'; g.fillStyle = col(role);
      record('txt', text, x, y, colourIndex(fillStyle), align, size);
    }
    function validLayer(layer) {
      if (layer.px.length !== layer.w * layer.h) return false;
      for (var i = 0; i < layer.px.length; i++) if (layer.px[i] > 3) return false;
      return true;
    }
    function same(a, b) {
      if (!b || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }

    var api = {
      g: screen, LW: LW, LH: LH, HUD: HUD, W: W, H: H, C: C, K: CELL / C, S: S, best: 0,
      fitGrid: function () {}, col: col, palette: palette,
      palRGB: palette.pal.map(function (hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }),
      txt: txt,
      banner: function (title, sub) {
        var y = HUD + Math.round((LH - HUD) / 2) - 23;
        g.fillStyle = col('bg'); g.fillRect(0, y, LW, sub ? 46 : 32);
        g.fillStyle = col('hud'); g.fillRect(0, y, LW, 1); g.fillRect(0, y + (sub ? 45 : 31), LW, 1);
        txt(title, LW / 2, y + 8, 'text', 'center', 16);
        if (sub) txt(sub, LW / 2, y + 30, 'hud', 'center', 8);
      },
      rr: function (x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
      poly: function (points) { g.beginPath(); g.moveTo(points[0], points[1]); for (var i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]); g.closePath(); g.fill(); },
      circ: function (x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); },
      layer: function (w, h) { integer(w, 1, 4096, 'layer.w'); integer(h, 1, 4096, 'layer.h'); return { w: w, h: h, px: new Uint8Array(w * h) }; },
      // A layer's pixels go into the buffer on its first stamp and again only when they change.
      stamp: function (layer, x, y) {
        if (!validLayer(layer)) throw new Error('Invalid layer pixels');
        var cached = layers.get(layer);
        if (!cached) { cached = { id: nextLayer++, px: null }; layers.set(layer, cached); }
        if (!same(layer.px, cached.px)) { cached.px = new Uint8Array(layer.px); record('layer', cached.id, layer.w, layer.h, new Uint8Array(layer.px)); }
        record('stamp', cached.id, x, y);
      },
      idx: function (x, y) { return y * W + x; }, inb: function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; }, DIRS: DIRS,
      get held() { return held; }, get stickDir() { return stickDir; },
      wantDir: function () { var d = DIRS[stickDir != null ? stickDir : held[held.length - 1]]; return d == null ? null : d; },
      button: function (id) { return copy(B(id)); }, clearButton: function (id) { B(id).queued = false; },
      setButtons: function (changes) {
        var patch = {};
        Object.keys(changes).forEach(function (id) {
          var value = changes[id];
          if (SLOTS.indexOf(id) >= 0) {
            var button = B(id), spec = value === null ? (disk.buttons[id] != null ? disk.buttons[id] : { label: button.label, enabled: false }) : value;
            button.label = spec.label == null ? button.label : spec.label;
            button.enabled = spec.enabled == null ? (value === null ? true : button.enabled) : spec.enabled;
            if (!button.enabled) button.queued = button.held = false;
          }
          patch[id] = value === null ? null : Object.assign({}, value);
        });
        record('buttons', patch);
      },
      get fireHeld() { return B('fire').held; }, get fireQueued() { return B('fire').queued; },
      get boostHeld() { return B('boost').held; }, get boostQueued() { return B('boost').queued; },
      clearFire: function () { B('fire').queued = false; }, clearBoost: function () { B('boost').queued = false; },
      get tapHeld() { return tapHeld; }, get tapQueued() { return tapQueued; }, get tapX() { return tapX; },
      clearTap: function () { tapQueued = false; },
      setBoostLabel: function (label) { api.setButtons({ boost: label === null ? null : { label: label } }); },
      tone: function () { buffer.push(OP.tone, Array.prototype.slice.call(arguments)); },
      buzz: function (pattern) { record('buzz', pattern); }, track: function () {},
      saveBest: function () { record('best', api.best); },
      finishGame: function () { S.mode = 'over'; api.saveBest(); record('finishGame'); },
      mulberry32: function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
      diskInfo: function () { throw new Error('Loading screens need a system-disk host; this shim runs game play'); },
    };

    return {
      api: api,
      /** This frame's commands, as { version, ops, strings, blobs }; the buffer starts empty again. */
      take: function () { return buffer.take(); },
      state: function () { return { mode: S.mode, modeT: S.modeT, time: S.time, score: S.score, level: S.level, lives: S.lives, best: api.best }; },
      /** Input from the core, applied before the frame's update. Omitted fields keep their values. */
      input: function (event) {
        if (event.held !== undefined) held = event.held.slice();
        if (event.stickDir !== undefined) stickDir = event.stickDir;
        var pressed = event.buttons || {};
        Object.keys(pressed).forEach(function (id) {
          var button = B(id), down = pressed[id];
          if (!button.enabled) return;
          if (down && !button.held) queuePress(id);
          button.held = down;
        });
        (event.press || []).forEach(queuePress);
        if (event.tap) {
          var edge = event.tap.held && !tapDown;
          tapDown = event.tap.held;
          if (!tapDown) tapHeld = false;
          else if (edge && disk.tap && (S.mode === 'play' || S.mode === 'ready')) { tapQueued = true; tapHeld = true; tapX = event.tap.x; }
        }
      },
      /** One 1/60 s frame: the console's own particles, the game's update in its modes, then a cleared picture and draw. */
      step: function (runtime) {
        S.time += DT;
        // The console owns Tunnel Raider's legacy particles and score pop-ups.
        var i, q;
        for (i = S.parts.length - 1; i >= 0; i--) { q = S.parts[i]; q.life -= DT; q.vy += 220 * DT; q.x += q.vx * DT; q.y += q.vy * DT; if (q.life <= 0) S.parts.splice(i, 1); }
        for (i = S.pops.length - 1; i >= 0; i--) { q = S.pops[i]; q.life -= DT; q.y -= 24 * DT; if (q.life <= 0) S.pops.splice(i, 1); }
        if (S.mode === 'ready' || S.mode === 'play' || S.mode === 'dying' || S.mode === 'clear') runtime.update(DT);
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col('bg'); g.fillRect(0, 0, LW, LH); runtime.draw();
      },
    };
  }

  return { VERSION: VERSION, OPS: OPS, TAG: TAG, SLOTS: SLOTS, DIRS: DIRS, createShim: createShim };
})();

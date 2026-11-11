/* Draws one frame of the launcher from its state, layout and system, through the console API only. */
import type { ConsoleAPI, GameDisk } from '../../games/types';
import type { LauncherSystem, DiskState } from './system';
import type { LauncherState } from './state';
import { previewing, previewT, cursorOn } from './state';
import type { Layout, Card, Line, Rect } from './layout';
import { LINE } from './layout';
import { paintCover, paintPixels, decodeCover, cropTo } from './cover';
import { stateIcon, coverOverlay, stateLine, DIM_NEAR, DIM_FAR, DIM_MISSING, ICON_W } from './states';

type Api = Pick<ConsoleAPI, 'g' | 'col' | 'txt' | 'LW' | 'LH' | 'palette'>;
const R = (a: Api, x: number, y: number, w: number, h: number, role: string) => { a.g.fillStyle = a.col(role); a.g.fillRect(x, y, w, h); };
const pad2 = (v: number) => String(v).padStart(2, '0');
const FONT = '8px Silkscreen, "Courier New", monospace';
const width = (a: Api, s: string) => { a.g.font = FONT; return Math.ceil(a.g.measureText(s).width); };
/** Shorten a line until it fits `max` px. */
function fit(a: Api, s: string, max: number){
  if (width(a, s) <= max) return s;
  while (s.length > 1 && width(a, s + '..') > max) s = s.slice(0, -1);
  return s.trimEnd() + '..';
}
/** Coloured pieces of one line, centred on cx. */
function pieces(a: Api, parts: [string, string][], cx: number, y: number, max: number){
  let text = parts.map(p => p[0]).join('');
  if (width(a, text) > max) { a.txt(fit(a, text, max), cx, y, parts[0][1], 'center'); return; }
  let x = Math.round(cx - width(a, text) / 2);
  for (const [s, role] of parts) { a.txt(s, x, y, role, 'left'); x += width(a, s); }
}
function frame(a: Api, r: Rect, role: string){
  R(a, r.x - 1, r.y - 1, r.w + 2, 1, role); R(a, r.x - 1, r.y + r.h, r.w + 2, 1, role);
  R(a, r.x - 1, r.y, 1, r.h, role); R(a, r.x + r.w, r.y, 1, r.h, role);
}
function triangle(a: Api, r: Rect, by: -1 | 1, role: string){
  const cx = Math.round(r.x + r.w / 2), cy = Math.round(r.y + r.h / 2);
  for (let i = 0; i < 4; i++) R(a, by < 0 ? cx - 2 + i : cx + 1 - i, cy - i, 1, 2 * i + 1, role);
}

/** A disk with no cover of any kind: its title on a floppy label. */
function labelCover(a: Api, d: GameDisk, r: Rect, dim: number){
  const ink = dim ? 'hud' : 'text';
  R(a, r.x, r.y, r.w, r.h, dim ? 'dirt' : 'hud');                                    // 'dirt' is the dim index on every theme
  const sw = Math.round(r.w * 0.4), sh = Math.round(r.h * 0.3);
  R(a, r.x + Math.round((r.w - sw) / 2), r.y, sw, sh, 'bg');                       // shutter
  const lx = r.x + Math.round(r.w * 0.1), ly = r.y + Math.round(r.h * 0.45), lw = Math.round(r.w * 0.8), lh = Math.round(r.h * 0.48);
  R(a, lx, ly, lw, lh, 'bg');                                                       // label
  if (lw > 30 && lh > 10) a.txt(fit(a, d.title, lw - 4), r.x + r.w / 2, ly + Math.round(lh / 2) - 4, ink, 'center');
}

function paintCard(a: Api, d: GameDisk, c: Card, s: LauncherState, sys: LauncherSystem, st: DiskState){
  const pal: string[] = a.palette.pal, front = c.off === 0;
  const map = st.kind === 'missing' ? DIM_MISSING : c.dim === 2 ? DIM_FAR : c.dim === 1 ? DIM_NEAR : undefined;
  const live = front && previewing(s, sys.reducedMotion()), pt = previewT(s);
  if (live && d.drawPreview) d.drawPreview(a as ConsoleAPI, c.x, c.y, c.w, c.h, pt);
  else if (live && d.preview && d.preview.frames.length) {
    const p = d.preview, f = p.frames[Math.floor(pt * p.fps) % p.frames.length];
    paintPixels(a.g, pal, decodeFrame(f, p.w, p.h), p.w, p.h, c.x, c.y, c.w, c.h, { src: cropTo(p.w, p.h, c.w / c.h), map }); // cropped like the still cover
  }
  else if (d.drawCover) d.drawCover(a as ConsoleAPI, c.x, c.y, c.w, c.h, front ? s.t : 0);
  else if (d.cover) paintCover(a.g, pal, d.cover, c.x, c.y, c.w, c.h, map);
  else labelCover(a, d, c, c.dim);
  frame(a, c, front ? 'text' : 'hud');
  if (front) coverOverlay(a, c, st);
}
const frames = new Map<string, Uint8Array>();
function decodeFrame(f: string, w: number, h: number){
  let px = frames.get(f);
  if (!px) { px = decodeCover(f, w, h); if (frames.size > 64) frames.clear(); frames.set(f, px); }
  return px;
}

function header(a: Api, L: Layout, s: LauncherState, sys: LauncherSystem){
  const n = sys.disks().length, cur = cursorOn(s, sys.reducedMotion());
  if (L.header.lines === 2) {
    a.txt('PGD-01 PORTABLE GAMING DEVICE', a.LW / 2, L.header.y, 'text', 'center');
    const p = `A:\\> DRIVE A: ${n} DISKS`, w = width(a, p), x = Math.round(a.LW / 2 - (w + 6) / 2);
    a.txt(p, x, L.header.y + 11, 'hud');
    if (cur) R(a, x + w + 2, L.header.y + 17, 5, 2, 'text');
  } else {
    a.txt('PGD-01 PORTABLE GAMING DEVICE', 8, L.header.y, 'text');
    const p = L.tier === 'short' ? `A:\\> ${n} DISKS` : `A:\\> DRIVE A: ${n} DISKS`;
    a.txt(p, a.LW - 15, L.header.y, 'hud', 'right');
    if (cur) R(a, a.LW - 13, L.header.y + 6, 5, 2, 'text');
  }
  for (let x = 8; x < a.LW - 8; x += 4) R(a, x, L.header.ruleY, 2, 1, 'hud');
}

function detailLine(a: Api, kind: Line, d: GameDisk, sys: LauncherSystem, y: number){
  const cx = a.LW / 2, max = a.LW - 8, b = sys.best(d.id);
  const hi = `HI ${String(b.score).padStart(6, '0')}${b.name ? ' ' + b.name : ''}`;
  if (kind === 'blurb') a.txt(fit(a, d.blurb, max), cx, y, 'textDim', 'center');
  else if (kind === 'blurbHi') pieces(a, [[d.blurb + ' · ', 'textDim'], [`HI ${String(b.score).padStart(6, '0')}`, 'gold']], cx, y, max);
  else if (kind === 'hi') pieces(a, [[hi, 'gold'], [` · ${d.genre} · ${d.players}P${d.year ? ' · ' + d.year : ''}`, 'hud']], cx, y, max);
  else {
    // the controls glyph, then one chip per lit button: STICK  [FIRE JUMP] [BOOST DUCK]
    const glyph = (d.controls === 'pad' ? 'PAD' : 'STICK') + (d.tap ? ' + TAP' : '');
    // one chip per lit action button, named by what it does in this game (the stand-in pad's slots aren't listed)
    const chips = Object.entries(d.buttons).filter(([k, v]) => !k.startsWith('pad') && v.enabled !== false).map(([, v]) => sys.label(v.label).toUpperCase());
    const all = [glyph, ...chips], ws = all.map(t => width(a, t) + (t === glyph ? 0 : 6)), gap = 6;
    let total = ws.reduce((p, w) => p + w, 0) + gap * (all.length - 1);
    while (total > max && all.length > 1) { total -= ws.pop()! + gap; all.pop(); }
    let x = Math.round(cx - total / 2);
    all.forEach((t, k) => {
      if (k === 0) a.txt(t, x, y, 'hud');
      else { R(a, x, y - 2, ws[k], 1, 'textDim'); R(a, x, y + 8, ws[k], 1, 'textDim'); R(a, x, y - 2, 1, 11, 'textDim'); R(a, x + ws[k] - 1, y - 2, 1, 11, 'textDim'); a.txt(t, x + 3, y, 'text'); }
      x += ws[k] + gap;
    });
  }
}

function ticks(a: Api, L: Layout, s: LauncherState){
  const T = L.ticks;
  for (const t of T.items) {
    const on = t.i === s.sel;
    if (T.numbered) {
      const y = on ? t.y - 2 : t.y;
      if (on) { R(a, t.x, y, t.w, t.h, 'text'); a.txt(pad2(t.i + 1), t.x + t.w / 2, y + 3, 'bg', 'center'); }
      else { frame(a, { x: t.x + 1, y: y + 1, w: t.w - 2, h: t.h - 2 }, 'hud'); a.txt(pad2(t.i + 1), t.x + t.w / 2, y + 3, 'hud', 'center'); }
    } else {
      const mw = 6, mx = t.x + Math.round((t.w - mw) / 2);
      if (on) R(a, mx, t.y + t.h - 9, mw, 8, 'text'); else R(a, mx, t.y + t.h - 5, mw, 4, 'hud');
    }
  }
  const first = T.items[0], last = T.items[T.items.length - 1];
  if (T.before && first) triangle(a, { x: first.x - 14, y: T.y, w: 12, h: T.h }, -1, 'hud');
  if (T.after && last) triangle(a, { x: last.x + last.w + 2, y: T.y, w: 12, h: T.h }, 1, 'hud');
}

/** One frame of the launcher. `notice` (the DISK ERROR line) takes the counter line's place while it's set. */
export function drawLauncher(a: Api, L: Layout, s: LauncherState, sys: LauncherSystem, notice?: string | null){
  const disks = sys.disks();
  header(a, L, s, sys);
  if (!disks.length) { a.txt('NO DISKS IN DRIVE A:', a.LW / 2, a.LH / 2 - 4, 'hud', 'center'); return; }
  for (const c of L.cards) { const d = disks[c.i]; if (d) paintCard(a, d, c, s, sys, sys.state(d.id)); }
  for (const r of L.arrows) triangle(a, r, r.by, 'hud');
  const d = disks[s.sel], st = sys.state(d.id), cx = Math.round(L.front.x + L.front.w / 2);
  // the label strip: the state's floppy and the title, then the file and size (or what the state needs)
  const title = fit(a, d.title, a.LW - 44), line2 = fit(a, stateLine(st, d.file, d.size), a.LW - 44);
  a.txt(title, cx, L.label.y + 1, 'text', 'center');
  a.txt(line2, cx, L.label.y + 11, 'hud', 'center');
  // the state's floppy sits left of both lines
  if (L.tier !== 'short') stateIcon(a, Math.round(cx - Math.max(width(a, title), width(a, line2)) / 2) - ICON_W - 6, L.label.y + 2, st);
  L.details.lines.forEach((k, j) => detailLine(a, k, d, sys, L.details.y + j * LINE + 1));
  ticks(a, L, s);
  const count = `${pad2(s.sel + 1)}/${pad2(disks.length)}`;
  if (notice) a.txt(fit(a, notice, a.LW - 8), a.LW / 2, L.counter.y, 'gold', 'center');
  else a.txt(count + (L.counter.long ? ' · STICK TO CHOOSE · FIRE TO LOAD' : ' · FIRE TO LOAD'), a.LW / 2, L.counter.y, 'hud', 'center');
}

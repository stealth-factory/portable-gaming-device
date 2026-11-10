/* Where everything goes on the tube, for one tube size and box of disks. Pure: the same numbers on the web and in
   the apps, and unit-tested at every size the console comes in. All values are low-res pixels.

   Three tiers (see the launcher design spec):
   - wide      desk, console and tablet held sideways: two neighbours a side, label, three details lines, numbered ticks
   - portrait  phones and tablets upright: a tall front cover with its neighbours cropped at the edges, blurb and HI
   - short     a phone held sideways or a short console: one neighbour a side, one details line, plain ticks */
import type { Target } from './state';

export type Tier = 'wide' | 'portrait' | 'short';
export interface Rect { x: number; y: number; w: number; h: number }
/** A cover on the carousel: which disk, how far from the front (0 is the front), and how dim (0 full, 1 near, 2 far). */
export interface Card extends Rect { i: number; off: number; dim: 0 | 1 | 2 }
/** What a details line holds. */
export type Line = 'blurb' | 'hi' | 'controls' | 'blurbHi';

export interface Layout {
  tier: Tier;
  LW: number; LH: number;
  /** The header: one line on wide and short tubes (title left, drive right), two centred lines upright. */
  header: { y: number; lines: 1 | 2; ruleY: number };
  /** Covers to draw, back to front: the front card is last. Cards may run off the tube's edges (cropped). */
  cards: Card[];
  front: Card;
  /** Covers are 4:3 on wide and short tubes, 3:4 (the middle of the capture) upright. */
  portraitCovers: boolean;
  /** The label strip under the front cover: the title, then the file and size 10 px lower. */
  label: { x: number; y: number; w: number };
  /** The details lines under the label, 11 px apart, centred on the tube. */
  details: { y: number; lines: Line[] };
  /** The tick strip: one tick per disk shown (a window round the front one in a big box), numbered or plain. */
  ticks: { y: number; h: number; numbered: boolean; items: (Rect & { i: number })[]; before: boolean; after: boolean };
  /** The counter line (`02/05 · STICK TO CHOOSE · FIRE TO LOAD`), short form on narrow tubes. */
  counter: { y: number; long: boolean };
  /** ◀ ▶ at the carousel's edges. */
  arrows: (Rect & { by: -1 | 1 })[];
  /** Everything a tap can hit, first match wins. */
  targets: Target[];
}

export const LINE = 11, MIN_TAP = 12;
const NEAR = 0.65, FAR = 0.4;

export function pickTier(LW: number, LH: number): Tier {
  if (LW < LH || LW < 300) return 'portrait';   // a narrow tube stacks, whatever its shape
  return LH < 230 ? 'short' : 'wide';
}

export function launcherLayout(LW: number, LH: number, n: number, sel: number): Layout {
  const tier = pickTier(LW, LH), portrait = tier === 'portrait', short = tier === 'short';
  n = Math.max(0, n | 0); sel = n ? ((sel % n) + n) % n : 0;

  /* ---- header, then one centred stack: cover, label, details, ticks, counter ---- */
  const header = portrait ? { y: 6, lines: 2 as const, ruleY: 28 } : short ? { y: 3, lines: 1 as const, ruleY: 13 } : { y: 6, lines: 1 as const, ruleY: 17 };
  const lines: Line[] = portrait ? ['blurb', 'hi'] : short ? ['blurbHi'] : ['blurb', 'hi', 'controls'];
  const tickH = short ? MIN_TAP : 13, gapC = short ? 3 : 4, labelH = 21, detailsH = lines.length * LINE;
  const tail = (short ? 3 : 8) + tickH + (short ? 1 : 3) + 9;   // gap, ticks, gap, the counter line
  const top = header.ruleY + (short ? 4 : 6), bottom = LH - (short ? 1 : 3);
  const room = bottom - top - labelH - detailsH - 2 * gapC - tail;
  let fh: number, fw: number;
  if (portrait) { fw = Math.round(LW * 0.5); fh = Math.round(fw * 4 / 3); if (fh > room) { fh = room; fw = Math.round(fh * 3 / 4); } }
  else { fw = Math.round(LW * (short ? 0.4 : 0.37)); fh = Math.round(fw * 3 / 4); if (fh > room) { fh = room; fw = Math.round(fh * 4 / 3); } }
  fh = Math.max(12, fh); fw = Math.max(12, fw);
  const block = fh + gapC + labelH + gapC + detailsH + tail;
  const fy = top + Math.max(0, Math.floor((bottom - top - block) / 2)), fx = Math.round((LW - fw) / 2);
  const front: Card = { i: sel, off: 0, dim: 0, x: fx, y: fy, w: fw, h: fh };
  const ticksY = fy + fh + gapC + labelH + gapC + detailsH + (short ? 3 : 8);
  const counterY = ticksY + tickH + (short ? 1 : 3);

  /* ---- neighbours: nearest first, each disk shown once ---- */
  const sides = portrait || short ? 1 : 2, cards: Card[] = [];
  const shown = new Set([sel]);
  const place = (off: number): Card | null => {
    const i = ((sel + off) % n + n) % n;
    if (shown.has(i)) return null;
    shown.add(i);
    const far = Math.abs(off) === 2, k = far ? FAR : NEAR, w = Math.round(fw * k), h = Math.round(fh * k);
    const gap = far ? 5 : 6, nearW = Math.round(fw * NEAR);
    const dist = far ? fw / 2 + gap + nearW + 5 + w / 2 : fw / 2 + gap + w / 2;
    const cx = LW / 2 + Math.sign(off) * dist;
    return { i, off, dim: far ? 2 : 1, x: Math.round(cx - w / 2), y: Math.round(fy + (fh - h) / 2), w, h };
  };
  for (let k = 1; k <= sides && n > 1; k++) for (const off of [k, -k]) { const c = place(off); if (c) cards.push(c); }
  cards.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));   // far ones first, so the near ones and the front draw over them
  cards.push(front);

  /* ---- label and details ---- */
  const label = { x: fx, y: fy + fh + gapC, w: fw };
  const details = { y: label.y + labelH + gapC, lines };

  /* ---- ticks: a window round the front one when the box is bigger than the strip ---- */
  const numbered = !short, tw = numbered ? 16 : MIN_TAP, pitch = numbered ? 18 : MIN_TAP;
  const fit = Math.max(1, Math.floor((LW - 2 * 16) / pitch));
  const count = Math.min(n, fit), first = n <= fit ? 0 : Math.min(n - count, Math.max(0, sel - Math.floor(count / 2)));
  const x0 = Math.round((LW - (count * pitch - (pitch - tw))) / 2);
  const items = Array.from({ length: count }, (_, k) => ({ i: first + k, x: x0 + k * pitch, y: ticksY, w: tw, h: tickH }));
  const ticks = { y: ticksY, h: tickH, numbered, items, before: first > 0, after: first + count < n };

  /* ---- arrows at the carousel's edges, and the tap targets ---- */
  const aw = MIN_TAP, ah = Math.max(MIN_TAP, Math.min(24, fh));
  const ay = Math.round(fy + (fh - ah) / 2);
  const arrows = n > 1 ? [{ by: -1 as const, x: 1, y: ay, w: aw, h: ah }, { by: 1 as const, x: LW - 1 - aw, y: ay, w: aw, h: ah }] : [];
  const clip = (r: Rect): Rect | null => {
    const x = Math.max(0, r.x), y = Math.max(0, r.y), x1 = Math.min(LW, r.x + r.w), y1 = Math.min(LH, r.y + r.h);
    return x1 - x >= MIN_TAP && y1 - y >= MIN_TAP ? { x, y, w: x1 - x, h: y1 - y } : null;
  };
  const targets: Target[] = [];
  for (const a of arrows) targets.push({ kind: 'arrow', by: a.by, x: a.x, y: a.y, w: a.w, h: a.h });
  // a tick strip window's ends step the box too
  if (ticks.before) targets.push({ kind: 'arrow', by: -1, x: x0 - 14, y: ticksY, w: MIN_TAP, h: tickH });
  if (ticks.after) targets.push({ kind: 'arrow', by: 1, x: x0 + count * pitch - (pitch - tw) + 2, y: ticksY, w: MIN_TAP, h: tickH });
  targets.push({ kind: 'front', i: sel, x: fx, y: fy, w: fw, h: fh + gapC + labelH });
  for (const c of [...cards].reverse()) if (c.off !== 0) { const r = clip(c); if (r) targets.push({ kind: 'cover', i: c.i, ...r }); }
  for (const t of items) targets.push({ kind: 'tick', i: t.i, x: t.x, y: t.y, w: t.w, h: t.h });

  return { tier, LW, LH, header, cards, front, portraitCovers: portrait, label, details, ticks,
    counter: { y: counterY, long: LW >= 300 && !short }, arrows, targets };
}

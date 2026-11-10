/* The four disk states, drawn like the menu's floppy (clipped corner, shutter and slot, label, write-protect notch).
   Each differs by shape, not only shade, so it reads on every phosphor:
   READY solid · NOT ON DEVICE dashed outline with a down arrow · DOWNLOADING dim with a bar · UPDATE READY a NEW tag. */
import type { ConsoleAPI } from '../../games/types';
import type { DiskState } from './system';
import type { Rect } from './layout';

type Api = Pick<ConsoleAPI, 'g' | 'col' | 'txt'>;
const R = (a: Api, x: number, y: number, w: number, h: number, role: string) => { a.g.fillStyle = a.col(role); a.g.fillRect(x, y, w, h); };

export const ICON_W = 14, ICON_H = 15;

/** A small floppy for a disk state, 14 × 15, at x, y. */
export function stateIcon(a: Api, x: number, y: number, s: DiskState){
  if (s.kind === 'missing') {
    // dashed outline, an empty shutter, and a down arrow on the label
    for (let i = 0; i < ICON_W; i += 2) { R(a, x + i, y, 1, 1, 'hud'); R(a, x + i, y + ICON_H - 1, 1, 1, 'hud'); }
    for (let j = 0; j < ICON_H; j += 2) { R(a, x, y + j, 1, 1, 'hud'); R(a, x + ICON_W - 1, y + j, 1, 1, 'hud'); }
    R(a, x + 3, y + 1, 8, 1, 'hud');
    R(a, x + 6, y + 6, 2, 5, 'text'); R(a, x + 4, y + 9, 6, 1, 'text'); R(a, x + 5, y + 10, 4, 1, 'text'); R(a, x + 6, y + 11, 2, 1, 'text');
    return;
  }
  const on = s.kind !== 'downloading', body = on ? 'text' : 'hud', ink = on ? 'bg' : 'textDim';
  R(a, x, y, ICON_W, ICON_H, body);
  R(a, x + 13, y, 1, 1, 'bg');                                    // clipped corner
  R(a, x + 3, y, 8, 5, ink); R(a, x + 8, y + 1, 2, 3, body);      // shutter and its slot
  R(a, x + 2, y + 7, 10, 7, ink);                                 // label
  R(a, x, y + 12, 1, 2, 'bg');                                    // write-protect notch
  if (s.kind === 'downloading') {
    R(a, x + 3, y + 10, 8, 2, 'hud'); R(a, x + 3, y + 10, Math.round(8 * Math.max(0, Math.min(1, s.p))), 2, 'text');
  } else {
    R(a, x + 3, y + 9, 8, 1, body); R(a, x + 3, y + 11, 6, 1, body);
  }
  if (s.kind === 'update') { R(a, x + 7, y - 4, 13, 7, 'gold'); a.txt('NEW', x + 8, y - 4, 'bg', 'left'); }
}

/** Index maps that dim a cover: a neighbour, a far neighbour, and a disk that isn't on the device. */
export const DIM_NEAR = [0, 1, 1, 2], DIM_FAR = [0, 1, 1, 1], DIM_MISSING = [0, 0, 1, 1];

/** What a state adds over the front cover once it's painted: a big down arrow, a progress bar under it, or a NEW tag. */
export function coverOverlay(a: Api, r: Rect, s: DiskState){
  if (s.kind === 'missing') {
    const cx = Math.round(r.x + r.w / 2), cy = Math.round(r.y + r.h / 2), k = Math.max(2, Math.round(r.h / 24));
    R(a, cx - k, cy - 4 * k, 2 * k, 5 * k, 'text');
    for (let i = 0; i < 3; i++) R(a, cx - (3 - i) * k, cy + (1 + i) * k, (3 - i) * 2 * k, k, 'text');
  } else if (s.kind === 'downloading') {
    R(a, r.x, r.y + r.h - 3, r.w, 3, 'hud'); R(a, r.x, r.y + r.h - 3, Math.round(r.w * Math.max(0, Math.min(1, s.p))), 3, 'text');
  } else if (s.kind === 'update') {
    R(a, r.x + r.w - 22, r.y + 2, 20, 10, 'gold'); a.txt('NEW', r.x + r.w - 12, r.y + 3, 'bg', 'center');
  }
}

/** The label strip's second line for a state: the file and size, or what the state needs. */
export function stateLine(s: DiskState, file: string, size: number): string {
  const k = `${Math.round(size / 1024)}K`;
  if (s.kind === 'missing') return `GET · ${k}`;
  if (s.kind === 'downloading') return `${Math.round(Math.max(0, Math.min(1, s.p)) * 100)}% · ${k}`;
  if (s.kind === 'update') return `${file} · NEW`;
  return `${file} · ${k}`;
}

/* Bricks' pictures. Slabs and a square, drawn with the console's colour roles. Not a ship, and not a traced bat. */
import type { ConsoleAPI } from '../types';
import { batT, batTopAt, type Brick, type DropKind } from './rules';

/** Spare bats on the HUD: a lip over a short slab. */
export const BAT_MINI = [
  '########',
  ' ###### ',
  ' ###### ',
];

function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}

/** The slot is 24×12. The brick is inset 1px so neighbours do not bleed together. */
export function drawBrick(api: ConsoleAPI, brick: Brick, slotX: number, slotY: number) {
  const g = api.g;
  const x = slotX + 1, y = slotY + 1, w = 22, h = 10;
  if (brick.kind === 'glass') {
    g.fillStyle = api.col('gem');
    frame(g, x, y, w, h);
    return;
  }
  if (brick.kind === 'kiln' && brick.hits >= 1) {
    g.fillStyle = api.col('textDim');
    frame(g, x, y, w, h);
    g.fillStyle = api.col('bg');
    for (let i = 0; i < h; i++) g.fillRect(x + 3 + i, y + i, 2, 1);
    return;
  }
  const role = brick.kind === 'clay' ? 'dirt' : brick.kind === 'kiln' ? 'cart' : brick.kind === 'anvil' ? 'hud' : 'gold';
  g.fillStyle = api.col(role);
  g.fillRect(x, y, w, h);
  g.fillStyle = api.col(brick.kind === 'anvil' ? 'text' : 'bg');
  if (brick.kind === 'clay') g.fillRect(x, y, 2, 2);
  else if (brick.kind === 'kiln') g.fillRect(x + 4, y + 4, w - 8, 2);
  else if (brick.kind === 'anvil') g.fillRect(x + 2, y + 4, w - 4, 2);
  else {
    g.fillStyle = api.col('spark');
    g.fillRect(x + Math.floor(w / 2), y + Math.floor(h / 2), 1, 1);
  }
}

/** A slab with a 2px lip. `rise` bows the middle like a rubber ruler; the ends stay put. Height is 6. */
export function drawBat(api: ConsoleAPI, x: number, y: number, w: number, rise = 0) {
  const g = api.g;
  const x0 = Math.round(x);
  const slices = Math.max(1, Math.round(w));
  g.fillStyle = api.col('cart');
  for (let i = 0; i < slices; i++) {
    const t = batT(x0 + i + 0.5, x, slices);
    const top = Math.round(batTopAt(y, t, rise));
    g.fillRect(x0 + i, top, 1, 2);
    if (i > 0 && i < slices - 1) g.fillRect(x0 + i, top + 2, 1, 4);
  }
}

/** A kiln shard, 12×8, with a mark for what it carries. Not a lettered capsule. */
export const CAP_W = 12;
export const CAP_H = 8;

export function drawDrop(api: ConsoleAPI, kind: DropKind, x: number, y: number) {
  const g = api.g;
  const x0 = Math.round(x), y0 = Math.round(y);
  g.fillStyle = api.col('hud');
  g.fillRect(x0, y0, CAP_W, CAP_H);
  g.fillStyle = api.col('bg');
  g.fillRect(x0 + 1, y0 + 1, CAP_W - 2, CAP_H - 2);
  switch (kind) {
    case 'broad':
      g.fillStyle = api.col('cart');
      g.fillRect(x0 + 2, y0 + 3, 8, 2);
      break;
    case 'slim':
      g.fillStyle = api.col('cart');
      g.fillRect(x0 + 5, y0 + 3, 2, 2);
      break;
    case 'flare':
      g.fillStyle = api.col('gold');
      g.fillRect(x0 + 3, y0 + 5, 2, 1);
      g.fillRect(x0 + 5, y0 + 3, 2, 2);
      g.fillRect(x0 + 7, y0 + 2, 2, 1);
      break;
    case 'damp':
      g.fillStyle = api.col('textDim');
      g.fillRect(x0 + 3, y0 + 5, 6, 1);
      break;
    case 'sear':
      g.fillStyle = api.col('spark');
      g.fillRect(x0 + 5, y0 + 3, 2, 2);
      break;
    default: {
      const never: never = kind;
      return never;
    }
  }
}

export function drawEmber(api: ConsoleAPI, x: number, y: number) {
  api.g.fillStyle = api.col('spark');
  api.g.fillRect(Math.round(x), Math.round(y), 4, 4);
}

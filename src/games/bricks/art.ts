/* Bricks' pictures. Slabs and a square, drawn with the console's colour roles. Not a ship, and not a traced bat. */
import type { ConsoleAPI } from '../types';
import type { Brick } from './rules';

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

/** A flat slab with a 2px lip. Height is 6. */
export function drawBat(api: ConsoleAPI, x: number, y: number, w: number) {
  const g = api.g;
  const x0 = Math.round(x), y0 = Math.round(y);
  g.fillStyle = api.col('cart');
  g.fillRect(x0, y0, w, 2);
  g.fillRect(x0 + 1, y0 + 2, Math.max(1, w - 2), 4);
}

export function drawEmber(api: ConsoleAPI, x: number, y: number) {
  api.g.fillStyle = api.col('spark');
  api.g.fillRect(Math.round(x), Math.round(y), 4, 4);
}

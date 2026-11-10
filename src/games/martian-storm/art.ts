/* Martian Storm's pictures. A wedge with one fin, and three alien glyphs. Not a wartime plane. */
import type { ConsoleAPI } from '../types';
import { drawSprite } from '../../kit/play';
import type { Sprite } from '../../kit/play';
import type { TokenPhase } from './rules';

/** Nose up, one fin down the middle. 11×9. */
export const SKIFF: Sprite = [
  '     #     ',
  '    ###    ',
  '   #####   ',
  '  ## # ##  ',
  ' ### # ### ',
  '###########',
  '#### # ####',
  ' ### # ### ',
  '  #  #  #  ',
];

/** Spare skiffs on the bar. */
export const SKIFF_MINI: Sprite = [
  '  #  ',
  ' ### ',
  '#####',
  '# # #',
];

/** Four dots, with a blank margin so a graze on the outer pixel is not the body. */
export const SPORE: Sprite = [
  '     ',
  ' # # ',
  '     ',
  ' # # ',
  '     ',
];

/** A spike on a bulb. 5×7. */
export const BARB: Sprite = [
  '  #  ',
  '  #  ',
  ' ### ',
  '#####',
  '# # #',
  ' ### ',
  '  #  ',
];

/** A wide stone with one pit. 16×7. */
export const SLAB: Sprite = [
  '################',
  '##  ########  ##',
  '################',
  '#####      #####',
  '#####      #####',
  '################',
  '################',
];

export const SKIFF_W = 11;
export const SKIFF_H = 9;
export const SPORE_W = 5;
export const SPORE_H = 5;
export const BARB_W = 5;
export const BARB_H = 7;
export const SLAB_W = 16;
export const SLAB_H = 7;
export const TOKEN_W = 7;
export const TOKEN_H = 7;

export function drawSkiff(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, SKIFF, x, y, 'cart');
}

export function drawSpore(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, SPORE, x, y, 'grub');
}

export function drawBarb(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, BARB, x, y, 'gold');
}

export function drawSlab(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, SLAB, x, y, 'hud');
}

/** The falling gift. The mark changes with the phase so the catch is readable. */
export function drawToken(api: ConsoleAPI, x: number, y: number, phase: TokenPhase): void {
  const g = api.g;
  const x0 = Math.round(x), y0 = Math.round(y);
  g.fillStyle = api.col('hud');
  g.fillRect(x0, y0, TOKEN_W, TOKEN_H);
  g.fillStyle = api.col('bg');
  g.fillRect(x0 + 1, y0 + 1, TOKEN_W - 2, TOKEN_H - 2);
  g.fillStyle = api.col(phase === 'points' ? 'gold' : phase === 'tuck' ? 'spark' : 'cart');
  if (phase === 'points') g.fillRect(x0 + 2, y0 + 2, 3, 3);
  else if (phase === 'tuck') {
    g.fillRect(x0 + 3, y0 + 1, 1, 1);
    g.fillRect(x0 + 1, y0 + 3, 1, 1);
    g.fillRect(x0 + 5, y0 + 3, 1, 1);
    g.fillRect(x0 + 3, y0 + 5, 1, 1);
  } else {
    g.fillRect(x0 + 2, y0 + 2, 1, 3);
    g.fillRect(x0 + 4, y0 + 2, 1, 3);
  }
}

/* Martian Storm's pictures. A wedge with one fin, two aliens and a rock. Not a wartime plane.
   Craft are solid bodies about the skiff's size; enemy shots are small sparks, so the two never read alike. */
import type { ConsoleAPI } from '../types';
import { drawSprite } from '../../kit/play/sprite';
import type { Sprite } from '../../kit/play/types';
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

/** A jelly pod with two lit eyes and a fringe. 9×8, as wide as most of the skiff, so a flight of four reads
    as four things to shoot and never as shots. '#' is the body, 'o' the eyes. */
export const SPORE: Sprite = [
  '  #####  ',
  ' ####### ',
  '##o###o##',
  '#########',
  ' ####### ',
  '# # # # #',
  '#  # #  #',
  ' #     # ',
];

/** A horned gunner with its barrel pointing down at you. 11×11. '#' is the shell, '+' its plating, 'o' the eye. */
export const BARB: Sprite = [
  '#         #',
  '##   #   ##',
  '###########',
  ' ##+#o#+## ',
  ' ######### ',
  '  #+###+#  ',
  '   #####   ',
  '    ###    ',
  '    ###    ',
  '    ###    ',
  '     #     ',
];

/** A tumbling rock, the incoming astro. 22×14. '#' is the stone, '+' its lit rim, '.' the craters' floors. */
export const SLAB: Sprite = [
  '      ++++++++        ',
  '   ++++########++     ',
  '  ++##############    ',
  ' +#####..#########+   ',
  ' +####....#########+  ',
  '+######..###########+ ',
  '+###################++',
  '+##########...#######+',
  ' ##########....######+',
  ' ###...#####..#######+',
  '  ##....############# ',
  '   ##..############   ',
  '    ##############    ',
  '       ########       ',
];

/** Where each hit cracks the rock, so you can see it giving. One cell per pixel, [x, y]. */
const CRACKS: readonly (readonly [number, number])[][] = [
  [[14, 2], [13, 3], [13, 4], [12, 5]],
  [[5, 6], [6, 7], [7, 7], [8, 8], [9, 9]],
  [[16, 9], [17, 10], [16, 11], [15, 12], [12, 6]],
];

export const SKIFF_W = 11;
export const SKIFF_H = 9;
export const SPORE_W = 9;
export const SPORE_H = 8;
export const BARB_W = 11;
export const BARB_H = 11;
export const SLAB_W = 22;
export const SLAB_H = 14;
export const TOKEN_W = 7;
export const TOKEN_H = 7;

export function drawSkiff(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, SKIFF, x, y, 'cart');
}

export function drawSpore(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, SPORE, x, y, { '#': 'grub', o: 'grubBelly' });
}

export function drawBarb(api: ConsoleAPI, x: number, y: number): void {
  drawSprite(api, BARB, x, y, { '#': 'gold', '+': 'goldDark', o: 'bg' });
}

/** The rock, cracked once for each hit it has taken. */
export function drawSlab(api: ConsoleAPI, x: number, y: number, hits = 0): void {
  drawSprite(api, SLAB, x, y, { '#': 'hud', '+': 'text', '.': 'dirt' });
  const g = api.g, x0 = Math.round(x), y0 = Math.round(y);
  g.fillStyle = api.col('bg');
  for (let i = 0; i < Math.min(hits, CRACKS.length); i++) for (const [cx, cy] of CRACKS[i]!) g.fillRect(x0 + cx, y0 + cy, 1, 1);
}

/** An enemy shot: a small bright spark that flickers between + and ×, never a body. (x, y) is the top left of
    its 2×2 hitbox; the 3×3 spark sits over it. */
export function drawPellet(api: ConsoleAPI, x: number, y: number, t: number): void {
  const g = api.g, x0 = Math.round(x) + 1, y0 = Math.round(y) + 1;
  g.fillStyle = api.col('spark');
  if (Math.floor(t * 12) % 2 === 0) {
    g.fillRect(x0, y0 - 1, 1, 3);
    g.fillRect(x0 - 1, y0, 3, 1);
  } else {
    g.fillRect(x0 - 1, y0 - 1, 1, 1);
    g.fillRect(x0 + 1, y0 - 1, 1, 1);
    g.fillRect(x0, y0, 1, 1);
    g.fillRect(x0 - 1, y0 + 1, 1, 1);
    g.fillRect(x0 + 1, y0 + 1, 1, 1);
  }
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

/* Martian Storm's pictures. A wedge with one fin, two aliens and a rock. Not a wartime plane.
   Craft are solid bodies about the skiff's size; enemy shots are small sparks, so the two never read alike. */
import type { ConsoleAPI } from '../types';
import { drawSprite } from '../../kit/play/sprite';
import type { Sprite } from '../../kit/play/types';
import type { CapsuleWeapon, PickupKind, ShotKind } from './rules';

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

/** A heart on the bar: filled while you have it, an outline once it is gone. 5×5. */
export const HEART: Sprite = [
  '## ##',
  '#####',
  '#####',
  ' ### ',
  '  #  ',
];
const HEART_EMPTY: Sprite = [
  '## ##',
  '# # #',
  '#   #',
  ' # # ',
  '  #  ',
];

/** A bomb left, on the status line and in its pickup. 5×5. */
export const BOMB_ICON: Sprite = [
  '   # ',
  ' ### ',
  '#####',
  '#####',
  ' ### ',
];
/** A speed pickup on board: two chevrons pointing up the screen. 5×5. */
export const SPEED_ICON: Sprite = [
  '  #  ',
  ' # # ',
  '# # #',
  ' # # ',
  '#   #',
];

/** A bomb going off: two rings racing out from where the skiff was, `k` from 0 to 1, reaching `reach` px,
    clipped to the playfield below the HUD. */
export function drawBlast(api: ConsoleAPI, cx: number, cy: number, k: number, reach: number, hud: number): void {
  const g = api.g;
  g.save();
  g.beginPath();
  g.rect(0, hud, api.LW, api.LH - hud);
  g.clip();
  const x = Math.round(cx), y = Math.round(cy);
  const ring = (radius: number, width: number, role: 'spark' | 'gold') => {
    const outer = radius + width / 2, inner = Math.max(0, radius - width / 2);
    g.fillStyle = api.col(role);
    g.beginPath();
    g.moveTo(x + outer, y);
    g.arc(x, y, outer, 0, Math.PI * 2);
    if (inner > 0) {
      g.moveTo(x + inner, y);
      g.arc(x, y, inner, 0, Math.PI * 2, true);
    }
    g.fill();
  };
  ring(Math.max(1, k * reach), 3, 'spark');
  ring(Math.max(1, k * reach * 0.6), 2, 'gold');
  g.restore();
}

/** Three-by-five letters for the capsules. */
const LETTER: Record<CapsuleWeapon, string[]> = {
  spread: ['###', '#  ', '###', '  #', '###'],
  laser: ['#  ', '#  ', '#  ', '#  ', '###'],
  missile: ['# #', '###', '###', '# #', '# #'],
  wave: ['# #', '# #', '# #', '###', '# #'],
};

export function drawHeart(api: ConsoleAPI, x: number, y: number, full: boolean): void {
  drawSprite(api, full ? HEART : HEART_EMPTY, x, y, full ? 'gold' : 'dirt');
}

/** A falling pickup in a 7×7 box. A weapon capsule shows the letter of the gun it holds right now. */
export function drawPickup(api: ConsoleAPI, x: number, y: number, kind: PickupKind, weapon: CapsuleWeapon, t: number): void {
  const g = api.g;
  const x0 = Math.round(x), y0 = Math.round(y);
  g.fillStyle = api.col(kind === 'life' && Math.floor(t * 6) % 2 === 0 ? 'spark' : 'hud');
  g.fillRect(x0, y0, TOKEN_W, TOKEN_H);
  g.fillStyle = api.col('bg');
  g.fillRect(x0 + 1, y0 + 1, TOKEN_W - 2, TOKEN_H - 2);
  if (kind === 'weapon') {
    g.fillStyle = api.col('gold');
    LETTER[weapon].forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect(x0 + 2 + rx, y0 + 1 + ry, 1, 1);
    });
  } else if (kind === 'heart') {
    g.fillStyle = api.col('gold');
    g.fillRect(x0 + 2, y0 + 2, 1, 1); g.fillRect(x0 + 4, y0 + 2, 1, 1);
    g.fillRect(x0 + 2, y0 + 3, 3, 1); g.fillRect(x0 + 3, y0 + 4, 1, 1);
  } else if (kind === 'life') {
    drawSprite(api, SKIFF_MINI, x0 + 1, y0 + 2, 'cart');
  } else if (kind === 'bomb') {
    drawSprite(api, BOMB_ICON, x0 + 1, y0 + 1, 'spark');
  } else if (kind === 'speed') {
    drawSprite(api, SPEED_ICON, x0 + 1, y0 + 1, 'text');
  } else {
    g.fillStyle = api.col('spark');
    g.fillRect(x0 + 3, y0 + 1, 1, 1);
    g.fillRect(x0 + 1, y0 + 3, 1, 1);
    g.fillRect(x0 + 5, y0 + 3, 1, 1);
    g.fillRect(x0 + 3, y0 + 5, 1, 1);
  }
}

/** The skiff's own shots. Bolts are the old 2×4 spark, beams a long bright line, missiles a dart with a
    flickering tail, wave shots a small diamond. All of them point up the screen, away from the enemy sparks. */
export function drawShot(api: ConsoleAPI, kind: ShotKind, x: number, y: number, t: number): void {
  const g = api.g, x0 = Math.round(x), y0 = Math.round(y);
  if (kind === 'bolt') { g.fillStyle = api.col('spark'); g.fillRect(x0, y0, 2, 4); return; }
  if (kind === 'beam') {
    g.fillStyle = api.col('text'); g.fillRect(x0, y0, 2, 10);
    g.fillStyle = api.col('spark'); g.fillRect(x0, y0, 1, 10);
    return;
  }
  if (kind === 'missile') {
    g.fillStyle = api.col('gold'); g.fillRect(x0, y0, 2, 4);
    g.fillStyle = api.col('spark'); g.fillRect(x0, y0 + 4 + (Math.floor(t * 16) % 2), 2, 1);
    return;
  }
  g.fillStyle = api.col('cart');
  g.fillRect(x0 + 1, y0, 1, 1); g.fillRect(x0, y0 + 1, 3, 1); g.fillRect(x0 + 1, y0 + 2, 1, 1);
}

/** Each shot's hitbox, from its top left. */
export const SHOT_BOX: Record<ShotKind, { w: number; h: number }> = {
  bolt: { w: 2, h: 4 }, beam: { w: 2, h: 10 }, missile: { w: 2, h: 5 }, wave: { w: 3, h: 3 },
};

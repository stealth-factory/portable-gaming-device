/* Pixel art from strings, drawn one low-res pixel at a time in colour roles, so every phosphor theme works. */
import type { ConsoleAPI, Role, Sprite } from './types';

/** Draw a sprite at (x, y), rounded to whole pixels. With one role, '#' is ink and anything else is
    see-through; with a map ({ '#': 'cart', 'o': 'text' }) each listed character gets its own role. */
export function drawSprite(api: ConsoleAPI, art: Sprite, x: number, y: number, role: Role | Record<string, Role>): void {
  const g = api.g, x0 = Math.round(x), y0 = Math.round(y);
  if (typeof role === 'object') {
    for (const [ch, r] of Object.entries(role)) { g.fillStyle = api.col(r); paint(g, art, x0, y0, ch); }
    return;
  }
  g.fillStyle = api.col(role);
  paint(g, art, x0, y0, '#');
}
function paint(g: CanvasRenderingContext2D, art: Sprite, x0: number, y0: number, ch: string){
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    for (let c = 0; c < row.length; c++) if (row[c] === ch) g.fillRect(x0 + c, y0 + r, 1, 1);
  }
}
export const spriteW = (art: Sprite) => (art.length ? art[0].length : 0);
export const spriteH = (art: Sprite) => art.length;
/** A bound helper for a game that draws a lot: `const { sprite } = sprites(api)`. */
export function sprites(api: ConsoleAPI){
  return { sprite: (art: Sprite, x: number, y: number, role: Role | Record<string, Role>) => drawSprite(api, art, x, y, role) };
}

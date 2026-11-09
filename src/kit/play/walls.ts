/* Crumbling walls: bunkers and pillboxes built from string art, bitten pixel by pixel by shots, bombs and blasts. */
import { spriteH, spriteW } from './sprite';
import type { Box, ConsoleAPI, Role, Sprite } from './types';

export type Wall = { x: number; y: number; w: number; h: number; px: Uint8Array };

export interface Walls {
  /** Build a wall from string art ('#' is solid) with its top-left at (x, y). */
  add(x: number, y: number, shape: Sprite): Wall;
  /** Lay `n` copies of a shape in a row at height y, spaced evenly across the tube. */
  row(n: number, y: number, shape: Sprite): void;
  /** A hit at (x, y): if it struck a solid pixel, bite a ragged hole of `radius` (each pixel goes with
      chance `chance`) and return true. Only the first wall struck is bitten. */
  bite(x: number, y: number, radius?: number, chance?: number): boolean;
  /** Erase pixels within `r` of (cx, cy), each with chance `chance`, across every wall. */
  blast(cx: number, cy: number, r: number, chance?: number): void;
  /** Something large grinding through a box of wall: small bites every 2 px across it. */
  chew(box: Box): void;
  solid(x: number, y: number): boolean;
  draw(role: Role): void;
  clear(): void;
  readonly list: readonly Wall[];
}

export function makeWalls(api: ConsoleAPI): Walls {
  let list: Wall[] = [];
  const at = (x: number, y: number) => {
    for (const w of list) {
      const lx = Math.floor(x - w.x), ly = Math.floor(y - w.y);
      if (lx >= 0 && ly >= 0 && lx < w.w && ly < w.h && w.px[ly * w.w + lx]) return { w, lx, ly };
    }
    return null;
  };
  const walls: Walls = {
    add(x, y, shape){
      const w = spriteW(shape), h = spriteH(shape), px = new Uint8Array(w * h);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) px[r * w + c] = shape[r][c] === '#' ? 1 : 0;
      const wall = { x, y, w, h, px };
      list.push(wall);
      return wall;
    },
    row(n, y, shape){
      const w = spriteW(shape), gap = (api.LW - n * w) / (n + 1);
      for (let i = 0; i < n; i++) walls.add(Math.round(gap + i * (w + gap)), y, shape);
    },
    bite(x, y, radius = 2, chance = 0.75){
      const hit = at(x, y);
      if (!hit) return false;
      const { w, lx, ly } = hit;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const xx = lx + dx, yy = ly + dy;
        if (xx < 0 || yy < 0 || xx >= w.w || yy >= w.h) continue;
        if (dx * dx + dy * dy <= radius * radius + 1 && Math.random() < chance) w.px[yy * w.w + xx] = 0;
      }
      return true;
    },
    blast(cx, cy, r, chance = 0.85){
      for (const w of list) for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        const dx = w.x + x - cx, dy = w.y + y - cy;
        if (w.px[y * w.w + x] && dx * dx + dy * dy <= r * r && Math.random() < chance) w.px[y * w.w + x] = 0;
      }
    },
    chew(b){
      for (let x = b.x; x < b.x + b.w; x += 2) for (let y = b.y; y < b.y + b.h; y += 2) walls.bite(x, y, 1);
    },
    solid: (x, y) => at(x, y) !== null,
    draw(role){
      const g = api.g;
      g.fillStyle = api.col(role);
      for (const w of list) for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (w.px[y * w.w + x]) g.fillRect(w.x + x, w.y + y, 1, 1);
    },
    clear(){ list = []; },
    get list(){ return list; },
  };
  return walls;
}

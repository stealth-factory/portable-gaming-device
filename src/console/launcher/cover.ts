/* Covers on the tube: a disk's captured cover is data, not an image, so the launcher can paint it in whatever
   phosphor the set is showing. One palette index (0 = bg … 3 = brightest) per pixel, four pixels a byte (the first
   pixel in the top two bits), rows top to bottom, base64. DOM-free: the native apps run this too. */
import type { Cover } from '../../games/types';

/** The size every captured cover is made at. */
export const COVER_W = 128, COVER_H = 96;

/** Pack palette indices (0 to 3) into a cover's base64 string. */
export function encodeCover(idx: ArrayLike<number>, w: number, h: number): string {
  const bytes = new Uint8Array(Math.ceil(w * h / 4));
  for (let i = 0; i < w * h; i++) bytes[i >> 2] |= (idx[i] & 3) << (6 - 2 * (i & 3));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Unpack a cover's base64 string into one palette index per pixel. */
export function decodeCover(data: string, w: number, h: number): Uint8Array {
  const bin = atob(data), out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = (bin.charCodeAt(i >> 2) >> (6 - 2 * (i & 3))) & 3;
  return out;
}

const cache = new WeakMap<Cover, Uint8Array>();
/** A cover's pixels, decoded once. */
export function coverPixels(c: Cover): Uint8Array {
  let px = cache.get(c);
  if (!px) { px = decodeCover(c.data, c.w, c.h); cache.set(c, px); }
  return px;
}

/** Shrink a block of palette indices (a capture of the playfield) to dw × dh. Each target pixel takes the brightest
    index that covers at least a quarter of its block, so one-pixel shots and outlines survive the shrink and stray
    specks don't. */
export function shrink(src: ArrayLike<number>, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  const out = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sh / dh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sh / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sw / dw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / dw));
      const n = [0, 0, 0, 0];
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) n[src[yy * sw + xx] & 3]++;
      const need = (x1 - x0) * (y1 - y0) / 4;
      let v = 0;
      for (let k = 3; k > 0; k--) if (n[k] >= need) { v = k; break; }
      out[y * dw + x] = v;
    }
  }
  return out;
}

/** The centred `aspect` (w / h) crop of a w × h block: [x, y, cw, ch]. */
export function cropTo(w: number, h: number, aspect: number): [number, number, number, number] {
  if (w / h > aspect) { const cw = Math.round(h * aspect); return [Math.floor((w - cw) / 2), 0, cw, h]; }
  const ch = Math.round(w / aspect); return [0, Math.floor((h - ch) / 2), w, ch];
}

/** What painting needs: a 2D context's fillStyle and fillRect. */
export interface Paint { fillStyle: any; fillRect(x: number, y: number, w: number, h: number): void }

/** Paint palette indices (pw × ph) into the rectangle x, y, w, h by nearest neighbour, in `colours` (the theme's four,
    by index). `skip0` leaves index 0 unpainted (the tube's background shows through). Runs of one index on a row
    are one fillRect, which keeps a 128 × 96 cover to a couple of thousand rects at most. */
export function paintPixels(g: Paint, colours: string[], px: ArrayLike<number>, pw: number, ph: number,
  x: number, y: number, w: number, h: number, skip0 = false){
  w = Math.round(w); h = Math.round(h); x = Math.round(x); y = Math.round(y);
  if (w <= 0 || h <= 0) return;
  for (let ty = 0; ty < h; ty++) {
    const row = Math.min(ph - 1, Math.floor(ty * ph / h)) * pw;
    let runStart = 0, runV = px[row + 0];
    for (let tx = 1; tx <= w; tx++) {
      const v = tx < w ? px[row + Math.min(pw - 1, Math.floor(tx * pw / w))] : -1;
      if (v === runV) continue;
      if (!(skip0 && runV === 0)) { g.fillStyle = colours[runV]; g.fillRect(x + runStart, y + ty, tx - runStart, 1); }
      runStart = tx; runV = v;
    }
  }
}

/** Paint a cover into x, y, w, h. */
export function paintCover(g: Paint, colours: string[], c: Cover, x: number, y: number, w: number, h: number){
  paintPixels(g, colours, coverPixels(c), c.w, c.h, x, y, w, h);
}

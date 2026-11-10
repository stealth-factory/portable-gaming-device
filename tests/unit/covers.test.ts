import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISKS } from '../../src/games/registry';
import { COVER_W, COVER_H, encodeCover, decodeCover, coverPixels, shrink, cropTo, paintPixels, paintCover } from '../../src/console/launcher/cover';

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/games');
const gameDirs = readdirSync(GAMES_DIR).filter(f => statSync(join(GAMES_DIR, f)).isDirectory());

/** A fake 2D context that records its fillRects. */
const recorder = () => {
  const rects: { c: string; x: number; y: number; w: number; h: number }[] = [];
  return { rects, fillStyle: '', fillRect(x: number, y: number, w: number, h: number){ rects.push({ c: this.fillStyle, x, y, w, h }); } };
};

describe('cover codec', () => {
  it('round-trips palette indices, including a size that is not a multiple of four', () => {
    for (const [w, h] of [[COVER_W, COVER_H], [7, 3]]) {
      const idx = Array.from({ length: w * h }, (_, i) => (i * 7 + (i >> 3)) & 3);
      expect(Array.from(decodeCover(encodeCover(idx, w, h), w, h))).toEqual(idx);
    }
  });
  it('packs four pixels a byte, first pixel in the top bits', () => {
    expect(encodeCover([3, 0, 0, 1], 4, 1)).toBe(btoa(String.fromCharCode(0b11000001)));
  });
  it('a 128 × 96 cover is 3 KB raw', () => {
    expect(atob(encodeCover(new Array(COVER_W * COVER_H).fill(2), COVER_W, COVER_H)).length).toBe(3072);
  });
  it('decodes each cover once', () => {
    const c = { w: 4, h: 1, data: encodeCover([1, 2, 3, 0], 4, 1) };
    expect(coverPixels(c)).toBe(coverPixels(c));
  });
});

describe('shrinking a capture', () => {
  it('keeps a one-pixel line through a 2.5× shrink', () => {
    const sw = 20, sh = 10, src = new Array(sw * sh).fill(0);
    for (let x = 0; x < sw; x++) src[5 * sw + x] = 3;   // a bright line across row 5
    const out = shrink(src, sw, sh, 8, 4);
    const lit = Array.from({ length: 4 }, (_, y) => out.slice(y * 8, y * 8 + 8).every(v => v === 3));
    expect(lit.filter(Boolean).length).toBe(1);
  });
  it('drops a lone speck', () => {
    const src = new Array(16).fill(0); src[5] = 3;
    expect(Array.from(shrink(src, 4, 4, 1, 1))).toEqual([0]);
  });
  it('crops to the centred 4:3 block', () => {
    expect(cropTo(360, 240, 4 / 3)).toEqual([20, 0, 320, 240]);
    expect(cropTo(200, 300, 4 / 3)).toEqual([0, 75, 200, 150]);
  });
});

describe('painting a cover', () => {
  const COLS = ['#000', '#111', '#222', '#333'];
  it('groups a run of one index on a row into one rect', () => {
    const r = recorder();
    paintPixels(r, COLS, [1, 1, 2, 2], 4, 1, 10, 20, 8, 2);
    expect(r.rects).toEqual([
      { c: '#111', x: 10, y: 20, w: 4, h: 1 }, { c: '#222', x: 14, y: 20, w: 4, h: 1 },
      { c: '#111', x: 10, y: 21, w: 4, h: 1 }, { c: '#222', x: 14, y: 21, w: 4, h: 1 },
    ]);
  });
  it('can leave the background unpainted', () => {
    const r = recorder();
    paintPixels(r, COLS, [0, 3], 2, 1, 0, 0, 2, 1, { skip0: true });
    expect(r.rects).toEqual([{ c: '#333', x: 1, y: 0, w: 1, h: 1 }]);
  });
  it('paints part of the source, remapped', () => {
    const r = recorder();
    paintPixels(r, COLS, [3, 2, 1, 0], 4, 1, 0, 0, 2, 1, { src: [1, 0, 2, 1], map: [0, 0, 1, 2] });
    expect(r.rects).toEqual([{ c: '#111', x: 0, y: 0, w: 1, h: 1 }, { c: '#000', x: 1, y: 0, w: 1, h: 1 }]);
  });
  it('paints an upright card from the middle of a wide cover', () => {
    const r = recorder(), idx = Array.from({ length: 8 * 6 }, (_, i) => ((i % 8) === 0 || (i % 8) === 7 ? 3 : 1));
    paintCover(r, COLS, { w: 8, h: 6, data: encodeCover(idx, 8, 6) }, 0, 0, 3, 4);
    expect(r.rects.every(q => q.c === '#111')).toBe(true);   // the bright side bands are cropped away
  });
  it.each(DISKS.filter(d => d.cover).map(d => [d.id, d] as const))('%s paints inside its rectangle', (_id, d) => {
    const r = recorder();
    paintCover(r, COLS, d.cover!, 5, 7, 96, 72);
    expect(r.rects.length).toBeGreaterThan(0);
    for (const q of r.rects) {
      expect(q.x).toBeGreaterThanOrEqual(5); expect(q.x + q.w).toBeLessThanOrEqual(5 + 96);
      expect(q.y).toBeGreaterThanOrEqual(7); expect(q.y + q.h).toBeLessThanOrEqual(7 + 72);
    }
  });
});

describe('launcher fields on every disk', () => {
  it.each(DISKS.map(d => [d.id, d] as const))('%s has a genre of at most 8 upper-case characters and a player count', (_id, d) => {
    expect(d.genre).toMatch(/^[A-Z0-9+ &-]{1,8}$/);
    expect(Number.isInteger(d.players) && d.players >= 1).toBe(true);
    if (d.year != null) expect(d.year).toBeGreaterThan(1970);
  });
  it.each(DISKS.filter(d => d.cover).map(d => [d.id, d] as const))('%s has a cover that decodes to w × h indices', (_id, d) => {
    const c = d.cover!;
    expect([c.w, c.h]).toEqual([COVER_W, COVER_H]);
    expect(atob(c.data).length).toBe(Math.ceil(c.w * c.h / 4));
    const px = decodeCover(c.data, c.w, c.h);
    expect(px.every(v => v >= 0 && v <= 3)).toBe(true);
    expect(new Set(px).size).toBeGreaterThan(1);   // not a blank capture
  });
  it('the registry attaches every cover.ts it finds', () => {
    const files = gameDirs.filter(dir => existsSync(join(GAMES_DIR, dir, 'cover.ts'))).length;
    expect(DISKS.filter(d => d.cover).length).toBe(files);
  });
  it('every disk in the box has a captured cover today', () => {
    for (const d of DISKS) expect(d.cover, d.id).toBeTruthy();
  });
});

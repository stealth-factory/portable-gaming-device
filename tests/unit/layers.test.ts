import { describe, expect, it } from 'vitest';
import { colourise, layer } from '../../src/console/layers';

const green = [[20, 14, 9], [15, 90, 29], [47, 191, 75], [178, 255, 189]];
const amber = [[23, 13, 7], [107, 57, 0], [222, 140, 18], [255, 216, 144]];

describe('palette-index layers', () => {
  it('allocates a zero-filled row-major picture without browser services', () => {
    const picture = layer(3, 2);
    expect(picture).toEqual({ w: 3, h: 2, px: new Uint8Array(6) });
  });
  it('presents every palette index as an opaque colour, including index zero', () => {
    const picture = layer(2, 2), rgba = new Uint8ClampedArray(16);
    picture.px.set([0, 1, 2, 3]);
    colourise(picture, green, rgba);
    expect([...rgba]).toEqual(green.flatMap(rgb => [...rgb, 255]));
  });
  it('uses current colours and current pixels without rebuilding the layer', () => {
    const picture = layer(2, 1), rgba = new Uint8ClampedArray(8);
    picture.px.set([1, 3]);
    colourise(picture, green, rgba);
    expect([...rgba]).toEqual([...green[1], 255, ...green[3], 255]);
    colourise(picture, amber, rgba);
    expect([...rgba]).toEqual([...amber[1], 255, ...amber[3], 255]);
    picture.px[0] = 2;
    colourise(picture, amber, rgba);
    expect([...rgba]).toEqual([...amber[2], 255, ...amber[3], 255]);
  });
  it('rejects dimensions that cannot describe a picture', () => {
    for (const n of [0, -1, 0.5, NaN, Infinity]) expect(() => layer(n, 2)).toThrow();
  });
  it('rejects pixels outside the four-colour palette', () => {
    const picture = layer(1, 1);
    picture.px[0] = 4;
    expect(() => colourise(picture, green, new Uint8ClampedArray(4))).toThrow(/palette indices/);
  });
});

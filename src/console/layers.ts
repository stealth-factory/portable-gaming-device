/* Browser storage and presentation for the contract's palette-index layers. */
import type { Layer } from '../games/types';

export function layer(w: number, h: number): Layer {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0)
    throw new Error('Layer dimensions must be positive whole numbers');
  return { w, h, px: new Uint8Array(w * h) };
}

/** Convert indices at presentation time so a cached layer follows the phosphor dial. */
export function colourise(layer: Layer, palRGB: readonly (readonly number[])[], rgba: Uint8ClampedArray): void {
  for (let i = 0; i < layer.px.length; i++) {
    const colour = palRGB[layer.px[i]];
    if (!colour) throw new Error('Layer pixels must be palette indices from 0 to 3');
    const o = i * 4;
    rgba[o] = colour[0]; rgba[o + 1] = colour[1]; rgba[o + 2] = colour[2]; rgba[o + 3] = 255;
  }
}

export function makeStamp(g: CanvasRenderingContext2D, palette: () => readonly (readonly number[])[]) {
  const pictures = new WeakMap<Layer, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; image: ImageData }>();
  return (layer: Layer, x: number, y: number): void => {
    let picture = pictures.get(layer);
    if (!picture) {
      const canvas = document.createElement('canvas'); canvas.width = layer.w; canvas.height = layer.h;
      const context = canvas.getContext('2d')!;
      picture = { canvas, context, image: context.createImageData(layer.w, layer.h) };
      pictures.set(layer, picture);
    }
    colourise(layer, palette(), picture.image.data);
    picture.context.putImageData(picture.image, 0, 0);
    g.drawImage(picture.canvas, x, y);
  };
}

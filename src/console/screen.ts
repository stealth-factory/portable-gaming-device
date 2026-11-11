/* The browser implementation of the disk's drawing surface. The CRT pipeline keeps its full canvas context. */
import type { Palette, Screen2D } from '../games/types';
import { measurePixelText } from '../kit/platform/font';

export function makeScreen2D(g: CanvasRenderingContext2D, palette: () => Palette): Screen2D {
  return {
    get fillStyle(){ return String(g.fillStyle); },
    set fillStyle(value: string){
      if (palette().pal.includes(value)) g.fillStyle = value;
      else if (import.meta.env.DEV) throw new Error('Screen2D.fillStyle must be a current palette colour');
    },
    fillRect: (x, y, w, h) => g.fillRect(x, y, w, h),
    beginPath: () => g.beginPath(),
    rect: (x, y, w, h) => g.rect(x, y, w, h),
    moveTo: (x, y) => g.moveTo(x, y),
    lineTo: (x, y) => g.lineTo(x, y),
    arc: (x, y, r, start, end, counterclockwise) => g.arc(x, y, r, start, end, counterclockwise),
    arcTo: (x1, y1, x2, y2, r) => g.arcTo(x1, y1, x2, y2, r),
    closePath: () => g.closePath(),
    fill: () => g.fill(),
    clip: () => g.clip(),
    save: () => g.save(),
    restore: () => g.restore(),
    translate: (x, y) => g.translate(x, y),
    rotate: angle => g.rotate(angle),
    scale: (x, y) => g.scale(x, y),
    setTransform: (a, b, c, d, e, f) => g.setTransform(a, b, c, d, e, f),
    get font(){ return g.font; },
    set font(value: string){
      if (/^(8|16)px Silkscreen(?:,|$)/.test(value)) g.font = value;
      else if (import.meta.env.DEV) throw new Error('Screen2D.font must be 8 or 16 px Silkscreen');
    },
    measureText: text => measurePixelText(text, g.font),
  };
}

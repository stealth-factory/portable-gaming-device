/* The web's side of the boot splash: put the splash a framing app asked for (splash-config.ts) on the console, and
   turn its logo image into a palette layer the tube can draw (four shades by brightness, like everything else on it). */
import type { Layer } from '../../games/types';
import { layer } from '../layers';
import { setSplash, PGD_SPLASH } from '../splash';
import type { SplashConfig } from '../splash-config';

/** The largest logo the splash draws; bigger images are scaled down to fit, smaller ones stay as they are. */
export const LOGO_MAX = { w: 160, h: 64 };

/** Image pixels (RGBA) to palette indices: brightness times opacity, in four steps; `invert` flips the brightness. */
export function shadeLogo(rgba: Uint8ClampedArray, w: number, h: number, invert = false): Layer {
  const L = layer(w, h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3] / 255;
    let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (invert) lum = 1 - lum;
    const ink = lum * a;
    L.px[i] = ink < 0.15 ? 0 : ink < 0.4 ? 1 : ink < 0.7 ? 2 : 3;
  }
  return L;
}

/** Load an image and shade it. Rejects when it won't load, or when another site's image comes without CORS
    (the console can't read its pixels then). */
export function loadLogo(src: string, invert: boolean): Promise<Layer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src) && new URL(src, location.href).origin !== location.origin) img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('splash image did not load (another site\'s image needs CORS)'));
    img.onload = () => {
      const k = Math.min(1, LOGO_MAX.w / (img.naturalWidth || 1), LOGO_MAX.h / (img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * k)), h = Math.max(1, Math.round((img.naturalHeight || 1) * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      if (!g) { reject(new Error('splash image could not be drawn')); return; }
      g.drawImage(img, 0, 0, w, h);
      try { resolve(shadeLogo(g.getImageData(0, 0, w, h).data, w, h, invert)); }
      catch (_) { reject(new Error('splash image is on another site without CORS, so the console cannot read it')); }
    };
    img.src = src;
  });
}

let asked = 0;
/** Put a splash on the console. A logo arrives once it has loaded; if it fails, the splash keeps its text (or goes
    back to PGD's without any) and `onError` hears why. A later call wins over a logo still loading. */
export function applySplash(cfg: SplashConfig, onError?: (error: string) => void){
  const ask = ++asked;
  if (cfg.kind === 'pgd') { setSplash(PGD_SPLASH); return; }
  if (cfg.kind === 'none') { setSplash(null); return; }
  const own = { text: cfg.text, sub: cfg.sub, logo: null, pgd: false };
  setSplash(own);
  if (!cfg.image) return;
  loadLogo(cfg.image, cfg.invert).then(
    logo => { if (ask === asked) setSplash({ ...own, logo }); },
    err => { if (ask !== asked) return; if (!own.text) setSplash(PGD_SPLASH); onError?.(String(err?.message ?? err)); },
  );
}

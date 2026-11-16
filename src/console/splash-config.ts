/* What a `splash` command or prop asks for, checked (unit-tested). `null` (or nothing) is PGD's own splash, `false`
   none, a string the splash's text. The web turns it into the splash the boot shows (web/splash-logo.ts). */
import type { PGDSplash } from '../../react/index';
import { clean, imageAddress } from './nameplate';

export type SplashConfig =
  | { kind: 'pgd' }
  | { kind: 'none' }
  | { kind: 'own'; text: string; sub: string; image: string | null; invert: boolean };

const LIMITS = { text: 24, sub: 48 };

/** Throws on an image address the console won't show, so the page hears about it. */
export function readSplash(p: unknown): SplashConfig {
  if (p === false) return { kind: 'none' };
  if (p == null || p === '' || p === true) return { kind: 'pgd' };
  const o: PGDSplash = typeof p === 'string' ? { text: p } : typeof p === 'object' ? p as PGDSplash : {};
  const image = imageAddress(o.image, 'splash image');
  const text = clean(o.text, LIMITS.text).toUpperCase(), sub = clean(o.sub, LIMITS.sub).toUpperCase();
  if (!text && !image) return { kind: 'pgd' };
  return { kind: 'own', text, sub, image, invert: o.invert === true };
}

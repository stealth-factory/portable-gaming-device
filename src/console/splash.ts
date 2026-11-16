/* The boot splash: a mark on the tube for a moment when the set is switched on (or RESET), before the BIOS lines.
   PGD's own is the console's 3 × 5 pixel letters, drawn in by the beam from the top, with its name typed under
   it and a rising three-note chime. An app that frames the console can show its own name or logo instead
   (the `splash` embed command and `<PGDConsole splash>`), or none at all. Warm boots (SELECT) never show it.
   DOM-free: the program draws it through the api (loader.ts), and the web turns a logo image into a palette
   layer (src/console/web/splash-logo.ts) before it gets here. */
import type { ConsoleAPI, Layer } from '../games/types';

export interface Splash {
  /** The big line, in the plate's capitals. For PGD's own splash, the letters are drawn in blocks instead. */
  text: string;
  /** The small line under it, typed in. */
  sub: string;
  /** A logo, already in the tube's four shades (index 0 is the dark background). Drawn above the text. */
  logo: Layer | null;
  /** True for PGD's own splash (block letters). */
  pgd: boolean;
}

export const PGD_SPLASH: Splash = { text: 'PGD', sub: 'PORTABLE GAMING DEVICE', logo: null, pgd: true };
/** How long the splash stays on the tube, in seconds. A press of FIRE skips it after SKIP_AFTER. */
export const SPLASH_LEN = 2.1, SKIP_AFTER = 0.25;
/** When the chime plays, as the mark finishes drawing in. */
export const CHIME_AT = 0.7;

let current: Splash | null = PGD_SPLASH;
/** The splash a cold boot shows, or null for none. */
export const splash = () => current;
export function setSplash(s: Splash | null){ current = s; }

/** Where the splash is `t` seconds in: how much of the mark is drawn (0 to 1), how many letters of the small line
    are typed, and whether it is fading out. A long line types faster, so all `subLen` letters are in a moment before the fade.
    With reduced motion, everything is there at once. */
export function splashPhase(t: number, reduced: boolean, subLen = 0){
  const fading = t > SPLASH_LEN - 0.25;
  if (reduced) return { reveal: 1, typed: Infinity, fading };
  const from = CHIME_AT + 0.1, per = Math.min(0.03, (SPLASH_LEN - 0.35 - from) / Math.max(1, subLen));
  return {
    reveal: Math.min(1, Math.max(0, t / CHIME_AT)),
    typed: fading ? Infinity : Math.max(0, Math.floor((t - from) / per)),
    fading,
  };
}

/** The console's own 3 × 5 letters (the favicon spells PGD with them). */
const LETTERS: Record<string, string[]> = {
  P: ['111', '101', '111', '100', '100'], G: ['111', '100', '101', '101', '111'], D: ['110', '101', '101', '101', '110'],
};

type Api = Pick<ConsoleAPI, 'g' | 'col' | 'txt' | 'LW' | 'LH' | 'stamp'>;
const FONT8 = '8px Silkscreen, "Courier New", monospace', FONT16 = '16px Silkscreen, "Courier New", monospace';
const width = (a: Api, s: string, font: string) => { a.g.font = font; return Math.ceil(a.g.measureText(s).width); };

/** Draw the splash `t` seconds in. */
export function drawSplash(a: Api, s: Splash, t: number, reduced: boolean){
  const { reveal, typed, fading } = splashPhase(t, reduced, s.sub.length);
  const main = fading ? 'textDim' : 'text', dim = fading ? 'hud' : 'textDim';
  // lay out the mark: the logo, then the big line (or PGD's block letters), then the small line
  const blocks = s.pgd ? Math.max(4, Math.min(10, Math.floor(a.LW * 0.34 / 11))) : 0;
  const big = s.pgd ? null : s.text ? (width(a, s.text, FONT16) <= a.LW - 16 ? 16 : 8) : null;
  const logoH = s.logo ? s.logo.h : 0, bigH = s.pgd ? blocks * 5 : big ? big : 0;
  const markH = logoH + (logoH && bigH ? 8 : 0) + bigH;
  const subH = s.sub ? 14 : 0, top = Math.round(a.LH / 2 - (markH + subH) / 2);
  let y = top;
  if (s.logo) { a.stamp(s.logo, Math.round(a.LW / 2 - s.logo.w / 2), y); y += logoH + (bigH ? 8 : 0); }
  if (s.pgd) {
    const w = 11 * blocks, x0 = Math.round(a.LW / 2 - w / 2);
    a.g.fillStyle = a.col(main);
    [...s.text].forEach((ch, i) => (LETTERS[ch] || []).forEach((row, r) => [...row].forEach((b, c) => {
      if (b === '1') a.g.fillRect(x0 + (i * 4 + c) * blocks, y + r * blocks, blocks - 1, blocks - 1);
    })));
  } else if (big) {
    let text = s.text;
    if (big === 8) while (text.length > 1 && width(a, text, FONT8) > a.LW - 16) text = text.slice(0, -1);
    a.txt(text, a.LW / 2, y, main, 'center', big);
  }
  // the beam draws the mark in from the top: hide what it hasn't reached, and show the beam itself
  if (reveal < 1) {
    const edge = top + Math.round(markH * reveal);
    a.g.fillStyle = a.col('bg'); a.g.fillRect(0, edge, a.LW, top + markH - edge + 1);
    a.g.fillStyle = a.col('text'); a.g.fillRect(Math.round(a.LW * 0.2), edge, Math.round(a.LW * 0.6), 1);
  }
  if (s.sub && typed > 0) {
    // typed from where the whole line will sit, so the letters don't shuffle as it grows
    let full = s.sub;
    while (full.length > 1 && width(a, full, FONT8) > a.LW - 16) full = full.slice(0, -1);
    a.txt(full.slice(0, typed), Math.round(a.LW / 2 - width(a, full, FONT8) / 2), top + markH + 8, dim, 'left');
  }
}

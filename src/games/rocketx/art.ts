/* ROCKETX's pictures: an original rocket, its flame and the landing pad. Drawn only in colour roles, so it reads on every
   phosphor. No state here: the loading screen and the game both use it. */
import type { Screen2D } from '../types';

type Api = { g: Screen2D; col(role: string): string };

/** A rocket of nine rows, tilted by `a` radians: each row shifts sideways a little more the higher it sits. */
export function drawRocket(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, dead = false) {
  const g = api.g;
  // the nose leans toward +sin(a); when the rocket is more than halfway over (cos a < 0) it is drawn upside down
  const lean = Math.sin(a);
  const flip = Math.cos(a) < 0;
  const at = (r: number) => (flip ? 8 - r : r);      // the row a sprite row lands on
  const shift = (r: number) => Math.round(lean * (4 - r) * 1.2);
  const body = dead ? 'hud' : 'text';
  g.fillStyle = api.col(body);
  for (let r = 0; r < 9; r++) {
    const half = r < 2 ? 1 : 2;                   // a nose cone at the top (row 0)
    const row = at(r);
    g.fillRect(x + shift(row) - half, y - 4 + row, half * 2 + 1, 1);
  }
  // fins at the base (row 7), and a porthole, so it reads as a rocket and not a bar
  g.fillStyle = api.col('hud');
  g.fillRect(x + shift(at(7)) - 4, y - 4 + at(7), 2, 2);
  g.fillRect(x + shift(at(7)) + 3, y - 4 + at(7), 2, 2);
  g.fillStyle = api.col('bg');
  g.fillRect(x + shift(at(3)), y - 4 + at(3), 1, 1);
}

/** The flame under the engine: two flickering tongues, drawn only while the main engine burns. */
export function drawFlame(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, t: number) {
  const g = api.g;
  // the exhaust leaves from the base, opposite the nose
  const lean = Math.sin(a);
  const flip = Math.cos(a) < 0;
  const base = flip ? y - 10 : y + 6;
  const dir = flip ? -1 : 1;
  const flick = Math.floor(t * 20) % 2;
  g.fillStyle = api.col('text');
  g.fillRect(x - Math.round(lean * 6) - 1, base, 3, 3 + flick);
  g.fillStyle = api.col('hud');
  g.fillRect(x - Math.round(lean * 6), base + dir * 3, 1, 3 + (1 - flick));
}

/** The pad on the ground: a bar across the pad's width, with two lights at its ends that blink. */
export function drawPad(api: { g: Screen2D; col(r: string): string; LW?: number }, x0: number, x1: number, y: number, t: number) {
  const g = api.g;
  g.fillStyle = api.col('hud');
  g.fillRect(x0, y, Math.max(2, x1 - x0), 2);
  const on = Math.floor(t * 2) % 2 === 0;
  g.fillStyle = api.col(on ? 'text' : 'hud');
  g.fillRect(x0 - 1, y - 2, 2, 2);
  g.fillRect(x1 - 1, y - 2, 2, 2);
}

/** The loading screen's scene: the rocket coming in over the pad. */
export function drawInbound(api: Api & { LW: number; LH: number; HUD: number }, p: number, t: number) {
  const x = Math.round(api.LW * 0.5);
  const y = Math.round(api.HUD + (api.LH - api.HUD - 36) * Math.min(1, p));
  drawRocket(api, x, y, Math.sin(t * 2) * 0.12);
}

/** The ROCKETX logo: an original rocket glyph to the left of a bold pixel wordmark, with a landing-pad bar under the
    whole mark. The 16px wordmark is about 78 px wide on the tube; the parts are laid out from that, centred on cx. */
export function drawLogo(api: { g: Screen2D; col(r: string): string; txt(s: string, x: number, y: number, role?: string, align?: string, size?: number): void }, cx: number, y: number) {
  const g = api.g;
  const WORD_W = 78;
  const wordX = cx + 10;                       // the wordmark's centre
  const gx = wordX - WORD_W / 2 - 16;          // the glyph's middle, left of the word
  api.txt('ROCKETX', wordX, y + 1, 'text', 'center', 16);
  g.fillStyle = api.col('text');
  g.fillRect(gx - 1, y - 2, 4, 2);
  g.fillRect(gx - 2, y, 6, 6);
  g.fillRect(gx - 3, y + 6, 8, 4);
  g.fillStyle = api.col('hud');
  g.fillRect(gx - 5, y + 6, 2, 4);
  g.fillRect(gx + 5, y + 6, 2, 4);
  g.fillStyle = api.col('text');
  g.fillRect(gx - 1, y + 10, 4, 2);
  // the pad: a bar under the whole mark, with lights at each end
  const x0 = cx - 50, x1 = cx + 50;
  g.fillStyle = api.col('hud');
  g.fillRect(x0, y + 18, x1 - x0, 2);
  g.fillStyle = api.col('text');
  g.fillRect(x0 - 2, y + 16, 2, 2);
  g.fillRect(x1, y + 16, 2, 2);
}

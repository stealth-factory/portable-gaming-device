/* ROCKETX's pictures: an original rocket, its flame and the landing pad. Drawn only in colour roles, so it reads on every
   phosphor. No state here: the loading screen and the game both use it. */
import type { Screen2D } from '../types';

type Api = { g: Screen2D; col(role: string): string };

/** A rocket of nine rows, tilted by `a` radians: each row shifts sideways a little more the higher it sits. */
export function drawRocket(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, dead = false) {
  const g = api.g;
  const lean = Math.sin(a);
  const shift = (row: number) => Math.round(lean * (row - 4) * 1.2);
  const body = dead ? 'hud' : 'text';
  g.fillStyle = api.col(body);
  for (let r = 0; r < 9; r++) {
    const half = r < 2 ? 1 : 2;                   // a nose cone above the body
    g.fillRect(x + shift(r) - half, y - 4 + r, half * 2 + 1, 1);
  }
  // fins at the bottom
  g.fillStyle = api.col('hud');
  g.fillRect(x + shift(7) - 4, y + 2, 2, 2);
  g.fillRect(x + shift(7) + 3, y + 2, 2, 2);
  // a porthole, so it reads as a rocket and not a bar
  g.fillStyle = api.col('bg');
  g.fillRect(x + shift(3), y - 1, 1, 1);
}

/** The flame under the engine: two flickering tongues, drawn only while the main engine burns. */
export function drawFlame(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, t: number) {
  const g = api.g;
  const lean = Math.sin(a);
  const base = y + 6;
  const flick = Math.floor(t * 20) % 2;
  g.fillStyle = api.col('text');
  g.fillRect(x + Math.round(lean * 6) - 1, base, 3, 3 + flick);
  g.fillStyle = api.col('hud');
  g.fillRect(x + Math.round(lean * 6), base + 3, 1, 3 + (1 - flick));
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

/** The ROCKETX logo: an original rocket glyph beside a bold pixel wordmark, with a landing-pad bar under it.
    It is ROCKETX's own mark, not any company's. `scale` 1 for the cover and preview, 2 for the loading screen. */
export function drawLogo(api: { g: Screen2D; col(r: string): string; txt(s: string, x: number, y: number, role?: string, align?: string, size?: number): void }, cx: number, y: number) {
  const g = api.g;
  // the glyph: a small rocket, nose up, with two fins and a flame
  g.fillStyle = api.col('text');
  g.fillRect(cx - 40, y - 2, 4, 2);
  g.fillRect(cx - 41, y, 6, 6);
  g.fillRect(cx - 42, y + 6, 8, 4);
  g.fillStyle = api.col('hud');
  g.fillRect(cx - 44, y + 6, 2, 4);
  g.fillRect(cx - 34, y + 6, 2, 4);
  g.fillStyle = api.col('text');
  g.fillRect(cx - 40, y + 10, 4, 2);
  // the wordmark, in the title face
  api.txt('ROCKET', cx + 6, y + 1, 'text', 'left', 16);
  api.txt('X', cx + 6 + 6 * 11 + 2, y + 1, 'hud', 'left', 16);
  // the pad: a bar under the wordmark with lights at each end
  g.fillStyle = api.col('hud');
  g.fillRect(cx - 42, y + 18, 96, 2);
  g.fillStyle = api.col('text');
  g.fillRect(cx - 44, y + 16, 2, 2);
  g.fillRect(cx + 52, y + 16, 2, 2);
}

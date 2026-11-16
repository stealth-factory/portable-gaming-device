/* ROCKETX's pictures: an original rocket, its flame and the landing pad. Drawn only in colour roles, so it reads on every
   phosphor. No state here: the loading screen and the game both use it. */
import type { Screen2D } from '../types';

type Api = { g: Screen2D; col(role: string): string };

/** A rocket of nine rows, tilted by `a` radians: each row shifts sideways a little more the higher it sits. */
export function drawRocket(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, dead = false, gridFins = false, heavy = false) {
  const g = api.g;
  // the nose leans toward +sin(a); when the rocket is more than halfway over (cos a < 0) it is drawn upside down
  const lean = Math.sin(a);
  const flip = Math.cos(a) < 0;
  const at = (r: number) => (flip ? 8 - r : r);      // the row a sprite row lands on
  const shift = (r: number) => Math.round(lean * (4 - r) * 1.2);
  const body = dead ? 'hud' : 'text';
  g.fillStyle = api.col(body);
  for (let r = 0; r < 9; r++) {
    const half = r < 2 ? 1 : heavy ? 3 : 2;       // a nose cone at the top (row 0); HAULER is broader
    const row = at(r);
    g.fillRect(x + shift(row) - half, y - 4 + row, half * 2 + 1, 1);
  }
  // fins at the base (row 7), and a porthole, so it reads as a rocket and not a bar
  g.fillStyle = api.col('hud');
  if (!heavy) {                                  // STILT's legs; HAULER has none (the tower catches it)
    g.fillRect(x + shift(at(7)) - 4, y - 4 + at(7), 2, 2);
    g.fillRect(x + shift(at(7)) + 3, y - 4 + at(7), 2, 2);
  } else {                                       // HAULER's catch pins, just under the grid fins
    g.fillRect(x + shift(at(3)) - 4, y - 4 + at(3), 1, 1);
    g.fillRect(x + shift(at(3)) + 4, y - 4 + at(3), 1, 1);
  }
  g.fillStyle = api.col('bg');
  g.fillRect(x + shift(at(3)), y - 4 + at(3), 1, 1);
  // grid fins: a small square either side, just under the nose
  if (gridFins) {
    g.fillStyle = api.col('hud');
    const o = heavy ? 1 : 0;
    g.fillRect(x + shift(at(2)) - 4 - o, y - 4 + at(2), 2, 1);
    g.fillRect(x + shift(at(2)) + 3 + o, y - 4 + at(2), 2, 1);
  }
}

/** A puff from a nose thruster. `side` is the way the nose is being pushed (1 turns it right, so the gas leaves on
    the left). Drawn while the thruster fires, flickering. */
export function drawPuff(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, side: -1 | 1, t: number) {
  const g = api.g;
  const flip = Math.cos(a) < 0;
  const row = flip ? 7 : 1;                                // the thrusters sit just under the nose
  const nx = x + Math.round(Math.sin(a) * (4 - row) * 1.2);
  const ny = y - 4 + row;
  const out = -side;                                       // the gas leaves on the far side from the push
  const flick = Math.floor(t * 30) % 2;
  g.fillStyle = api.col('text');
  g.fillRect(nx + out * 4 - (out < 0 ? 1 : 0), ny, 2, 1);
  g.fillStyle = api.col('hud');
  g.fillRect(nx + out * (6 + flick) - (out < 0 ? 1 : 0), ny - flick, 1, 1);
  g.fillRect(nx + out * (7 - flick) - (out < 0 ? 1 : 0), ny + 1, 1, 1);
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

/** The sea: a rolling line across the whole tube at the water's height, with crests that travel and grow with the
    swell (`amp` in pixels). Below it, a few rows of dashes for the water. */
export function drawSea(api: { g: Screen2D; col(r: string): string }, w: number, y: number, amp: number, t: number) {
  const g = api.g;
  g.fillStyle = api.col('hud');
  for (let x = 0; x < w; x += 2) {
    const dy = Math.round(Math.sin(x * 0.09 + t * 1.6) * amp * 0.6 + Math.sin(x * 0.031 - t * 0.9) * amp * 0.4);
    g.fillRect(x, y + dy, 2, 1);
  }
  // crests: brighter flecks riding the swell
  g.fillStyle = api.col('text');
  const n = Math.max(2, Math.round(w / 40));
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i * 43 + t * 14) % w + w) % w);
    const dy = Math.round(Math.sin(x * 0.09 + t * 1.6) * amp * 0.6 + Math.sin(x * 0.031 - t * 0.9) * amp * 0.4);
    if (amp > 1) g.fillRect(x, y + dy - 1, 2, 1);
  }
  // the water under the line
  g.fillStyle = api.col('hud');
  for (let r = 1; r <= 3; r++) {
    for (let x = (r * 7 + Math.floor(t * 6 * r)) % 12; x < w; x += 12) g.fillRect(x, y + 3 + r * 3, 3, 1);
  }
}

/** The landing ship: a flat deck that tilts with `roll`, a hull under it down to the water, and a light at each end of
    the deck that blinks. (x0, x1) is the deck across, y its height at the middle. */
export function drawShip(api: { g: Screen2D; col(r: string): string }, x0: number, x1: number, y: number, roll: number, waterY: number, t: number) {
  const g = api.g;
  const mid = (x0 + x1) / 2;
  const at = (x: number) => Math.round(y + (x - mid) * Math.tan(roll));
  // the hull: a solid block under the deck, down to the waterline
  g.fillStyle = api.col('hud');
  for (let x = x0 + 2; x < x1 - 2; x++) {
    const top = at(x) + 2;
    g.fillRect(x, top, 1, Math.max(1, waterY - top));
  }
  // the deck itself, stepped along the roll
  g.fillStyle = api.col('text');
  for (let x = x0; x < x1; x++) g.fillRect(x, at(x), 1, 2);
  // a landing mark in the middle of the deck: a ring the rocket aims for
  g.fillStyle = api.col('bg');
  g.fillRect(Math.round(mid) - 2, at(mid), 5, 1);
  const on = Math.floor(t * 2) % 2 === 0;
  g.fillStyle = api.col(on ? 'text' : 'hud');
  g.fillRect(x0 - 1, at(x0) - 2, 2, 2);
  g.fillRect(x1 - 1, at(x1) - 2, 2, 2);
}

/** A splash where the rocket went into the sea: a spray that rises and falls back over `p` (0 to 1). */
export function drawSplash(api: { g: Screen2D; col(r: string): string }, x: number, y: number, p: number) {
  const g = api.g;
  const h = Math.round(Math.sin(Math.min(1, p) * Math.PI) * 14);
  g.fillStyle = api.col('text');
  for (let i = -3; i <= 3; i++) {
    const hi = Math.max(0, h - Math.abs(i) * 3);
    if (hi > 0) g.fillRect(x + i * 2, y - hi, 1, hi);
  }
  g.fillStyle = api.col('hud');
  g.fillRect(x - 9, y, 19, 1);
}

/** The catch tower: a lattice column from the ground up past the arms, and two arms reaching left from it at the arms'
    height. Open, the arms stand apart above and below the catch point; `closed` draws them shut on the rocket. */
export function drawTower(api: { g: Screen2D; col(r: string): string }, towerX: number, topY: number, groundY: number,
  armY: number, tipX: number, closed: boolean, t: number) {
  const g = api.g;
  g.fillStyle = api.col('hud');
  g.fillRect(towerX, topY, 1, groundY - topY);
  g.fillRect(towerX + 5, topY, 1, groundY - topY);
  for (let y = topY; y < groundY; y += 6) {               // the lattice
    g.fillRect(towerX, y, 6, 1);
    g.fillRect(towerX + (Math.floor((y - topY) / 6) % 2 ? 1 : 3), y + 3, 2, 1);
  }
  g.fillRect(towerX - 2, groundY, 10, 2);                 // the foot
  // the arms: two bars reaching left, apart when open, together when closed
  const gap = closed ? 2 : 7;
  g.fillStyle = api.col('text');
  g.fillRect(tipX, armY - gap, towerX - tipX, 2);
  g.fillRect(tipX, armY + gap - 1, towerX - tipX, 2);
  // a light at the top that blinks
  const on = Math.floor(t * 2) % 2 === 0;
  g.fillStyle = api.col(on ? 'text' : 'hud');
  g.fillRect(towerX + 2, topY - 2, 2, 2);
}

/** CRUISER, the upper stage: a long body with flaps fore and aft, drawn truly rotated (it spends its fall lying flat,
    which the leaning sprite above can't show). `flap` tilts the flaps while they work (-1, 0, 1). */
export function drawCruiser(api: { g: Screen2D; col(r: string): string }, x: number, y: number, a: number, dead = false, flap = 0) {
  const g = api.g;
  const c = Math.cos(a), s = Math.sin(a);
  // a point on the upright body (dx across, dy along, up negative) to the tube
  const dot = (dx: number, dy: number) => g.fillRect(Math.round(x + dx * c - dy * s), Math.round(y + dx * s + dy * c), 1, 1);
  g.fillStyle = api.col(dead ? 'hud' : 'text');
  for (let dy = -6; dy <= 5; dy++) {
    const half = dy <= -5 ? 0 : 1;                       // a pointed nose
    for (let dx = -half; dx <= half; dx++) dot(dx, dy);
  }
  // flaps: small fore pair under the nose, bigger aft pair at the base; a working flap kicks out one more pixel
  g.fillStyle = api.col('hud');
  dot(-2, -3); dot(2, -3);
  for (const dy of [3, 4]) { dot(-2, dy); dot(2, dy); }
  if (flap < 0) dot(-3, 4);
  if (flap > 0) dot(3, 4);
  g.fillStyle = api.col('bg');
  dot(0, -2);                                            // a porthole
}

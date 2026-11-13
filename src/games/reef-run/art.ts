/* Reef Run's pictures: a fish, coral, rock and a wreck, in colour roles. */
import type { ConsoleAPI } from '../types';
import type { GateKind } from './rules';

function R(api: ConsoleAPI, x: number, y: number, w: number, h: number, role: string) {
  if (w <= 0 || h <= 0) return;
  api.g.fillStyle = api.col(role);
  api.g.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Side view, facing the current. `vy` pitches the nose; `dead` crosses the eye. */
export function drawFish(api: ConsoleAPI, x: number, y: number, vy: number, frame: number, dead = false) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const nose = dead ? 3 : Math.max(-2, Math.min(2, Math.round(vy / 120)));
  const wag = frame % 2;
  R(api, X + wag, Y + 3 - nose, 2, 2, 'textDim');
  R(api, X + wag, Y + 7 + nose, 2, 2, 'textDim');
  R(api, X + 2, Y + 4, 3, 4, 'textDim');
  R(api, X + 4, Y + 3, 8, 5, 'text');
  R(api, X + 5, Y + 2, 6, 1, 'text');
  R(api, X + 5, Y + 8, 5, 1, 'text');
  R(api, X + 7, Y + 1, 3, 2, 'gold');
  R(api, X + 8, Y + 8, 2, 2, 'gold');
  R(api, X + 11, Y + 3 + nose, 4, 4, 'text');
  R(api, X + 15, Y + 4 + nose, 2, 2, 'text');
  R(api, X + 11, Y + 4 + nose, 1, 3, 'textDim');
  const ey = Y + 4 + nose;
  if (dead) {
    R(api, X + 13, ey, 2, 2, 'bg');
    R(api, X + 13, ey, 1, 1, 'text');
    R(api, X + 14, ey + 1, 1, 1, 'text');
  } else {
    R(api, X + 13, ey, 2, 2, 'bg');
    R(api, X + 14, ey, 1, 1, 'spark');
  }
}

function nibble(n: number) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Coral hanging from the surface down to the opening. The silhouette wobbles; it stays inside the column. */
export function drawCoral(api: ConsoleAPI, x: number, top: number, bottom: number, w: number) {
  const h = bottom - top;
  if (h < 2 || w < 4) return;
  const X = Math.round(x);
  for (let y = top; y < bottom; y += 2) {
    const wobble = Math.round(Math.sin((y + X) * 0.45) * 2);
    const inset = (y + X) % 8 < 2 ? 2 : 0;
    const left = X + 2 + wobble + inset;
    const width = Math.max(4, w - 4 - inset * 2);
    R(api, left, y, width, Math.min(2, bottom - y), (y + X) % 6 < 2 ? 'gem' : 'dirt');
  }
  for (let i = 0; i < 4; i++) {
    const y = top + 2 + Math.floor(nibble(X * 0.17 + i * 5.1) * Math.max(1, h - 6));
    const len = 3 + (i % 3);
    const bx = i % 2 === 0 ? X + w - 2 - len : X + 1;
    R(api, bx, y, len, 2, 'gold');
  }
}

/** Rock rising from the seabed to the opening, thicker toward the floor. */
export function drawRocks(api: ConsoleAPI, x: number, top: number, bottom: number, w: number) {
  const h = bottom - top;
  if (h < 2 || w < 4) return;
  const X = Math.round(x);
  for (let y = top; y < bottom; y += 2) {
    const t = (y - top) / Math.max(1, h);
    const shrink = Math.round((1 - t) * 5);
    R(api, X + shrink, y, Math.max(4, w - shrink * 2), Math.min(2, bottom - y), (y + X) % 7 < 2 ? 'hud' : 'dirt');
  }
  R(api, X + Math.round(w / 2) - 1, top + 1, 2, 2, 'spark');
  R(api, X + 3, top + 4, 3, 2, 'gem');
}

/** A ribbed hull. The opening is the gap between the ribs, not a cut in a slab. */
export function drawWreck(api: ConsoleAPI, x: number, gapY: number, gapH: number, w: number, laneTop: number, laneBottom: number) {
  const X = Math.round(x);
  const topH = gapY - laneTop;
  const botH = laneBottom - (gapY + gapH);
  R(api, X + 2, laneTop, 3, topH, 'hud');
  R(api, X + w - 5, laneTop, 3, topH, 'hud');
  R(api, X + 2, gapY + gapH, 3, botH, 'hud');
  R(api, X + w - 5, gapY + gapH, 3, botH, 'hud');
  if (topH > 8) R(api, X, gapY - 4, w, 2, 'textDim');
  if (botH > 8) R(api, X, gapY + gapH + 2, w, 2, 'textDim');
  if (topH > 14) {
    R(api, X + Math.round(w / 2) - 2, laneTop + 6, 4, 4, 'gold');
    R(api, X + Math.round(w / 2) - 1, laneTop + 7, 2, 2, 'bg');
  }
}

export function drawReef(api: ConsoleAPI, x: number, gapY: number, gapH: number, w: number, laneTop: number, laneBottom: number, kind: GateKind) {
  if (kind === 'wreck') drawWreck(api, x, gapY, gapH, w, laneTop, laneBottom);
  else {
    drawCoral(api, x, laneTop, gapY, w);
    drawRocks(api, x, gapY + gapH, laneBottom, w);
  }
}

export function drawCurrents(api: ConsoleAPI, top: number, bottom: number, scroll: number) {
  const span = api.LW + 48;
  const bands = 5;
  const room = bottom - top - 12;
  if (room < 8) return;
  for (let i = 0; i < bands; i++) {
    const y = top + 6 + Math.round((i + 0.5) * room / bands);
    for (let k = 0; k < 7; k++) {
      const x = ((k * 53 + i * 17 - scroll * (0.25 + i * 0.04)) % span + span) % span - 24;
      R(api, x, y, 5 + (k % 3) * 3, 1, 'textDim');
    }
  }
}

export function drawBubble(api: ConsoleAPI, x: number, y: number, big: boolean) {
  const X = Math.round(x), Y = Math.round(y);
  if (big) {
    R(api, X + 1, Y, 2, 1, 'hud');
    R(api, X, Y + 1, 1, 2, 'hud');
    R(api, X + 3, Y + 1, 1, 2, 'hud');
    R(api, X + 1, Y + 3, 2, 1, 'hud');
    R(api, X + 1, Y + 1, 1, 1, 'text');
  } else R(api, X, Y, 2, 2, 'hud');
}

export function drawSurface(api: ConsoleAPI, y: number, t: number) {
  for (let x = 0; x < api.LW; x += 4) {
    const crest = (x + Math.floor(t * 14)) % 10 < 4;
    R(api, x, y, 2, crest ? 2 : 1, 'hud');
  }
}

export function drawBed(api: ConsoleAPI, y: number, scroll: number) {
  R(api, 0, y, api.LW, 2, 'dirt');
  const span = api.LW + 30;
  for (let i = 0; i < 16; i++) {
    const x = ((i * 27 - scroll * 0.5) % span + span) % span - 8;
    R(api, x, y + 2, 2 + (i % 2), 1, i % 3 ? 'hud' : 'gem');
  }
}

/** A frond in the water outside the lane. `base` is its root. */
export function drawKelp(api: ConsoleAPI, x: number, base: number, h: number, t: number) {
  if (h < 4) return;
  const sway = Math.round(Math.sin(t * 2 + x * 0.05) * 2);
  R(api, x + sway, base - h, 2, h, 'gem');
  R(api, x + sway - 2, base - h + 3, 2, 3, 'textDim');
}

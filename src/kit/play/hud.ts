/* The standard top bar: score at the left, HI when the tube is wide enough, a title or wave counter at
   the right with spare lives beside it, badges in between, and a dotted rule underneath. */
import { drawSprite } from './sprite';
import { shared } from './types';
import type { ConsoleAPI, Role, Sprite } from './types';

export interface Badge {
  text: string;
  role: Role;
  /** 0..1: a bar under the text that drains as a timer runs down. */
  frac?: number;
  /** Blink at this many Hz (hidden on the even half); 0 or unset shows it steadily. */
  blink?: number;
}
export interface HudOpts {
  /** Right-aligned text: 'WAVE 3', 'DINO RUN'. */
  right: string;
  /** Spare lives as small sprites, left of `right`. `spare` (default true) shows lives − 1 outside `dying`. */
  lives?: { art: Sprite; role: Role; max?: number; spare?: boolean };
  badges?: Badge[];
  scoreRole?: Role;
  hiRole?: Role;
  rightRole?: Role;
}

const CH = 6;                                 // the 8 px pixel font's advance
const HI_X = 80, AFTER_HI_X = 142, NO_HI_X = 48;

/** Badges' width with a gap after each. */
export const badgesWidth = (badges: readonly Badge[]) => badges.reduce((w, b) => w + b.text.length * CH + CH, 0);

export function drawHud(api: ConsoleAPI, o: HudOpts): void {
  const { g, LW, HUD, txt } = api, S = shared(api);
  g.fillStyle = api.col('bg'); g.fillRect(0, 0, LW, HUD);
  txt(String(S.score).padStart(6, '0'), 6, 6, o.scoreRole ?? 'text');
  txt(o.right, LW - 6, 6, o.rightRole ?? 'hud', 'right');
  let livesX = LW - 6 - o.right.length * CH;
  if (o.lives) {
    const { art, role, max = 5, spare = true } = o.lives;
    const n = Math.max(0, Math.min(max, S.lives - (spare && S.mode !== 'dying' ? 1 : 0)));
    livesX = LW - 12 - o.right.length * CH - n * 10;
    for (let i = 0, x = livesX; i < n; i++, x += 10) drawSprite(api, art, x, 6, role);
  }
  g.fillStyle = api.col('hud'); for (let i = 0; i < LW; i += 4) g.fillRect(i, HUD - 2, 2, 1);
  // badges go after HI when they fit before the lives, otherwise in HI's place; any that still don't fit are left out
  const badges = o.badges ?? [], need = badgesWidth(badges);
  const wide = LW >= 300, afterHi = wide && AFTER_HI_X + need <= livesX - 4;
  if (wide && (afterHi || !need)) txt('HI ' + String(api.best).padStart(6, '0'), HI_X, 6, o.hiRole ?? 'hud');
  let x = afterHi ? AFTER_HI_X : NO_HI_X;
  for (const b of badges) {
    if (x + b.text.length * CH > livesX - 4) break;          // no room left before the lives: drop the rest
    if (!b.blink || Math.floor(S.time * b.blink) % 2) txt(b.text, x, 6, b.role);
    if (b.frac != null) { g.fillStyle = api.col(b.role); g.fillRect(x, HUD - 4, Math.ceil(b.text.length * CH * Math.max(0, Math.min(1, b.frac))), 1); }
    x += b.text.length * CH + CH;
  }
}

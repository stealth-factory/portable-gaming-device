/* Bricks' disk: its label, loading screen and instructions. Drawn with fillRect and txt only. */
import type { ConsoleAPI, GameDisk } from '../types';
import { strings } from './strings';

/* the loading screen: a wall that gains a row as the disk reads, a bat, and a square ember knocking into it */
function drawLoad(a: ConsoleAPI, p: number, t: number) {
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('BRICKS', LW / 2, top, 'text', 'center', 16);
  txt('SERVE · BOUNCE · CLEAR', LW / 2, top + 20, 'hud', 'center');
  const cols = 7, bw = 10, bh = 5, gap = 1;
  const rows = Math.round(p * 4);
  const gridW = cols * (bw + gap) - gap;
  const x0 = Math.round(LW / 2 - gridW / 2), y0 = top + 36;
  const roles = ['dirt', 'cart', 'gem', 'gold', 'hud'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 6 === 0) continue;
      g.fillStyle = a.col(roles[(r * 3 + c) % roles.length]);
      const x = x0 + c * (bw + gap), y = y0 + r * (bh + gap);
      g.fillRect(x, y, bw, bh);
      if (roles[(r * 3 + c) % roles.length] === 'gem') {
        g.fillStyle = a.col('bg');
        g.fillRect(x + 2, y + 1, bw - 4, bh - 2);
      }
    }
  }
  const batW = 36, batY = y0 + 4 * (bh + gap) + 8;
  const batX = Math.round(LW / 2 - batW / 2 + Math.sin(t * 2.2) * 16);
  g.fillStyle = a.col('cart');
  g.fillRect(batX, batY, batW, 2);
  g.fillRect(batX + 2, batY + 2, batW - 4, 3);
  const travel = (t * 36) % 26;
  g.fillStyle = a.col('spark');
  g.fillRect(batX + Math.round(batW / 2) - 2, batY - 4 - travel, 4, 4);
  a.diskInfo(batY + 14, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'bHow' },
  { h: 'bBrickH', p: 'bBricks' },
  { h: 'secScore', list: [
    { k: 'bClay', v: 'bClayV' }, { k: 'bKiln', v: 'bKilnV' }, { k: 'bGlass', v: 'bGlassV' },
    { k: 'bCinder', v: 'bCinderV' }, { k: 'bAnvil', v: 'bAnvilV' }, { k: 'bClear', v: 'bClearV' },
  ] },
  { h: 'ctlH', keys: true, list: [
    { k: 'bk1', v: 'bk1v' }, { k: 'bk2', v: 'bk2v' }, { k: 'bk3', v: 'bk3v' }, { k: 'bk4', v: 'bk4v' },
    { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'bCred' },
];

export const disk: GameDisk = {
  id: 'bricks', order: 5, slug: 'bricks',
  page: {
    title: 'Bricks',
    description: 'Serve an ember into a wall of clay, kiln, glass and cinder bricks and clear them with one bat, on the Game Guy 3000 Deluxe: a 1983-style console in your browser.',
  },
  title: 'BRICKS', nameKey: 'bName', file: 'BRICKS.EXE', size: 18432, loadSecs: 2.2,
  steps: [[0, 0], [0.1, 0.08], [0.22, 0.3], [0.34, 0.32], [0.5, 0.55], [0.62, 0.6], [0.78, 0.86], [0.9, 0.9], [1, 1]],
  blurb: 'SERVE · BOUNCE · CLEAR', verb: 'SERVE', tap: true,
  buttons: { fire: { label: 'serve' } },
  overKey: 'bOver', againKey: 'bAgain',
  manual: MANUAL, strings, drawLoad,
};

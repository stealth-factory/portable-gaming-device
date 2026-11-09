/* I Invade's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { useApi, sprite, JELLY, BEETLE, DRONE, CANNON, SAUCER } from '../invader-force/art';
import { strings } from './strings';

/* the loading screen, seen from the fleet: the earthlings' tanks wait on the ground
   while your formation lowers into view a row at a time, and a UFO sweeps across dropping bombs */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  useApi(a);
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 160) / 3));
  txt('I INVADE', LW / 2, top, 'text', 'center', 16);
  txt('STEER · BOMB · CONQUER', LW / 2, top + 20, 'hud', 'center');
  // the fleet comes down out of the sky as the sectors arrive
  const cols = LW < 330 ? 7 : 9, sw = (cols - 1) * 15 + 11;
  const x0 = Math.round(LW / 2 - sw / 2 + Math.sin(t * 1.6) * 10), y0 = top + 32 + Math.round(p * 10);
  const rows = [JELLY, BEETLE, DRONE], roles = ['rockjaw', 'borer', 'grub'], frame = Math.floor(t * 3) % 2;
  const shown = Math.min(3, Math.floor(p * 3.2));
  for (let r = 0; r < shown; r++) for (let c = 0; c < cols; c++) sprite(rows[r][frame], x0 + c * 15, y0 + r * 11, roles[r]);
  // the UFO's bombing run
  const ux = ((t * 70) % (LW + 60)) - 30;
  sprite(SAUCER, ux, top + 34, 'sun');
  g.fillStyle = a.col('sun');
  for (let k = 1; k < 5; k++) { const bx = ux + 8 - k * 17, by = top + 42 + k * 9; if (bx > 0 && bx < LW) g.fillRect(Math.round(bx), Math.round(by), 2, 2); }
  // the ground, and the earthlings' tanks on it
  const gy = top + 80;
  g.fillStyle = a.col('hud'); g.fillRect(10, gy + 9, LW - 20, 1);
  const n = p < 0.5 ? 1 : p < 0.85 ? 3 : 6;
  for (let i = 0; i < n; i++) sprite(CANNON, Math.round((LW - 13) * (i + 1) / (n + 1) + Math.sin(t * 2 + i) * 4), gy, 'cart');
  a.diskInfo(gy + 18, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'iiHow' },
  { h: 'secScore', list: [
    { k: 'ii1', v: '100', lit: true }, { k: 'ii2', v: '300', lit: true }, { k: 'ii3', v: 'ii3v' }, { k: 'ii4', v: 'ii4v' }, { k: 'ii5', v: 'ii5v' },
  ] },
  { h: 'ctlH', keys: true, list: [
    { k: 'iik1', v: 'iik1v' }, { k: 'iik2', v: 'iik2v' }, { k: 'iik5', v: 'iik5v' }, { k: 'iik3', v: 'iik3v' }, { k: 'iik4', v: 'iik4v' }, { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'iiCred' },
];

export const disk: GameDisk = {
  id: 'iinvade', order: 4, slug: 'i-invade',
  page: { title: 'I Invade', description: "Be the invaders for once: steer the whole alien fleet, bomb the earthlings' tanks, call in UFO strikes and meteor showers, on the Game Guy 3000 Deluxe: a 1983-style console in your browser." },
  title: 'I INVADE', nameKey: 'iiName', file: 'IINVADE.EXE', size: 24576, loadSecs: 2.6,
  steps: [[0, 0], [0.1, 0.06], [0.22, 0.3], [0.34, 0.32], [0.5, 0.58], [0.6, 0.6], [0.78, 0.86], [0.86, 0.88], [1, 1]],
  blurb: 'STEER · BOMB · CONQUER', verb: 'INVADE', tap: true,
  fireKey: 'iiBomb', boostKey: 'iiUfo', overKey: 'iiOver', againKey: 'iiAgain',
  manual: MANUAL, strings, drawLoad,
};

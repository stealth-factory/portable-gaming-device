/* Dino Run's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { useApi, drawDino, drawCactus, drawCloud } from './art';
import { strings } from './strings';

const R = (a: ConsoleAPI, x: number, y: number, w: number, h: number, role: string) => { a.g.fillStyle = a.col(role); a.g.fillRect(Math.round(x), Math.round(y), w, h); };

/* themed loading screen: the dinosaur runs the length of the load, hopping the cacti on the way */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  useApi(a);
  const { LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('DINO RUN', LW / 2, top, 'text', 'center', 16);
  txt('JUMP · DUCK · RUN', LW / 2, top + 20, 'hud', 'center');
  const x0 = 14, bw = LW - 28, gy = top + 76;
  for (const c of [0.18, 0.5, 0.78]) drawCloud(x0 + bw * c - 8, top + 38 + (c * 40) % 12);
  R(a, x0, gy, bw, 1, 'hud');
  const cacti = [0.3, 0.55, 0.82].map(f => x0 + bw * f);
  cacti.forEach((cx, i) => drawCactus(cx, gy, i === 1));
  const dx = x0 + p * (bw - 26);
  for (let fx = x0 + 2; fx < dx - 2; fx += 6) R(a, fx, gy + 3, 2, 1, 'textDim');   // footprints behind it
  let hop = 0;
  for (const cx of cacti) { const d = cx + 4 - (dx + 13); if (d > -18 && d < 18) hop = Math.max(hop, 26 * (1 - (d / 18) ** 2)); }
  drawDino(dx, gy - Math.round(hop), false, Math.floor(t * 10) % 2, hop > 0);
  a.diskInfo(gy + 16, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'dHow' },
  { h: 'secScore', list: [{ k: 'dr1', v: 'dr1v' }, { k: 'dr2', v: 'dr2v' }, { k: 'dr3', v: 'dr3v' }] },
  { h: 'ctlH', keys: true, list: [{ k: 'dk1', v: 'dk1v' }, { k: 'dk2', v: 'dk2v' }, { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' }] },
  { h: 'aboutH', p: 'dCred' },
];

export const disk: GameDisk = {
  id: 'dino', order: 2, slug: 'dino-run', genre: 'RUNNER', players: 1,
  page: { title: 'Dino Run', description: 'Jump the cacti, duck the pterosaurs and run as far as you can across the desert, on the Game Guy 3000 Deluxe: a 1983-style console in your browser.' },
  title: 'DINO RUN', nameKey: 'dName', file: 'DINORUN.COM', size: 9216, loadSecs: 1.8,
  steps: [[0, 0], [0.12, 0.18], [0.22, 0.2], [0.42, 0.52], [0.55, 0.56], [0.78, 0.9], [0.88, 0.92], [1, 1]],
  blurb: 'JUMP · DUCK · RUN', verb: 'RUN', tap: true, buttons: { fire: { label: 'jump' }, boost: { label: 'duck' } }, overKey: 'dOver', againKey: 'dAgain',
  manual: MANUAL, strings, drawLoad,
};

/* Invader Force's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { useApi, sprite, JELLY, BEETLE, DRONE, CANNON } from './art';
import { strings } from './strings';

/* the loading screen: under the stars, the formation marches in a row at a time as the disk reads,
   while your cannon takes pot shots at it */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  useApi(a);
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('INVADER FORCE', LW / 2, top, 'text', 'center', 16);
  txt('AIM · FIRE · HOLD THE LINE', LW / 2, top + 20, 'hud', 'center');
  // stars
  g.fillStyle = a.col('textDim');
  for (let i = 0; i < 26; i++) {
    const x = (i * 53.7) % (LW - 20) + 10, y = top + 34 + ((i * 17.3) % 46);
    if ((i + Math.floor(t * 3)) % 5) g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  // the formation, a row at a time as the sectors come in
  const cols = LW < 330 ? 7 : 9, span = (cols - 1) * 15 + 11;
  const sway = Math.round(Math.sin(t * 2.2) * 8), x0 = Math.round(LW / 2 - span / 2) + sway, y0 = top + 36;
  const rows = [JELLY, BEETLE, DRONE], roles = ['rockjaw', 'borer', 'grub'];
  const shown = Math.min(3, Math.floor(p * 3.2));
  const frame = Math.floor(t * 3) % 2;
  for (let r = 0; r < shown; r++) for (let c = 0; c < cols; c++) sprite(rows[r][frame], x0 + c * 15, y0 + r * 11, roles[r]);
  // your cannon, firing up the middle
  const cy = y0 + 46;
  sprite(CANNON, LW / 2 - 6, cy, 'cart');
  const shotY = cy - 4 - ((t * 90) % 40);
  g.fillStyle = a.col('spark'); g.fillRect(Math.round(LW / 2), Math.round(shotY), 1, 4);
  g.fillStyle = a.col('hud'); g.fillRect(10, cy + 9, LW - 20, 1);
  a.diskInfo(cy + 18, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'ifHow' },
  { h: 'secScore', list: [
    { k: 'if1', v: '10', lit: true }, { k: 'if2', v: '20', lit: true }, { k: 'if3', v: '30', lit: true },
    { k: 'if4', v: '50 · 100 · 150 · 300', lit: true }, { k: 'if5', v: 'if5v' },
  ] },
  { h: 'ifCapH', p: 'ifCap' },
  { h: 'ifWepH', list: [
    { k: 'ifw1', v: 'ifw1v' }, { k: 'ifw2', v: 'ifw2v' }, { k: 'ifw3', v: 'ifw3v' }, { k: 'ifw4', v: 'ifw4v' }, { k: 'ifw5', v: 'ifw5v' }, { k: 'ifw6', v: 'ifw6v' },
  ] },
  { h: 'ctlH', keys: true, list: [
    { k: 'ik1', v: 'ik1v' }, { k: 'ik2', v: 'ik2v' }, { k: 'ik3', v: 'ik3v' }, { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'ifCred' },
];

export const disk: GameDisk = {
  id: 'invader', order: 3, slug: 'invader-force',
  page: { title: 'Invader Force', description: 'Hold the line against a marching alien formation: shoot them down before they land, duck behind the walls and grab the mystery saucer, catch weapon capsules, on the Game Guy 3000 Deluxe: a 1983-style console in your browser.' },
  title: 'INVADER FORCE', nameKey: 'ifName', file: 'INVFORCE.EXE', size: 28672, loadSecs: 3.1,
  steps: [[0, 0], [0.08, 0.04], [0.2, 0.22], [0.3, 0.24], [0.45, 0.48], [0.52, 0.5], [0.66, 0.7], [0.74, 0.72], [0.9, 0.96], [1, 1]],
  blurb: 'AIM · FIRE · HOLD', verb: 'FIGHT', tap: true,
  buttons: { fire: { label: 'spark' }, boost: { label: 'shield' } }, overKey: 'ifOver', againKey: 'ifAgain',
  manual: MANUAL, strings, drawLoad,
};

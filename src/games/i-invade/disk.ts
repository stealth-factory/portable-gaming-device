/* I Invade's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { drawSprite } from '../../kit/play/sprite';
import type { Role, Sprite } from '../../kit/play/types';
import { CROWN, PUFFER, POD, TANK, UFO } from './art';
import { strings } from './strings';

/* the loading screen: your fleet sinks towards the planet as the disk reads, the UFO crosses the sky,
   and a bomb falls from the bay onto the tanks patrolling below */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  const sprite = (art: Sprite, x: number, y: number, role: Role) => drawSprite(a, art, x, y, role);
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('I INVADE', LW / 2, top, 'text', 'center', 16);
  txt('STEER · BOMB · LAND', LW / 2, top + 20, 'hud', 'center');
  const cols = LW < 330 ? 5 : 7, span = (cols - 1) * 15 + 11, frame = Math.floor(t * 3) % 2;
  const x0 = Math.round(LW / 2 - span / 2 + Math.sin(t * 1.6) * 10), y0 = top + 34 + Math.round(p * 12);
  const rows = [CROWN, PUFFER, POD], roles = ['rockjaw', 'borer', 'grub'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) sprite(rows[r][frame], x0 + c * 15, y0 + r * 10, roles[r]);
  const ux = ((t * 60) % (LW + 40)) - 20;
  sprite(UFO, ux, top + 28, 'sun');
  const gy = top + 92;
  const by = y0 + 30 + ((t * 70) % Math.max(10, gy - y0 - 36));
  g.fillStyle = a.col('gold'); g.fillRect(Math.round(LW / 2) - 1, Math.round(by), 3, 3);
  for (let i = 0; i < 3; i++) sprite(TANK, Math.round(LW * (0.2 + 0.3 * i) - 6 + Math.sin(t * 1.3 + i * 2) * 8), gy - 8, 'cart');
  g.fillStyle = a.col('hud'); g.fillRect(10, gy, LW - 20, 1);
  a.diskInfo(gy + 10, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'iiHow' },
  { h: 'secScore', list: [{ k: 'ii1', v: 'ii1v' }, { k: 'ii2', v: 'ii2v' }, { k: 'ii3', v: 'ii3v' }] },
  { h: 'ctlH', keys: true, list: [
    { k: 'iik1', v: 'iik1v' }, { k: 'iik2', v: 'iik2v' }, { k: 'iik3', v: 'iik3v' }, { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'iiCred' },
];

export const disk: GameDisk = {
  id: 'iinvade', order: 4, slug: 'i-invade',
  page: { title: 'I Invade', description: 'Be the invaders for once: steer the alien fleet, bomb the tanks below and call in the UFO, on the Game Guy 3000 Deluxe: a 1983-style console in your browser.' },
  title: 'I INVADE', nameKey: 'iiName', file: 'IINVADE.EXE', size: 24576, loadSecs: 2.6,
  steps: [[0, 0], [0.1, 0.1], [0.18, 0.12], [0.34, 0.4], [0.46, 0.42], [0.6, 0.66], [0.7, 0.7], [0.86, 0.94], [1, 1]],
  blurb: 'STEER · BOMB · LAND', verb: 'INVADE', tap: true,
  buttons: { fireL: { label: 'bayL' }, fire: { label: 'bayM' }, fireR: { label: 'bayR' }, boost: { label: 'ufo' } }, overKey: 'iiOver', againKey: 'iiAgain',
  manual: MANUAL, strings, drawLoad,
};

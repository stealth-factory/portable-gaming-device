/* I Invade's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { drawSprite } from '../../kit/play/sprite';
import type { Role, Sprite } from '../../kit/play/types';
import { CROWN, PUFFER, POD, TANK, UFO } from './art';

import { strings } from './strings';

const TANK_DOWN = [...TANK].reverse();

/* the loading screen: the tanks patrol along the top, your fleet marches side to side and climbs towards them as the
   disk reads, bombs fly up from its three bays and the UFO crosses underneath */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  const sprite = (art: Sprite, x: number, y: number, role: Role) => drawSprite(a, art, x, y, role);
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('I INVADE', LW / 2, top, 'text', 'center', 16);
  txt('MARCH · BOMB · LAND', LW / 2, top + 20, 'hud', 'center');
  const cols = LW < 330 ? 5 : 7, span = (cols - 1) * 15 + 11, frame = Math.floor(t * 3) % 2;
  const sky = top + 32;                                   // the planet's surface; the tanks hang below it
  g.fillStyle = a.col('hud'); g.fillRect(10, sky, LW - 20, 1);
  for (let i = 0; i < 3; i++) sprite(TANK_DOWN, Math.round(LW * (0.2 + 0.3 * i) - 6 + Math.sin(t * 1.3 + i * 2) * 8), sky + 1, 'cart');
  const x0 = Math.round(LW / 2 - span / 2 + (Math.floor(t * 4) % 12 < 6 ? Math.floor(t * 4) % 6 : 6 - Math.floor(t * 4) % 6) * 2 - 6), y0 = top + 64 - Math.round(p * 12);
  const rows = [POD, PUFFER, CROWN], roles = ['grub', 'borer', 'rockjaw'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) sprite(rows[r][frame], x0 + c * 15, y0 + r * 10, roles[r]);
  g.fillStyle = a.col('gold');
  for (const [c, off] of [[0, 0], [Math.floor(cols / 2), 0.33], [cols - 1, 0.66]] as const) {   // a bomb up from each bay in turn
    const bx = x0 + c * 15 + 5, by = y0 - 4 - (((t + off * 1.2) * 70) % Math.max(10, y0 - sky - 14));
    g.fillRect(bx, Math.round(by), 1, 1); g.fillRect(bx - 1, Math.round(by) + 1, 3, 3);
  }
  const ux = ((t * 60) % (LW + 40)) - 20;
  sprite(UFO, ux, top + 94, 'sun');
  a.diskInfo(top + 102, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'iiHow' },
  /* sentences, not a score row: a nowrap leader ran each weapon across the page and over the sections after it */
  { h: 'iiArmsH', notes: true, list: [{ k: 'iiw1', v: 'iiw1v' }, { k: 'iiw2', v: 'iiw2v' }, { k: 'iiw3', v: 'iiw3v' }, { k: 'iiw4', v: 'iiw4v' }] },
  { h: 'secScore', wrap: true, list: [{ k: 'ii1', v: 'ii1v' }, { k: 'ii2', v: 'ii2v' }, { k: 'ii3', v: 'ii3v' }, { k: 'ii4', v: 'ii4v' }] },
  /* the bomb bay is a sentence of keys; beside the name it wrapped into a pile and, in Chinese, crushed the label */
  { h: 'ctlH', keys: true, notes: true, list: [
    { k: 'iik2', v: 'iik2v' }, { k: 'iik4', v: 'iik4v' }, { k: 'iik5', v: 'iik5v' }, { k: 'iik3', v: 'iik3v' }, { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'iiCred' },
];

export const disk: GameDisk = {
  contract: 1, version: 1, rating: '4+',
  id: 'iinvade', order: 4, slug: 'i-invade', genre: 'TACTICS', players: 1,
  page: { title: 'I Invade', description: 'Be the invaders for once: time your bomb bays as the alien fleet marches up from below, call a cluster sweep, a UFO and meteors on the tanks above, on the PGD-01 Portable Gaming Device: a 1983-style console in your browser.' },
  title: 'I INVADE', nameKey: 'iiName', file: 'IINVADE.EXE', size: 24576, loadSecs: 2.6,
  steps: [[0, 0], [0.1, 0.1], [0.18, 0.12], [0.34, 0.4], [0.46, 0.42], [0.6, 0.66], [0.7, 0.7], [0.86, 0.94], [1, 1]],
  blurb: 'MARCH · BOMB · LAND', verb: 'INVADE', tap: true, controls: 'pad',
  /* no stick: the pad's top row is the three bomb bays, the bottom row the cluster sweep and the meteor swarm; FIRE
     (Space) is the middle bay too, and BOOST calls the UFO. On the sideways console the bays and CLUSTER sit on the
     right and UFO sits above METEORS on the left (console.css). */
  buttons: {
    pad1: { label: 'bayL' }, pad2: { label: 'bayM' }, pad3: { label: 'bayR' },
    pad4: { label: 'cluster' }, pad5: { label: 'meteors', enabled: false },
    fire: { label: 'bomb' }, boost: { label: 'ufo' },
  }, overKey: 'iiOver', againKey: 'iiAgain',
  manual: MANUAL, strings, drawLoad,
};

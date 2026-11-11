/* Martian Storm's disk: its label, loading screen and instructions. Drawn with fillRect and txt only. */
import type { ConsoleAPI, GameDisk } from '../types';
import { strings } from './strings';
import { SPORE_W, drawSpore } from './art';

function band(a: ConsoleAPI, y: number, drift: number, role: string, dash: number, thick: number) {
  const { g, LW } = a;
  g.fillStyle = a.col(role);
  for (let x = -16 + drift; x < LW; x += 18) g.fillRect(Math.round(x), y, dash, thick);
}

function skiff(a: ConsoleAPI, x: number, y: number) {
  const g = a.g;
  g.fillStyle = a.col('cart');
  g.fillRect(x + 5, y, 1, 2);
  g.fillRect(x + 3, y + 2, 5, 2);
  g.fillRect(x + 1, y + 4, 9, 2);
  g.fillRect(x, y + 6, 11, 2);
  g.fillRect(x + 5, y + 3, 1, 6);
}

/* title, two dust bands that creep, a skiff, and a flight that fills in as the disk reads */
function drawLoad(a: ConsoleAPI, p: number, t: number) {
  const { g, LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  g.font = '16px Silkscreen, "Courier New", monospace';
  const narrow = g.measureText('MARTIAN STORM').width > LW - 24;
  let art: number;
  if (narrow) {
    txt('MARTIAN', LW / 2, top, 'text', 'center', 16);
    txt('STORM', LW / 2, top + 16, 'text', 'center', 16);
    txt('FLY · TUCK · LAND', LW / 2, top + 34, 'hud', 'center');
    art = top + 48;
  } else {
    txt('MARTIAN STORM', LW / 2, top, 'text', 'center', 16);
    txt('FLY · TUCK · LAND', LW / 2, top + 20, 'hud', 'center');
    art = top + 36;
  }
  const drift = Math.round((t * 14) % 18);
  band(a, art, drift, 'dirt', 7, 1);
  band(a, art + 8, Math.round((t * 9) % 18), 'textDim', 3, 2);
  const shown = Math.round(p * 4);
  const cx = Math.round(LW / 2);
  const spots = [{ x: -24, y: 0 }, { x: -8, y: 6 }, { x: 8, y: 6 }, { x: 24, y: 0 }];
  for (let i = 0; i < shown; i++) drawSpore(a, cx + spots[i]!.x - Math.floor(SPORE_W / 2), art + 14 + spots[i]!.y);
  skiff(a, cx - 5, art + 36);
  a.diskInfo(art + 52, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'msHow' },
  { h: 'msCraftH', p: 'msCraft' },
  { h: 'msTokenH', p: 'msToken' },
  { h: 'secScore', list: [
    { k: 'msSpore', v: 'msSporeV' }, { k: 'msBarb', v: 'msBarbV' }, { k: 'msSlab', v: 'msSlabV' },
    { k: 'msPoints', v: 'msPointsV' }, { k: 'msTuckLeft', v: 'msTuckLeftV' }, { k: 'msLeg', v: 'msLegV' },
  ] },
  { h: 'ctlH', keys: true, list: [
    { k: 'msk1', v: 'msk1v' }, { k: 'msk2', v: 'msk2v' }, { k: 'msk3', v: 'msk3v' }, { k: 'msk4', v: 'msk4v' },
    { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'msCred' },
];

export const disk: GameDisk = {
  id: 'martian-storm', order: 6, slug: 'martian-storm', genre: 'SHOOTER', players: 1,
  page: {
    title: 'Martian Storm',
    description: 'Fly a skiff through a Martian dust storm, stack up guns, bomb the sky clear, tuck past the shots and clear each leg, on the PGD-01 Portable Gaming Device: a 1983-style console in your browser.',
  },
  title: 'MARTIAN STORM', nameKey: 'msName', file: 'STORM.EXE', size: 30720, loadSecs: 3.8,
  steps: [[0, 0], [0.12, 0.1], [0.24, 0.22], [0.4, 0.28], [0.55, 0.5], [0.68, 0.66], [0.8, 0.72], [0.92, 0.9], [1, 1]],
  blurb: 'FLY · TUCK · LAND', verb: 'FLY', tap: true,
  buttons: { fire: { label: 'spark' }, boost: { label: 'msLoop' }, fireR: { label: 'msBomb' } },
  overKey: 'msOver', againKey: 'msAgain',
  manual: MANUAL, strings, drawLoad,
};

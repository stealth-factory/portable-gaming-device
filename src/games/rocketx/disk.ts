/* ROCKETX's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { drawFlame, drawInbound, drawLogo, drawPad, drawRocket } from './art';
import { strings } from './strings';

/* the logo, the rocket coming down over the pad as the disk reads */
function drawLoad(a: ConsoleAPI, p: number, t: number) {
  const { LW, LH, HUD } = a;
  const top = HUD + Math.max(4, Math.round((LH - HUD - 120) / 4));
  drawLogo(a, Math.round(LW / 2), top);
  a.txt('BURN · STEER · LAND', LW / 2, top + 26, 'hud', 'center');
  const padY = LH - 46;
  drawPad(a, Math.round(LW * 0.4), Math.round(LW * 0.6), padY, t);
  drawInbound(a, p, t);
  a.diskInfo(padY + 14, p, t, disk);
}

/* the launcher's cover: the logo over the pad, drawn in the phosphor's colours (no capture needed) */
function drawCover(a: ConsoleAPI, x: number, y: number, w: number, h: number, t: number) {
  drawLogo(a, Math.round(x + w / 2), Math.round(y + h * 0.18));
  drawPad(a, Math.round(x + w * 0.4), Math.round(x + w * 0.6), Math.round(y + h * 0.78), t);
  drawRocket(a, Math.round(x + w / 2), Math.round(y + h * 0.5), 0);
}

/* the launcher's preview: the rocket comes down on the pad and lights its flame, over and over */
function drawPreview(a: ConsoleAPI, x: number, y: number, w: number, h: number, t: number) {
  const p = (t % 2) / 2;
  drawPad(a, Math.round(x + w * 0.4), Math.round(x + w * 0.6), Math.round(y + h * 0.82), t);
  drawFlame(a, Math.round(x + w / 2), Math.round(y + h * 0.18 + p * h * 0.55), 0, t);
  drawRocket(a, Math.round(x + w / 2), Math.round(y + h * 0.18 + p * h * 0.55), 0);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'rxHow' },
  { h: 'secScore', list: [{ k: 'rxS1', v: 'rxS1v' }, { k: 'rxS2', v: 'rxS2v' }] },
  { h: 'ctlH', keys: true, list: [
    { k: 'rxK1', v: 'rxK1v' }, { k: 'rxK2', v: 'rxK2v' }, { k: 'rxK3', v: 'rxK3v' },
  ] },
  { h: 'aboutH', p: 'rxCred' },
];

export const disk: GameDisk = {
  contract: 1, version: 5, rating: '4+',
  id: 'rocketx', order: 8, slug: 'rocketx', genre: 'LAND', players: 1,
  page: {
    title: 'ROCKETX',
    description: 'Burn an inbound rocket down onto its pad, steer it with the side thrusters and land it soft, on the PGD-01 Portable Gaming Device: a 1983-style console in your browser.',
  },
  title: 'ROCKETX', nameKey: 'rxName', file: 'ROCKETX.EXE', size: 12288, loadSecs: 2.4,
  steps: [[0, 0], [0.12, 0.1], [0.3, 0.35], [0.5, 0.52], [0.7, 0.7], [0.85, 0.92], [1, 1]],
  blurb: 'BURN · STEER · LAND', verb: 'LAND', tap: true,
  buttons: { fire: { label: 'rxBurn' }, boost: { label: 'rxLevel' } },
  overKey: 'rxOver', againKey: 'rxAgain',
  manual: MANUAL, strings, drawLoad, drawCover, drawPreview,
};

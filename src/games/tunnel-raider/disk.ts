/* Tunnel Raider's disk: its loading screen, instructions and the hooks the console calls. */
import type { ConsoleAPI, GameDisk } from '../types';

let api: ConsoleAPI;
const R = (x: number, y: number, w: number, h: number, role: string) => { api.g.fillStyle = api.col(role); api.g.fillRect(Math.round(x), Math.round(y), w, h); };

function gem(x: number, y: number){
  R(x + 2, y, 3, 1, 'gemHi'); R(x + 1, y + 1, 5, 1, 'gem'); R(x, y + 2, 7, 2, 'gem'); R(x + 1, y + 4, 5, 1, 'gem'); R(x + 2, y + 5, 3, 1, 'gem'); R(x + 3, y + 6, 1, 1, 'gem');
}
function cart(x: number, y: number, t: number){
  R(x, y + 1, 12, 7, 'cart'); R(x + 2, y + 2, 4, 3, 'window'); R(x - 1, y + 3, 2, 3, 'lamp');
  // the drill on the front, its thread turning
  for (let i = 0; i < 6; i++) R(x + 12 + i, y + 1 + Math.floor(i / 2), 1, 7 - Math.floor(i / 2) * 2, 'drill');
  const k = Math.floor(t * 16) % 2; R(x + 13 + k, y + 3, 1, 1, 'drillLine'); R(x + 15 + k, y + 4, 1, 1, 'drillLine');
  R(x + 1, y + 8, 3, 2, 'wheel'); R(x + 8, y + 8, 3, 2, 'wheel');
}

/* the loading screen: a drill cart bores across a seam of earth as the disk reads, swallowing emeralds */
function drawLoad(a: ConsoleAPI, p: number, t: number){
  api = a;
  const { LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(6, Math.round((LH - HUD - 150) / 3));
  txt('TUNNEL RAIDER', LW / 2, top, 'text', 'center', 16);
  txt('DIG · DROP · SURVIVE', LW / 2, top + 20, 'hud', 'center');
  const x0 = 12, bw = LW - 24, by = top + 40, bh = 30;
  R(x0, by, bw, bh, 'dirt');
  for (let i = 0; i < bw * bh / 22; i++) { const sx = (i * 37.3) % bw, sy = (i * 13.7) % bh; R(x0 + sx, by + sy, 1, 1, i % 5 ? 'ds1' : 'ds2'); }
  const edge = x0 + p * (bw - 20);
  R(x0, by + 9, edge - x0 + 6, 13, 'bg');                       // the tunnel so far
  for (let i = 0; i < 9; i++) {
    const gx = x0 + 14 + i * ((bw - 28) / 8);
    if (gx > edge + 6) gem(gx - 3, by + 12);                      // emeralds still in the ground
  }
  cart(edge - 10, by + 11, t);
  a.diskInfo(by + bh + 12, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'howNote' },
  { h: 'secScore', list: [
    { k: 'r1', v: '25', lit: true }, { k: 'r2', v: '+250', lit: true }, { k: 'r3', v: '500', lit: true }, { k: 'r4', v: '250', lit: true },
    { k: 'r5', v: '500', lit: true }, { k: 'r6', v: '1,000', lit: true }, { k: 'r7', v: '200 · 400 · 800 · 1,600', lit: true }, { k: 'r8', v: 'r8v' }, { k: 'r9', v: 'r9v' },
  ] },
  { h: 'ctlH', keys: true, list: [
    { k: 'k1', v: 'k1v' }, { k: 'k2', v: 'k2v' }, { k: 'k9', v: 'k9v' }, { k: 'k3', v: 'k3v' }, { k: 'k7', v: '<kbd>Enter</kbd>', lit: true }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'trCred' },
];

export const disk: GameDisk = {
  id: 'tunnel', order: 1, slug: 'tunnel-raider',
  page: { title: 'Tunnel Raider', description: 'Dig for emeralds, drop sacks of gold on the grubs and outwit smarter monsters every level, on the Game Guy 3000 Deluxe: a 1983-style console in your browser.' }, title: 'TUNNEL RAIDER', nameKey: 'trName', file: 'TUNNEL.EXE', size: 47104, loadSecs: 4.4,
  steps: [[0, 0], [0.1, 0.06], [0.18, 0.06], [0.3, 0.27], [0.4, 0.31], [0.5, 0.31], [0.63, 0.58], [0.71, 0.63], [0.8, 0.63], [0.92, 0.94], [1, 1]],
  blurb: 'DIG · DROP · SURVIVE', verb: 'DIG', buttons: { fire: { label: 'spark' }, boost: { label: 'boost' } }, overKey: 'over', againKey: 'again',
  manual: MANUAL,
  strings: { en: { trName: 'Tunnel Raider' }, 'zh-hant': { trName: 'Tunnel Raider 隧道掘金' }, 'zh-hans': { trName: 'Tunnel Raider 隧道掘金' } },
  drawLoad,
};

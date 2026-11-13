/* Reef Run's disk: its label, loading screen and instructions. */
import type { ConsoleAPI, GameDisk } from '../types';
import { drawBed, drawBubble, drawCoral, drawCurrents, drawFish, drawRocks, drawSurface } from './art';
import { strings } from './strings';

/* the fish crosses toward a reef as the disk reads */
function drawLoad(a: ConsoleAPI, p: number, t: number) {
  const { LW, LH, HUD, txt } = a;
  const top = HUD + Math.max(4, Math.round((LH - HUD - 120) / 4));
  txt('REEF RUN', LW / 2, top, 'text', 'center', 16);
  txt('KICK · GLIDE · PASS', LW / 2, top + 18, 'hud', 'center');
  const surface = top + 32;
  const bed = Math.min(LH - 52, surface + 52);
  drawSurface(a, surface, t);
  drawCurrents(a, surface + 2, bed, t * 36);
  const gateX = LW - 48;
  const gapH = Math.max(26, Math.round((bed - surface) * 0.42));
  const gapY = surface + Math.round((bed - surface - gapH) / 2);
  drawCoral(a, gateX, surface, gapY, 26);
  drawRocks(a, gateX, gapY + gapH, bed, 26);
  for (let i = 0; i < 4; i++) {
    const bx = ((i * 36 + t * 16) % Math.max(20, gateX - 8));
    const by = bed - 6 - ((t * 22 + i * 19) % Math.max(8, bed - surface - 8));
    drawBubble(a, bx, by, i % 2 === 0);
  }
  const fishX = 12 + p * Math.max(8, gateX - 40);
  const fishY = gapY + Math.round(gapH / 2) - 6 + Math.round(Math.sin(t * 5) * 2);
  drawFish(a, fishX, fishY, Math.sin(t * 5) * 40, Math.floor(t * 8));
  drawBed(a, bed, t * 28);
  a.diskInfo(bed + 8, p, t, disk);
}

const MANUAL: GameDisk['manual'] = [
  { h: 'howH', p: 'rrHow' },
  { h: 'secScore', list: [{ k: 'rrS1', v: 'rrS1v' }, { k: 'rrS2', v: 'rrS2v' }] },
  { h: 'ctlH', keys: true, list: [
    { k: 'rrK1', v: 'rrK1v' }, { k: 'rrK2', v: 'rrK2v' }, { k: 'rrK3', v: 'rrK3v' },
    { k: 'k3', v: 'k3v' }, { k: 'c3', v: 'c3v' },
  ] },
  { h: 'aboutH', p: 'rrCred' },
];

export const disk: GameDisk = {
  contract: 1, version: 2, rating: '4+',
  id: 'reef', order: 7, slug: 'reef-run', genre: 'SWIM', players: 1,
  page: {
    title: 'Reef Run',
    description: 'Kick a fish up through a reef current and slip the openings in the coral and rock, on the PGD-01 Portable Gaming Device: a 1983-style console in your browser.',
  },
  title: 'REEF RUN', nameKey: 'rrName', file: 'REEFRUN.COM', size: 8192, loadSecs: 1.5,
  steps: [[0, 0], [0.08, 0.05], [0.2, 0.28], [0.34, 0.3], [0.5, 0.58], [0.66, 0.62], [0.82, 0.9], [1, 1]],
  blurb: 'KICK · GLIDE · PASS', verb: 'SWIM', tap: true,
  buttons: { fire: { label: 'rrKick' } },
  overKey: 'rrOver', againKey: 'rrAgain',
  manual: MANUAL, strings, drawLoad,
};

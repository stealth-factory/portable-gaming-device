/* The API every game gets (src/games/types.ts), made by the console program (GAM-39).

   The console program owns the parts that are about the console: the state bag, the action buttons, the
   loaded game's best, the end of a game, sound, buzzes and analytics. The picture and the stick belong to
   the machine's screen and input, so the host passes those in as `ApiIO`, as live getters where they
   change (the tube's size, the palette, what is held). Games read every value each frame. */
import type { ConsoleAPI } from '../../games/types';
import * as Btn from '../buttons';
import { host } from './host';
import { finishGame } from './machine';
import { scores, saveBest } from './scores';
import { diskInfo } from './loader';

/** What the host's picture and input give the API. */
export type ApiIO = Pick<ConsoleAPI,
  'g' | 'layer' | 'stamp' | 'LW' | 'LH' | 'HUD' | 'W' | 'H' | 'C' | 'K' | 'fitGrid' | 'col' | 'palRGB' | 'palette' |
  'txt' | 'banner' | 'rr' | 'poly' | 'circ' | 'idx' | 'inb' | 'DIRS' |
  'held' | 'stickDir' | 'wantDir' | 'tapQueued' | 'tapHeld' | 'tapX' | 'clearTap'>;

/** A small seeded random generator (Mulberry32). */
export function mulberry32(a: number){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/** @deprecated games use api.setButtons({ boost: { label } }); kept so older game code still runs */
export function setBoostLabel(key: string | null){ Btn.setButtons({ boost: key ? { label: key } : null }); }

export function makeConsoleAPI(io: ApiIO): ConsoleAPI {
  return {
    layer: io.layer, stamp: io.stamp,
    get g(){ return io.g; }, get LW(){ return io.LW; }, get LH(){ return io.LH; }, get HUD(){ return io.HUD; },
    get W(){ return io.W; }, get H(){ return io.H; }, get C(){ return io.C; }, get K(){ return io.K; },
    fitGrid: io.fitGrid, col: io.col, get palRGB(){ return io.palRGB; }, get palette(){ return io.palette; },
    txt: io.txt, banner: io.banner, rr: io.rr, poly: io.poly, circ: io.circ, idx: io.idx, inb: io.inb, DIRS: io.DIRS,
    get S(){ return host.S; },
    get held(){ return io.held; }, get stickDir(){ return io.stickDir; }, wantDir: () => io.wantDir(),
    button: Btn.button, clearButton: Btn.clearQueued, setButtons: Btn.setButtons,
    get fireQueued(){ return Btn.button('fire').queued; }, get fireHeld(){ return Btn.button('fire').held; },
    get boostQueued(){ return Btn.button('boost').queued; }, get boostHeld(){ return Btn.button('boost').held; },
    get tapQueued(){ return io.tapQueued; }, get tapHeld(){ return io.tapHeld; }, get tapX(){ return io.tapX; },
    clearFire: () => Btn.clearQueued('fire'), clearBoost: () => Btn.clearQueued('boost'), clearTap: io.clearTap, setBoostLabel,
    tone: (freq, dur, vol, slide, delay) => host.platform.tone(freq, dur, vol, slide, delay),
    buzz: h => host.platform.buzz(h),
    get best(){ return scores.best; }, set best(v: number){ scores.best = v; },
    saveBest, finishGame,
    track: (name, data) => host.platform.track(name, data),
    mulberry32,
    diskInfo: (y, p, t, d) => diskInfo(y, p, t, d),
  };
}

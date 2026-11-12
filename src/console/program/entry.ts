/* Name entry and the score table, drawn on the tube like an arcade cabinet (GAM-39).

   After a game that makes the table, `startEntry()` puts up a letter grid: the stick or arrows move,
   FIRE picks, letter keys type, Enter finishes. Then the attract loop (`over`) takes turns between the
   game-over card and the table until FIRE starts another game. Part of the console program: the card
   over the tube and the sounds come through `host.platform`. */
import { host } from './host';
import type { Dir } from '../../games/types';
import { game, startGame } from './machine';
import { scores, lastName, boardRank, addToBoard, ordinal, BOARD_MAX, NAME_MAX } from './scores';

/** The letter grid: three rows of ten, then space, delete and END (two wide) at the end of the last row. */
export const NKEYS: { k: string; r: number; c: number; w: number }[] = [];
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((k, i) => NKEYS.push({ k, r: Math.floor(i / 10), c: i % 10, w: 1 }));
NKEYS.push({ k: ' ', r: 2, c: 6, w: 1 }, { k: 'DEL', r: 2, c: 7, w: 1 }, { k: 'END', r: 2, c: 8, w: 2 });
/** Where each key was last drawn, in tube pixels, for taps. */
export let keyRects: { x: number; y: number; w: number; h: number; i: number }[] = [];

const beep = (freq: number, dur: number, vol: number, slide = 0, delay = 0) => {
  const P = host.platform;
  if (P.sounding) P.tone(freq, dur, vol, slide, delay);
};

export function startEntry(){
  const S = host.S, name = lastName();
  S.mode = 'entry'; host.platform.hideCard();
  S.entry = { name, cur: name ? NKEYS.length - 1 : 0, rank: boardRank(S.score), dir: null, rep: 0, t: 0 };
  host.releaseKeys();
  [784, 988, 1175, 1568].forEach((f, i) => beep(f, 0.09, 0.04, 0, i * 0.09));
}

/** The attract loop. `boardFirst` shows the table first (straight after entry), else the game-over card. */
export function enterOver(boardFirst: boolean){
  const S = host.S;
  S.mode = 'over'; S.overT = 0; S.boardFirst = boardFirst;
  S.showBoard = boardFirst && scores.board.length > 0;
  host.platform.showOverCard(S.level, String(S.score).padStart(6, '0'));
  if (S.showBoard) host.platform.hideCard();
}

export function entryMove(d: Dir){
  const E = host.S.entry, k = NKEYS[E.cur];
  if (d === 'left' || d === 'right') { const n = NKEYS.length; E.cur = (E.cur + (d === 'right' ? 1 : n - 1)) % n; }
  else {
    const r = (k.r + (d === 'down' ? 1 : 2)) % 3, col = Math.min(k.c, 9);
    E.cur = NKEYS.findIndex(q => q.r === r && col >= q.c && col < q.c + q.w);
    if (E.cur < 0) E.cur = NKEYS.findIndex(q => q.r === r && q.c + q.w > 8);
  }
  beep(660, 0.02, 0.03);
}

export function entryType(k: string){
  const E = host.S.entry;
  if (k === 'END') return entryFinish();
  if (k === 'DEL') { if (E.name) { E.name = E.name.slice(0, -1); beep(330, 0.04, 0.04, -80); } return; }
  if (E.name.length >= NAME_MAX || (k === ' ' && !E.name)) { beep(140, 0.08, 0.04); return; }
  E.name += k; beep(1175, 0.03, 0.04);
  if (E.name.length >= NAME_MAX) E.cur = NKEYS.length - 1;   // full: jump to END
}

/** FIRE on the grid: type the key under the cursor. */
export function entryPick(){ entryType(NKEYS[host.S.entry.cur].k); }

export function entryFinish(){
  const S = host.S, rank = addToBoard(S.entry.name, S.score, S.level);
  host.platform.track('high_score', { game: game.id, rank: rank + 1 });
  S.boardHi = rank;
  [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.07, 0.04, 0, i * 0.07));
  enterOver(true);
}

const ARROWS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
/** A key during entry, by its `KeyboardEvent.code`. Returns true when entry used it. */
export function entryKey(code: string){
  if (ARROWS[code]) { entryMove(ARROWS[code]); return true; }
  if (code === 'Space') { entryPick(); return true; }
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Escape') { entryFinish(); return true; }
  if (code === 'Backspace' || code === 'Delete') { entryType('DEL'); return true; }
  const m = /^Key([A-Z])$/.exec(code);
  if (m) { host.S.entry.cur = NKEYS.findIndex(q => q.k === m[1]); entryType(m[1]); return true; }
  return false;
}

/** A tap on the tube, in tube pixels, during entry or while the table shows. Returns true when used. */
export function entryTap(x: number, y: number){
  const S = host.S;
  if (S.mode === 'over' && S.showBoard) { if (S.overT > 0.8) startGame(); return true; }
  if (S.mode !== 'entry') return false;
  const hit = keyRects.find(q => x >= q.x - 1 && x < q.x + q.w + 1 && y >= q.y - 1 && y < q.y + q.h + 1);
  if (hit) { S.entry.cur = hit.i; entryType(NKEYS[hit.i].k); }
  return true;
}

/** The stick moves the cursor once, then repeats while held. */
export function updateEntry(dt: number){
  const E = host.S.entry, dir = host.stickDir;
  E.t += dt; E.rep -= dt;
  if (dir !== E.dir) { E.dir = dir; if (dir) { entryMove(dir); E.rep = 0.4; } }
  else if (dir && E.rep <= 0) { entryMove(dir); E.rep = 0.15; }
}

/** The attract loop: the game-over card and the table take turns (7 s of table in every 12). */
export function updateOver(dt: number){
  const S = host.S;
  S.overT += dt;
  if (!scores.board.length) return;
  const sb = ((S.overT + (S.boardFirst ? 0 : 7)) % 12) < 7;
  if (sb === S.showBoard) return;
  S.showBoard = sb;
  if (sb) host.platform.hideCard(); else host.platform.showOverCard(S.level, String(S.score).padStart(6, '0'));
}

function panel(){
  const { g, col, LW, LH, HUD } = host;
  g.fillStyle = col('bg'); g.fillRect(0, HUD, LW, LH - HUD);
  g.fillStyle = col('hud'); for (let x = 4; x < LW - 4; x += 4) { g.fillRect(x, HUD + 4, 2, 1); g.fillRect(x, LH - 5, 2, 1); }
}

export function drawEntry(){
  const { g, col, txt, LW, LH, HUD } = host, S = host.S, E = S.entry, blink = Math.floor(E.t * 3) % 2 === 0;
  panel();
  const cw = Math.min(24, Math.floor((LW - 12) / 10)), ch = 17, gw = cw * 10;
  const top = HUD + Math.max(10, Math.round((LH - HUD - 158) / 2));
  txt('NEW HIGH SCORE', LW / 2, top, blink ? 'gold' : 'text', 'center', 16);
  txt(`${ordinal(E.rank + 1)}  ${String(S.score).padStart(6, '0')}  L${S.level}`, LW / 2, top + 22, 'hud', 'center');
  // nine name slots with a flashing cursor
  const sw = Math.min(14, Math.floor((LW - 20) / NAME_MAX)), sx = Math.round(LW / 2 - sw * NAME_MAX / 2), sy = top + 40;
  for (let i = 0; i < NAME_MAX; i++) {
    const x = sx + i * sw, ch1 = E.name[i];
    if (ch1 && ch1 !== ' ') txt(ch1, x + sw / 2, sy, 'text', 'center', 16);
    const cursor = i === E.name.length && E.name.length < NAME_MAX;
    if (!cursor || blink) { g.fillStyle = col(cursor ? 'gold' : 'hud'); g.fillRect(x + 2, sy + 17, sw - 4, cursor ? 2 : 1); }
  }
  // the letter grid: stick or arrows to move, FIRE to pick
  const gx = Math.round(LW / 2 - gw / 2), gy = sy + 30;
  keyRects = [];
  NKEYS.forEach((q, i) => {
    const x = gx + q.c * cw, y = gy + q.r * ch, w = q.w * cw - 2, h = ch - 3, on = i === E.cur;
    keyRects.push({ x, y, w, h, i });
    if (on) { g.fillStyle = col('text'); g.fillRect(x, y, w, h); }
    const role = on ? 'bg' : (q.k.length > 1 ? 'hud' : 'text'), cx = Math.round(x + w / 2), cy = y + Math.round(h / 2);
    g.fillStyle = col(role);
    if (q.k === ' ') { g.fillRect(cx - 4, cy + 1, 9, 1); g.fillRect(cx - 4, cy - 1, 1, 2); g.fillRect(cx + 4, cy - 1, 1, 2); }
    else if (q.k === 'DEL') { for (let j = 0; j < 4; j++) g.fillRect(cx - 3 + j, cy - j, 1, j * 2 + 1); g.fillRect(cx + 1, cy - 1, 4, 3); }
    else txt(q.k, cx, cy - 4, role, 'center');
  });
  txt('STICK TO MOVE · FIRE TO PICK', LW / 2, gy + ch * 3 + 6, 'textDim', 'center');
}

export function drawBoard(){
  const { txt, LW, LH, HUD } = host, S = host.S, board = scores.board;
  panel();
  const blink = Math.floor(S.overT * 4) % 2 === 0, AH = LH - HUD;
  const rh = Math.max(11, Math.min(15, Math.floor((AH - 62) / BOARD_MAX))), wide = LW >= 300;
  const top = HUD + Math.max(10, Math.round((AH - (42 + rh * BOARD_MAX + 18)) / 2));
  txt('HIGH SCORES', LW / 2, top, 'text', 'center', 16);
  const bw = Math.min(LW - 20, wide ? 240 : 200), x0 = Math.round(LW / 2 - bw / 2), y0 = top + 30;
  for (let i = 0; i < BOARD_MAX; i++) {
    const e = board[i], y = y0 + i * rh, hi = i === S.boardHi;
    if (hi && !blink) continue;
    const role = hi ? 'gold' : i < 3 ? 'text' : 'hud';
    txt(ordinal(i + 1), x0 + 24, y, role, 'right');
    txt(e ? e.n : '.........', x0 + 34, y, e ? role : 'textDim');
    if (wide) txt(e ? 'L' + e.l : '', x0 + bw - 58, y, role, 'right');
    txt(e ? String(e.s).padStart(6, '0') : '------', x0 + bw, y, e ? role : 'textDim', 'right');
  }
  if (Math.floor(S.overT * 2) % 2 === 0) txt('PRESS FIRE TO ' + game.verb, LW / 2, y0 + rh * BOARD_MAX + 8, 'hud', 'center');
}

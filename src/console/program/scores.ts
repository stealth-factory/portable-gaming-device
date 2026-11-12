/* Scores: each game keeps its own best and top-ten table on this device (GAM-39).

   Part of the console program, so it reaches storage only through `host.platform.store`. The keys are
   kept from before the rename (`gg-best-<id>`, `gg-board-<id>`, `gg-name`) so nobody loses a score, and
   Tunnel Raider still reads the standalone game's `eb-best`, `tr-board` and `tr-name` once. */
import { host } from './host';

export const BOARD_MAX = 10, NAME_MAX = 9;
export interface BoardEntry { n: string; s: number; l: number }

const bestKey = (id: string) => 'gg-best-' + id, boardKey = (id: string) => 'gg-board-' + id;
const OLD_KEYS: Record<string, { best: string; board: string }> = { tunnel: { best: 'eb-best', board: 'tr-board' } };
const get = (k: string) => host.platform.store.get(k);
const set = (k: string, v: string) => host.platform.store.set(k, v);

export const cleanName = (v: unknown) => String(v || '').toUpperCase().replace(/[^A-Z ]/g, '').slice(0, NAME_MAX);
export const ordinal = (n: number) => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

/** A game's table as stored, cleaned up: bad rows dropped, names tidied, best first, at most ten. */
export function readBoard(id: string): BoardEntry[] {
  const raw = get(boardKey(id)) ?? (OLD_KEYS[id] ? get(OLD_KEYS[id].board) : null);
  try {
    const b = JSON.parse(raw || '[]');
    if (Array.isArray(b)) return b.filter(e => e && Number.isFinite(e.s) && e.s > 0).map(e => ({ n: cleanName(e.n).trim() || 'RAIDER', s: Math.floor(e.s), l: Math.max(1, e.l | 0) })).sort((a, b) => b.s - a.s).slice(0, BOARD_MAX);
  } catch (_) {}
  return [];
}

const bestCache: Record<string, number> = {};
/** A game's best: the stored best or the top of its table, whichever is higher. */
export function readBest(id: string){
  if (bestCache[id] != null) return bestCache[id];
  const raw = get(bestKey(id)) ?? (OLD_KEYS[id] ? get(OLD_KEYS[id].best) : null);
  const b = readBoard(id);
  return (bestCache[id] = Math.max(parseInt(raw || '0', 10) || 0, b.length ? b[0].s : 0));
}

/** The loaded game's scores. `best` is live: games raise it as they play (`api.best`). */
export const scores = { id: '', best: 0, board: [] as BoardEntry[] };
let name: string | null = null;
/** The last name typed on this device, offered first next time. */
export function lastName(){ return name ??= cleanName(get('gg-name') ?? get('tr-name')); }

export function loadScores(id: string){ scores.id = id; scores.board = readBoard(id); scores.best = readBest(id); }
export function saveBest(){ if (!scores.id) return; bestCache[scores.id] = scores.best; set(bestKey(scores.id), String(scores.best)); }

/** Where a score would go in the table; ties go below the older score. */
export const boardRank = (sc: number) => { const i = scores.board.findIndex(e => sc > e.s); return i < 0 ? scores.board.length : i; };
export const qualifies = (sc: number) => sc > 0 && boardRank(sc) < BOARD_MAX;

/** Put a finished game in the table and remember the name. Returns its place, from 0. */
export function addToBoard(entryName: string, score: number, level: number){
  const n = cleanName(entryName).trim() || 'RAIDER', rank = boardRank(score);
  scores.board.splice(rank, 0, { n, s: score, l: level });
  scores.board = scores.board.slice(0, BOARD_MAX);
  name = n;
  set(boardKey(scores.id), JSON.stringify(scores.board)); set('gg-name', n);
  return rank;
}

/** After the player wiped this device's scores: forget what was read, then read the loaded game again. */
export function forgetScores(){
  for (const id of Object.keys(bestCache)) delete bestCache[id];
  name = '';
  if (scores.id) loadScores(scores.id);
}

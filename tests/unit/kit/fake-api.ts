/* A stand-in ConsoleAPI for kit tests: records drawing, text, tones and cleared presses, and holds a plain S. */
import type { ButtonState, ConsoleAPI, Dir } from '../../../src/games/types';

export type Rect = { x: number; y: number; w: number; h: number; style: string };
export type Text = { s: string; x: number; y: number; role?: string; align?: string };

export function fakeApi(over: { LW?: number; LH?: number; HUD?: number } = {}){
  const rects: Rect[] = [], texts: Text[] = [], tones: number[][] = [], cleared: string[] = [];
  const buttons: Record<string, ButtonState> = {};
  const g = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number){ rects.push({ x, y, w, h, style: String(this.fillStyle) }); } };
  const S = { mode: 'play', modeT: 0, time: 0, score: 0, level: 1, lives: 3, nextLife: 20000 };
  const state = { finished: 0, held: [] as Dir[], stickDir: null as Dir | null, tapQueued: false };
  const api = {
    g, LW: over.LW ?? 320, LH: over.LH ?? 200, HUD: over.HUD ?? 18, S, best: 0,
    col: (role: string) => 'c:' + role,
    txt: (s: string, x: number, y: number, role?: string, align?: string) => { texts.push({ s, x, y, role, align }); },
    tone: (...a: number[]) => { tones.push(a); },
    finishGame: () => { state.finished++; },
    get held(){ return state.held; },
    get stickDir(){ return state.stickDir; },
    get tapQueued(){ return state.tapQueued; },
    button: (id: string) => buttons[id] ?? { label: id, enabled: true, queued: false, held: false },
    clearButton: (id: string) => { cleared.push(id); if (buttons[id]) buttons[id].queued = false; },
    clearTap: () => { cleared.push('tap'); state.tapQueued = false; },
  } as unknown as ConsoleAPI & { S: typeof S };
  const press = (id: string) => { buttons[id] = { label: id, enabled: true, queued: true, held: true }; };
  /** The set of pixels drawn in a style, as "x,y" strings. */
  const pixels = (style: string) => new Set(rects.filter(r => r.style === style).map(r => `${r.x},${r.y}`));
  const reset = () => { rects.length = 0; texts.length = 0; tones.length = 0; cleared.length = 0; };
  return { api, S, rects, texts, tones, cleared, state, press, pixels, reset };
}

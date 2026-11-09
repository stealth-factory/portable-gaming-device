/* Points, the best score and extra lives. Writes the console's shared state (`S.score`, `S.lives`,
   `S.nextLife`) and `api.best`, so the console and the game agree. */
import type { Fx, PopOpts } from './fx';
import { shared } from './types';
import type { ConsoleAPI } from './types';

export interface ScoreOpts {
  /** An extra life every this many points. */
  extraEvery: number;
  /** Never more lives than this (no limit by default). */
  maxLives?: number;
  /** Where to float the points when `add` is given a place. */
  fx?: Fx;
  pop?: PopOpts;
  /** The game's own fanfare for an extra life. */
  onExtra?: () => void;
}
export interface Score {
  /** Score 0, the first extra life at `extraEvery`. */
  reset(): void;
  /** Add points; with (x, y), float them there. */
  add(n: number, x?: number, y?: number): void;
  readonly nextLife: number;
}

export function makeScore(api: ConsoleAPI, opts: ScoreOpts): Score {
  const S = () => shared(api);
  return {
    reset(){ S().score = 0; S().nextLife = opts.extraEvery; },
    add(n, x, y){
      const s = S();
      s.score += n;
      if (s.score > api.best) api.best = s.score;
      if (s.score >= s.nextLife) {
        s.nextLife += opts.extraEvery;
        if (opts.maxLives == null || s.lives < opts.maxLives) s.lives++;
        opts.onExtra?.();
      }
      if (x != null && y != null) opts.fx?.pop(String(n), x, y, opts.pop);
    },
    get nextLife(){ return S().nextLife; },
  };
}

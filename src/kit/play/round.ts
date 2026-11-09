/* The round sequence every game runs: ready → play → dying or clear → ready again. The kit runs the
   timers and the shared state (`S.mode`, `S.modeT`, `S.level`, `S.lives`); the game draws its own banners. */
import { shared } from './types';
import type { ConsoleAPI } from './types';

export type Phase = 'ready' | 'play' | 'dying' | 'clear';
export interface RoundTimes { ready?: number; respawn?: number; dying?: number; clear?: number }
export interface RoundHooks {
  /** A life lost but lives remain: reset the player, keep the field. */
  respawn(): void;
  /** The level is won: build the next one (`S.level` has already gone up). */
  nextLevel(): void;
  /** Seconds for each phase. Defaults: ready 1.2, respawn (ready after a lost life) 0.9, dying 1.4, clear 1.8. */
  times?: RoundTimes;
  /** Button slots whose presses are dropped during `ready`, so a press on the banner doesn't fire on the
      first frame of play. Default ['fire']. Taps are always dropped. */
  clearOnReady?: readonly string[];
}
export interface Round {
  /** Run the mode timers. True when the game should run its play logic this step. */
  tick(dt: number): boolean;
  /** A life lost. `fatal` ends the game whatever the count (the line has fallen); `secs` overrides the dying time. */
  lose(opts?: { fatal?: boolean; secs?: number }): void;
  /** The level is won; `secs` overrides the clear time. */
  clear(opts?: { secs?: number }): void;
  readonly phase: Phase | null;
}

export function makeRound(api: ConsoleAPI, hooks: RoundHooks): Round {
  const t = { ready: 1.2, respawn: 0.9, dying: 1.4, clear: 1.8, ...hooks.times };
  const slots = hooks.clearOnReady ?? ['fire'];
  return {
    tick(dt){
      const S = shared(api);
      if (S.mode === 'ready') {
        if ((S.modeT -= dt) <= 0) S.mode = 'play';
        for (const id of slots) api.clearButton(id);
        api.clearTap();
        return false;
      }
      if (S.mode === 'clear') {
        if ((S.modeT -= dt) <= 0) { S.level++; hooks.nextLevel(); S.mode = 'ready'; S.modeT = t.ready; }
        return false;
      }
      if (S.mode === 'dying') {
        if ((S.modeT -= dt) > 0) return false;
        if (S.lives > 0) { hooks.respawn(); S.mode = 'ready'; S.modeT = t.respawn; }
        else api.finishGame();
        return false;
      }
      return S.mode === 'play';
    },
    lose(o = {}){
      const S = shared(api);
      S.lives = o.fatal ? 0 : S.lives - 1;
      S.mode = 'dying'; S.modeT = o.secs ?? t.dying;
    },
    clear(o = {}){
      const S = shared(api);
      S.mode = 'clear'; S.modeT = o.secs ?? t.clear;
    },
    get phase(){
      const m = shared(api).mode;
      return m === 'ready' || m === 'play' || m === 'dying' || m === 'clear' ? m : null;
    },
  };
}

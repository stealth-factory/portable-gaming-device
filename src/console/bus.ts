/* A tiny store shared by the console engine and the React islands on the page.
   The engine writes (language, whose instructions to show); islands read with useSyncExternalStore.
   It lives on globalThis so the engine's bundle and an island's bundle always share one copy. */

export interface ConsoleState {
  /** 'en' | 'zh-hant' | 'zh-hans' */
  lang: string;
  /** Whose instructions the leaflet shows: 'console', or a disk id. */
  manual: string;
  /** The console's model code and full name (src/console/brand.ts), which a framing app can change. */
  model: string;
  name: string;
}

type Bus = {
  get(): ConsoleState;
  set(patch: Partial<ConsoleState>): void;
  subscribe(fn: () => void): () => void;
};

function makeBus(): Bus {
  let state: ConsoleState = { lang: 'en', manual: 'console', model: 'PGD-01', name: 'PGD-01 Portable Gaming Device' };
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch){
      const next = { ...state, ...patch };
      if ((Object.keys(next) as (keyof ConsoleState)[]).every(k => next[k] === state[k])) return;
      state = next; subs.forEach(f => f());
    },
    subscribe(fn){ subs.add(fn); return () => { subs.delete(fn); }; },
  };
}

const KEY = '__ggBus' as const;
type GlobalWithBus = typeof globalThis & { [KEY]?: Bus };
export const bus: Bus = ((globalThis as GlobalWithBus)[KEY] ??= makeBus());

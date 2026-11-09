/* Haptics: short buzzes on phones that can vibrate. The rules live here (named patterns, the SOUND-off rule,
   and which buzz wins when two overlap); the console core supplies the hardware call, the SOUND switch's
   state and a clock. Games reach it through `api.buzz()`. No browser objects are touched in this file. */

/** The console's named buzzes. */
export type HapticName = 'tick' | 'fire' | 'pickup' | 'lose' | 'over';
/** A named buzz, a length in milliseconds, or a pattern: buzz, pause, buzz … in milliseconds. */
export type Haptic = HapticName | number | readonly number[];

export const PATTERNS: Readonly<Record<HapticName, readonly number[]>> = {
  /** The set's own controls: a key, a rocker, a click of the dial. */
  tick: [8],
  /** A shot leaves the barrel. */
  fire: [14],
  /** A pickup is caught: a quick double buzz. */
  pickup: [22, 45, 22],
  /** A life is lost. */
  lose: [160],
  /** The game is over. */
  over: [260, 90, 320],
};

/** No single step longer than this, and no more steps than this, so a game can't leave the phone buzzing. */
export const MAX_STEP = 1000, MAX_STEPS = 9;

/** The pattern for a buzz, tidied: whole milliseconds from 0 to MAX_STEP, at most MAX_STEPS steps, ending on a
    buzz. Null when there is nothing to feel (an unknown name, zero, or an empty pattern). */
export function toPattern(h: Haptic): number[] | null {
  const raw = typeof h === 'string' ? PATTERNS[h as HapticName] : typeof h === 'number' ? [h] : h;
  if (!raw) return null;
  const p = raw.slice(0, MAX_STEPS).map(v => (Number.isFinite(v) ? Math.max(0, Math.min(MAX_STEP, Math.round(v))) : 0));
  if (p.length % 2 === 0) p.pop();                      // a trailing pause does nothing
  return p.some((v, i) => i % 2 === 0 && v > 0) ? p : null;
}
/** How long a pattern runs, in milliseconds. */
export const patternLength = (p: readonly number[]) => p.reduce((a, b) => a + b, 0);

export interface HapticsDeps {
  /** Play a pattern on the hardware. Returns false (or throws) where it can't. */
  vibrate(pattern: number[]): boolean | void;
  /** Whether buzzes are on: the console ties this to the SOUND switch. */
  enabled(): boolean;
  /** Milliseconds from any fixed point. */
  now(): number;
}
export interface Haptics {
  /** Buzz, if buzzes are on and nothing longer is still running. True if the hardware took it. */
  buzz(h: Haptic): boolean;
}

/** A new hardware call replaces whatever is buzzing, so a short buzz never cuts off a longer one that has
    more time left to run than the new one would take: a shot's tick doesn't swallow a lost life. */
export function makeHaptics(deps: HapticsDeps): Haptics {
  const state = { until: 0 };
  return {
    buzz(h){
      if (!deps.enabled()) return false;
      const p = toPattern(h);
      if (!p) return false;
      const now = deps.now(), len = patternLength(p);
      if (now + len < state.until) return false;
      let ok: boolean | void = false;
      try { ok = deps.vibrate(p); } catch (_) { ok = false; }
      if (ok === false) return false;
      state.until = now + len;
      return true;
    },
  };
}

/* Things that fall for the player to catch (Invader Force's capsules), and the timers for what they give. */
import { overlaps } from './collide';
import type { Box, ConsoleAPI } from './types';

export type Pickup<K> = { kind: K; x: number; y: number };
export interface PickupOpts<K> {
  size: { w: number; h: number };
  /** Fall speed (px/s). */
  speed: number;
  /** No more than this many falling at once. */
  max: number;
  /** Draw one (top-left at x, y). */
  draw: (kind: K, x: number, y: number) => void;
  /** Off the field once its top passes this y. Default the tube's height. */
  floor?: () => number;
}
export interface Pickups<K> {
  /** Drop one with its top-left at (x, y), if fewer than `max` are falling (or always, with `force`:
      Invader Force's saucer always drops one). Returns whether it dropped. */
  drop(x: number, y: number, kind: K, force?: boolean): boolean;
  /** Fall, catch against the catcher's box (touching from above counts), drop off the floor. Returns what was caught. */
  update(dt: number, catcher: Box | null): K[];
  /** Remove and return every pickup overlapping a box (a bomb set one off). */
  take(box: Box): Pickup<K>[];
  /** Remove one (it was shot, or went off). */
  remove(p: Pickup<K>): void;
  draw(): void;
  clear(): void;
  readonly falling: number;
  readonly list: readonly Pickup<K>[];
}

export function makePickups<K>(api: ConsoleAPI, o: PickupOpts<K>): Pickups<K> {
  let list: Pickup<K>[] = [];
  const { w, h } = o.size;
  const box = (p: Pickup<K>): Box => ({ x: p.x, y: p.y, w, h });
  const floor = o.floor ?? (() => api.LH);
  return {
    drop(x, y, kind, force = false){
      if (!force && list.length >= o.max) return false;
      list.push({ kind, x, y });
      return true;
    },
    update(dt, catcher){
      const caught: K[] = [];
      for (const p of list) p.y += o.speed * dt;
      list = list.filter(p => {
        // like Invader Force's catches(): sides must overlap, a pickup resting on the catcher's top counts
        if (catcher && p.x + w > catcher.x && p.x < catcher.x + catcher.w && p.y + h >= catcher.y && p.y < catcher.y + catcher.h) {
          caught.push(p.kind); return false;
        }
        return p.y <= floor();
      });
      return caught;
    },
    take(b){
      const hit = list.filter(p => overlaps(box(p), b));
      list = list.filter(p => !hit.includes(p));
      return hit;
    },
    remove(p){ list = list.filter(q => q !== p); },
    draw(){ for (const p of list) o.draw(p.kind, p.x, p.y); },
    clear(){ list = []; },
    get falling(){ return list.length; },
    get list(){ return list; },
  };
}

/** Does something drop? `rand` is 0..1; nothing drops while `falling` has reached `max`. */
export const roll = (rand: number, chance: number, falling: number, max: number) => falling < max && rand < chance;
/** Pick from a pool by `rand` (0..1), leaving out `exclude` (what the player already has). */
export function pickFrom<K>(pool: readonly K[], rand: number, exclude?: K): K {
  const p = exclude === undefined ? pool : pool.filter(k => k !== exclude);
  return p[Math.min(p.length - 1, Math.floor(rand * p.length))];
}

export type TimerState = 'idle' | 'running' | 'expired';
/** One timed power-up (a 12-second weapon). `tick` reports 'expired' on the step it runs out. */
export interface Timer { set(secs: number): void; tick(dt: number): TimerState; stop(): void; readonly left: number; frac(total: number): number }
export function makeTimer(): Timer {
  let left = 0;
  return {
    set(secs){ left = secs; },
    tick(dt){
      if (left <= 0) return 'idle';
      left -= dt;
      if (left > 0) return 'running';
      left = 0; return 'expired';
    },
    stop(){ left = 0; },
    get left(){ return left; },
    frac: total => (total > 0 ? Math.max(0, Math.min(1, left / total)) : 0),
  };
}
/** A power-up that stacks up to `max` levels on one shared clock of `secs`, reset by every bump (the speed boost). */
export interface Stack { bump(): number; tick(dt: number): TimerState; stop(): void; readonly level: number; readonly left: number }
export function makeStack(max: number, secs: number): Stack {
  let level = 0, left = 0;
  return {
    bump(){ level = Math.min(max, level + 1); left = secs; return level; },
    tick(dt){
      if (!level) return 'idle';
      left -= dt;
      if (left > 0) return 'running';
      level = 0; left = 0; return 'expired';
    },
    stop(){ level = 0; left = 0; },
    get level(){ return level; },
    get left(){ return left; },
  };
}

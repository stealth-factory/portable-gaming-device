/* The disk launcher (GAM-32): the cover carousel. `program/loader.ts` calls these where it used to call the old menu's
   enterMenu, updateMenu, drawMenu, menuKey and menuTap. DOM-free: everything comes through the ConsoleAPI and the
   LauncherSystem, so the native apps can run it as their built-in system disk. */
import type { ConsoleAPI, Dir } from '../../games/types';
import type { LauncherSystem } from './system';
import { initState, move, bringToFront, update, tap, stepOf, type LauncherState, type Target } from './state';
import { launcherLayout } from './layout';
import { drawLauncher } from './draw';

export type { LauncherSystem, DiskState } from './system';

const MOVE_KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
const LOAD_KEYS = ['Space', 'Enter', 'NumpadEnter', 'KeyZ', 'KeyX'];

export interface Launcher {
  /** Open the box at a disk (the last one loaded, or what the caller remembers). */
  enter(sel?: number): void;
  update(dt: number, stick: Dir | null): void;
  draw(notice?: string | null): void;
  /** A key by `code`; true when the launcher used it. */
  key(code: string): boolean;
  /** A tap in low-res pixels. */
  tap(x: number, y: number): void;
  /** The disk at the front. */
  readonly sel: number;
  /** Where a tap lands on the tube now (for the browser tests). */
  targets(): Target[];
}

export function createLauncher(api: ConsoleAPI, sys: LauncherSystem): Launcher {
  let s: LauncherState = initState(sys.disks().length);
  const layout = () => launcherLayout(api.LW, api.LH, s.n, s.sel);
  const moved = (next: LauncherState) => { if (next.sel !== s.sel) { sys.tick(); sys.seek(); } s = next; };
  const load = (i: number) => { s = bringToFront(s, i); sys.load(i); };
  return {
    enter(sel?: number){
      const disks = sys.disks(), last = sys.lastDiskId();
      const i = sel ?? Math.max(0, disks.findIndex(d => d.id === last));
      s = initState(disks.length, i);
    },
    update(dt, stick){
      if (s.n !== sys.disks().length) s = initState(sys.disks().length, s.sel);
      const r = update(s, stick, dt);
      if (r.moves) { sys.tick(); sys.seek(); }
      s = r.state;
    },
    draw(notice){ drawLauncher(api, layout(), s, sys, notice); },
    key(code){
      if (MOVE_KEYS[code]) { moved(move(s, stepOf(MOVE_KEYS[code]))); return true; }
      if (LOAD_KEYS.includes(code)) { if (s.n) load(s.sel); return true; }
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m && +m[1] <= s.n) { load(+m[1] - 1); return true; }
      return false;
    },
    tap(x, y){
      const r = tap(s, layout().targets, x, y);
      if (!r) return;
      if (r.kind === 'load') load(r.i); else moved(bringToFront(s, r.i));
    },
    get sel(){ return s.sel; },
    targets(){ return layout().targets; },
  };
}

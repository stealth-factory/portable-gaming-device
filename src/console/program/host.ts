/* The loader's view of the console, while the console program is being split out of core.ts (GAM-39).

   loader.ts must not import core.ts: the loader only needs this surface, and core binds it once,
   at the end of its own module, before any screen runs. Values that change later (the tube size,
   the loaded disk) are getters, so each read sees the current one.

   Everything that belongs to the machine (sound, storage, the clock, the cards over the tube) comes
   through `host.platform` (see platform.ts). What is left here is the web console's picture and input,
   which stay in core.ts: the low-res buffer and its drawing, the tube's size and quirks, the stick and
   held keys. The mode machine, the loaded game and the api are in this folder (machine.ts, api.ts). */
import type { ConsoleAPI, Dir } from '../../games/types';
import type { Platform } from './platform';

export interface ConsoleHost {
  readonly platform: Platform;
  /** The console's state bag (machine.ts), untyped: each game owns its own fields. */
  readonly S: any;
  readonly g: CanvasRenderingContext2D;
  col(role: string): string;
  txt(s: string, x: number, y: number, role: string, align?: 'left' | 'center' | 'right', size?: number): void;
  readonly LW: number;
  readonly LH: number;
  /** The status bar's height at the top of the tube; the console's own panels draw below it. */
  readonly HUD: number;
  readonly stickDir: Dir | null;
  readonly tvOn: boolean;
  readonly age: { dipLeft: number };
  setAccReset(): void;
  clearInput(): void;
  /** Let go of the arrow keys and WASD held down, as the screen changes under them. */
  releaseKeys(): void;
  /** The api games get, made by makeConsoleAPI (api.ts) over core's picture and input. */
  readonly api: ConsoleAPI;
}

/** Filled by bindHost. Reading a field before that throws, which is what an unbound seam should do. */
export const host = {} as ConsoleHost;

/** Copy the console's surface onto `host`, including getters. A later call replaces the same keys. */
export function bindHost(spec: ConsoleHost): void {
  for (const key of Object.keys(spec) as (keyof ConsoleHost)[]) {
    const desc = Object.getOwnPropertyDescriptor(spec, key);
    if (desc) Object.defineProperty(host, key, desc);
  }
}

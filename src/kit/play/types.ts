/* Types every kit module shares. */
import type { ConsoleAPI, Role } from '../../games/types';

export type { ConsoleAPI, Role };
/** A box in low-res screen pixels: top-left corner, width and height. */
export type Box = { x: number; y: number; w: number; h: number };
/** Pixel art as rows of text: '#' is ink, anything else is see-through (multi-colour sprites map more characters). */
export type Sprite = string[];
/** A colour role, or one that changes with time (a blink). */
export type RoleOf = Role | ((t: number) => Role);

/** The fields of the console's shared state (`api.S`) the kit reads and writes. `S` is untyped on
    `ConsoleAPI` until WII-42 types it, so the kit names only what it owns. */
export interface SharedState {
  mode: string;
  modeT: number;
  time: number;
  score: number;
  level: number;
  lives: number;
  nextLife: number;
}
export const shared = (api: ConsoleAPI): SharedState => api.S as SharedState;

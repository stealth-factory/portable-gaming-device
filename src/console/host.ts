/* The loader's view of the console.

   loader.ts must not import core.ts. A strict program follows imports, and core is still loose
   (it is the last module to tighten, and it wants splitting first). core binds this object once,
   at the end of its own module, before any screen runs. Values that change later (the tube size,
   the audio context, the loaded disk) are getters, so each read sees the current one. Read one of
   those after a call that may have changed it (ensureAudio creates the context); a local copy
   taken before that call stays stale. */
import type { ConsoleAPI, GameDisk } from '../games/types';

export interface ConsoleHost {
  /** The console's state bag. Still untyped: core owns the fields, the loader only reads and writes them. */
  readonly S: any;
  readonly g: CanvasRenderingContext2D;
  col(role: string): string;
  txt(s: string, x: number, y: number, role: string, align?: 'left' | 'center' | 'right', size?: number): void;
  readonly LW: number;
  readonly LH: number;
  readonly ac: AudioContext | null;
  readonly muted: boolean;
  tone(freq: number, dur: number, vol?: number, slide?: number, delay?: number): void;
  noise(): AudioBufferSourceNode;
  headClick(t: number, vol?: number, freq?: number): void;
  out(): GainNode;
  ensureAudio(): void;
  readonly stickDir: string | null;
  readonly overlay: HTMLElement;
  $(id: string): HTMLElement | null;
  readonly tvOn: boolean;
  readonly age: { dipLeft: number };
  setAccReset(): void;
  track(name: string, data?: Record<string, string | number | boolean | null>): void;
  layoutName(): string;
  startGame(): void;
  setGame(disk: GameDisk | null): void;
  readonly game: GameDisk;
  readBest(id: string): number;
  readBoard(id: string): { n: string; s: number; l: number }[];
  readonly reduceMotion: boolean;
  setManual(ctx: string): void;
  clearInput(): void;
  readonly api: ConsoleAPI;
  fetchRuntime(disk: GameDisk): Promise<unknown>;
  runtimeReady(id: string): boolean;
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

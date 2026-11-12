/* PGD for React: the console in another React app (GAM-64).
   <PGDConsole> shows a PGD deployment in an iframe and drives it through the embed bridge
   (src/console/embed.ts). This file is also the bridge's protocol, so both sides share one set of types. */
import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';

/** Instructions languages. */
export type PGDLang = 'en' | 'zh-hant' | 'zh-hans';
/** The phosphor dial's settings (`MODE_ORDER` in src/kit/platform/palettes.ts). */
export type PGDPhosphor = 'greenP1' | 'greenP39' | 'radarP7' | 'amberP3' | 'whiteP4' | 'cga1' | 'cga0' | (string & {});
/** What the console is doing (`S.mode`). */
export type PGDMode = 'off' | 'boot' | 'menu' | 'load' | 'ready' | 'play' | 'dying' | 'clear' | 'paused' | 'entry' | 'over' | (string & {});

/** One disk in the box. */
export interface PGDDisk {
  id: string;
  slug: string;
  title: string;
  genre: string;
  players: number | string;
  /** Inserted by the page (insertDisk or the `disks` prop), not one of the console's own. */
  added: boolean;
}

/** A game an AI harness (or anyone) made, to put in the box. The shapes are a .pgdisk file's (tools/disks/README.md):
    `disk` is disk.js, a plain script defining the global `PGDDisk` (the disk is `PGDDisk.disk`, with at least `id`
    and `drawLoad`; the rest has defaults), and `game` is game.js, a plain script defining `PGDGame` (`PGDGame.create(api)`).
    Or send `pgdisk`, the bytes of a whole .pgdisk file. */
export interface PGDDiskSource {
  /** disk.js source. */
  disk?: string;
  /** game.js source. Leave it out to send the game only when the player loads the disk (see `PGDCustomDisk.game`). */
  game?: string;
  /** A .pgdisk file's bytes, in place of `disk` and `game`. */
  pgdisk?: ArrayBuffer | Uint8Array;
  /** The launcher cover and flipbook, in the generated cover.ts / preview.ts shapes. Optional: without one the
      launcher shows the title on a floppy label. */
  cover?: { w: number; h: number; data: string };
  preview?: { w: number; h: number; fps: number; frames: string[] };
}

/** A disk for the `disks` prop. `game` may be a function: it's called when the player loads the disk from the menu,
    while the drive reads, and its answer (game.js source) is the game. */
export interface PGDCustomDisk extends Omit<PGDDiskSource, 'game'> {
  game?: string | ((id: string) => string | Promise<string>);
}

/** The console's state, sent whenever any of it changes (score, level and lives at most four times a second). */
export interface PGDState {
  power: boolean;
  mode: PGDMode;
  /** The loaded disk's id, or null on the boot screen and the disk menu. */
  game: string | null;
  score: number;
  level: number;
  lives: number;
  lang: PGDLang;
  phosphor: PGDPhosphor;
  sound: boolean;
}

/** Sent once the console has started inside the frame. */
export interface PGDReady {
  /** The console's release (package.json version). */
  version: string;
  /** Changes each time the page in the frame loads (a reload starts with only the console's own disks). */
  session: string;
  disks: PGDDisk[];
  phosphors: PGDPhosphor[];
  langs: PGDLang[];
}

/** An event the console tracks (the same names and fields as its analytics: game_start, game_over, high_score …). */
export type PGDEventData = Record<string, string | number | boolean | null>;

/** Messages from the console to the page. */
export type PGDMessage =
  | { pgd: 1; type: 'ready'; ready: PGDReady }
  | { pgd: 1; type: 'state'; state: PGDState }
  | { pgd: 1; type: 'event'; name: string; data?: PGDEventData }
  /** The answer to a command that carried a `request` number (insert). */
  | { pgd: 1; type: 'reply'; request: number; ok: boolean; error?: string; disk?: PGDDisk }
  /** How tall the page in the frame is, and which layout it picked (desk, phone-portrait, tablet-portrait, console). */
  | { pgd: 1; type: 'size'; height: number; layout: string }
  /** A disk inserted without its game was loaded: send the game with `{ command: 'game', request, game }`. */
  | { pgd: 1; type: 'need'; request: number; id: string };

/** Commands from the page to the console. */
export type PGDCommand =
  /** Ask for the ready message and the state again (the component sends this when it mounts). */
  | { command: 'hello' }
  | { command: 'power'; on?: boolean }
  | { command: 'reset' }
  | { command: 'menu' }
  | { command: 'load'; game: string }
  | { command: 'phosphor'; phosphor: PGDPhosphor }
  | { command: 'lang'; lang: PGDLang }
  | { command: 'sound'; on: boolean }
  | { command: 'pause'; on: boolean }
  /** Put a disk in the box (or replace one inserted earlier with the same id); `boot` loads it at once.
      Only the console's own origin, localhost and the build's PUBLIC_PGD_EMBED_ORIGINS may insert. */
  | { command: 'insert'; disk: PGDDiskSource; boot?: boolean; request?: number }
  /** The answer to a `need` message: the game.js source, or why there isn't one. */
  | { command: 'game'; request: number; game?: string; error?: string };

/** A command as posted to the frame. */
export type PGDCommandMessage = { pgd: 1; type: 'command' } & PGDCommand;

export interface PGDConsoleProps {
  /** Where a PGD build is served, e.g. `https://pgd.example.com` or `/pgd` for a copy under your own site. */
  src: string;
  /** A disk id or slug to boot straight into on the first power-on. Changing it later loads that disk (a warm boot). */
  game?: string;
  /** Switch the set on (true) or off (false). Leave it out to let the player use the POWER switch. */
  power?: boolean;
  lang?: PGDLang;
  phosphor?: PGDPhosphor;
  /** The SOUND switch. */
  sound?: boolean;
  /** HOLD: pause a game in progress (true) or carry on (false). Set to true with no game running, it pauses the next game as it starts. */
  paused?: boolean;
  /** Games to put in the box, beside the console's own. They're on the disk menu like any other; loading one fetches
      its game (calling `game` when it's a function). Sent when the console is ready and again whenever the array changes. */
  disks?: PGDCustomDisk[];
  /** Show the page around the set too: the header, the instructions bar and leaflet. Default false: just the set. */
  chrome?: boolean;
  /** The frame's accessible name. Default "PGD-01 Portable Gaming Device". */
  title?: string;
  className?: string;
  /** The frame's style. Without a `height`, the frame takes the set's height on the desk layout, and a 6:5 box on
      the others (the upright and sideways layouts fill whatever box they're given). */
  style?: CSSProperties;
  onReady?: (ready: PGDReady) => void;
  onStateChange?: (state: PGDState) => void;
  /** Every event the console tracks: `game_load`, `game_start`, `game_over`, `high_score`, `power_on`, `reset` … */
  onEvent?: (name: string, data: PGDEventData | undefined) => void;
  /** A game ended: the disk's id and the final score. */
  onGameOver?: (result: { game: string; score: number }) => void;
  /** An inserted disk failed: `stage` is insert (bad disk.js, not allowed, or a cover or preview that threw), load (bad game.js, or drawLoad or create threw) or run (it threw while playing). */
  onDiskError?: (error: { game: string | null; stage: 'insert' | 'load' | 'run'; message: string }) => void;
}

/** Drive the console from code: `const pgd = useRef<PGDConsoleHandle>(null)`. */
export interface PGDConsoleHandle {
  /** Switch on or off; with no argument, flip the switch. */
  power(on?: boolean): void;
  /** RESET: the cold boot, then the disk menu. */
  reset(): void;
  /** SELECT: leave the game for the disk menu (a warm boot). */
  menu(): void;
  /** Load a disk by id or slug (switches the set on if it's off). */
  load(game: string): void;
  /** Put a disk in the box; resolves with it once it's there, rejects with the reason it isn't. */
  /** Rejects if the console refuses the disk, reloads before answering, or the component unmounts. */
  insertDisk(disk: PGDCustomDisk, options?: { boot?: boolean }): Promise<PGDDisk>;
  /** Send any bridge command. */
  send(command: PGDCommand): void;
  /** Give the console keyboard focus (the frame needs it for the arrow keys, Space and the rest). */
  focus(): void;
  /** The latest state, or null before the console is ready. */
  readonly state: PGDState | null;
  readonly iframe: HTMLIFrameElement | null;
}

/** The PGD console, in an iframe. Safe to server-render: the frame only talks to the console once it's in the browser. */
export declare const PGDConsole: ForwardRefExoticComponent<PGDConsoleProps & RefAttributes<PGDConsoleHandle>>;

/** The frame's address for a PGD build: `src` plus the embed flags. Exported for apps that make the iframe themselves. */
export declare function embedUrl(src: string, options?: { game?: string; lang?: PGDLang; chrome?: boolean }): string;

/** Whether a posted message is from the PGD bridge. */
export declare function isPGDMessage(data: unknown): data is PGDMessage;

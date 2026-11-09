/* The plug-in contract between the console and its games.

   A game is a folder in src/games/ with two modules:
   - disk.ts  exports `disk: GameDisk`: the label, loading screen, instructions and strings. Small, loaded up front
              so the menu and the loading screen can show before the game itself arrives.
   - game.ts  default-exports `create(api) => GameRuntime`: the game. Downloaded while the drive "reads" the disk.

   Neither may import from src/console: everything a game needs comes through the ConsoleAPI it is handed.
   The console finds games on its own (src/games/registry.ts); there is no list to edit. */

export type Lang = 'en' | 'zh-hant' | 'zh-hans';
export type Strings = Record<Lang, Record<string, any>>;

/** A section of a game's Operating Instructions. Strings are I18N keys; `v` is a key or, with `lit`, literal HTML. */
export type ManualSection =
  | { h: string; p: string }
  | { h: string; list: { k: string; v: string; lit?: boolean }[]; keys?: boolean };

/** Colour roles every phosphor theme defines; draw only with these so the game works on green, amber, white and CGA. */
export type Role =
  | 'bg' | 'text' | 'textDim' | 'hud' | 'dirt' | 'ds1' | 'ds2' | 'tunnel' | 'gem' | 'gemHi' | 'bag' | 'goldHi'
  | 'cart' | 'cartShade' | 'window' | 'lamp' | 'drill' | 'drillLine' | 'wheel' | 'grub' | 'borer' | 'rockjaw'
  | 'eye' | 'spark' | 'gold' | 'sun' | (string & {});

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Step = { dx: number; dy: number };

/** What the console lends a game. Values are live: read them each frame, don't copy them at start-up. */
export interface ConsoleAPI {
  /* ---- the picture: a low-res buffer, snapped to four colours and run through the CRT pass ---- */
  /** Drawing context for the low-res buffer, LW × LH pixels. Row 0..HUD is the status bar. */
  readonly g: CanvasRenderingContext2D;
  readonly LW: number; readonly LH: number; readonly HUD: number;
  /** Grid for tile games: W × H cells of CELL low-res pixels; game units are C per cell, K low-res px per unit. */
  readonly W: number; readonly H: number; readonly C: number; readonly K: number;
  /** Re-fit the grid (and the buffer) to the tube's current shape. Call when starting a game. */
  fitGrid(): void;
  /** The colour for a role in the current phosphor theme. */
  col(role: Role): string;
  /** The current theme's four colours as [r, g, b], by palette index; the theme itself (its `roles` map a role to an index). */
  readonly palRGB: number[][];
  readonly palette: any;
  /** Pixel-font text: size 8 or 16, align left / center / right. */
  txt(s: string, x: number, y: number, role?: Role, align?: 'left' | 'center' | 'right', size?: number): void;
  /** A centred two-line banner over the playfield (GET READY, LEVEL CLEARED …). */
  banner(title: string, sub?: string): void;
  /** Shape helpers: a rounded-rect path (fill or stroke it yourself), and a filled polygon and circle in the current fillStyle. */
  rr(x: number, y: number, w: number, h: number, r: number): void;
  poly(pts: number[]): void;
  circ(x: number, y: number, r: number): void;
  /** Grid helpers: index of a cell, and whether a cell is on the board. */
  idx(x: number, y: number): number;
  inb(x: number, y: number): boolean;
  readonly DIRS: Record<Dir, Step>;

  /* ---- shared state ---- */
  /** mode (`ready` | `play` | `dying` | `clear` …), modeT, time, score, level, lives, plus room for the game's own fields. */
  readonly S: any;

  /* ---- input ---- */
  /** Directions held on the keyboard, newest last. */
  readonly held: Dir[];
  /** The on-screen stick's direction, or null. */
  readonly stickDir: Dir | null;
  /** The step to move in now (stick first, then the newest key), or null. */
  wantDir(): Step | null;
  /** Any action button by slot id: its label, whether it's live, and its press state. The set has 'fire' and 'boost', plus
      'fireL' and 'fireR', extra fire keys either side of FIRE (Z and V) that appear only while the app maps them.
      With all three showing, each is about 32 px wide on a small phone: give them labels of three letters or fewer. */
  button(id: string): ButtonState;
  /** Take a press off a slot once it's handled. */
  clearButton(id: string): void;
  /** Change slots for now (label and/or on/off); null puts a slot back to the disk's `buttons`. Unknown slots are ignored. */
  setButtons(patch: ButtonPatch): void;
  /** Shorthands for the two buttons on the set today, and taps on the screen: `…Queued` is a press not yet handled, `…Held` is down now. */
  readonly fireQueued: boolean; readonly fireHeld: boolean;
  readonly boostQueued: boolean; readonly boostHeld: boolean;
  readonly tapQueued: boolean; readonly tapHeld: boolean;
  /** Where the last tap on the screen landed, in low-res pixels across the tube (for a game that fires where you tap). */
  readonly tapX: number;
  clearFire(): void; clearBoost(): void; clearTap(): void;
  /** @deprecated use setButtons({ boost: { label } }) / setButtons({ boost: null }). */
  setBoostLabel(key: string | null): void;

  /* ---- sound ---- */
  /** A synth beep: frequency (Hz), duration (s), volume, pitch slide (Hz), delay (s). Silent when SOUND is off. */
  tone(freq: number, dur: number, vol?: number, slide?: number, delay?: number): void;

  /* ---- scores and the end of a game ---- */
  /** This game's best on this device; set it when the score passes it. */
  best: number;
  saveBest(): void;
  /** The game is over: the console saves the best, then runs name entry or the attract loop. */
  finishGame(): void;

  /* ---- odds and ends ---- */
  /** Vercel Analytics custom event (at most two properties). */
  track(name: string, data?: Record<string, string | number | boolean | null>): void;
  /** A small seeded random generator. */
  mulberry32(seed: number): () => number;
  /** The loader's sector bar, for loading screens. Returns the y below it. */
  diskInfo(y: number, p: number, t: number, disk: GameDisk): number;
}

/** A running game, made by `create(api)` in the game's game.ts. */
export interface GameRuntime {
  /** A new game: reset the field and score. The console then counts down `ready` and switches to `play`. */
  start(): void;
  /** Every step while the game is in `ready`, `play`, `dying` or `clear`. */
  update(dt: number): void;
  /** Draw the playfield and HUD into the low-res buffer. */
  draw(): void;
  /** Optional: the phosphor theme changed. */
  onPalette?(): void;
  /** Optional hooks for the Playwright tests. */
  debug?: Record<string, (...a: any[]) => any>;
}
export type CreateGame = (api: ConsoleAPI) => GameRuntime;

/** A game's disk: everything the console shows before and around the game. */
export interface GameDisk {
  /** Short id, used for storage keys (`gg-board-<id>`) and analytics. */
  id: string;
  /** Position on the disk menu. */
  order: number;
  /** Its own page: /<slug> boots straight into this disk. */
  slug: string;
  /** Title and description for that page and its share preview (English). */
  page: { title: string; description: string };
  /** Title in the pixel font, on the menu and the loading screen. */
  title: string;
  /** I18N key for the title in the instructions. */
  nameKey: string;
  /** The file the drive "reads", and its size in bytes. */
  file: string;
  size: number;
  /** How long the load takes, in seconds. Never more than 5. */
  loadSecs: number;
  /** The load's progress curve: [fraction of the time, fraction loaded], uneven like sectors off a disk. */
  steps: [number, number][];
  /** One line under the title on the menu, in the pixel font. */
  blurb: string;
  /** Verb for "PRESS FIRE TO …" on the high-score table. */
  verb: string;
  /** Taps on the screen count as a press (`tapQueued` / `tapHeld`) while playing, e.g. to jump or fire. */
  tap?: boolean;
  /** 'pad' swaps the on-screen stick for a pad of up to six buttons (slots `pad1`…`pad6`: top row ← ↑ → or Z X C,
      bottom row A S D) while the game is playing, and hides the FIRE row beside it; the stick comes back whenever the
      console runs (menu, loading, name entry, high scores). Default 'stick'. */
  controls?: 'stick' | 'pad';
  /** What each action button is for in this game: an I18N key for its label, and `enabled: false` to leave it dark. Slots left out go dark. */
  buttons: ButtonMap;
  /** I18N keys for the game-over card's title and button. */
  overKey: string; againKey: string;
  /** Operating Instructions, and the strings they (and the labels above) use. */
  manual: ManualSection[];
  strings: Partial<Strings>;
  /** The themed loading screen; p is 0..1 loaded, t the seconds since the drive started. */
  drawLoad(api: ConsoleAPI, p: number, t: number): void;
}

/* ---------- action buttons (see src/console/buttons.ts) ---------- */
/** One slot as an app wants it: an I18N key for the label, and whether it's live (default true). */
export interface ButtonSpec { label: string; enabled?: boolean }
/** An app's buttons, by slot id ('fire', 'boost', …). Slots it leaves out go dark. */
export type ButtonMap = Record<string, ButtonSpec>;
/** A change for now: new label and/or on/off per slot, or null to go back to the declared spec. */
export type ButtonPatch = Record<string, Partial<ButtonSpec> | null>;
/** What a game can read about a slot. */
export interface ButtonState { label: string; enabled: boolean; queued: boolean; held: boolean }

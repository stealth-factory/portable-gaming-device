/* The plug-in contract between the console and its games.

   A game is a folder in src/games/ with two modules:
   - disk.ts  exports `disk: GameDisk`: the label, loading screen, instructions and strings. Small, loaded up front
              so the menu and the loading screen can show before the game itself arrives.
   - game.ts  default-exports `create(api) => GameRuntime`: the game. Downloaded while the drive "reads" the disk.

   Disk contract v1 runs without a browser. Games and the play kit use only ConsoleAPI, never browser globals
   or imports from src/console. Math.random is supplied by the host and can be seeded for conformance runs.
   The console finds games on its own (src/games/registry.ts); there is no list to edit. */
import type { Haptic } from '../kit/platform/haptics';
export type { Haptic, HapticName } from '../kit/platform/haptics';

export type Lang = 'en' | 'zh-hant' | 'zh-hans';
export type Strings = Record<Lang, Record<string, any>>;

/** One row of a leaflet list. Strings are I18N keys; `v` is a key or, with `lit`, literal HTML. */
export type ManualItem = { k: string; v: string; lit?: boolean };

/** A section of a game's Operating Instructions.
    A paragraph (`p`), a dotted-leader list (scores, or `keys` for controls), or the same list
    set in `notes` (the name on its own line, the text wrapping under it) when a row is a sentence.
    `wrap` keeps the dotted leaders but lets a long value break, and on a narrow column puts the value under the name. */
export type ManualSection =
  | { h: string; p: string }
  | { h: string; list: ManualItem[]; keys?: boolean; notes?: boolean; wrap?: boolean };

/** Colour roles every phosphor theme defines; draw only with these so the game works on green, amber, white and CGA. */
export type Role =
  | 'bg' | 'text' | 'textDim' | 'hud' | 'dirt' | 'ds1' | 'ds2' | 'tunnel' | 'gem' | 'gemHi' | 'bag' | 'goldHi'
  | 'cart' | 'cartShade' | 'window' | 'lamp' | 'drill' | 'drillLine' | 'wheel' | 'grub' | 'borer' | 'rockjaw'
  | 'eye' | 'spark' | 'gold' | 'sun' | (string & {});

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Step = { dx: number; dy: number };

/** The drawing surface shared by browser and native hosts. Only filled paths are supported.
    Colours are current palette strings from col() or palette.pal; fonts are Silkscreen at 8 or 16 px. */
export interface Screen2D {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
  clip(): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  font: string;
  measureText(s: string): { width: number };
}

/** An opaque off-screen picture, row-major, one palette index (0 to 3) per pixel.
    Mutate px, then stamp it. Palette colour changes need no rebuild; changed role mappings may use onPalette(). */
export interface Layer { readonly w: number; readonly h: number; readonly px: Uint8Array }

/** The read-only theme information disks need; roles map drawing roles to palette indices. */
export interface Palette { readonly pal: readonly string[]; readonly roles: Readonly<Record<string, number>> }

/** What the console lends a game. Values are live: read them each frame, don't copy them at start-up. */
export interface ConsoleAPI {
  /* ---- the picture: a low-res buffer, snapped to four colours and run through the CRT pass ---- */
  /** Drawing context for the low-res buffer, LW × LH pixels. Row 0..HUD is the status bar. */
  readonly g: Screen2D;
  /** Allocate an off-screen picture of whole low-res pixels, initially palette index 0. */
  layer(w: number, h: number): Layer;
  /** Copy an opaque layer onto the picture at (x, y), using the current palette and drawing transform. */
  stamp(layer: Layer, x: number, y: number): void;
  readonly LW: number; readonly LH: number; readonly HUD: number;
  /** Grid for tile games: W × H cells of CELL low-res pixels; game units are C per cell, K low-res px per unit. */
  readonly W: number; readonly H: number; readonly C: number; readonly K: number;
  /** Re-fit the grid (and the buffer) to the tube's current shape. Call when starting a game. */
  fitGrid(): void;
  /** The colour for a role in the current phosphor theme. */
  col(role: Role): string;
  /** The current theme's four colours as [r, g, b], by palette index; the theme itself (its `roles` map a role to an index). */
  readonly palRGB: readonly (readonly number[])[];
  readonly palette: Palette;
  /** Pixel-font text: size 8 or 16, align left / center / right. */
  txt(s: string, x: number, y: number, role?: Role, align?: 'left' | 'center' | 'right', size?: number): void;
  /** A centred two-line banner over the playfield (GET READY, LEVEL CLEARED …). */
  banner(title: string, sub?: string): void;
  /** Shape helpers: a rounded-rect path (fill it yourself), and a filled polygon and circle in the current fillStyle. */
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
  /** A buzz on phones that can vibrate: a name ('fire' as a shot leaves, 'pickup' on a catch, 'lose' for a lost life;
      the console buzzes 'over' itself when the game ends), a length in ms, or a pattern [buzz, pause, buzz …].
      Nothing happens with SOUND off or where the browser can't vibrate, and a short buzz never cuts off a longer one. */
  buzz(h: Haptic): void;

  /* ---- scores and the end of a game ---- */
  /** This game's best on this device; set it when the score passes it. */
  best: number;
  saveBest(): void;
  /** The game is over: the console saves the best, then runs name entry or the attract loop. */
  finishGame(): void;

  /* ---- odds and ends ---- */
  /** Vercel Analytics custom event (at most two properties); a no-op on mobile hosts. */
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
  /** Optional: the phosphor theme changed. Rebuild cached indices if its role mapping changed. */
  onPalette?(): void;
  /** Optional hooks for the Playwright tests. */
  debug?: Record<string, (...a: any[]) => any>;
}
export type CreateGame = (api: ConsoleAPI) => GameRuntime;

/** A game's disk: everything the console shows before and around the game. */
export interface GameDisk {
  /** The ConsoleAPI version this disk requires. */
  contract: 1;
  /** Positive whole-number revision; increase whenever this disk's built files change. */
  version: number;
  /** The lowest App Store age band this disk suits. Version 1 ships only 4+ disks. */
  rating: '4+';
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

  /* ---- the launcher's cover card ---- */
  /** The kind of game, upper case, at most 8 characters (DIG, SHOOTER …), on the launcher's details lines. */
  genre: string;
  /** How many play at once. */
  players: number;
  /** Optional year, shown only on wide tubes. */
  year?: number;
  /** Optional hand-drawn key art for the launcher, drawn through the API like `drawLoad`. Use it only where the
      captured cover (`cover.ts`) reads badly at carousel size. t is seconds since the disk came to the front. */
  drawCover?: (api: ConsoleAPI, x: number, y: number, w: number, h: number, t: number) => void;
  /** Optional scripted preview: a loop of about 6 s that starts on the cover's frame. */
  drawPreview?: (api: ConsoleAPI, x: number, y: number, w: number, h: number, t: number) => void;
  /** Attached by the registry from the folder's generated cover.ts and preview.ts; never set these in disk.ts. */
  cover?: Cover;
  preview?: Preview;
}

/** A captured cover: one palette index (0 = bg … 3 = brightest) per pixel, four pixels a byte (first pixel in the
    top two bits), rows top to bottom, base64. Generated by `tools/share-images/make.cjs --covers`; never edit by hand. */
export interface Cover { w: number; h: number; data: string }
/** A flipbook preview: frames in the same format as a cover, played at `fps`. */
export interface Preview { w: number; h: number; fps: number; frames: string[] }

/* ---------- action buttons (see src/console/buttons.ts) ---------- */
/** One slot as an app wants it: an I18N key for the label, and whether it's live (default true). */
export interface ButtonSpec { label: string; enabled?: boolean }
/** An app's buttons, by slot id ('fire', 'boost', …). Slots it leaves out go dark. */
export type ButtonMap = Record<string, ButtonSpec>;
/** A change for now: new label and/or on/off per slot, or null to go back to the declared spec. */
export type ButtonPatch = Record<string, Partial<ButtonSpec> | null>;
/** What a game can read about a slot. */
export interface ButtonState { label: string; enabled: boolean; queued: boolean; held: boolean }

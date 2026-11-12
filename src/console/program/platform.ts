/* Everything the console program asks of the machine it runs on (GAM-39).

   The console program (src/console/program/) decides what the tube shows and when: boot, the launcher,
   loading, name entry, the score table. It never touches the DOM, Web Audio or storage itself. The web
   console implements this interface over the browser (src/console/web/platform.ts); the native apps
   implement it over their engine core, where the program runs as the built-in system disk.

   Keep it small and abstract: a call here is a call both hosts must make work the same way. */

/** Key-value storage on this device. Values are strings; a failed write is ignored, as on the web. */
export interface PlatformStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export interface Platform {
  /** A monotonic clock in milliseconds. Boots and loads run on it, so a slow frame rate can't stretch them. */
  now(): number;
  readonly store: PlatformStore;

  /** Make sure sound can play (the web needs a user gesture to start its audio). Safe to call often. */
  wakeAudio(): void;
  /** True while a sound would be heard: the output exists and SOUND is on. Read it after `wakeAudio()`. */
  readonly sounding: boolean;
  /** A square-wave note: the gain holds for 85% of `dur`, then falls to silence; `slide` ramps the pitch exponentially. */
  tone(freq: number, dur: number, vol?: number, slide?: number, delay?: number): void;
  /** One floppy head click `delay` seconds from now: an 18 ms burst of noise through a band-pass at `freq`. */
  click(delay: number, vol?: number, freq?: number): void;
  /** The drive motor running for `dur` seconds from `start` seconds from now: a low rumble with a hum under it. */
  motor(start: number, dur: number): void;

  /** Analytics. At most two properties (Vercel Pro); does nothing in the apps. */
  track(name: string, data?: Record<string, string | number | boolean | null>): void;
  /** The set's layout (`desk`, `console`, `phone-portrait`, `tablet-portrait`), for analytics. */
  layoutName(): string;
  readonly reducedMotion: boolean;

  /** Take the pause or game-over card off the tube. */
  hideCard(): void;
  /** Show whether HOLD is on. */
  showHold(on: boolean): void;
  /** Flash one of the set's own buttons as it is pressed. */
  flash(control: 'select'): void;

  /** The disk a game's own page boots straight into the first time (`/dino-run`), or null on the console's page. */
  autoloadId(): string | null;
  /** The old list menu instead of the launcher (`?menu=list` on the web, until GAM-52 removes it). */
  readonly oldList: boolean;
  /** Called when the network comes back, so disks that failed to arrive can be tried again. */
  onOnline(fn: () => void): void;
  /** Called when the player resets settings or clears scores from the leaflet. */
  onSettings(fn: () => void): void;
}

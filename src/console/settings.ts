/* The set's settings and the scores kept on this device: what "reset" puts back, and which storage keys
   "clear high scores" removes. Plain data and pure functions, so the unit tests can check them. */

/** The set as it leaves the factory: green P1, SOUND and GLOW on, HOLD and FULL off, English. */
export const DEFAULTS = { mode: 'greenP1', fx: true, sound: true, hold: false, full: false, lang: 'en' } as const;

/** A storage key that holds a score or the last name typed: every game's best and table (`gg-best-<id>`,
    `gg-board-<id>`), the name (`gg-name`), and the standalone Tunnel Raider's, which the console still reads. */
export const isScoreKey = (k: string) =>
  /^gg-(best|board)-[\w-]+$/.test(k) || ['gg-name', 'eb-best', 'tr-board', 'tr-name'].includes(k);

/** The score keys among a list of storage keys. */
export const scoreKeys = (keys: Iterable<string>) => [...keys].filter(isScoreKey);

/** What the leaflet asks the console to do; sent as a `gg:settings` event on the page, whose `detail` is one of these. */
export type SettingsAction = 'reset' | 'scores';
export const SETTINGS_EVENT = 'gg:settings';

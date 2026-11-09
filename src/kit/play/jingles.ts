/* Short tunes: a few notes in a row on the console's synth. The tunes themselves stay in each game. */
import type { ConsoleAPI } from './types';

/** Notes in Hz, each `dur` seconds at `vol`, `gap` seconds apart, every note sliding by `slide` Hz. */
export type Jingle = { notes: readonly number[]; dur?: number; vol?: number; gap?: number; slide?: number };

/** Play a jingle (silent when SOUND is off, as every tone is). */
export function play(api: ConsoleAPI, j: Jingle): void {
  const { dur = 0.1, vol = 0.04, gap = 0.09, slide = 0 } = j;
  j.notes.forEach((f, i) => api.tone(f, dur, vol, slide, i * gap));
}

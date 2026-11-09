/* Reading the action buttons and the stick: the lines every game repeats. The buttons themselves (slots,
   labels, on/off, press state) belong to the console core (src/console/buttons.ts); this only reads them
   through the ConsoleAPI. */
import type { ConsoleAPI } from './types';

/** Left or right: the stick first, then the newest left/right key held. −1, 0 or 1. */
export function horizontal(api: ConsoleAPI): -1 | 0 | 1 {
  const sd = api.stickDir, keys = api.held.filter(d => d === 'left' || d === 'right');
  const dir = sd === 'left' || sd === 'right' ? sd : keys[keys.length - 1];
  return dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
}
/** A press on any of `slots` not yet handled, or a tap on the screen when `tap` is true. Doesn't clear it. */
export function pressed(api: ConsoleAPI, slots: string | readonly string[], tap = false): boolean {
  const ids = typeof slots === 'string' ? [slots] : slots;
  return ids.some(id => api.button(id).queued) || (tap && api.tapQueued);
}
/** Take the presses off `slots` (and taps, when `tap` is true) once handled. */
export function consume(api: ConsoleAPI, slots: string | readonly string[], tap = false): void {
  for (const id of typeof slots === 'string' ? [slots] : slots) api.clearButton(id);
  if (tap) api.clearTap();
}

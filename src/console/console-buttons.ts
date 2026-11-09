/* The console's own buttons: the boot and the disk menu are apps like any game (see buttons.ts). */
import type { ButtonMap } from '../games/types';

/** Booting: nothing to press yet. */
export const BOOT_BUTTONS: ButtonMap = { fire: { label: 'spark', enabled: false }, boost: { label: 'boost', enabled: false } };
/** The disk menu: FIRE loads the highlighted disk; BOOST has no job here, so it stays dark. */
export const MENU_BUTTONS: ButtonMap = { fire: { label: 'menuSel' }, boost: { label: 'boost', enabled: false } };

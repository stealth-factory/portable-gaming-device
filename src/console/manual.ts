/* The console's own Operating Instructions (shown while the disk menu is up). Games bring theirs on their disks. */
import type { ManualSection } from '../games/types';

export const CONSOLE_MANUAL: ManualSection[] = [
  { h: 'cmPickH', p: 'cmPick' },
  { h: 'cmCtlH', keys: true, list: [
    { k: 'c1', v: 'c1v' }, { k: 'c2', v: 'c2v' }, { k: 'c3', v: 'c3v' }, { k: 'c4', v: 'c4v' }, { k: 'k4', v: 'k4v' },
    { k: 'k5', v: '<kbd>M</kbd>', lit: true }, { k: 'k6', v: 'k6v' }, { k: 'k8', v: 'k8v' },
  ] },
  { h: 'secMonitor', p: 'ctlNote' },
];

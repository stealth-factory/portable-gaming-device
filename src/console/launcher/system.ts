/* What the launcher may ask of the console. The web console builds one in loader.ts; the native apps build theirs
   in their shell. Nothing in src/console/launcher/ touches the DOM, storage or the window: it all comes through here
   or through the ConsoleAPI. */
import type { GameDisk } from '../../games/types';

/** Where a disk stands on this device. The web only ever shows `ready` and `missing` (offline, and the disk's code
    couldn't be fetched); `downloading` and `update` are for the apps. */
export type DiskState =
  | { kind: 'ready' }
  | { kind: 'missing'; size: number }
  | { kind: 'downloading'; p: number }
  | { kind: 'update' };

export interface LauncherSystem {
  /** The disks in the box, sorted by `order`. */
  disks(): GameDisk[];
  state(id: string): DiskState;
  /** This device's best score for a disk, and whose it is (null when nobody has signed the table). */
  best(id: string): { score: number; name: string | null };
  /** Load the disk at this index (the themed loading screen, drive sounds and all). */
  load(index: number): void;
  /** Fetch a disk that isn't on the device (apps only; a no-op on the web). */
  download(id: string): void;
  /** The disk last loaded on this device, to open the box at. */
  lastDiskId(): string | null;
  /** The player asked for less motion: no preview, no blinking cursor. */
  reducedMotion(): boolean;
  /** The move tick, and the drive's two-step seek, played on every move. */
  tick(): void;
  seek(): void;
  /** English text for a button label's I18N key (the tube is always English). */
  label(key: string): string;
}

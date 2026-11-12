/* Disks sent in through the embed bridge (GAM-64): games an AI harness makes, in the same shapes as a .pgdisk file
   (tools/disks/README.md). DOM-free, so the unit tests run it under Node.
   - disk.js: a plain script that defines the global `PGDDisk` (the disk is `PGDDisk.disk`)
   - game.js: a plain script that defines the global `PGDGame` (the factory is `PGDGame.create`)
   - or the .pgdisk file's bytes, which hold both (plus manifest.json and preview.json). */
import type { CreateGame, GameDisk, GameRuntime, Cover, Preview } from '../games/types';

/** Run a plain script and hand back the global it defines (`var NAME = …`, as Rolldown's iife output does). */
export function runScript(code: string, name: 'PGDDisk' | 'PGDGame'): any {
  // a Function body keeps the script's `var` out of the page's globals; `this` and globalThis are the page's
  return new Function(`${code}\n;return typeof ${name} !== 'undefined' ? ${name} : globalThis.${name};`)();
}

/** The disk object from a disk.js script: `PGDDisk.disk`, or `PGDDisk` itself when the script defines the disk directly. */
export function diskFromScript(code: string): Record<string, any> {
  const g = runScript(code, 'PGDDisk');
  const d = g && (g.disk ?? g.default ?? g);
  if (!d || typeof d !== 'object') throw new Error('disk.js defines no PGDDisk');
  return d;
}

/** The factory from a game.js script: `PGDGame.create`, `PGDGame.default`, or `PGDGame` when it is the function. */
export function gameFromScript(code: string): CreateGame {
  const g = runScript(code, 'PGDGame');
  const create = typeof g === 'function' ? g : g && (g.create ?? g.default);
  if (typeof create !== 'function') throw new Error('game.js defines no PGDGame.create');
  return create;
}

const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A disk with every field the console reads: the harness may leave the fussy ones out. Throws on what can't be guessed. */
export function completeDisk(raw: Record<string, any>, order: number): GameDisk {
  const id = raw.id;
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('disk id must be lower-case letters, digits and hyphens, up to 32');
  if (typeof raw.drawLoad !== 'function') throw new Error(`disk "${id}" has no drawLoad(api, p, t)`);
  if (raw.contract !== undefined && raw.contract !== 1) throw new Error(`disk "${id}" needs console contract ${raw.contract}; this console has 1`);
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().toUpperCase() : id.toUpperCase();
  const nameKey = typeof raw.nameKey === 'string' ? raw.nameKey : `x-${id}-name`;
  const strings = raw.strings && typeof raw.strings === 'object' ? { ...raw.strings } : {};
  // the instructions show the disk's name through nameKey: make sure every language has one
  for (const l of ['en', 'zh-hant', 'zh-hans'] as const) {
    const s = strings[l] = { ...(strings[l] || {}) };
    if (typeof s[nameKey] !== 'string') s[nameKey] = strings.en?.[nameKey] || raw.page?.title || title;
  }
  const loadSecs = Math.min(5, Math.max(0.5, Number(raw.loadSecs) || 2));
  const steps = Array.isArray(raw.steps) && raw.steps.length ? raw.steps : [[0, 0], [0.3, 0.25], [0.55, 0.5], [0.8, 0.8], [1, 1]];
  return {
    ...raw,
    contract: 1,
    version: Number.isInteger(raw.version) && raw.version > 0 ? raw.version : 1,
    rating: '4+',
    id, title, nameKey, strings, loadSecs, steps,
    order: Number.isFinite(raw.order) ? raw.order : order,
    slug: typeof raw.slug === 'string' ? raw.slug : id,
    page: raw.page && typeof raw.page.title === 'string' ? raw.page : { title, description: '' },
    file: typeof raw.file === 'string' ? raw.file : `${id.replace(/-/g, '').slice(0, 8).toUpperCase()}.EXE`,
    size: Number.isFinite(raw.size) ? raw.size : 32768,
    blurb: typeof raw.blurb === 'string' ? raw.blurb : '',
    verb: typeof raw.verb === 'string' ? raw.verb : 'PLAY',
    buttons: raw.buttons && typeof raw.buttons === 'object' ? raw.buttons : { fire: { label: 'spark' } },
    overKey: typeof raw.overKey === 'string' ? raw.overKey : 'over',
    againKey: typeof raw.againKey === 'string' ? raw.againKey : 'again',
    manual: Array.isArray(raw.manual) ? raw.manual : [],
    genre: typeof raw.genre === 'string' && raw.genre ? raw.genre.toUpperCase().slice(0, 8) : 'CUSTOM',
    players: Number.isFinite(raw.players) ? raw.players : 1,
  } as GameDisk;
}

/** The files in a .pgdisk (a zip of stored, uncompressed entries; see tools/disks/pgdisk.mjs). */
export function readPgdisk(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = new TextDecoder(), files: Record<string, string> = {};
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true), size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true), extraLen = view.getUint16(at + 28, true);
    const name = text.decode(bytes.subarray(at + 30, at + 30 + nameLen)), start = at + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error(`.pgdisk entry ${name} is compressed; disk files store their entries`);
    if (start + size > bytes.length) throw new Error('.pgdisk is cut short');
    files[name] = text.decode(bytes.subarray(start, start + size));
    at = start + size;
  }
  if (!files['disk.js']) throw new Error('not a .pgdisk: no disk.js');
  return files;
}

/** What a page sends to insert a disk. */
export interface DiskSource {
  /** disk.js source */
  disk?: string;
  /** game.js source; leave it out to supply the game when the disk is loaded */
  game?: string;
  /** a .pgdisk file's bytes, in place of disk and game */
  pgdisk?: ArrayBuffer | Uint8Array;
  cover?: Cover;
  preview?: Preview;
}

/** Read a disk source: the disk (completed), and the game's source where it came with it. */
export function readSource(src: DiskSource, order: number): { disk: GameDisk; game: string | null } {
  let diskJs = src.disk, gameJs = src.game ?? null, cover = src.cover, preview = src.preview;
  if (src.pgdisk) {
    const files = readPgdisk(src.pgdisk instanceof Uint8Array ? src.pgdisk : new Uint8Array(src.pgdisk));
    diskJs = files['disk.js']; gameJs = files['game.js'] ?? gameJs;
    if (files['manifest.json']) cover ??= JSON.parse(files['manifest.json']).cover;
    if (files['preview.json']) preview ??= JSON.parse(files['preview.json']);
  }
  if (typeof diskJs !== 'string') throw new Error('send disk (the disk.js source) or pgdisk');
  const disk = completeDisk(diskFromScript(diskJs), order);
  if (cover) disk.cover = cover;
  if (preview) disk.preview = preview;
  return { disk, game: gameJs };
}

/** Wrap a game so a throw in its code is reported and stops it, rather than stopping the console's frame loop. */
export function guard(rt: GameRuntime, crashed: (err: unknown) => void): GameRuntime {
  let dead = false;
  const safe = <A extends unknown[]>(f: ((...a: A) => void) | undefined) => (...a: A) => {
    if (dead || !f) return;
    try { f.apply(rt, a); } catch (err) { dead = true; crashed(err); }
  };
  return { start: safe(rt.start), update: safe(rt.update), draw: safe(rt.draw), onPalette: rt.onPalette && safe(rt.onPalette), debug: rt.debug };
}

/** Origins allowed to insert disks: the console's own, localhost, and the build's PUBLIC_PGD_EMBED_ORIGINS
    (comma-separated; `https://*.example.com` matches any subdomain). Inserting runs the disk's code on the console's site. */
export function mayInsert(origin: string, own: string, list: string): boolean {
  if (origin === own) return true;
  let u: URL; try { u = new URL(origin); } catch (_) { return false; }
  if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true;
  return list.split(',').map(s => s.trim()).filter(Boolean).some(p => {
    if (p === origin) return true;
    const m = /^(https?):\/\/\*\.(.+)$/.exec(p);
    return !!m && u.protocol === `${m[1]}:` && u.host.endsWith(`.${m[2]}`);
  });
}

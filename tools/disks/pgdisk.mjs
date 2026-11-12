// Disk files (GAM-34): build, read and sign `.pgdisk` files and the catalogue the native apps load.
// The format is described in tools/disks/README.md. Used by build.mjs, verify.mjs, the conformance runner and the unit tests.
import { rolldown } from 'rolldown';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { createContext, runInContext } from 'node:vm';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FORMAT = 1;
/** Where the site serves the disks and the catalogue. */
export const BASE = '/disks/v1/';
/** The committed record of each disk's version and built file, which CI checks against. */
export const LOCK = join(ROOT, 'tools/disks/versions.json');
/** The global each script defines when run as a plain script. */
export const GLOBALS = { disk: 'PGDDisk', game: 'PGDGame' };

/** Every game folder under src/games, in name order. */
export function folders() {
  return readdirSync(join(ROOT, 'src/games'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
}

/* ---------- scripts ---------- */

/** Bundle some ES module source into one plain script that defines `name` on the global object. */
export async function bundle(source, name) {
  const temp = mkdtempSync(join(tmpdir(), 'pgd-disk-'));
  try {
    const entry = join(temp, 'entry.ts');
    writeFileSync(entry, source);
    const b = await rolldown({ input: entry, cwd: ROOT, onLog(level, log, next) { if (level !== 'info') next(level, log); } });
    try {
      const code = (await b.generate({ format: 'iife', name, comments: { legal: true, annotation: false, jsdoc: false } })).output[0].code;
      return code.replace(/^\/\/#region .*\n|^\/\/#endregion.*\n/gm, '');
    } finally { await b.close(); }
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

/** Run plain scripts in a fresh realm with no browser globals and return that realm's global object. */
export function runScripts(scripts, extra = {}) {
  const context = createContext({ Date: undefined, performance: undefined, ...extra });
  for (const code of scripts) runInContext(code, context);
  return context;
}

const src = (folder, file) => JSON.stringify(join(ROOT, 'src/games', folder, file));

/* ---------- one disk ---------- */

/** The manifest's fields, in this order. Everything else on the disk object is code (disk.js) or the flipbook. */
const MANIFEST = ['id', 'version', 'contract', 'rating', 'order', 'slug', 'page', 'title', 'nameKey', 'file', 'size',
  'loadSecs', 'steps', 'blurb', 'verb', 'tap', 'controls', 'buttons', 'overKey', 'againKey', 'genre', 'players', 'year',
  'manual', 'strings', 'cover'];

/** Build one game folder into its disk file: `{ id, version, name, files, bytes, sha256 }`. */
export async function buildDisk(folder) {
  const has = file => readdirSync(join(ROOT, 'src/games', folder)).includes(file);
  const disk = await bundle(`export { disk } from ${src(folder, 'disk.ts')};`, GLOBALS.disk);
  const game = await bundle(`export { default as create } from ${src(folder, 'game.ts')};`, GLOBALS.game);
  // the data: run the disk script once, with its generated cover and flipbook
  const data = await bundle([
    `export { cover } from ${src(folder, 'cover.ts')};`,
    has('preview.ts') ? `export { preview } from ${src(folder, 'preview.ts')};` : 'export const preview = undefined;',
  ].join('\n'), 'PGDData');
  const realm = runScripts([disk, data]);
  const d = realm.PGDDisk.disk, { cover, preview } = realm.PGDData;
  if (!d || typeof d.drawLoad !== 'function') throw new Error(`${folder}: disk.ts exports no disk`);
  const manifest = { format: FORMAT };
  for (const key of MANIFEST) if (key !== 'cover' && d[key] !== undefined) manifest[key] = d[key];
  manifest.cover = cover;
  const files = { 'manifest.json': json(manifest), 'disk.js': disk, 'game.js': game };
  if (preview) files['preview.json'] = json(preview);
  const zipped = zip(files);
  return { id: d.id, version: d.version, contract: d.contract, rating: d.rating, slug: d.slug, folder,
    name: `${d.id}-${d.version}.pgdisk`, files, zip: zipped, bytes: zipped.length, sha256: sha256(zipped) };
}

/** Plain JSON, the same bytes on every machine. Throws on anything JSON can't hold (a function, NaN). */
function json(value) {
  return JSON.stringify(value, (key, v) => {
    if (typeof v === 'function') throw new Error(`manifest field ${key} is a function`);
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`manifest field ${key} is not a finite number`);
    return v;
  }) + '\n';
}

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

/* ---------- zip: stored entries, fixed dates, so the same files always make the same bytes ---------- */

const DOS_DATE = (0 << 9) | (1 << 5) | 1;   // 1 January 1980, the earliest a zip can say

/** A zip of `{ name: string | Buffer }`, entries in the order given, uncompressed (method 0). */
export function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const n = Buffer.from(name, 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data); centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centrals.length / 2, 8); end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** Read a disk file back into `{ name: Buffer }`. Only what `zip` writes is accepted: stored entries, checked CRCs. */
export function unzip(buf) {
  const at = buf.length - 22;
  if (at < 0 || buf.readUInt32LE(at) !== 0x06054b50) throw new Error('not a disk file: no end of central directory');
  const count = buf.readUInt16LE(at + 10), files = {};
  let p = buf.readUInt32LE(at + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), note = buf.readUInt16LE(p + 32);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen), local = buf.readUInt32LE(p + 42);
    if (method !== 0) throw new Error(`${name} is compressed; disk files store entries`);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (data.length !== size || crc32(data) !== crc) throw new Error(`${name} fails its CRC`);
    if (Object.hasOwn(files, name)) throw new Error(`${name} appears twice`);
    files[name] = data;
    p += 46 + nameLen + extra + note;
  }
  return files;
}

/* ---------- signing ---------- */

/* Local and pull-request builds sign with a development key that anyone can make: its seed is this public phrase.
   Development builds of the apps trust it; release builds trust only the release key, whose private half is the
   PGD_DISK_SIGNING_KEY secret and is never in this repo. */
const DEV_SEED = createHash('sha256').update('PGD development disk key: public, never trusted by a release build').digest();
const ED25519_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');

/** The key that signs this build's catalogue: the release key from the environment, or the development key. */
export function signingKey(env = process.env) {
  const secret = env.PGD_DISK_SIGNING_KEY?.trim();
  if (!secret) return { kind: 'development', key: createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, DEV_SEED]), format: 'der', type: 'pkcs8' }) };
  const key = secret.startsWith('-----')
    ? createPrivateKey(secret)
    : createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, Buffer.from(secret, 'base64')]), format: 'der', type: 'pkcs8' });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('PGD_DISK_SIGNING_KEY must be an Ed25519 key');
  return { kind: 'release', key };
}

/** A public key as the 32 raw bytes, base64: the form committed in tools/disks/keys and built into the apps. */
export function rawPublic(key) {
  return (key.type === 'public' ? key : createPublicKey(key)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

/** The committed public keys, by name ('development', 'release'), skipping any not created yet. */
export function trustedKeys() {
  const out = {};
  for (const name of ['development', 'release']) {
    let raw;
    try { raw = readFileSync(join(ROOT, 'tools/disks/keys', `${name}.pub`), 'utf8').trim(); } catch { continue; }
    out[name] = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(raw, 'base64')]), format: 'der', type: 'spki' });
  }
  return out;
}

export function signBytes(bytes, key) { return sign(null, bytes, key).toString('base64') + '\n'; }
export function verifyBytes(bytes, signature, key) { return verify(null, bytes, key, Buffer.from(signature.trim(), 'base64')); }

/* ---------- the catalogue ---------- */

/** index.json for these built disks, sorted by id. */
export function catalogue(disks) {
  return json({
    format: FORMAT,
    disks: [...disks].sort((a, b) => a.id < b.id ? -1 : 1).map(d => ({
      id: d.id, version: d.version, contract: d.contract, rating: d.rating,
      sha256: d.sha256, bytes: d.bytes, url: BASE + d.name, page: `/${d.slug}`,
    })),
  });
}

/** Check a built catalogue directory the way the apps will; returns a one-line summary or throws. */
export function verifyCatalogue(dir, { releaseOnly = false } = {}) {
  const index = readFileSync(join(dir, 'index.json'));
  const signature = readFileSync(join(dir, 'index.json.sig'), 'utf8');
  const keys = Object.entries(trustedKeys()).filter(([name]) => !releaseOnly || name === 'release');
  const signer = keys.find(([, key]) => verifyBytes(index, signature, key))?.[0];
  if (!signer) throw new Error(`index.json's signature matches no ${releaseOnly ? 'release ' : ''}key in tools/disks/keys`);
  const cat = JSON.parse(index.toString('utf8'));
  if (cat.format !== FORMAT || !Array.isArray(cat.disks)) throw new Error('index.json is not catalogue format 1');
  for (const d of cat.disks) {
    if (!d.url.startsWith(BASE) || basename(d.url) !== `${d.id}-${d.version}.pgdisk`) throw new Error(`${d.id}: unexpected url ${d.url}`);
    const file = readFileSync(join(dir, basename(d.url)));
    if (file.length !== d.bytes) throw new Error(`${d.id}: ${file.length} bytes, the catalogue says ${d.bytes}`);
    if (sha256(file) !== d.sha256) throw new Error(`${d.id}: SHA-256 does not match the catalogue`);
    const files = unzip(file);
    for (const need of ['manifest.json', 'disk.js', 'game.js']) if (!files[need]) throw new Error(`${d.id}: no ${need}`);
    const m = JSON.parse(files['manifest.json'].toString('utf8'));
    for (const k of ['id', 'version', 'contract', 'rating']) if (m[k] !== d[k]) throw new Error(`${d.id}: manifest ${k} is ${m[k]}, the catalogue says ${d[k]}`);
    if (`/${m.slug}` !== d.page) throw new Error(`${d.id}: manifest slug does not match the page ${d.page}`);
  }
  return `${cat.disks.length} disks verified, signed with the ${signer} key`;
}

/* Disk files and the signed catalogue (GAM-34). After changing a game, raise `version` in its disk.ts and run
   node tools/disks/build.mjs --lock; this file fails until tools/disks/versions.json matches the built disks. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: a plain script with no type declarations
import * as pg from '../../tools/disks/pgdisk.mjs';

interface Built { id: string; version: number; folder: string; name: string; files: Record<string, string>; zip: Buffer; sha256: string; bytes: number }
const FOLDERS: string[] = pg.folders();
const TEMP = mkdtempSync(join(tmpdir(), 'pgd-disk-files-'));
let disks: Built[] = [];

beforeAll(async () => {
  for (const folder of FOLDERS) disks.push(await pg.buildDisk(folder));
  for (const d of disks) writeFileSync(join(TEMP, d.name), d.zip);
  const index = pg.catalogue(disks);
  writeFileSync(join(TEMP, 'index.json'), index);
  writeFileSync(join(TEMP, 'index.json.sig'), pg.signBytes(Buffer.from(index), pg.signingKey({}).key));
}, 120000);
afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

describe('disk files', () => {
  it('match tools/disks/versions.json: a changed disk needs a higher version', () => {
    const lock = JSON.parse(readFileSync(pg.LOCK, 'utf8'));
    const problems: string[] = [];
    for (const d of disks) {
      const was = lock[d.id];
      if (!was) problems.push(`${d.id} is new: run node tools/disks/build.mjs --lock`);
      else if (was.sha256 !== d.sha256 && d.version <= was.version) problems.push(`${d.id} changed: raise version in src/games/${d.folder}/disk.ts above ${was.version}, then run node tools/disks/build.mjs --lock`);
      else if (was.sha256 !== d.sha256 || was.version !== d.version) problems.push(`${d.id} is now version ${d.version}: run node tools/disks/build.mjs --lock`);
    }
    for (const id of Object.keys(lock)) if (!disks.some(d => d.id === id)) problems.push(`${id} is in the lock but no longer built`);
    expect(problems).toEqual([]);
  });

  it('are the same bytes every time', async () => {
    const again = await pg.buildDisk(disks[0].folder);
    expect(again.sha256).toBe(disks[0].sha256);
  }, 60000);

  it.each(FOLDERS)('%s unpacks into plain scripts and a JSON manifest', (folder: string) => {
    const d = disks.find(x => x.folder === folder)!;
    const files = pg.unzip(d.zip);
    expect(Object.keys(files).slice(0, 3)).toEqual(['manifest.json', 'disk.js', 'game.js']);
    for (const script of ['disk.js', 'game.js']) {
      const code = files[script].toString('utf8');
      expect(code).not.toMatch(/^\s*(import|export)\b/m);
      expect(code).not.toMatch(/\bimport\s*\(/);
    }
    const m = JSON.parse(files['manifest.json'].toString('utf8'));
    expect(m).toMatchObject({ format: 1, id: d.id, version: d.version, contract: 1, rating: '4+' });
    for (const key of ['order', 'slug', 'page', 'title', 'nameKey', 'file', 'size', 'loadSecs', 'steps', 'blurb', 'verb',
      'buttons', 'overKey', 'againKey', 'genre', 'players', 'manual', 'strings', 'cover']) expect(m, key).toHaveProperty(key);
    expect(m.cover).toMatchObject({ w: 128, h: 96 });
    const realm = pg.runScripts([files['disk.js'].toString('utf8'), files['game.js'].toString('utf8')]);
    expect(typeof realm.PGDDisk.disk.drawLoad).toBe('function');
    expect(typeof realm.PGDGame.create).toBe('function');
  });

  it.each(FOLDERS)('%s plays the same from its disk file as from source', (folder: string) => {
    const d = disks.find(x => x.folder === folder)!;
    const play = join(pg.ROOT, 'tools/conformance/play.json');
    const run = (what: string, out: string) => {
      execFileSync(process.execPath, ['tools/conformance/run.mjs', what, play, out], { cwd: pg.ROOT, stdio: 'pipe', timeout: 30000 });
      return readFileSync(out, 'utf8');
    };
    expect(run(join(TEMP, d.name), join(TEMP, `${folder}-disk.jsonl`))).toBe(run(folder, join(TEMP, `${folder}-src.jsonl`)));
  }, 60000);
});

describe('the catalogue', () => {
  it('lists every disk and verifies against the committed development key', () => {
    expect(pg.verifyCatalogue(TEMP)).toBe(`${disks.length} disks verified, signed with the development key`);
    const cat = JSON.parse(readFileSync(join(TEMP, 'index.json'), 'utf8'));
    expect(cat.disks.map((d: { url: string }) => d.url)).toEqual([...disks].sort((a, b) => a.id < b.id ? -1 : 1).map(d => `/disks/v1/${d.name}`));
  });

  it('refuses a release check when only the development key signed it', () => {
    expect(() => pg.verifyCatalogue(TEMP, { releaseOnly: true })).toThrow(/release/);
  });

  it('catches a changed catalogue or disk file', () => {
    const index = readFileSync(join(TEMP, 'index.json'));
    const sig = readFileSync(join(TEMP, 'index.json.sig'), 'utf8');
    const key = pg.trustedKeys().development;
    expect(pg.verifyBytes(index, sig, key)).toBe(true);
    expect(pg.verifyBytes(Buffer.from(index.toString().replace('"bytes":', '"bytes":1')), sig, key)).toBe(false);
    const d = disks[0], copy = Buffer.from(d.zip);
    copy[copy.length - 100] ^= 1;
    writeFileSync(join(TEMP, d.name), copy);
    try { expect(() => pg.verifyCatalogue(TEMP)).toThrow(/SHA-256/); }
    finally { writeFileSync(join(TEMP, d.name), d.zip); }
  });

  it('signs with the release key from the environment', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const k = pg.signingKey({ PGD_DISK_SIGNING_KEY: pem });
    expect(k.kind).toBe('release');
    expect(pg.rawPublic(k.key)).not.toBe(readFileSync(join(pg.ROOT, 'tools/disks/keys/development.pub'), 'utf8').trim());
  });
});

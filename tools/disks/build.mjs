#!/usr/bin/env node
// Build every game into a .pgdisk file, plus the signed catalogue (GAM-34):
//   node tools/disks/build.mjs                 writes dist/disks/v1/ (npm run build runs this after Astro)
//   node tools/disks/build.mjs --out <dir>     writes somewhere else
//   node tools/disks/build.mjs --lock          records each disk's version and file in tools/disks/versions.json
// A disk whose built file changed must have a higher `version` in its disk.ts; --lock refuses otherwise, and the
// unit test tests/unit/disk-files.test.ts fails CI until the lock matches. See tools/disks/README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDisk, catalogue, folders, LOCK, rawPublic, ROOT, signBytes, signingKey, trustedKeys } from './pgdisk.mjs';

const args = process.argv.slice(2);
const lockOnly = args.includes('--lock');
const outAt = args.indexOf('--out');
const out = resolve(outAt >= 0 ? args[outAt + 1] : join(ROOT, 'dist/disks/v1'));

const disks = [];
for (const folder of folders()) disks.push(await buildDisk(folder));
const ids = disks.map(d => d.id);
if (new Set(ids).size !== ids.length) throw new Error(`two disks share an id: ${ids.join(', ')}`);

if (lockOnly) {
  const old = readLock();
  const lock = {};
  for (const d of disks) {
    const was = old[d.id];
    if (was && was.sha256 !== d.sha256 && d.version <= was.version) {
      throw new Error(`${d.id}: its built file changed, so raise version in src/games/${d.folder}/disk.ts above ${was.version} first`);
    }
    lock[d.id] = { version: d.version, sha256: d.sha256 };
  }
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
  console.log(`wrote ${LOCK}`);
} else {
  const { kind, key } = signingKey();
  // A release key must be the one the apps build in, or every release app would reject this catalogue.
  if (kind === 'release') {
    const trusted = trustedKeys().release;
    if (!trusted) throw new Error('PGD_DISK_SIGNING_KEY is set but tools/disks/keys/release.pub is not committed');
    if (rawPublic(trusted) !== rawPublic(key)) throw new Error('PGD_DISK_SIGNING_KEY does not match tools/disks/keys/release.pub');
  }
  mkdirSync(out, { recursive: true });
  for (const d of disks) writeFileSync(join(out, d.name), d.zip);
  const index = catalogue(disks);
  writeFileSync(join(out, 'index.json'), index);
  writeFileSync(join(out, 'index.json.sig'), signBytes(Buffer.from(index), key));
  console.log(`wrote ${disks.length} disks and the catalogue to ${out}, signed with the ${kind} key ${rawPublic(key)}`);
}

function readLock() {
  try { return JSON.parse(readFileSync(LOCK, 'utf8')); } catch { return {}; }
}

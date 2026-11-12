#!/usr/bin/env node
// Check a built catalogue the way the apps will (GAM-34):
//   node tools/disks/verify.mjs [dir]          default dist/disks/v1
//   node tools/disks/verify.mjs [dir] --release   accept only the release key
// The signature must verify against a committed key in tools/disks/keys, and every disk file must match its
// size and SHA-256, unpack, and carry a manifest that agrees with the catalogue.
import { join, resolve } from 'node:path';
import { ROOT, verifyCatalogue } from './pgdisk.mjs';

const args = process.argv.slice(2);
const releaseOnly = args.includes('--release');
const dir = resolve(args.find(a => !a.startsWith('--')) ?? join(ROOT, 'dist/disks/v1'));
console.log(verifyCatalogue(dir, { releaseOnly }));

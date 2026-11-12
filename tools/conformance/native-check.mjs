#!/usr/bin/env node
// Plays every disk file in a folder through both hosts, Node (run.mjs) and the native script host
// (native.mjs, QuickJS), and fails unless the two conformance streams match byte for byte (GAM-36):
//   node tools/conformance/native-check.mjs <disk folder> <path/to/pgd_disk_run> [input.json]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [folder, binary, input = join(ROOT, 'tools/conformance/play.json')] = process.argv.slice(2);
if (!folder || !binary) throw new Error('Usage: node tools/conformance/native-check.mjs <disk folder> <pgd_disk_run> [input.json]');
const disks = readdirSync(folder).filter(name => name.endsWith('.pgdisk')).sort();
if (!disks.length) throw new Error(`no disk files in ${folder}`);
const temp = mkdtempSync(join(tmpdir(), 'pgd-native-check-'));
let failed = 0;
try {
  for (const name of disks) {
    const disk = resolve(folder, name), node = join(temp, `${name}.node.jsonl`), native = join(temp, `${name}.native.jsonl`);
    execFileSync(process.execPath, [join(ROOT, 'tools/conformance/run.mjs'), disk, input, node], { stdio: 'inherit' });
    process.stdout.write(`${name}: `);
    execFileSync(process.execPath, [join(ROOT, 'tools/conformance/native.mjs'), disk, input, native, resolve(binary)], { stdio: 'inherit' });
    const a = readFileSync(node, 'utf8').split('\n'), b = readFileSync(native, 'utf8').split('\n');
    const at = a.findIndex((line, i) => line !== b[i]);
    if (at < 0 && a.length === b.length) console.log(`${name}: the same in both hosts`);
    else { failed++; console.log(`${name}: differs from line ${at + 1}\n  node:   ${a[at]?.slice(0, 300)}\n  native: ${b[at]?.slice(0, 300)}`); }
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
if (failed) { console.error(`${failed} of ${disks.length} disks play differently in the native host`); process.exit(1); }

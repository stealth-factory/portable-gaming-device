#!/usr/bin/env node
// The conformance stream from the native script host (GAM-36): plays a disk file in QuickJS through
// native/core's pgd_disk_run, then decodes each frame's command buffer exactly as run.mjs does, so the two
// streams can be compared byte for byte:
//   node tools/conformance/native.mjs <file.pgdisk> <input.json> <output.jsonl> [path/to/pgd_disk_run]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScript } from './host.mjs';
import { decode, VERSION } from '../../native/shim/decode.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [disk, input, output, binary = join(ROOT, 'build/core/pgd_disk_run')] = process.argv.slice(2);
if (!disk?.endsWith('.pgdisk') || !input || !output || process.argv.length > 6) {
  throw new Error('Usage: node tools/conformance/native.mjs <file.pgdisk> <input.json> <output.jsonl> [pgd_disk_run]');
}
const script = parseScript(JSON.parse(readFileSync(input, 'utf8')));
const temp = mkdtempSync(join(tmpdir(), 'pgd-native-'));
try {
  const scriptFile = join(temp, 'script.json'), frames = join(temp, 'frames.bin');
  writeFileSync(scriptFile, JSON.stringify(script));
  execFileSync(resolve(binary), [resolve(disk), scriptFile, String(script.seed), frames, ROOT], { stdio: ['ignore', 'inherit', 'inherit'] });
  const records = read(readFileSync(frames));
  if (records.length !== script.frames + 1) throw new Error(`expected ${script.frames + 1} records, got ${records.length}`);
  const [init, ...rest] = records;
  const lines = [serialise(init.state), serialise({ type: 'init', commands: decode(init) })];
  for (const out of rest) lines.push(serialise({ type: 'frame', frame: out.state.frame, input: out.state.input, state: out.state.state, commands: decode(out) }));
  writeFileSync(resolve(output), lines.join('\n') + '\n');
} finally { rmSync(temp, { recursive: true, force: true }); }

/** pgd_disk_run's records: state JSON, ops as little-endian doubles, strings, blobs, each length-prefixed. */
function read(buf) {
  const records = [];
  let at = 0;
  const u32 = () => { const n = buf.readUInt32LE(at); at += 4; return n; };
  const bytes = () => { const n = u32(); const b = buf.subarray(at, at + n); at += n; return b; };
  while (at < buf.length) {
    const state = JSON.parse(bytes().toString('utf8'));
    const count = u32(), ops = new Float64Array(count);
    for (let i = 0; i < count; i++, at += 8) ops[i] = buf.readDoubleLE(at);
    const strings = Array.from({ length: u32() }, () => bytes().toString('utf8'));
    const blobs = Array.from({ length: u32() }, () => new Uint8Array(bytes()));
    records.push({ version: VERSION, ops, strings, blobs, state });
  }
  return records;
}

function serialise(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('A disk produced a non-finite command or state value');
    return item;
  });
}

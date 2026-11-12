#!/usr/bin/env node
// A deterministic disk host, based on tools/autopilot/i-invade.mjs.
import { rolldown } from 'rolldown';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { parseScript } from './host.mjs';
import { decode } from '../../native/shim/decode.mjs';
import { unzip } from '../disks/pgdisk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [folder, input, output] = process.argv.slice(2);
const folders = readdirSync(join(ROOT, 'src/games'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const packaged = folder?.endsWith('.pgdisk');
if ((!packaged && !folders.includes(folder)) || !input || !output || process.argv.length !== 5) {
  throw new Error(`Usage: node tools/conformance/run.mjs <${folders.join('|')}|file.pgdisk> <input.json> <output.jsonl>`);
}
const script = parseScript(JSON.parse(readFileSync(input, 'utf8')));
const temp = mkdtempSync(join(tmpdir(), 'pgd-conformance-'));
try {
  const entry = join(temp, 'entry.ts');
  writeFileSync(entry, [
    ...(packaged ? [] : [
      `export { disk } from ${JSON.stringify(join(ROOT, 'src/games', folder, 'disk.ts'))};`,
      `export { default as create } from ${JSON.stringify(join(ROOT, 'src/games', folder, 'game.ts'))};`,
    ]),
    `export { MODES } from ${JSON.stringify(join(ROOT, 'src/kit/platform/palettes.ts'))};`,
    `export { measurePixelText } from ${JSON.stringify(join(ROOT, 'src/kit/platform/font.ts'))};`,
  ].join('\n'));
  const bundle = await rolldown({ input: entry, onLog(level, log, next) { if (level !== 'info') next(level, log); } });
  let code;
  try { code = (await bundle.generate({ format: 'iife', name: 'PGDDisk' })).output[0].code; }
  finally { await bundle.close(); }
  // Each run has a fresh JavaScript realm: module-level game state and Math.random cannot leak between runs.
  const context = createContext({ Date: undefined, performance: undefined });
  runInContext(`Math.random = (${mulberry32.toString()})(${script.seed});`, context);
  let MODES, measurePixelText;
  if (packaged) {
    // A disk file (GAM-34): its two plain scripts, as an app runs them, beside the host's own palettes and font table.
    runInContext(code.replace(/^var PGDDisk\b/m, 'var PGDKit'), context);
    ({ MODES, measurePixelText } = runInContext('PGDKit', context));
    const files = unzip(readFileSync(resolve(folder)));
    runInContext(files['disk.js'].toString('utf8'), context);
    runInContext(files['game.js'].toString('utf8'), context);
  } else {
    runInContext(code, context);
    runInContext('var PGDGame = { create: PGDDisk.create };', context);
    ({ MODES, measurePixelText } = runInContext('PGDDisk', context));
  }
  // The same session and driver scripts the native runner evaluates (native/core/tools/disk_run.cpp), with the
  // font measure the native host supplies as __pgdMeasure.
  context.__pgdMeasure = (text, size) => measurePixelText(text, `${size}px Silkscreen`).width;
  for (const file of ['native/shim/shim.js', 'native/shim/host.js', 'tools/conformance/driver.js']) {
    runInContext(readFileSync(join(ROOT, file), 'utf8'), context, { filename: file });
  }
  const driver = runInContext('PGDConformance', context);
  const init = driver.boot({ script, palettes: MODES });
  const lines = [serialise(init.state), serialise({ type: 'init', commands: decode(init) })];
  for (let frame = 0; frame < script.frames; frame++) {
    const out = driver.tick();
    lines.push(serialise({ type: 'frame', frame: out.state.frame, input: out.state.input, state: out.state.state, commands: decode(out) }));
  }
  writeFileSync(resolve(output), lines.join('\n') + '\n');
} finally { rmSync(temp, { recursive: true, force: true }); }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function serialise(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('A disk produced a non-finite command or state value');
    return item;
  });
}

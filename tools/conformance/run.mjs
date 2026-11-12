#!/usr/bin/env node
// A deterministic disk host, based on tools/autopilot/i-invade.mjs.
import { rolldown } from 'rolldown';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { makeHost, parseScript } from './host.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [folder, input, output] = process.argv.slice(2);
const folders = readdirSync(join(ROOT, 'src/games'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
if (!folders.includes(folder) || !input || !output || process.argv.length !== 5) {
  throw new Error(`Usage: node tools/conformance/run.mjs <${folders.join('|')}> <input.json> <output.jsonl>`);
}
const script = parseScript(JSON.parse(readFileSync(input, 'utf8')));
const temp = mkdtempSync(join(tmpdir(), 'pgd-conformance-'));
try {
  const entry = join(temp, 'entry.ts');
  writeFileSync(entry, [
    `export { disk } from ${JSON.stringify(join(ROOT, 'src/games', folder, 'disk.ts'))};`,
    `export { default as create } from ${JSON.stringify(join(ROOT, 'src/games', folder, 'game.ts'))};`,
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
  runInContext(code, context);
  const { disk, create, MODES, measurePixelText } = runInContext('PGDDisk', context);
  const palette = MODES[script.palette];
  if (!palette) throw new Error(`Unknown palette: ${script.palette}`);
  const host = makeHost({ disk, script, palette, measurePixelText });
  const runtime = create(host.api);
  runtime.start();
  host.api.S.mode = 'ready';
  host.api.S.modeT = disk.id === 'tunnel' ? 1.4 : 1.2;
  const lines = [serialise({ type: 'header', stream: 1, contract: disk.contract, disk: disk.id, version: disk.version,
    seed: script.seed, dt: 1 / 60, frames: script.frames, grid: script.grid, palette: script.palette, colours: palette.pal }),
    serialise({ type: 'init', commands: host.takeCommands() })];
  let eventIndex = 0;
  for (let frame = 0; frame < script.frames; frame++) {
    const events = [];
    while (script.events[eventIndex]?.frame === frame) {
      const event = script.events[eventIndex++];
      host.input(event); events.push(event);
    }
    host.step(runtime);
    lines.push(serialise({ type: 'frame', frame, input: events, state: host.state(), commands: host.takeCommands() }));
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

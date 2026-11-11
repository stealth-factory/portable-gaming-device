import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TEMP = mkdtempSync(join(tmpdir(), 'pgd-conformance-test-'));
const folders = readdirSync(join(ROOT, 'src/games'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
let serial = 0;

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

function run(folder: string, script?: object) {
  const n = serial++, input = join(TEMP, `input-${n}.json`), output = join(TEMP, `stream-${n}.jsonl`);
  writeFileSync(input, script ? JSON.stringify(script) : readFileSync(join(ROOT, 'tools/conformance/play.json')));
  execFileSync(process.execPath, ['tools/conformance/run.mjs', folder, input, output], { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
  const stream = readFileSync(output, 'utf8');
  return { stream, hash: createHash('sha256').update(stream).digest('hex') };
}

describe('the Node disk conformance runner', () => {
  it.each(folders)('%s records 360 identical frames from the same seed and input', folder => {
    const a = run(folder), b = run(folder);
    expect(a.hash).toBe(b.hash);
    const lines = a.stream.trimEnd().split('\n');
    expect(lines.length).toBe(362);
    expect(lines[0]).toContain('"dt":0.016666666666666666');
    expect(lines[0]).toContain('"contract":1');
    expect(lines[2]).toContain('"mode":"ready"');
    expect(lines.at(-1)).toContain('"frame":359');
    expect(a.stream).toContain('["fillRect",');
    expect(a.stream).toContain('["txt",');
    if (folder === 'tunnel-raider') {
      expect(a.stream).toContain('["layer",0,360,240,');
      expect(a.stream).toContain('["stamp",0,0,20]');
    }
  }, 60000);

  it('records a different run when input changes', () => {
    const idle = run('bricks', { frames: 240, seed: 17 });
    const serve = run('bricks', { frames: 240, seed: 17, events: [{ frame: 90, press: ['fire'] }] });
    // Frame commands, rather than header/input metadata, must actually change.
    const commands = (stream: string) => stream.split('\n').filter(line => line.includes('"commands":')).map(line => line.slice(line.indexOf('"commands":'))).join('\n');
    expect(commands(idle.stream)).not.toBe(commands(serve.stream));
  }, 60000);

  it('changes random gameplay from a different seed', () => {
    const a = run('i-invade', { frames: 240, seed: 17 }), b = run('i-invade', { frames: 240, seed: 18 });
    const drawing = (stream: string) => stream.split('\n').filter(line => line.includes('"commands":')).map(line => line.slice(line.indexOf('"commands":'))).join('\n');
    expect(drawing(a.stream)).not.toBe(drawing(b.stream));
  }, 60000);

  it('drops BOOST and optional-slot countdown presses while retaining FIRE and held state', () => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { makeHost, parseScript } from './tools/conformance/host.mjs';
      const palette = { pal: ['#000000', '#111111', '#222222', '#333333'], roles: { bg: 0 } };
      const ids = ['fire', 'boost', 'fireL', 'fireR', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];
      for (const mode of ['ready', 'dying', 'clear', 'paused', 'play']) for (const path of ['buttons', 'press']) {
        const { api, input } = makeHost({ disk: { buttons: Object.fromEntries(ids.map(id => [id, { label: id }])) },
          script: parseScript({}), palette, measurePixelText: () => ({ width: 0 }) });
        api.S.mode = mode;
        input(path === 'buttons' ? { buttons: Object.fromEntries(ids.map(id => [id, true])) } : { press: ids });
        for (const id of ids) {
          const state = api.button(id);
          if (state.queued !== (id === 'fire' || mode === 'play')) throw new Error(mode + ' ' + path + ' queued ' + id);
          if (state.held !== (path === 'buttons')) throw new Error(mode + ' ' + path + ' held ' + id);
        }
        input({ buttons: Object.fromEntries(ids.map(id => [id, false])) });
        api.S.mode = 'play';
        if (mode !== 'play' && ids.slice(1).some(id => api.button(id).queued)) throw new Error('Countdown press leaked into play');
      }
      process.stdout.write('ok');
    `], { cwd: ROOT, encoding: 'utf8' });
    expect(result).toBe('ok');
  });

  it('keeps the previous palette ink for legacy unmapped sprite roles', () => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { makeHost, parseScript } from './tools/conformance/host.mjs';
      const palette = { pal: ['#000000', '#111111', '#222222', '#333333'], roles: { bg: 0 } };
      const { api, takeCommands } = makeHost({ disk: { buttons: {} }, script: parseScript({}), palette,
        measurePixelText: () => ({ width: 0 }) });
      api.g.fillStyle = palette.pal[2];
      api.g.fillStyle = api.col('rockjaw');
      process.stdout.write(JSON.stringify(takeCommands()));
    `], { cwd: ROOT, encoding: 'utf8' });
    expect(result).toBe('[["fillStyle",2],["fillStyle",2]]');
  });

  it('rejects unknown or out-of-order input instead of silently ignoring it', () => {
    expect(() => run('bricks', { frames: 10, events: [{ frame: 2, typo: true }] })).toThrow();
    expect(() => run('bricks', { frames: 10, events: [{ frame: 3 }, { frame: 2 }] })).toThrow();
  }, 60000);
});

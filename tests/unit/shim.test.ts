/* The disk contract shim's command buffer (GAM-36): native/shim/README.md is the layout the apps read. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
// @ts-expect-error: a plain script with no type declarations
import { decode, loadShim, OPS, TAG, VERSION } from '../../native/shim/decode.mjs';

const ROOT = new URL('../../', import.meta.url);
const SOURCE = readFileSync(new URL('native/shim/shim.js', ROOT), 'utf8');
const README = readFileSync(new URL('native/shim/README.md', ROOT), 'utf8');
const palette = { pal: ['#000000', '#111111', '#222222', '#333333'], roles: { bg: 0, text: 3, hud: 2 } };
const measurePixelText = (text: string) => ({ width: text.length * 6 });
type Frame = { version: number; ops: Float64Array; strings: string[]; blobs: Uint8Array[] };
interface Shim {
  api: any;
  take(): Frame;
  input(event: object): void;
  step(runtime: { update(dt: number): void; draw(): void }): void;
}
const make = (disk: object = { buttons: {} }, shim = loadShim()): Shim =>
  shim.createShim({ disk, grid: { w: 15, h: 10 }, palette, measurePixelText });

describe('the shim command buffer', () => {
  it('lays a frame out as documented', () => {
    const { api, take } = make();
    api.g.fillStyle = '#222222';
    api.g.fillRect(1, 2, 3, 4);
    api.g.arc(5, 6, 7, 0, 1, true);
    api.txt('HI', 8, 9);
    const frame = take();
    expect(frame.version).toBe(1);
    expect(Array.from(frame.ops)).toEqual([
      17, 1, 0, 2,
      1, 4, 0, 1, 0, 2, 0, 3, 0, 4,
      6, 6, 0, 5, 0, 6, 0, 7, 0, 0, 0, 1, 1, 1,
      18, 1, 2, 0,
      17, 1, 0, 3,
      20, 6, 2, 1, 0, 8, 0, 9, 0, 3, 2, 2, 0, 8,
    ]);
    expect(frame.strings).toEqual(['8px Silkscreen, "Courier New", monospace', 'HI', 'left']);
    expect(frame.blobs).toEqual([]);
  });

  it('round-trips every argument tag', () => {
    const { api, take } = make();
    api.tone(440, 0.1, undefined, null as unknown as number);
    api.buzz('fire'); api.buzz(12); api.buzz([10, 20, 30]);
    api.g.arc(0, 0, 1, 0, 2, false);
    api.setButtons({ boost: { label: 'nuke' }, fire: null });
    const frame = take();
    const tags = new Set<number>();
    for (let at = 0; at < frame.ops.length;) { const count = frame.ops[at + 1]; for (let i = 0; i < count; i++) tags.add(frame.ops[at + 2 + i * 2]); at += 2 + count * 2; }
    expect([...tags].sort()).toEqual([TAG.number, TAG.boolean, TAG.string, TAG.null, TAG.undefined, TAG.json].sort());
    expect(decode(frame)).toEqual([
      ['tone', 440, 0.1, undefined, null],
      ['buzz', 'fire'], ['buzz', 12], ['buzz', [10, 20, 30]],
      ['arc', 0, 0, 1, 0, 2, false],
      ['buttons', { boost: { label: 'nuke' }, fire: null }],
    ]);
  });

  it('shares a string within a frame and starts each frame empty', () => {
    const { api, take } = make();
    api.txt('SCORE', 0, 0); api.txt('SCORE', 0, 10);
    const first = take();
    expect(first.strings.filter(s => s === 'SCORE')).toHaveLength(1);
    api.g.fill();
    const second = take();
    expect(second.strings).toEqual([]);
    expect(Array.from(second.ops)).toEqual([9, 0]);
    expect(take().ops.length).toBe(0);
  });

  it('sends a layer on its first stamp and again only when its pixels change', () => {
    const { api, take } = make();
    const layer = api.layer(2, 2);
    layer.px.set([0, 1, 2, 3]);
    api.stamp(layer, 4, 5);
    api.stamp(layer, 6, 7);
    let frame = take();
    expect(decode(frame)).toEqual([['layer', 0, 2, 2, 'AAECAw=='], ['stamp', 0, 4, 5], ['stamp', 0, 6, 7]]);
    expect(Array.from(frame.blobs[0])).toEqual([0, 1, 2, 3]);
    layer.px[0] = 3;
    expect(Array.from(frame.blobs[0])).toEqual([0, 1, 2, 3]);
    api.stamp(layer, 0, 0);
    api.stamp(api.layer(1, 1), 0, 0);
    frame = take();
    expect(decode(frame).map((c: unknown[]) => c.slice(0, 2))).toEqual([['layer', 0], ['stamp', 0], ['layer', 1], ['stamp', 1]]);
    const bad = api.layer(1, 1); bad.px[0] = 4;
    expect(() => api.stamp(bad, 0, 0)).toThrow(/layer pixels/);
  });

  it('grows past its first allocation', () => {
    const { api, take } = make();
    for (let i = 0; i < 5000; i++) api.g.fillRect(i, 0, 1, 1);
    const commands = decode(take());
    expect(commands).toHaveLength(5000);
    expect(commands[4999]).toEqual(['fillRect', 4999, 0, 1, 1]);
  });

  it('carries every opcode as the command the disk sent', () => {
    const { api, take } = make({ buttons: {} });
    const g = api.g;
    g.fillRect(1, 2, 3, 4); g.beginPath(); g.rect(5, 6, 7, 8); g.moveTo(1, 1); g.lineTo(2, 2); g.arc(3, 3, 1, 0, 1);
    g.arcTo(1, 2, 3, 4, 5); g.closePath(); g.fill(); g.clip(); g.save(); g.restore(); g.translate(1, 2); g.rotate(0.5);
    g.scale(2, 3); g.setTransform(1, 0, 0, 1, 4, 5); g.fillStyle = '#111111'; g.font = '16px Silkscreen'; g.measureText('AB');
    api.txt('HI', 1, 2, 'hud', 'center', 16);
    const layer = api.layer(1, 1); api.stamp(layer, 3, 4);
    api.tone(220, 0.1); api.buzz('fire'); api.setButtons({ boost: { label: 'nuke' } }); api.best = 9; api.finishGame();
    const commands = decode(take());
    expect(commands).toEqual([
      ['fillRect', 1, 2, 3, 4], ['beginPath'], ['rect', 5, 6, 7, 8], ['moveTo', 1, 1], ['lineTo', 2, 2], ['arc', 3, 3, 1, 0, 1],
      ['arcTo', 1, 2, 3, 4, 5], ['closePath'], ['fill'], ['clip'], ['save'], ['restore'], ['translate', 1, 2], ['rotate', 0.5],
      ['scale', 2, 3], ['setTransform', 1, 0, 0, 1, 4, 5], ['fillStyle', 1], ['font', '16px Silkscreen'], ['measureText', 'AB', 12],
      ['font', '16px Silkscreen, "Courier New", monospace'], ['fillStyle', 2], ['txt', 'HI', 1, 2, 2, 'center', 16],
      ['layer', 0, 1, 1, 'AA=='], ['stamp', 0, 3, 4], ['tone', 220, 0.1], ['buzz', 'fire'], ['buttons', { boost: { label: 'nuke' } }],
      ['best', 9], ['finishGame'],
    ]);
    expect(new Set(commands.map((c: unknown[]) => c[0]))).toEqual(new Set(OPS.slice(1)));
  });

  it('refuses a non-finite number inside an object or array argument', () => {
    const { api } = make();
    expect(() => api.buzz([10, NaN])).toThrow(/non-finite/);
    expect(() => api.setButtons({ boost: { label: 'x', n: Infinity } })).toThrow(/non-finite/);
  });

  it('refuses a buffer version or opcode it does not know', () => {
    expect(() => decode({ version: 2, ops: new Float64Array(), strings: [], blobs: [] })).toThrow(/version/);
    expect(() => decode({ version: VERSION, ops: new Float64Array([99, 0]), strings: [], blobs: [] })).toThrow(/opcode/);
  });

  it('keeps Screen2D to the contract', () => {
    const { api } = make();
    expect(() => api.g.drawImage).toThrow(/Not in Screen2D/);
    expect(() => { api.g.lineWidth = 2; }).toThrow(/Not writable/);
    expect(() => { api.g.fillStyle = '#ff0000'; }).toThrow(/outside palette/);
  });

  it('runs in a context with only the language globals, as in QuickJS', () => {
    expect(SOURCE).not.toMatch(/^\s*(import|export)\b/m);
    const context = createContext({});
    runInContext('delete globalThis.console;', context);
    const shim = loadShim((code: string) => runInContext(code, context));
    const host = make({ buttons: { fire: { label: 'fire' } }, tap: true }, shim);
    let updates = 0;
    host.input({ buttons: { fire: true }, tap: { held: true, x: 30 } });
    host.step({ update() { updates++; host.api.txt('A', 0, 0); }, draw() { host.api.circ(1, 1, 1); } });
    expect(updates).toBe(1);
    expect(host.api.fireQueued).toBe(true);
    expect(host.api.tapX).toBe(30);
    const names = decode(host.take()).map((c: unknown[]) => c[0]);
    expect(names).toEqual(['font', 'fillStyle', 'txt', 'setTransform', 'fillStyle', 'fillRect', 'beginPath', 'arc', 'fill']);
  });

  it('documents every opcode in native/shim/README.md', () => {
    OPS.forEach((name: string, op: number) => { if (op) expect(README).toContain(`| ${op} | \`${name}\` |`); });
  });
});

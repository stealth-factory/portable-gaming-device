/* GAM-64: <PGDConsole> (react/) and the disks a page inserts through the embed bridge (src/console/embed-disks.ts). */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PGDConsole, embedUrl, isPGDMessage, type PGDConsoleProps, type PGDCommandMessage } from '../../react/index.js';
import { completeDisk, diskFromScript, gameFromScript, guard, mayInsert, readPgdisk, readSource } from '../../src/console/embed-disks';
import type { GameRuntime } from '../../src/games/types';
// @ts-expect-error: a plain script with no type declarations
import * as pg from '../../tools/disks/pgdisk.mjs';
import pkg from '../../package.json';

const DISK_JS = `var PGDDisk = { disk: { id: 'my-game', title: 'My Game', drawLoad(api, p) {} } };`;
const GAME_JS = `var PGDGame = { create(api) { return { start() {}, update(dt) {}, draw() {} }; } };`;

describe('embedUrl', () => {
  it('flags the embed and passes the first disk and language', () => {
    expect(embedUrl('https://pgd.example.com')).toBe('https://pgd.example.com?embed');
    expect(embedUrl('https://pgd.example.com/', { game: 'dino-run', lang: 'zh-hant' })).toBe('https://pgd.example.com/?embed&disk=dino-run#zh-hant');
    expect(embedUrl('/pgd/index.html?x=1', { chrome: true })).toBe('/pgd/index.html?x=1&embed=page');
  });
  it('ignores a language the console does not have', () => {
    // @ts-expect-error: not a PGD language
    expect(embedUrl('https://a.b', { lang: 'fr' })).toBe('https://a.b?embed');
  });
});

describe('<PGDConsole>', () => {
  it('renders on the server: an iframe and nothing that needs a window', () => {
    const props: PGDConsoleProps = { src: 'https://pgd.example.com', game: 'bricks', power: true, onGameOver: () => {} };
    const html = renderToString(createElement(PGDConsole, props));
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://pgd.example.com?embed&amp;disk=bricks"');
    expect(html).toContain('allow="autoplay; fullscreen; gamepad; screen-wake-lock"');
  });
  it('knows the bridge messages', () => {
    expect(isPGDMessage({ pgd: 1, type: 'ready' })).toBe(true);
    expect(isPGDMessage({ type: 'ready' })).toBe(false);
    expect(isPGDMessage(null)).toBe(false);
    const cmd: PGDCommandMessage = { pgd: 1, type: 'command', command: 'insert', disk: { disk: DISK_JS }, boot: true, request: 1 };
    expect(cmd.command).toBe('insert');
  });
});

describe('the package', () => {
  it('installs from git with nothing but React, and only the react folder and licences', () => {
    expect((pkg as Record<string, unknown>).dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toEqual({ react: '>=18' });
    expect(pkg.exports['./react']).toEqual({ types: './react/index.d.ts', default: './react/index.js' });
    expect(pkg.files).toContain('react/');
    expect(pkg.files.some(f => /^(src|native|tools)/.test(f))).toBe(false);
    // `sideEffects: false` would let Vite drop the console's own side-effect imports (main.ts) from the site's build
    expect((pkg as Record<string, unknown>).sideEffects).toBeUndefined();
  });
});

describe('inserted disks', () => {
  it('reads plain-script disk.js and game.js', () => {
    const { disk, game } = readSource({ disk: DISK_JS, game: GAME_JS }, 1000);
    expect(disk.id).toBe('my-game');
    expect(disk.title).toBe('MY GAME');
    expect(game).toBe(GAME_JS);
    expect(typeof gameFromScript(GAME_JS)).toBe('function');
    // the script's var stays out of the global object
    expect((globalThis as Record<string, unknown>).PGDDisk).toBeUndefined();
  });
  it('fills in the fields a harness leaves out', () => {
    const d = completeDisk(diskFromScript(DISK_JS), 1007);
    expect(d).toMatchObject({ contract: 1, version: 1, rating: '4+', order: 1007, slug: 'my-game', genre: 'CUSTOM', players: 1, verb: 'PLAY', overKey: 'over', againKey: 'again', manual: [] });
    expect(d.loadSecs).toBeGreaterThan(0); expect(d.loadSecs).toBeLessThanOrEqual(5);
    expect(d.strings['zh-hans']?.[d.nameKey]).toBe('MY GAME');
    expect(completeDisk({ id: 'x', drawLoad() {}, loadSecs: 30 }, 0).loadSecs).toBe(5);
  });
  it('refuses a disk it cannot run', () => {
    expect(() => completeDisk({ id: 'Bad Id', drawLoad() {} }, 0)).toThrow(/id/);
    expect(() => completeDisk({ id: 'ok' }, 0)).toThrow(/drawLoad/);
    expect(() => completeDisk({ id: 'ok', drawLoad() {}, contract: 2 }, 0)).toThrow(/contract/);
    expect(() => readSource({}, 0)).toThrow(/disk/);
    expect(() => gameFromScript('var nothing = 1;')).toThrow(/PGDGame/);
    // artwork the launcher would fail to decode mid-frame is refused at insert
    expect(() => readSource({ disk: DISK_JS, cover: { w: 128, h: 96, data: 'not-base64!' } }, 0)).toThrow(/base64/);
    expect(() => readSource({ disk: DISK_JS, cover: { w: 128, h: 96, data: 'AAAA' } }, 0)).toThrow(/too short/);
    expect(() => readSource({ disk: DISK_JS, preview: { w: 8, h: 8, fps: 8, frames: [] } }, 0)).toThrow(/frame/);
    expect(() => readSource({ disk: DISK_JS, preview: { w: 8, h: 8, fps: 8, frames: new Array(1) } }, 0)).toThrow(/frame 0/);
    const ownArt = `var PGDDisk = { disk: { id: 'art', drawLoad() {}, cover: { w: 4, h: 4, data: '!' } } };`;
    expect(() => readSource({ disk: ownArt }, 0)).toThrow(/base64/);
    expect(readSource({ disk: DISK_JS, cover: { w: 4, h: 4, data: btoa('\0\0\0\0') } }, 0).disk.cover?.w).toBe(4);
  });
  it('reads a real .pgdisk file', async () => {
    const built = await pg.buildDisk('dino-run');
    expect(Object.keys(readPgdisk(new Uint8Array(built.zip)))).toEqual(expect.arrayContaining(['manifest.json', 'disk.js', 'game.js']));
    const { disk, game } = readSource({ pgdisk: new Uint8Array(built.zip) }, 0);
    expect(disk.id).toBe('dino');
    expect(disk.cover?.w).toBe(128);
    expect(typeof gameFromScript(game!)).toBe('function');
  }, 60000);
  it('stops a game that throws instead of the console', () => {
    const errors: unknown[] = [];
    let draws = 0;
    const rt: GameRuntime = { start() {}, update() { throw new Error('boom'); }, draw() { draws++; } };
    const g = guard(rt, e => errors.push(e));
    g.update(1 / 60); g.update(1 / 60); g.draw();
    expect(errors).toHaveLength(1);
    expect(draws).toBe(0);
  });
  it('lets only trusted origins insert', () => {
    const own = 'https://pgd.example.com';
    expect(mayInsert(own, own, '')).toBe(true);
    expect(mayInsert('http://localhost:3000', own, '')).toBe(true);
    expect(mayInsert('https://evil.example', own, '')).toBe(false);
    expect(mayInsert('https://builder.dev', own, 'https://builder.dev, https://*.vercel.app')).toBe(true);
    expect(mayInsert('https://pr-1.vercel.app', own, 'https://builder.dev,https://*.vercel.app')).toBe(true);
    expect(mayInsert('http://pr-1.vercel.app', own, 'https://*.vercel.app')).toBe(false);
    expect(mayInsert('https://vercel.app.evil.com', own, 'https://*.vercel.app')).toBe(false);
  });
});

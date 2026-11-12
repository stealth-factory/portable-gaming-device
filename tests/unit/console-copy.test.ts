/* GAM-69: the self-hosted console. bin/pgd-console.mjs copies the built console/ into a site and swaps the
   placeholder path for the one the site serves it at; package.json ships the folders a git install needs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: a plain script with no type declarations
import { copyConsole, normaliseBase, rebase } from '../../bin/pgd-console.mjs';
import pkg from '../../package.json';

const tmp = () => mkdtempSync(join(tmpdir(), 'pgd-console-'));

/** A small stand-in for a built console/ folder. */
function fakeConsole(){
  const src = tmp();
  mkdirSync(join(src, '_astro'));
  writeFileSync(join(src, 'pgd-console.json'), JSON.stringify({ version: '9.9.9', placeholder: '/__pgd_base__' }));
  writeFileSync(join(src, 'index.html'), '<link href="/__pgd_base__/favicon.svg"><script src="/__pgd_base__/_astro/main.js"></script>');
  writeFileSync(join(src, '_astro', 'main.js'), 'const BASE="/__pgd_base__";fetch("/__pgd_base__/_astro/game.js")');
  writeFileSync(join(src, '_astro', 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return src;
}

describe('normaliseBase', () => {
  it('gives a path with a leading and a trailing slash', () => {
    expect(normaliseBase()).toBe('/pgd/');
    expect(normaliseBase('games/pgd')).toBe('/games/pgd/');
    expect(normaliseBase('/x/')).toBe('/x/');
    expect(normaliseBase('/')).toBe('/');
  });
  it('refuses full addresses and characters a path cannot hold', () => {
    expect(() => normaliseBase('https://a.b/pgd/')).toThrow(/not a full address/);
    expect(() => normaliseBase('//cdn.example.com/pgd')).toThrow(/not a full address/);
    expect(() => normaliseBase('/p g d/')).toThrow(/characters/);
    expect(() => normaliseBase('/a"b/')).toThrow(/characters/);
    expect(() => normaliseBase('/games/c#/')).toThrow(/characters/);
    expect(() => normaliseBase('/pgd?v=1/')).toThrow(/characters/);
  });
});

describe('rebase', () => {
  it('swaps the placeholder, with and without a slash after it', () => {
    expect(rebase('"/__pgd_base__/_astro/a.js" "/__pgd_base__"', '/pgd/')).toBe('"/pgd/_astro/a.js" "/pgd"');
    expect(rebase('"/__pgd_base__/x" "/__pgd_base__"', '/')).toBe('"/x" "/"');
  });
});

describe('copyConsole', () => {
  it('copies every file and rewrites the text ones for the path', () => {
    const src = fakeConsole(), dest = join(tmp(), 'public', 'pgd');
    const r = copyConsole(dest, { base: 'games/pgd', source: src });
    expect(r).toMatchObject({ version: '9.9.9', base: '/games/pgd/', files: 4 });
    expect(readFileSync(join(dest, 'index.html'), 'utf8')).toBe('<link href="/games/pgd/favicon.svg"><script src="/games/pgd/_astro/main.js"></script>');
    expect(readFileSync(join(dest, '_astro', 'main.js'), 'utf8')).toBe('const BASE="/games/pgd";fetch("/games/pgd/_astro/game.js")');
    expect([...readFileSync(join(dest, '_astro', 'pic.png'))]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
  it('replaces an earlier copy', () => {
    const src = fakeConsole(), dest = join(tmp(), 'pgd');
    copyConsole(dest, { source: src });
    writeFileSync(join(dest, 'stale.js'), '');
    copyConsole(dest, { source: src });
    expect(existsSync(join(dest, 'stale.js'))).toBe(false);
  });
  it('never wipes a folder that holds other files', () => {
    const src = fakeConsole(), site = tmp();
    writeFileSync(join(site, 'robots.txt'), 'keep me');
    expect(() => copyConsole(site, { source: src })).toThrow(/other files/);
    expect(readFileSync(join(site, 'robots.txt'), 'utf8')).toBe('keep me');
  });
  it('never copies over the console it copies from', () => {
    const src = fakeConsole();
    expect(() => copyConsole(src, { source: src })).toThrow(/copied from/);
    expect(() => copyConsole(join(src, '..'), { source: src })).toThrow(/copied from|other files/);
    expect(existsSync(join(src, 'pgd-console.json'))).toBe(true);
  });
  it('says how to get a console when there is none', () => {
    expect(() => copyConsole(join(tmp(), 'pgd'), { source: tmp() })).toThrow(/console-vX\.Y\.Z/);
  });
});

describe('package.json', () => {
  it('ships the component, the copy command and the built console, and nothing else of the site', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['react/', 'bin/', 'console/']));
    expect(pkg.files.some((f: string) => f.startsWith('src'))).toBe(false);
    expect(pkg.bin).toEqual({ 'pgd-console': 'bin/pgd-console.mjs' });
    expect(pkg.scripts['build:console']).toMatch(/PUBLIC_PGD_CONSOLE_BUILD=1/);
  });
});

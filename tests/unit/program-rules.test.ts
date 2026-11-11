/* The console program (src/console/program/) runs in the browser and, as the system disk, inside the native
   apps with no browser at all (GAM-39). It reaches the machine only through its Platform. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROGRAM = join(dirname(fileURLToPath(import.meta.url)), '../../src/console/program');
const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(PROGRAM).filter(f => f.endsWith('.ts'));
/** Source with comments taken out, so a comment may still say what the web does. */
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const BANNED = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'performance', 'AudioContext',
  'setTimeout', 'setInterval', 'requestAnimationFrame', 'addEventListener', 'fetch', 'HTMLElement', 'KeyboardEvent', 'PointerEvent'];

describe('the console program\'s rules', () => {
  it('has modules', () => { expect(files.length).toBeGreaterThanOrEqual(3); });

  it.each(files.map(f => [relative(PROGRAM, f), f]))('%s names no browser global', (_n, f) => {
    const src = code(f);
    for (const name of BANNED) expect(src, name).not.toMatch(new RegExp(`(?<![\\w.'"])${name}\\b(?!\\s*:)`));
  });

  it.each(files.map(f => [relative(PROGRAM, f), f]))('%s does not import the web console', (_n, f) => {
    expect(code(f)).not.toMatch(/from\s+['"][^'"]*(\/core|\/web\/[^'"]*|\/pwa|\/bus)['"]/);
  });
});

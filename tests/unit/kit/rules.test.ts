import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '../../../src/kit');
const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(KIT).filter(f => f.endsWith('.ts'));

describe('the kit\'s rules', () => {
  it('has modules', () => { expect(files.length).toBeGreaterThan(5); });
  it.each(files.map(f => [relative(KIT, f), f]))('%s does not import from src/console', (_n, f) => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/from\s+['"][^'"]*console\//);
  });
  it.each(files.map(f => [relative(KIT, f), f]))('%s imports from src/games only for types', (_n, f) => {
    for (const m of readFileSync(f, 'utf8').matchAll(/^import\s+(type\s+)?[^;]*from\s+['"]([^'"]+)['"]/gm)) {
      if (m[2].includes('games/')) expect(m[1], `${m[0]}`).toBeTruthy();
    }
  });
  it.each(files.map(f => [relative(KIT, f), f]))('%s keeps no state at module level and touches nothing on load', (_n, f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/^(let|var)\s/m);
    // Role labels such as window: are data, rather than references to browser globals.
    expect(src).not.toMatch(/\b(document|window|navigator|localStorage|AudioContext|setTimeout|setInterval|requestAnimationFrame)\b(?!\s*:)/);
  });
  it('imports in a bare process without touching any globals', async () => {
    const before = Object.keys(globalThis).sort();
    const mod = await import('../../../src/kit/play');
    expect(Object.keys(mod).length).toBeGreaterThan(20);
    expect(Object.keys(globalThis).sort()).toEqual(before);
  });
});

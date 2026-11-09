import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISKS, loadGameCode } from '../../src/games/registry';

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/games');
const gameDirs = readdirSync(GAMES_DIR).filter(f => statSync(join(GAMES_DIR, f)).isDirectory());

describe('game disks', () => {
  it('finds a disk in every game folder', () => {
    expect(DISKS.length).toBe(gameDirs.length);
    expect(DISKS.length).toBeGreaterThanOrEqual(2);
  });
  it('has unique ids, slugs and menu positions', () => {
    for (const key of ['id', 'slug', 'order'] as const) expect(new Set(DISKS.map(d => d[key])).size).toBe(DISKS.length);
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s loads within five seconds', (_id, d) => {
    expect(d.loadSecs).toBeGreaterThan(0);
    expect(d.loadSecs).toBeLessThanOrEqual(5);
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s labels every button it maps in all three languages', async (_id, d) => {
    const { I18N } = await import('../../src/console/i18n');
    for (const lang of ['en', 'zh-hant', 'zh-hans'] as const) for (const [slot, spec] of Object.entries(d.buttons)) {
      const text = d.strings[lang]?.[spec.label] ?? (I18N as any)[lang]?.[spec.label];
      expect(typeof text, `${slot} → ${spec.label} (${lang})`).toBe('string');
    }
  });
  it('a stickless disk maps only the pad slots the set has (pad1 to pad6)', () => {
    for (const d of DISKS.filter(d => d.controls === 'pad')) {
      const pads = Object.keys(d.buttons).filter(k => k.startsWith('pad'));
      expect(pads.length).toBeGreaterThan(0);
      for (const k of pads) expect(k).toMatch(/^pad[1-6]$/);
    }
    expect(DISKS.find(d => d.id === 'iinvade')?.controls).toBe('pad');
  });
  it('load times differ between games', () => {
    expect(new Set(DISKS.map(d => d.loadSecs)).size).toBe(DISKS.length);
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s has a load curve from 0 to 1 that never goes backwards', (_id, d) => {
    expect(d.steps[0]).toEqual([0, 0]);
    expect(d.steps[d.steps.length - 1]).toEqual([1, 1]);
    for (let i = 1; i < d.steps.length; i++) {
      expect(d.steps[i][0]).toBeGreaterThan(d.steps[i - 1][0]);
      expect(d.steps[i][1]).toBeGreaterThanOrEqual(d.steps[i - 1][1]);
    }
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s has a name and instructions in all three languages', (_id, d) => {
    expect(d.manual.length).toBeGreaterThan(0);
    for (const l of ['en', 'zh-hant', 'zh-hans'] as const) expect(d.strings?.[l]?.[d.nameKey]).toBeTruthy();
  });
  it('no two disks define the same string key differently (they share one table)', () => {
    for (const l of ['en', 'zh-hant', 'zh-hans'] as const) {
      const seen = new Map<string, [string, unknown]>();
      for (const d of DISKS) for (const [k, v] of Object.entries(d.strings?.[l] ?? {})) {
        const prev = seen.get(k);
        if (prev && prev[1] !== v) throw new Error(`"${k}" (${l}) differs between ${prev[0]} and ${d.id}`);
        seen.set(k, [d.id, v]);
      }
    }
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s has a share image for its page', (_id, d) => {
    expect(existsSync(join(GAMES_DIR, '../../public', `og-${d.slug}.png`))).toBe(true);
  });
  it.each(DISKS.map(d => [d.id, d] as const))('%s has game code that makes a runtime', async (_id, d) => {
    const create = await loadGameCode(d.id);
    expect(typeof create).toBe('function');
  });
});

describe('plug-in rule', () => {
  // games talk to the console only through the ConsoleAPI they are handed
  const files = gameDirs.flatMap(dir => readdirSync(join(GAMES_DIR, dir)).filter(f => f.endsWith('.ts')).map(f => join(dir, f)));
  it.each(files)('%s does not import from src/console', f => {
    const src = readFileSync(join(GAMES_DIR, f), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*console\//);
  });
});

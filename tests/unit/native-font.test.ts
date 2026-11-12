/* The native core's bitmap font is baked from the pinned Silkscreen by tools/fonts/atlas.cjs (GAM-35).
   Re-run it after changing the font: node tools/fonts/atlas.cjs (needs Playwright with Chromium). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import metrics from '../../src/kit/platform/font-metrics.json';

const header = readFileSync(new URL('../../native/core/include/pgd/font_atlas.hpp', import.meta.url), 'utf8');
const font = readFileSync(new URL('../../tools/fonts/Silkscreen-Regular.ttf', import.meta.url));
const advances = metrics.advances as Record<string, number>;

/** The `{code, advance, …}` rows of one glyph table in the header. */
function glyphs(size: number): Array<[number, number]> {
  const body = header.match(new RegExp(`kGlyphs${size}\\[\\] = \\{([\\s\\S]*?)\\n\\};`));
  if (!body) throw new Error(`no kGlyphs${size} table`);
  return [...body[1].matchAll(/\{(\d+), (-?\d+),/g)].map(m => [Number(m[1]), Number(m[2])]);
}

describe('native font atlas', () => {
  it('was baked from the pinned font', () => {
    expect(header).toContain(`kSourceSha256 = "${metrics.sha256}"`);
    expect(createHash('sha256').update(font).digest('hex')).toBe(metrics.sha256);
  });

  it('has every printable character in the metrics, with the same advances', () => {
    const codes = Object.keys(advances).map(Number).filter(c => c >= 32).sort((a, b) => a - b);
    expect(header).toContain(`kGlyphCount = ${codes.length};`);
    for (const size of [8, 16]) {
      const rows = glyphs(size);
      expect(rows.map(r => r[0])).toEqual(codes);
      for (const [code, adv] of rows) expect(adv).toBe((advances[code] * size) / metrics.unitsPerEm);
    }
    expect(header).toContain(`kMissingAdvance8 = ${(metrics.missingAdvance * 8) / metrics.unitsPerEm};`);
  });
});

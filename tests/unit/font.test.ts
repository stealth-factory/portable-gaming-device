import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { measurePixelText } from '../../src/kit/platform/font';
import metrics from '../../src/kit/platform/font-metrics.json';

describe('shared Silkscreen metrics', () => {
  it('measures proportional glyphs at both pixel sizes', () => {
    const font = '8px Silkscreen, "Courier New", monospace';
    expect(measurePixelText('III', font).width).toBe(9);
    expect(measurePixelText('WWW', font).width).toBe(21);
    expect(measurePixelText('MARTIAN STORM', font).width).toBe(74);
    expect(measurePixelText('MARTIAN STORM', '16px Silkscreen').width).toBe(148);
  });
  it('normalises Canvas whitespace and preserves an empty string', () => {
    expect(measurePixelText('', '8px Silkscreen').width).toBe(0);
    expect(measurePixelText('A\tB\nC', '8px Silkscreen')).toEqual(measurePixelText('A B C', '8px Silkscreen'));
  });
  it('refuses fonts outside the frozen contract', () => {
    for (const font of ['12px Silkscreen', '8px serif', 'bold 8px Silkscreen']) {
      expect(() => measurePixelText('PGD', font)).toThrow(/8 or 16 px Silkscreen/);
    }
  });
  it('identifies the exact font used to generate the shared table', () => {
    const font = readFileSync(new URL('../../tools/fonts/Silkscreen-Regular.ttf', import.meta.url));
    expect(createHash('sha256').update(font).digest('hex')).toBe(metrics.sha256);
  });
});

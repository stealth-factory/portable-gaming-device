/* The native core's palettes are generated from the web's (GAM-35). Regenerate after changing
   src/kit/platform/palettes.ts: node native/core/tools/gen-palettes.mjs */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error: a plain script with no type declarations
import { palettesHeader, OUT } from '../../native/core/tools/gen-palettes.mjs';

describe('native palettes', () => {
  it('match the web console\'s phosphor modes', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(palettesHeader());
  });
});

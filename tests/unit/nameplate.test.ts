import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Nameplate } from '../../src/components/Nameplate';
import { VERSION } from '../../src/components/site';

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'));

describe('nameplate version', () => {
  it('reads the release from package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('stamps that version on its own line under the plate', () => {
    const html = renderToStaticMarkup(createElement(Nameplate));
    expect(html).toContain('class="np-badge"');
    expect(html).toContain(`class="np-ver">v${pkg.version}</small>`);
    expect(html.indexOf('np-badge')).toBeLessThan(html.indexOf('np-ver'));
  });
});

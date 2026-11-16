import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Nameplate } from '../../src/components/Nameplate';
import { VERSION } from '../../src/components/site';
import { readPlate, PGD_PLATE } from '../../src/console/nameplate';

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

describe('nameplate from the framing page', () => {
  it('keeps the PGD plate when the page sets none', () => {
    expect(readPlate(undefined)).toBe(PGD_PLATE);
    expect(readPlate(null)).toBe(PGD_PLATE);
    expect(readPlate('')).toBe(PGD_PLATE);
    expect(readPlate({})).toEqual(PGD_PLATE);
  });

  it('gives the set ids to swap the name and logo, the logo hidden at first', () => {
    const html = renderToStaticMarkup(createElement(Nameplate));
    expect(html).toContain('<b id="np-name">PGD<span class="np-rest"> · PORTABLE GAMING DEVICE</span></b>');
    expect(html).toContain('<img id="np-logo" class="np-logo" alt="" hidden=""/>');
  });

  it('takes a string as the name', () => {
    expect(readPlate('RETROBOX')).toEqual({ text: 'RETROBOX', rest: '', image: null, alt: 'RETROBOX', model: 'PGD-01' });
  });

  it('joins the long part with a dot, as the PGD plate does', () => {
    expect(readPlate({ text: 'RETROBOX', rest: 'GAME STUDIO' }).rest).toBe(' · GAME STUDIO');
    expect(readPlate({ text: 'RETROBOX', rest: ' · GAME STUDIO' }).rest).toBe(' · GAME STUDIO');
  });

  it('trims, strips control characters and caps the lengths', () => {
    const p = readPlate({ text: `  RETRO\u0007BOX ${'X'.repeat(40)}`, model: 'RBX-01-AND-A-VERY-LONG-CODE' });
    expect(p.text.startsWith('RETROBOX')).toBe(true);
    expect(p.text.length).toBe(24);
    expect(p.model.length).toBe(16);
  });

  it('can change only the model code', () => {
    expect(readPlate({ model: 'RBX-01' })).toEqual({ ...PGD_PLATE, model: 'RBX-01' });
  });

  it('shows a logo from a web address, a path or a data:image URL', () => {
    for (const image of ['https://retrobox.example/plate.svg', '/brand/plate.png', './plate.png', 'data:image/png;base64,AAAA', 'data:image/svg+xml,%3Csvg%3E']) {
      const p = readPlate({ image, text: 'RETROBOX' });
      expect(p.image).toBe(image);
      expect(p.alt).toBe('RETROBOX');
    }
    expect(readPlate({ image: '/x.png', alt: 'Retrobox' }).alt).toBe('Retrobox');
  });

  it('refuses other image addresses', () => {
    for (const image of ['javascript:alert(1)', '//evil.example/x.png', 'data:text/html,<b>', 'ftp://x/y.png', 42]) {
      expect(() => readPlate({ image })).toThrow(/nameplate image/);
    }
  });
});

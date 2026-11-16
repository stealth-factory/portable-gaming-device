/* A framing app rebranding the console: the name its nameplate gives the machine (brand.ts), and the boot splash. */
import { describe, expect, it } from 'vitest';
import { PGD_BRAND, biosLine, dosName, menuTitle, cabinetStamp, fullName, setBrand, brand, onBrand } from '../../src/console/brand';
import { readPlate, plateBrand, PGD_PLATE } from '../../src/console/nameplate';
import { bootScript } from '../../src/console/boot';
import { readSplash, splashWithoutImage } from '../../src/console/splash-config';
import { splashPhase, SPLASH_LEN, CHIME_AT, PGD_SPLASH } from '../../src/console/splash';
import { shadeLogo } from '../../src/console/web/splash-logo';

describe('the console\'s name', () => {
  it('is PGD by default, as before', () => {
    expect(biosLine(PGD_BRAND)).toBe('PGD-01 GAMING DEVICE   BIOS 1.0');
    expect(dosName(PGD_BRAND)).toBe('PGD-DOS');
    expect(menuTitle(PGD_BRAND)).toBe('PGD-01 PORTABLE GAMING DEVICE');
    expect(cabinetStamp(PGD_BRAND)).toBe('PGD-01 · 12″ PHOSPHOR MONITOR');
    expect(fullName(PGD_BRAND)).toBe('PGD-01 Portable Gaming Device');
    expect(plateBrand(PGD_PLATE)).toBe(PGD_BRAND);
  });

  it('follows a nameplate\'s text and model', () => {
    const b = plateBrand(readPlate({ text: 'Retrobox', rest: 'Game Studio', model: 'RBX-01' }));
    expect(b).toEqual({ name: 'RETROBOX', long: 'GAME STUDIO', model: 'RBX-01' });
    expect(biosLine(b)).toBe('RBX-01 RETROBOX   BIOS 1.0');
    expect(dosName(b)).toBe('RETROBOX-DOS');
    expect(menuTitle(b)).toBe('RBX-01 RETROBOX GAME STUDIO');
    expect(cabinetStamp(b)).toBe('RBX-01 · 12″ PHOSPHOR MONITOR');
    expect(fullName(b)).toBe('RBX-01 RETROBOX');
  });

  it('takes a logo\'s alt text for its name, and keeps PGD\'s words with only a model', () => {
    expect(plateBrand(readPlate({ image: '/logo.svg', alt: 'Acme Arcade', model: 'AC-9' })).name).toBe('ACME ARCADE');
    const m = plateBrand(readPlate({ model: 'XYZ-2' }));
    expect(m).toEqual({ ...PGD_BRAND, model: 'XYZ-2' });
    expect(menuTitle(m)).toBe('XYZ-2 PORTABLE GAMING DEVICE');
  });

  it('keeps a plate\'s own long name even when it says PGD', () => {
    const b = plateBrand(readPlate({ text: 'PGD', rest: 'Game Studio', model: 'PGD-02' }));
    expect(menuTitle(b)).toBe('PGD-02 PGD GAME STUDIO');
    expect(fullName(b)).toBe('PGD-02 PGD');
  });

  it('keeps the DOS name to letters and digits', () => {
    expect(dosName({ name: 'MY ARCADE 3000!', long: '', model: 'M-1' })).toBe('MYARCADE-DOS');
    expect(dosName({ name: '★', long: '', model: 'M-1' })).toBe('PGD-DOS');
  });

  it('reaches the boot screen and tells listeners', () => {
    const heard: string[] = [];
    const off = onBrand(b => heard.push(b.model));
    setBrand({ name: 'RETROBOX', long: '', model: 'RBX-01' });
    expect(bootScript(2, false).lines[0]).toBe('RBX-01 RETROBOX   BIOS 1.0');
    expect(bootScript(2, false).lines).toContain('STARTING RETROBOX-DOS...');
    setBrand(PGD_BRAND);
    off();
    expect(heard).toEqual(['RBX-01', 'PGD-01']);
    expect(brand()).toBe(PGD_BRAND);
    expect(bootScript(2, false).lines[0]).toBe('PGD-01 GAMING DEVICE   BIOS 1.0');
  });
});

describe('the boot splash', () => {
  it('is PGD\'s own unless told otherwise', () => {
    for (const v of [undefined, null, '', true, {}, { sub: 'only a sub' }]) expect(readSplash(v)).toEqual({ kind: 'pgd' });
    expect(readSplash(false)).toEqual({ kind: 'none' });
    expect(PGD_SPLASH.pgd).toBe(true);
  });

  it('takes text, a sub line and a logo', () => {
    expect(readSplash('Retrobox')).toEqual({ kind: 'own', text: 'RETROBOX', sub: '', image: null, invert: false });
    expect(readSplash({ text: 'x'.repeat(40), sub: 'Games\u0007', image: ' /brand/logo.png ', invert: true }))
      .toEqual({ kind: 'own', text: 'X'.repeat(24), sub: 'GAMES', image: '/brand/logo.png', invert: true });
    expect(readSplash({ image: 'data:image/png;base64,AAAA' })).toMatchObject({ kind: 'own', text: '', image: 'data:image/png;base64,AAAA' });
  });

  it('refuses an image address the console won\'t show', () => {
    for (const image of ['javascript:alert(1)', '//evil.example/x.png', 'https://', 'data:text/html,hi', 42])
      expect(() => readSplash({ image }), String(image)).toThrow(/splash image/);
    // the embed falls back to the rest of the splash, keeping its text
    expect(splashWithoutImage({ text: 'Retrobox', sub: 'Games', image: 'https://' })).toMatchObject({ kind: 'own', text: 'RETROBOX', sub: 'GAMES', image: null });
    expect(splashWithoutImage({ image: 'https://' })).toEqual({ kind: 'pgd' });
  });

  it('draws in, chimes, types its line and fades within its time', () => {
    expect(splashPhase(0, false)).toMatchObject({ reveal: 0, typed: 0, fading: false });
    expect(splashPhase(CHIME_AT, false).reveal).toBe(1);
    expect(splashPhase(1.2, false).typed).toBeGreaterThan(5);
    expect(splashPhase(SPLASH_LEN - 0.1, false).fading).toBe(true);
    expect(splashPhase(0, true)).toMatchObject({ reveal: 1, typed: Infinity });
    // the longest sub line a splash takes (48) is all typed before the fade
    expect(splashPhase(SPLASH_LEN - 0.26, false, 48).typed).toBeGreaterThanOrEqual(48);
  });

  it('shades a logo by brightness and opacity, and inverts a dark one', () => {
    // white, mid grey, black, and transparent white
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 128, 128, 128, 255, 0, 0, 0, 255, 255, 255, 255, 0]);
    expect([...shadeLogo(rgba, 4, 1).px]).toEqual([3, 2, 0, 0]);
    expect([...shadeLogo(rgba, 4, 1, true).px]).toEqual([0, 2, 3, 0]);
  });
});

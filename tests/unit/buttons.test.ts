import { describe, it, expect, beforeEach } from 'vitest';
import * as Btn from '../../src/console/buttons';
import { DISKS } from '../../src/games/registry';

describe('action button slots', () => {
  beforeEach(() => {
    Btn.defineSlot('fire', ['Space'], 'spark');
    Btn.defineSlot('boost', ['KeyB'], 'boost');
    Btn.useButtons({});
  });

  it('gives each slot the app\'s label and leaves unmapped slots dark', () => {
    Btn.useButtons({ fire: { label: 'menuSel' } });
    expect(Btn.button('fire')).toMatchObject({ label: 'menuSel', enabled: true });
    expect(Btn.button('boost').enabled).toBe(false);
  });

  it('ignores presses on a dark slot and takes them on a live one', () => {
    Btn.useButtons({ fire: { label: 'spark' }, boost: { label: 'boost', enabled: false } });
    expect(Btn.press('boost')).toBe(false);
    expect(Btn.button('boost').queued).toBe(false);
    expect(Btn.press('fire')).toBe(true);
    expect(Btn.button('fire')).toMatchObject({ queued: true, held: true });
    Btn.clearQueued('fire'); Btn.release('fire');
    expect(Btn.button('fire')).toMatchObject({ queued: false, held: false });
  });

  it('lets an app change a slot for now and put the declared one back', () => {
    Btn.useButtons({ fire: { label: 'spark' }, boost: { label: 'shield' } });
    Btn.setButtons({ boost: { label: 'nuke' } });
    expect(Btn.button('boost').label).toBe('nuke');
    Btn.setButtons({ boost: null });
    expect(Btn.button('boost').label).toBe('shield');
    Btn.setButtons({ boost: { enabled: false } });
    expect(Btn.button('boost')).toMatchObject({ label: 'shield', enabled: false });
  });

  it('handles any number of slots and ignores ones the set lacks', () => {
    Btn.defineSlot('alt', ['KeyC'], 'alt');
    Btn.useButtons({ fire: { label: 'spark' }, alt: { label: 'warp' } });
    expect(Btn.button('alt')).toMatchObject({ label: 'warp', enabled: true });
    expect(Btn.slotForKey('KeyC')?.id).toBe('alt');
    expect(() => Btn.setButtons({ gamepadY: { label: 'x' } })).not.toThrow();
    expect(Btn.button('gamepadY').enabled).toBe(false);
  });

  it('every disk maps its buttons to I18N keys it ships', () => {
    for (const d of DISKS) {
      expect(Object.keys(d.buttons).length).toBeGreaterThan(0);
      for (const spec of Object.values(d.buttons)) expect(typeof spec.label).toBe('string');
    }
  });
});

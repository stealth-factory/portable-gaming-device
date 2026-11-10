import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initState, move, bringToFront, update, tap, previewing, previewT, cursorOn, REPEAT_FIRST, REPEAT_NEXT, PREVIEW_AFTER, type Target } from '../../src/console/launcher/state';
import { createLauncher, type LauncherSystem } from '../../src/console/launcher';

describe('launcher state', () => {
  it('opens at the given disk, wrapped into the box', () => {
    expect(initState(5, 3).sel).toBe(3);
    expect(initState(5, 7).sel).toBe(2);
    expect(initState(0, 3).sel).toBe(0);
  });
  it('wraps round both ways', () => {
    expect(move(initState(5, 4), 1).sel).toBe(0);
    expect(move(initState(5, 0), -1).sel).toBe(4);
    expect(move(initState(1, 0), 1).sel).toBe(0);
  });
  it('restarts the preview clock on a move', () => {
    const s = { ...initState(5, 0), t: 3 };
    expect(move(s, 1).t).toBe(0);
    expect(bringToFront(s, 0).t).toBe(3);   // already at the front: nothing changes
  });
  it('repeats a held stick after 0.4 s, then every 0.18 s', () => {
    let s = initState(20, 0), moves = 0;
    const run = (secs: number) => { for (let t = 0; t < secs - 1e-9; t += 0.01) { const r = update(s, 'right', 0.01); s = r.state; moves += r.moves; } };
    run(0.01); expect(moves).toBe(1);                          // the press itself
    run(REPEAT_FIRST - 0.03); expect(moves).toBe(1);           // nothing more before 0.4 s
    run(0.04); expect(moves).toBe(2);
    run(REPEAT_NEXT * 3); expect(moves).toBe(5);
    s = update(s, null, 0.01).state;
    const before = s.sel; s = update(s, 'left', 0.01).state;
    expect(s.sel).toBe(before - 1);                            // a new direction moves at once
  });
  it('starts the preview after 0.8 s, never with reduced motion', () => {
    let s = initState(5, 0);
    s = update(s, null, PREVIEW_AFTER - 0.01).state;
    expect(previewing(s, false)).toBe(false);
    s = update(s, null, 0.02).state;
    expect(previewing(s, false)).toBe(true);
    expect(previewT(s)).toBeCloseTo(0.01, 5);
    expect(previewing(s, true)).toBe(false);
  });
  it('keeps the cursor steady with reduced motion', () => {
    const s = { ...initState(5, 0), clock: 0.4 };
    expect(cursorOn(s, false)).toBe(false);
    expect(cursorOn(s, true)).toBe(true);
  });
});

describe('launcher taps', () => {
  const T: Target[] = [
    { kind: 'arrow', by: -1, x: 0, y: 0, w: 12, h: 12 },
    { kind: 'front', i: 2, x: 50, y: 0, w: 40, h: 30 },
    { kind: 'cover', i: 3, x: 100, y: 0, w: 30, h: 20 },
    { kind: 'tick', i: 4, x: 0, y: 50, w: 12, h: 12 },
    { kind: 'tick', i: 2, x: 20, y: 50, w: 12, h: 12 },
  ];
  const s = initState(5, 2);
  it('loads the front disk', () => expect(tap(s, T, 60, 10)).toEqual({ kind: 'load', i: 2 }));
  it('brings a side cover or a tick to the front', () => {
    expect(tap(s, T, 110, 10)).toEqual({ kind: 'front', i: 3 });
    expect(tap(s, T, 5, 55)).toEqual({ kind: 'front', i: 4 });
  });
  it("loads from the front disk's own tick", () => expect(tap(s, T, 25, 55)).toEqual({ kind: 'load', i: 2 }));
  it('steps with an arrow', () => expect(tap(s, T, 5, 5)).toEqual({ kind: 'front', i: 1 }));
  it('ignores a tap on nothing', () => expect(tap(s, T, 200, 200)).toBeNull());
});

describe('createLauncher', () => {
  const disks = ['a', 'b', 'c'].map((id, k) => ({ id, order: k, title: id.toUpperCase() })) as any[];
  const make = () => {
    const sys: LauncherSystem = { disks: () => disks, state: () => ({ kind: 'ready' }), best: () => ({ score: 0, name: null }),
      load: vi.fn(), download: vi.fn(), lastDiskId: () => 'b', reducedMotion: () => false, tick: vi.fn(), seek: vi.fn(), label: k => k };
    const api = { LW: 360, LH: 260 } as any;
    return { sys, L: createLauncher(api, sys) };
  };
  it('opens at the last disk played', () => { const { L } = make(); L.enter(); expect(L.sel).toBe(1); });
  it('moves with the arrow keys and WASD, ticking and seeking', () => {
    const { L, sys } = make(); L.enter(0);
    expect(L.key('ArrowRight')).toBe(true); expect(L.sel).toBe(1);
    expect(L.key('KeyA')).toBe(true); expect(L.sel).toBe(0);
    expect(L.key('ArrowUp')).toBe(true); expect(L.sel).toBe(2);
    expect(sys.tick).toHaveBeenCalledTimes(3); expect(sys.seek).toHaveBeenCalledTimes(3);
  });
  it('loads with FIRE keys and digits', () => {
    const { L, sys } = make(); L.enter(1);
    L.key('Enter'); expect(sys.load).toHaveBeenLastCalledWith(1);
    L.key('Digit3'); expect(sys.load).toHaveBeenLastCalledWith(2); expect(L.sel).toBe(2);
    expect(L.key('Digit9')).toBe(false);
    expect(L.key('KeyQ')).toBe(false);
  });
  it('taps a side cover to the front, then loads it', () => {
    const { L, sys } = make(); L.enter(0);
    const side = L.targets().find(q => q.kind === 'cover')!;
    L.tap(side.x + 2, side.y + 2); expect(sys.load).not.toHaveBeenCalled();
    const i = L.sel; expect(i).not.toBe(0);
    const front = L.targets().find(q => q.kind === 'front')!;
    L.tap(front.x + 2, front.y + 2); expect(sys.load).toHaveBeenCalledWith(i);
  });
});

describe("the launcher's rules", () => {
  // DOM-free, so the native apps can run it as their built-in system disk
  const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/console/launcher');
  const files = readdirSync(DIR).filter(f => f.endsWith('.ts'));
  it.each(files)('%s touches no browser globals and imports only its own folder and types', f => {
    const src = readFileSync(join(DIR, f), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // comments may say "window"
    expect(code).not.toMatch(/\b(document|window|navigator|localStorage|location|AudioContext|matchMedia|setTimeout|setInterval|requestAnimationFrame)\b/);
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*from\s+['"]([^'"]+)['"]/gm)) {
      if (!m[2].startsWith('./')) expect(m[1], m[0]).toBeTruthy();
    }
  });
});

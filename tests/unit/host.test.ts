import { describe, it, expect, vi } from 'vitest';
import { bindHost, host, type ConsoleHost } from '../../src/console/host';
import { loadGame, progress } from '../../src/console/loader';

// loader.ts reads the address and listens for the network at load time. Vitest's node
// environment has neither; the browser always does, so this only exists for the test.
vi.hoisted(() => {
  const g = globalThis as { location?: { search: string }; addEventListener?: (...args: unknown[]) => void };
  if (typeof g.location === 'undefined') g.location = { search: '' };
  if (typeof g.addEventListener !== 'function') g.addEventListener = () => {};
});

/* Enough of an audio node for the drive to connect and schedule, and nothing more. */
function node(){
  return {
    connect(){ return this; },
    start(){},
    stop(){},
    type: '',
    frequency: { value: 0, setValueAtTime(){}, linearRampToValueAtTime(){} },
    gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} },
    Q: { value: 0 },
  };
}

describe('console host', () => {
  it('keeps getters live so a screen sees a value that changes', () => {
    let width = 360;
    bindHost({ get LW(){ return width; } } as ConsoleHost);
    expect(host.LW).toBe(360);
    width = 240;
    expect(host.LW).toBe(240);
  });

  it('hears a context that ensureAudio has just created', () => {
    const tones: number[] = [];
    const created = {
      currentTime: 0,
      createBiquadFilter: () => node(),
      createGain: () => node(),
      createOscillator: () => node(),
    };
    let ac: typeof created | null = null;
    bindHost({
      S: {},
      ensureAudio(){ ac = created; },
      get ac(){ return ac; },
      get muted(){ return false; },
      tone(freq: number){ tones.push(freq); },
      noise: () => node(),
      headClick(){},
      out: () => node(),
      setGame(){},
      fetchRuntime(){ return Promise.resolve(); },
      clearInput(){},
      track(){},
      layoutName(){ return 'desk'; },
    } as unknown as ConsoleHost);
    loadGame(0);
    expect(tones).toContain(1200);
  });
});

describe('load progress', () => {
  const steps: [number, number][] = [[0, 0], [0.5, 0.2], [1, 1]];

  it('moves in the disk\'s steps and clamps at either end', () => {
    expect(progress(steps, 0)).toBe(0);
    expect(progress(steps, 0.25)).toBeCloseTo(0.1);
    expect(progress(steps, 1)).toBe(1);
    expect(progress(steps, 2)).toBe(1);
    expect(progress(steps, -1)).toBe(0);
  });
});

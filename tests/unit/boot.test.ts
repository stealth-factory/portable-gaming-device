import { describe, it, expect } from 'vitest';
import { bootScript, PROMPT } from '../../src/console/boot';

const last = (t: number, warm: boolean) => bootScript(t, warm).lines.at(-1);

describe('boot screen', () => {
  it('uses the DOS prompt A:\\>', () => {
    expect(PROMPT).toBe('A:\\>');
    for (const warm of [false, true]) {
      const { lines, enterAt } = bootScript(5, warm);
      expect(lines.at(-1)).toBe('A:\\>MENU');
      expect(lines.some(s => /^A>/.test(s))).toBe(false);
      expect(enterAt).toBeLessThan(warm ? 1.2 : 2.3);
    }
  });
  it('types MENU at the prompt a letter at a time', () => {
    const { enterAt } = bootScript(0, false), typed = new Set<string>();
    for (let t = 1.5; t < enterAt; t += 0.01) typed.add(last(t, false)!);
    expect([...typed].filter(s => s.startsWith(PROMPT))).toEqual(['A:\\>', 'A:\\>M', 'A:\\>ME', 'A:\\>MEN', 'A:\\>MENU']);
  });
  it('runs the memory test on a cold boot only', () => {
    expect(bootScript(4, false).lines.some(s => s.startsWith('MEMORY TEST  640K  OK'))).toBe(true);
    expect(bootScript(2, true).lines.some(s => s.startsWith('MEMORY TEST'))).toBe(false);
  });
});

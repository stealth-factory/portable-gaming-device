// GAM-115: a finger held on a control must not bring up iOS's magnifying glass or a selection
import { describe, it, expect } from 'vitest';
import { noTouchHold, noSelectOn } from '../../src/console/nohold';

type L = { fn: (e: any) => void; opts: any };
function target(){
  const ls: Record<string, L[]> = {};
  return { ls, addEventListener(t: string, fn: any, opts?: any){ (ls[t] ||= []).push({ fn, opts }); } } as any;
}
const ev = (over: object = {}) => { const e: any = { cancelable: true, defaultPrevented: false, preventDefault(){ e.defaultPrevented = true; }, ...over }; return e; };

describe('noTouchHold', () => {
  it('cancels touchstart from a non-passive listener', () => {
    const t = target(); noTouchHold(t);
    expect(t.ls.touchstart).toHaveLength(1);
    expect(t.ls.touchstart[0].opts).toEqual({ passive: false });
    const e = ev(); t.ls.touchstart[0].fn(e); expect(e.defaultPrevented).toBe(true);
  });
  it('leaves a touch the browser has already made uncancelable', () => {
    const t = target(); noTouchHold(t);
    const e = ev({ cancelable: false }); t.ls.touchstart[0].fn(e); expect(e.defaultPrevented).toBe(false);
  });
});

describe('noSelectOn', () => {
  const el = (match: boolean) => ({ closest: () => (match ? {} : null) });
  it('stops a selection and the long-press menu on the set', () => {
    const t = target(); noSelectOn(t);
    for (const type of ['selectstart', 'contextmenu']) { const e = ev({ target: el(false) }); t.ls[type][0].fn(e); expect(e.defaultPrevented).toBe(true); }
  });
  it('lets text fields select and open their menu', () => {
    const t = target(); noSelectOn(t);
    for (const type of ['selectstart', 'contextmenu']) { const e = ev({ target: el(true) }); t.ls[type][0].fn(e); expect(e.defaultPrevented).toBe(false); }
  });
});

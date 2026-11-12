/* The console program's Platform, built over the browser (GAM-39). See src/console/program/platform.ts.

   core.ts makes one with the few things that still live there (analytics, the layout name, the card over
   the tube); everything else is the page itself. */
import type { Platform, PlatformStore } from '../program/platform';
import { SETTINGS_EVENT } from '../settings';
import * as audio from './audio';

/** localStorage, quietly doing nothing where the browser refuses it (private modes, full storage). */
export const webStore: PlatformStore = {
  get(k){ try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (_) {} },
  remove(k){ try { localStorage.removeItem(k); } catch (_) {} },
  keys(){ try { return Object.keys(localStorage); } catch (_) { return []; } },
};

export interface WebPlatformDeps {
  track: Platform['track'];
  layoutName: Platform['layoutName'];
  reducedMotion: boolean;
  /** The pause and game-over card laid over the tube. */
  overlay: HTMLElement;
}

export function makeWebPlatform(deps: WebPlatformDeps): Platform {
  const $ = (id: string) => document.getElementById(id);
  return {
    now: () => performance.now(),
    store: webStore,
    wakeAudio: audio.ensureAudio,
    get sounding(){ return !!audio.ac && !audio.muted; },
    tone: audio.tone,
    click: audio.click,
    motor: audio.motor,
    track: deps.track,
    layoutName: deps.layoutName,
    reducedMotion: deps.reducedMotion,
    hideCard(){ deps.overlay.hidden = true; },
    showHold(on){ $('pauseBtn')?.setAttribute('aria-pressed', String(on)); },
    flash(control){
      const b = $(control + 'Btn'); if (!b) return;
      b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 140);
    },
    autoloadId: () => document.documentElement.dataset.autoload || null,
    oldList: /[?&]menu=list\b/.test(location.search),
    onOnline(fn){ addEventListener('online', fn); },
    onSettings(fn){ addEventListener(SETTINGS_EVENT, fn); },
  };
}

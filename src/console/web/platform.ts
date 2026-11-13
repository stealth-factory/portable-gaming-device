/* The console program's Platform, built over the browser (GAM-39). See src/console/program/platform.ts.

   core.ts makes one with the few things that still live there (analytics, the layout name, the cards over
   the tube, haptics, the leaflet); everything else is the page itself. */
import type { Platform, PlatformStore } from '../program/platform';
import { SETTINGS_EVENT } from '../settings';
import * as audio from './audio';
import { loadGameCode } from '../../games/registry';

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
  /** Fill that card with the loaded game's game-over words and show it. */
  showOverCard: Platform['showOverCard'];
  /** Show the HOLD card. */
  showPauseCard: Platform['showPauseCard'];
  /** The set's buzz, with the SOUND-off rule (core's haptics). */
  buzz: Platform['buzz'];
  /** The leaflet's instructions (core passes them to the React island). */
  setManual: Platform['setManual'];
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
    buzz: deps.buzz,
    loadCode: loadGameCode,
    track: deps.track,
    layoutName: deps.layoutName,
    reducedMotion: deps.reducedMotion,
    hideCard(){ deps.overlay.hidden = true; },
    showOverCard: deps.showOverCard,
    showPauseCard: deps.showPauseCard,
    showHold(on){ $('pauseBtn')?.setAttribute('aria-pressed', String(on)); },
    showGame(id){ document.documentElement.setAttribute('data-game', id ?? 'menu'); },
    setManual: deps.setManual,
    flash(control){
      const b = $(control + 'Btn'); if (!b) return;
      b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 140);
    },
    autoloadId: () => document.documentElement.dataset.autoload || null,
    onOnline(fn){ addEventListener('online', fn); },
    onSettings(fn){ addEventListener(SETTINGS_EVENT, fn); },
  };
}

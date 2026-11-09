/* The console's action buttons, as slots.
   The set has a row of physical buttons (FIRE and BOOST today). Each one is a slot with an id, its keyboard keys and,
   on the page, its element. Whatever is on screen (the boot, the disk menu, a game) is an "app" that declares a
   ButtonMap: a label and an on/off switch for each slot it uses. Slots an app leaves out go dark and ignore presses.
   An app can change its map while it runs (Invader Force's NUKE) and put the declared one back.
   Adding a button (or, later, a gamepad button) means one more defineSlot(); no app has to change. */
import type { ButtonMap, ButtonPatch, ButtonSpec, ButtonState } from '../games/types';

export interface Slot extends ButtonState {
  id: string;
  /** KeyboardEvent.code values that press this slot. */
  keys: string[];
  /** The button on the page, and the element its label goes in (the button itself if none). */
  el?: HTMLElement | null;
  labelEl?: HTMLElement | null;
  /** Label it falls back to when no app has given it one. */
  fallback: string;
}

const slots = new Map<string, Slot>();
let declared: ButtonMap = {};
let translate: (key: string) => string = k => k;

/** Add a physical button. The first label is used until an app maps the slot. Taps and clicks on `el` press and release
    it, unless `ownPointer` says the caller wires the pointer itself (FIRE and BOOST do, for the menu and the play-only queue). */
export function defineSlot(id: string, keys: string[], fallback: string, el?: HTMLElement | null, labelEl?: HTMLElement | null, ownPointer = false): Slot {
  const s: Slot = { id, keys, el, labelEl: labelEl ?? el, fallback, label: fallback, enabled: true, queued: false, held: false };
  slots.set(id, s); render(s);
  if (el && !ownPointer) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (press(id)) { try { el.setPointerCapture(e.pointerId); } catch (_) {} } });
    const up = () => release(id);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  return s;
}
export function slotIds(): string[] { return [...slots.keys()]; }
export function slotForKey(code: string): Slot | undefined { for (const s of slots.values()) if (s.keys.includes(code)) return s; }

/** How to turn a label key into text (the console's I18N for the current language). */
export function setTranslator(fn: (key: string) => string){ translate = fn; slots.forEach(render); }
/** Redraw every label, e.g. after the language changes. */
export function relabel(){ slots.forEach(render); }

/** An app takes the buttons: every slot gets the app's spec, or goes dark if the app doesn't map it. */
export function useButtons(map: ButtonMap){
  declared = map;
  slots.forEach(s => apply(s, map[s.id] ?? { label: s.label, enabled: false }));
}
/** Change some slots for now; null puts that slot back to what the app declared. */
export function setButtons(patch: ButtonPatch){
  for (const id of Object.keys(patch)) {
    const s = slots.get(id); if (!s) continue;   // a slot this set doesn't have (yet): ignore it
    const p = patch[id];
    apply(s, p === null ? (declared[id] ?? { label: s.label, enabled: false }) : { label: p.label ?? s.label, enabled: p.enabled ?? s.enabled });
  }
}

/** A press: true when the slot is live and took it. */
export function press(id: string): boolean {
  const s = slots.get(id); if (!s || !s.enabled) return false;
  s.queued = true; s.held = true; s.el?.classList.add('on');
  return true;
}
export function release(id: string){ const s = slots.get(id); if (!s) return; s.held = false; s.el?.classList.remove('on'); }
export function clearQueued(id: string){ const s = slots.get(id); if (s) s.queued = false; }
export function releaseAll(){ slots.forEach(s => { s.queued = false; s.held = false; s.el?.classList.remove('on'); }); }
/** Read-only view of one slot; an unknown slot reads as dark and idle. */
export function button(id: string): ButtonState {
  const s = slots.get(id);
  return s ? { label: s.label, enabled: s.enabled, queued: s.queued, held: s.held } : { label: '', enabled: false, queued: false, held: false };
}

function apply(s: Slot, spec: ButtonSpec){
  s.label = spec.label; s.enabled = spec.enabled ?? true;
  if (!s.enabled) { s.queued = false; s.held = false; s.el?.classList.remove('on'); }
  render(s);
}
function render(s: Slot){
  if (s.labelEl) { s.labelEl.dataset.i18n = s.label; s.labelEl.innerHTML = translate(s.label); }
  if (s.el) { s.el.classList.toggle('idle', !s.enabled); s.el.setAttribute('aria-disabled', String(!s.enabled)); }
}

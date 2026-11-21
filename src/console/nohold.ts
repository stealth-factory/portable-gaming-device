/* iOS Safari and WKWebView show their text-selection loupe (the magnifying glass) and start a selection when a finger
   rests on a control, or taps and then holds it, even under `user-select: none` (WebKit bugs 231161 and 296492). The
   only thing that reliably stops it is a non-passive `touchstart` listener that cancels the touch's default action.
   Cancelling it also cancels the compatibility mouse events and the `click` that would follow, but pointer events still
   arrive, so this goes only on controls that read pointer events (the stick's zone, FIRE, BOOST and the extra keys, the
   phosphor dial, the tube). Never put it on a control that acts on `click`, or a tap would do nothing. */
export function noTouchHold(el: EventTarget){
  el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}

/** Keep a selection from starting anywhere on the set, and the long-press menu from opening on it. Text fields keep both. */
export function noSelectOn(root: EventTarget){
  const editable = (t: EventTarget | null) => !!t && typeof (t as Element).closest === 'function' && !!(t as Element).closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
  root.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); });
  root.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); });
}

/* Load the pinned drawing face with one explicit, bounded attempt at a time. */
export function makePixelFont(url: string, events: { ready(): void; failed(): void }) {
  let state: 'loading' | 'ready' | 'failed' = 'loading';
  let attempt = 0, active: AbortController | null = null;
  return {
    get state(){ return state; },
    load(){
      const current = ++attempt;
      active?.abort();
      const controller = new AbortController(); active = controller;
      state = 'loading';
      const fail = () => {
        if (current !== attempt || state !== 'loading') return;
        state = 'failed'; clearTimeout(timer); controller.abort(); events.failed();
      };
      const timer = window.setTimeout(fail, 10_000);
      const read = async () => {
        const response = await fetch(url, { signal: controller.signal, cache: 'reload' });
        if (!response.ok) throw new Error('The console pixel font did not load');
        // A failed FontFace keeps its rejected promise; a fresh face makes a real retry possible.
        const face = new FontFace('Silkscreen', await response.arrayBuffer());
        return face.load();
      };
      void read().then(face => {
        if (current !== attempt || state !== 'loading') return;
        clearTimeout(timer); document.fonts.add(face); state = 'ready'; events.ready();
      }, fail);
    },
  };
}

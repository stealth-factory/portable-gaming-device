'use client';
/* PGD for React (GAM-64): <PGDConsole> shows a PGD build in an iframe and drives it through the console's
   embed bridge (src/console/embed.ts), including disks the page puts in the box. Plain JavaScript with no JSX,
   so it installs as a git dependency with no build step; the types are in index.d.ts. React is a peer dependency. */
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const LANGS = ['en', 'zh-hant', 'zh-hans'];

/** The frame's address: the build's root page with the embed flags. Works on any static host (no clean URLs needed). */
export function embedUrl(src, options = {}) {
  const { game, lang, chrome } = options;
  const [base, hash = ''] = String(src).split('#');
  const [path, query = ''] = base.split('?');
  const q = new URLSearchParams(query);
  q.set('embed', chrome ? 'page' : '');
  if (game) q.set('disk', game);
  const l = lang && LANGS.includes(lang) ? lang : hash;
  const qs = q.toString().replace(/(^|&)embed=(&|$)/, '$1embed$2');   // a bare `embed` flag
  return `${path}?${qs}${l ? `#${l}` : ''}`;
}

export function isPGDMessage(data) {
  return !!data && typeof data === 'object' && data.pgd === 1 && typeof data.type === 'string';
}

function originOf(src) {
  try { return new URL(src, typeof location === 'undefined' ? undefined : location.href).origin; } catch (_) { return null; }
}

/** Split a disk into what is posted to the console and a game function kept here (functions can't be posted). */
function diskSource(d) {
  const { game, ...rest } = d;
  return { source: typeof game === 'string' ? { ...rest, game } : rest, later: typeof game === 'function' ? game : null };
}

/** What makes two disks the same disk: their sources (a .pgdisk by its buffer). */
const bufferIds = new WeakMap();
let nextBuffer = 0;
function keyOf(d) {
  if (d.pgdisk) {
    const b = d.pgdisk.buffer || d.pgdisk;
    if (!bufferIds.has(b)) bufferIds.set(b, ++nextBuffer);
    return `pgdisk:${bufferIds.get(b)}:${d.pgdisk.byteOffset || 0}:${d.pgdisk.byteLength}`;
  }
  const extra = d.cover || d.preview ? `\u0000${JSON.stringify([d.cover ?? null, d.preview ?? null])}` : '';
  return `${d.disk}\u0000${typeof d.game === 'string' ? d.game : ''}${extra}`;
}

export const PGDConsole = forwardRef(function PGDConsole(props, ref) {
  const { src, game, power, lang, phosphor, sound, paused, disks, chrome = false, title = 'PGD-01 Portable Gaming Device', className, style } = props;
  const frame = useRef(null);
  const state = useRef(null);
  const ready = useRef(false);
  const session = useRef(null);
  const frameLoaded = useRef(false);
  // the set's height on the desk layout, as the console reports it
  const [deskHeight, setDeskHeight] = useState(null);
  // the latest callbacks and props, read by the message listener without re-subscribing
  const latest = useRef(props);
  latest.current = props;
  // inserts waiting for their reply, and the games to send when a disk inserted without one is loaded
  // and the `disks` already in this console (by content, so a new array with the same disks sends nothing)
  const requests = useRef({ next: 0, waiting: new Map(), games: new Map(), pending: [], sent: new Map() });

  // The frame's address only changes with src and chrome. The first game and language go in the address so the
  // first boot lands on them; later changes are sent as commands, so the console keeps running.
  // (when src or chrome change, the new frame starts on the latest game and language)
  const urlGame = useRef(game);
  const url = useMemo(() => {
    urlGame.current = latest.current.game;
    return embedUrl(src, { game: latest.current.game, lang: latest.current.lang, chrome });
  }, [src, chrome]);
  const origin = useMemo(() => originOf(src), [src]);

  const send = useCallback(cmd => {
    const w = frame.current && frame.current.contentWindow;
    if (!w || !cmd) return false;
    w.postMessage({ pgd: 1, type: 'command', ...cmd }, origin && origin !== 'null' ? origin : '*');
    return true;
  }, [origin]);

  const insert = useCallback((d, options = {}) => new Promise((resolve, reject) => {
    if (!d || typeof d !== 'object') { reject(new Error('insertDisk needs a disk')); return; }
    const r = requests.current, request = ++r.next, { source, later } = diskSource(d);
    r.waiting.set(request, { resolve: disk => { if (later) r.games.set(disk.id, later); resolve(disk); }, reject, session: null });
    const cmd = { command: 'insert', disk: source, boot: !!options.boot, request };
    // before the console is ready, hold it until it is
    if (ready.current) { r.waiting.get(request).session = session.current; send(cmd); } else r.pending.push(cmd);
  }), [send]);

  // push the props to the console: when it's ready, and whenever one changes after that
  const sync = useCallback(keys => {
    const p = latest.current;
    for (const k of keys) {
      if (k === 'power' && typeof p.power === 'boolean') send({ command: 'power', on: p.power });
      if (k === 'lang' && p.lang) send({ command: 'lang', lang: p.lang });
      if (k === 'phosphor' && p.phosphor) send({ command: 'phosphor', phosphor: p.phosphor });
      if (k === 'sound' && typeof p.sound === 'boolean') send({ command: 'sound', on: p.sound });
      if (k === 'paused' && typeof p.paused === 'boolean') send({ command: 'pause', on: p.paused });
      if (k === 'disks' && Array.isArray(p.disks)) {
        const r = requests.current;
        for (const d of p.disks) {
          if (!d || typeof d !== 'object') continue;
          const key = keyOf(d);
          if (r.sent.has(key)) { const id = r.sent.get(key); if (id && typeof d.game === 'function') r.games.set(id, d.game); continue; }
          r.sent.set(key, null);
          insert(d).then(disk => {
            // a disk with the same id from other sources has been replaced by this one: forget it, so it can come back
            for (const [k, id] of r.sent) if (id === disk.id && k !== key) r.sent.delete(k);
            r.sent.set(key, disk.id);
          }, () => { r.sent.delete(key); });   // failures reach onDiskError
        }
      }
    }
  }, [send, insert]);

  useEffect(() => {
    ready.current = false; session.current = null; state.current = null;
    const r = requests.current;
    const onMessage = e => {
      const f = frame.current;
      if (!f || e.source !== f.contentWindow) return;
      if (origin && origin !== 'null' && e.origin !== origin) return;
      const m = e.data;
      if (!isPGDMessage(m)) return;
      const p = latest.current;
      if (m.type === 'ready') {
        const firstReady = !ready.current || session.current !== m.ready.session;
        ready.current = true; session.current = m.ready.session;
        if (firstReady) {
          r.sent.clear();
          // inserts sent to an earlier page in the frame will never be answered
          for (const [id, w] of r.waiting) if (w.session !== null) { r.waiting.delete(id); w.reject(new Error('the console reloaded before it answered')); }
          // disks first, so a `game` that names one of them finds it when the boot ends
          sync(['disks', 'lang', 'phosphor', 'sound', 'paused', 'power']);
          for (const cmd of r.pending.splice(0)) { const w = r.waiting.get(cmd.request); if (w) w.session = session.current; send(cmd); }
          // a `game` changed before the console was listening: the address still names the old one
          if (p.game && p.game !== urlGame.current) { urlGame.current = p.game; send({ command: 'load', game: p.game }); }
        }
        if (p.onReady) p.onReady(m.ready);
      } else if (m.type === 'state') {
        state.current = m.state;
        if (p.onStateChange) p.onStateChange(m.state);
      } else if (m.type === 'event') {
        if (p.onEvent) p.onEvent(m.name, m.data);
        if (m.name === 'game_over' && p.onGameOver && m.data) p.onGameOver({ game: String(m.data.game), score: Number(m.data.score) || 0 });
        if (m.name === 'disk_error' && p.onDiskError && m.data) {
          const text = String(m.data.error || ''), i = text.indexOf(': ');
          p.onDiskError({ game: m.data.game == null ? null : String(m.data.game), stage: i > 0 ? text.slice(0, i) : 'insert', message: i > 0 ? text.slice(i + 2) : text });
        }
      } else if (m.type === 'size') {
        setDeskHeight(m.layout === 'desk' && m.height > 0 ? m.height : null);
      } else if (m.type === 'reply') {
        const w = r.waiting.get(m.request); if (!w) return;
        r.waiting.delete(m.request);
        if (m.ok) w.resolve(m.disk); else w.reject(new Error(m.error || 'the console refused the disk'));
      } else if (m.type === 'need') {
        const make = r.games.get(m.id);
        if (!make) { send({ command: 'game', request: m.request, error: `no game for "${m.id}"` }); return; }
        Promise.resolve().then(() => make(m.id)).then(
          code => send({ command: 'game', request: m.request, game: String(code) }),
          err => send({ command: 'game', request: m.request, error: String((err && err.message) || err) }),
        );
      }
    };
    window.addEventListener('message', onMessage);
    // the console says hello as it starts; if that was before this listener was here (a re-render), ask again
    if (frame.current && frame.current.contentWindow && frameLoaded.current) send({ command: 'hello' });
    return () => window.removeEventListener('message', onMessage);
  }, [url, origin, send, sync]);

  // inserts still waiting when the component goes away will never be answered
  useEffect(() => () => {
    const r = requests.current;
    for (const w of r.waiting.values()) w.reject(new Error('the console was unmounted'));
    r.waiting.clear(); r.pending.length = 0;
  }, []);

  // later prop changes become commands (only once the console is listening; the ready message syncs the rest)
  const shown = useRef(false);
  useEffect(() => { if (shown.current && ready.current) sync(['power']); }, [power, sync]);
  useEffect(() => { if (shown.current && ready.current) sync(['lang']); }, [lang, sync]);
  useEffect(() => { if (shown.current && ready.current) sync(['phosphor']); }, [phosphor, sync]);
  useEffect(() => { if (shown.current && ready.current) sync(['sound']); }, [sound, sync]);
  useEffect(() => { if (shown.current && ready.current) sync(['paused']); }, [paused, sync]);
  useEffect(() => { if (shown.current && ready.current) sync(['disks']); }, [disks, sync]);
  useEffect(() => { if (shown.current && ready.current && game) { urlGame.current = game; send({ command: 'load', game }); } }, [game, send]);
  useEffect(() => { shown.current = true; }, []);

  useImperativeHandle(ref, () => ({
    power: on => { send(typeof on === 'boolean' ? { command: 'power', on } : { command: 'power' }); },
    reset: () => { send({ command: 'reset' }); },
    menu: () => { send({ command: 'menu' }); },
    load: g => { send({ command: 'load', game: g }); },
    insertDisk: insert,
    send: cmd => { send(cmd); },
    focus: () => { const f = frame.current; if (f) { f.focus(); if (f.contentWindow) f.contentWindow.focus(); } },
    get state() { return state.current; },
    get iframe() { return frame.current; },
  }), [send, insert]);

  return createElement('iframe', {
    ref: frame,
    src: url,
    title,
    className,
    style: { border: 0, display: 'block', width: '100%', ...(deskHeight ? { height: deskHeight } : { aspectRatio: '6 / 5' }), ...style },
    allow: 'autoplay; fullscreen; gamepad; screen-wake-lock',
    // a backstop: if the console's own hello was missed, ask once the page in the frame has loaded
    onLoad: () => { frameLoaded.current = true; if (!ready.current) send({ command: 'hello' }); },
  });
});

/* The embed bridge (GAM-64): lets a page that shows the console in an iframe drive it, hear what it does, and put
   its own disks in the box (games an AI harness makes).
   Opted into with `?embed` in the frame's address (`?embed=page` keeps the header and the leaflet; plain `?embed`
   shows just the set). `?disk=<id or slug>` boots straight into that disk on the first power-on.
   The protocol's types are in react/index.d.ts, shared with the <PGDConsole> component.
   Messages go only to the page around the frame: to the origin in `?origin=`, else the referrer's; commands are
   taken only from that window and origin. Inserting a disk runs its code on this site, so only the same origin,
   localhost and the origins in PUBLIC_PGD_EMBED_ORIGINS (set when the site is built) may do it. */
import type { PGDCommand, PGDMessage, PGDState, PGDLang, PGDPhosphor, PGDDisk, PGDEventData } from '../../react/index';
import type { CreateGame, GameDisk } from '../games/types';
import { DISKS, addDisk, isAdded } from '../games/registry';
import { VERSION } from '../components/site';
import { S, game, tvOn, powerOn, powerOff, setMode, modeKey, MODE_ORDER, MODES, applyLang, lang, LANGS, toggleMute, muted, togglePause, ensureAudio, onTrack, forgetRuntime } from './core';
import { mergeStrings } from './i18n';
import { startConsole, pressSelect } from './program/loader';
import { readSource, gameFromScript, guard, mayInsert, type DiskSource } from './embed-disks';

const params = new URLSearchParams(location.search);
const root = document.documentElement;

/** A disk by id or slug. */
const findDisk = (key: string) => DISKS.find(d => d.id === key || d.slug === key);

function originOf(url: string | null){
  if (!url) return null;
  try { const o = new URL(url).origin; return o === 'null' ? null : o; } catch (_) { return null; }
}
const message = (err: unknown) => String((err as Error)?.message ?? err).slice(0, 300);

function stateNow(): PGDState {
  return {
    power: tvOn, mode: S.mode,
    game: ['boot', 'menu', 'off'].includes(S.mode) ? null : game.id,
    score: S.score || 0, level: S.level || 0, lives: S.lives || 0,
    lang: lang as PGDLang, phosphor: modeKey as PGDPhosphor, sound: !muted,
  };
}

const about = (d: GameDisk): PGDDisk => ({ id: d.id, slug: d.slug, title: d.title, genre: d.genre, players: d.players, added: isAdded(d.id) });

/** Load a disk through the boot, like a game's own page: switch on (or warm-boot) and go straight to it. */
function loadDisk(key: string){
  const d = findDisk(key); if (!d) return false;
  root.dataset.autoload = d.id; S.autoDone = false;
  if (tvOn) startConsole('warm'); else powerOn();
  return true;
}

const embed = params.get('embed');
if (embed !== null) {
  root.dataset.embed = embed === 'page' ? 'page' : 'set';
  // a disk the page will insert may not be in the box yet: keep the name, the boot looks for it when it ends
  const disk = params.get('disk');
  if (disk) root.dataset.autoload = findDisk(disk)?.id ?? disk;
}

if (embed !== null && window.parent !== window) {
  const target = originOf(params.get('origin')) || originOf(document.referrer) || '*';
  const allowList = String((import.meta.env as Record<string, unknown>).PUBLIC_PGD_EMBED_ORIGINS ?? '');
  let key = '', live = '', liveAt = 0;   // the last state sent (see watch below)
  const post = (m: PGDMessage) => { try { window.parent.postMessage(m, target); } catch (_) {} };
  const event = (name: string, data?: PGDEventData) => post({ pgd: 1, type: 'event', name, data });
  const reply = (request: number | undefined, ok: boolean, more: { error?: string; disk?: PGDDisk } = {}) => {
    if (typeof request === 'number') post({ pgd: 1, type: 'reply', request, ok, ...more });
  };
  const session = Math.random().toString(36).slice(2);   // this page load: a new one means a fresh console with only its own disks
  const sayReady = () => post({ pgd: 1, type: 'ready', ready: {
    version: VERSION, session,
    disks: DISKS.map(about),
    phosphors: MODE_ORDER as PGDPhosphor[],
    langs: LANGS as PGDLang[],
  } });

  /* ---- disks from the page ---- */
  // a game the page supplies only when its disk is loaded: the request number, and what to do with the answer
  let asked = 0;
  const waiting = new Map<number, { ok: (code: string) => void; fail: (err: Error) => void }>();
  const askForGame = (id: string) => new Promise<string>((ok, fail) => {
    const request = ++asked;
    waiting.set(request, { ok, fail });
    post({ pgd: 1, type: 'need', request, id });
    setTimeout(() => { if (waiting.delete(request)) fail(new Error('the page sent no game in time')); }, 20000);
  });
  const crashed = (id: string) => (err: unknown) => {
    forgetRuntime(id);
    event('disk_error', { game: id, error: `run: ${message(err)}` });
    // out of the frame that threw, then back to the disk menu
    setTimeout(() => { if (tvOn) startConsole('warm'); }, 0);
  };
  const refuse = (id: string | null, request: number | undefined, error: string) => {
    event('disk_error', { game: id, error: `insert: ${error}` }); reply(request, false, { error });
  };

  function insert(src: DiskSource, boot: boolean | undefined, request: number | undefined){
    let disk: GameDisk, code: string | null;
    try { ({ disk, game: code } = readSource(src, 1000 + DISKS.length)); } catch (err) { refuse(null, request, message(err)); return; }
    const id = disk.id;
    const load = async (): Promise<CreateGame> => {
      try {
        const create = gameFromScript(code ?? await askForGame(id));
        return api => guard(create(api), crashed(id));
      } catch (err) { event('disk_error', { game: id, error: `load: ${message(err)}` }); throw err; }
    };
    try { addDisk(disk, load); } catch (err) { refuse(id, request, message(err)); return; }
    mergeStrings(disk.strings);
    forgetRuntime(id);
    event('disk_inserted', { game: id, version: disk.version });
    reply(request, true, { disk: about(disk) });
    sayReady();
    if (boot) loadDisk(id);
  }

  function run(c: PGDCommand, from: string){
    switch (c.command) {
      case 'hello': sayReady(); key = ''; break;
      case 'power': { const on = c.on ?? !tvOn; if (on && !tvOn) { ensureAudio(); powerOn(); } else if (!on && tvOn) powerOff(); break; }
      case 'reset': if (tvOn) startConsole('cold'); break;
      case 'menu': pressSelect(); break;
      case 'load': if (typeof c.game === 'string' && !loadDisk(c.game)) event('disk_error', { game: c.game, error: 'load: no such disk' }); break;
      case 'phosphor': if (MODES[c.phosphor] && c.phosphor !== modeKey) setMode(c.phosphor); break;
      case 'lang': if (LANGS.includes(c.lang) && c.lang !== lang) applyLang(c.lang, false); break;
      case 'sound': if (c.on === muted) toggleMute(); break;
      case 'pause': if (c.on) togglePause(true); else if (S.mode === 'paused') togglePause(); break;
      case 'insert':
        if (!mayInsert(from, location.origin, allowList)) refuse(null, c.request, `${from} may not insert disks (add it to PUBLIC_PGD_EMBED_ORIGINS)`);
        else insert(c.disk as DiskSource, c.boot, c.request);
        break;
      case 'game': {
        const w = waiting.get(c.request); if (!w) break;
        waiting.delete(c.request);
        if (typeof c.game === 'string') w.ok(c.game); else w.fail(new Error(c.error || 'the page sent no game'));
        break;
      }
    }
  }

  addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || (target !== '*' && e.origin !== target)) return;
    const m = e.data;
    if (!m || m.pgd !== 1 || m.type !== 'command' || typeof m.command !== 'string') return;
    run(m as PGDCommand, e.origin);
  });

  onTrack((name, data) => event(name, data));

  // state: at once when power, mode, disk, language, phosphor or sound change; score, level and lives at most 4 times a second
  const watch = (now: number) => {
    const s = stateNow();
    const k = [s.power, s.mode, s.game, s.lang, s.phosphor, s.sound].join('|'), l = [s.score, s.level, s.lives].join('|');
    if (k !== key || (l !== live && now - liveAt >= 250)) { key = k; live = l; liveAt = now; post({ pgd: 1, type: 'state', state: s }); }
    requestAnimationFrame(watch);
  };

  // the set's height on desk layouts, so the page can size the frame to fit it (upright layouts fill the frame instead)
  let sent = '';
  const size = () => {
    const layout = root.getAttribute('data-layout') || 'desk', height = Math.ceil(root.scrollHeight), k = `${layout}|${height}`;
    if (k !== sent) { sent = k; post({ pgd: 1, type: 'size', height, layout }); }
  };
  new ResizeObserver(size).observe(document.body);
  new MutationObserver(size).observe(root, { attributes: true, attributeFilter: ['data-layout'] });

  sayReady();
  size();
  requestAnimationFrame(watch);
}

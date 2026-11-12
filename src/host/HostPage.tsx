/* The /host page: the site using its own <PGDConsole> (GAM-64), the way another React app such as builder does.
   It frames this site's console with ?embed, shows the state and events that come out, drives the set from React,
   and puts disks in the box: the sample, scripts typed or pasted in, or a .pgdisk file. Same origin, so inserting is allowed. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { PGDConsole } from '../../react/index.js';
import type { PGDConsoleHandle, PGDCustomDisk, PGDLang, PGDPhosphor, PGDReady, PGDState } from '../../react/index.js';
import { SAMPLE_DISK, SAMPLE_GAME } from './sample';

const PHOSPHORS: PGDPhosphor[] = ['greenP1', 'greenP39', 'radarP7', 'amberP3', 'whiteP4', 'cga1', 'cga0'];
const LANGS: PGDLang[] = ['en', 'zh-hant', 'zh-hans'];
type Line = { at: string; kind: 'event' | 'error' | 'note'; text: string };

const clock = () => new Date().toLocaleTimeString([], { hour12: false });

export default function HostPage({ src = '/' }: { src?: string }){
  const pgd = useRef<PGDConsoleHandle>(null);
  const [ready, setReady] = useState<PGDReady | null>(null);
  const [state, setState] = useState<PGDState | null>(null);
  const [log, setLog] = useState<Line[]>([]);
  const [phosphor, setPhosphor] = useState<PGDPhosphor>('greenP1');
  const [lang, setLang] = useState<PGDLang>('en');
  const [sound, setSound] = useState(true);
  const [paused, setPaused] = useState(false);
  const [diskJs, setDiskJs] = useState(SAMPLE_DISK);
  const [gameJs, setGameJs] = useState(SAMPLE_GAME);
  const [busy, setBusy] = useState(false);

  const note = useCallback((kind: Line['kind'], text: string) => {
    setLog(l => [{ at: clock(), kind, text }, ...l].slice(0, 60));
  }, []);

  // the sample goes in through the `disks` prop, with its game sent only when the player loads it
  const disks = useMemo<PGDCustomDisk[]>(() => [{ disk: SAMPLE_DISK, game: () => SAMPLE_GAME }], []);

  const insert = async (d: PGDCustomDisk, boot: boolean) => {
    setBusy(true);
    try { const disk = await pgd.current?.insertDisk(d, { boot }); if (disk) note('note', `inserted ${disk.id} (${disk.title})`); }
    catch (err) { note('error', `insert refused: ${(err as Error).message}`); }
    finally { setBusy(false); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    await insert({ pgdisk: new Uint8Array(await f.arrayBuffer()) }, true);
  };

  const on = state?.power ?? false;

  return (
    <div className="host">
      <header className="host-head">
        <h1>PGD in another app</h1>
        <p>
          This page is a React app using <code>&lt;PGDConsole&gt;</code> from <code>portable-gaming-device/react</code>, the
          same component other apps install. The console below runs in a frame, and everything around it talks to it
          through the component's props, ref and callbacks. <a href="/">Back to the console</a>.
        </p>
      </header>

      <div className="host-grid">
        <div className="host-set">
          <PGDConsole
            ref={pgd}
            src={src}
            phosphor={phosphor}
            lang={lang}
            sound={sound}
            paused={paused}
            disks={disks}
            onReady={r => { setReady(r); }}
            onStateChange={setState}
            onEvent={(name, data) => note('event', `${name} ${data ? JSON.stringify(data) : ''}`)}
            onGameOver={({ game, score }) => note('note', `game over: ${game} scored ${score}`)}
            onDiskError={({ game, stage, message }) => note('error', `${game ?? 'disk'} failed at ${stage}: ${message}`)}
          />
        </div>

        <aside className="host-side">
          <section>
            <h2>State</h2>
            <dl className="host-state">
              <dt>power</dt><dd>{state ? String(state.power) : '…'}</dd>
              <dt>mode</dt><dd>{state?.mode ?? '…'}</dd>
              <dt>game</dt><dd>{state?.game ?? '—'}</dd>
              <dt>score</dt><dd>{state?.score ?? 0}</dd>
              <dt>level</dt><dd>{state?.level ?? 0}</dd>
              <dt>lives</dt><dd>{state?.lives ?? 0}</dd>
            </dl>
            <p className="host-meta">{ready ? `PGD ${ready.version} · ${ready.disks.length} disks` : 'waiting for the console…'}</p>
          </section>

          <section>
            <h2>Drive it</h2>
            <div className="host-row">
              <button onClick={() => pgd.current?.power(!on)}>{on ? 'Power off' : 'Power on'}</button>
              <button onClick={() => pgd.current?.reset()} disabled={!on}>Reset</button>
              <button onClick={() => pgd.current?.menu()} disabled={!on}>Menu</button>
              <button onClick={() => pgd.current?.focus()}>Focus keys</button>
            </div>
            <label>Load a disk
              <select value="" onChange={e => { if (e.target.value) { pgd.current?.load(e.target.value); pgd.current?.focus(); } }}>
                <option value="">choose…</option>
                {ready?.disks.map(d => <option key={d.id} value={d.id}>{d.title}{d.added ? ' (added)' : ''}</option>)}
              </select>
            </label>
            <label>Phosphor
              <select value={phosphor} onChange={e => setPhosphor(e.target.value as PGDPhosphor)}>
                {PHOSPHORS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>Language
              <select value={lang} onChange={e => setLang(e.target.value as PGDLang)}>
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="host-check"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> Sound</label>
            <label className="host-check"><input type="checkbox" checked={paused} onChange={e => setPaused(e.target.checked)} /> Hold (pause)</label>
          </section>
        </aside>
      </div>

      <section className="host-disks">
        <h2>Put a disk in</h2>
        <p>
          A disk is two plain scripts, as an AI harness would write them: <code>disk.js</code> defines <code>PGDDisk</code> and
          <code> game.js</code> defines <code>PGDGame</code>. The sample, Rock Drop, is already on the disk menu. Edit it and
          insert it again: the same <code>id</code> replaces the disk. A <code>.pgdisk</code> file works too.
        </p>
        <div className="host-code">
          <label>disk.js<textarea spellCheck={false} value={diskJs} onChange={e => setDiskJs(e.target.value)} /></label>
          <label>game.js<textarea spellCheck={false} value={gameJs} onChange={e => setGameJs(e.target.value)} /></label>
        </div>
        <div className="host-row">
          <button disabled={busy} onClick={() => insert({ disk: diskJs, game: gameJs }, true)}>Insert and play</button>
          <button disabled={busy} onClick={() => insert({ disk: diskJs, game: gameJs }, false)}>Insert</button>
          <button onClick={() => { setDiskJs(SAMPLE_DISK); setGameJs(SAMPLE_GAME); }}>Restore the sample</button>
          <label className="host-file">Open a .pgdisk<input type="file" accept=".pgdisk,application/zip" onChange={e => onFile(e.target.files?.[0])} /></label>
        </div>
      </section>

      <section className="host-log">
        <h2>What comes out</h2>
        <ol>
          {log.map((l, i) => <li key={log.length - i} className={`host-${l.kind}`}><time>{l.at}</time> {l.text}</li>)}
        </ol>
      </section>
    </div>
  );
}

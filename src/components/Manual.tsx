import { useSyncExternalStore } from 'react';
import { bus, type ConsoleState } from '../console/bus';
import { I18N } from '../console/i18n';
import { CONSOLE_MANUAL } from '../console/manual';
import { DISKS } from '../games/registry';
import type { ManualSection } from '../games/types';
import { GitHubIcon } from './Icons';
import { Settings } from './Settings';
import { REPO_URL, REPO_LABEL } from './site';

const SERVER: ConsoleState = { lang: 'en', manual: 'console' };
const html = (s: string) => ({ __html: s });

/** One numbered section: a paragraph, a note (name, then wrapping text), or a dotted-leader list. */
function Section({ sec, n, T }: { sec: ManualSection; n: number; T: Record<string, any> }){
  const head = <h3><span className="num">{n}</span><span dangerouslySetInnerHTML={html(T[sec.h])} /></h3>;
  if ('p' in sec) return <section className="man-sec">{head}<p dangerouslySetInnerHTML={html(T[sec.p])} /></section>;
  if (sec.notes) return (
    <section className="man-sec">
      {head}
      <dl className="man-notes">
        {sec.list.map(it => {
          const v = it.lit ? it.v : T[it.v];
          return (
            <div key={it.k}>
              <dt dangerouslySetInnerHTML={html(T[it.k])} />
              <dd className={sec.keys ? 'keys' : undefined} dangerouslySetInnerHTML={html(v)} />
            </div>
          );
        })}
      </dl>
    </section>
  );
  return (
    <section className="man-sec">
      {head}
      <ul className={'leaders' + (sec.keys ? ' keys' : '') + (sec.wrap ? ' wrap' : '')}>
        {sec.list.map(it => {
          const v = it.lit ? it.v : T[it.v];
          return (
            <li key={it.k}>
              <span dangerouslySetInnerHTML={html(T[it.k])} />
              <i aria-hidden="true" />
              {sec.keys ? <span className="kv" dangerouslySetInnerHTML={html(v)} /> : <b dangerouslySetInnerHTML={html(v)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The printed Operating Instructions: the console's while the disk menu is up, the loaded game's otherwise.
    A React island: it follows the console engine's language and loaded game through the shared bus. */
export default function Manual(){
  const { lang, manual } = useSyncExternalStore(bus.subscribe, bus.get, () => SERVER);
  const T = I18N[lang] || I18N.en, disk = DISKS.find(d => d.id === manual);
  const secs = disk ? disk.manual : CONSOLE_MANUAL;
  return (
    <>
      <div className="man-head">
        <h2 id="manH">{disk ? T[disk.nameKey] : T.manTitle}</h2>
        <span className="man-model" id="manModel">{disk ? T.diskFor : T.model}</span>
      </div>
      <div className="man-cols" id="manBody">
        {secs.map((sec, i) => <Section key={disk ? disk.id + i : 'c' + i} sec={sec} n={i + 1} T={T} />)}
      </div>
      <Settings T={T} />
      <footer className="man-foot">
        <a href={REPO_URL} target="_blank" rel="noopener">
          <GitHubIcon /><span>{T.src}</span><span className="url">{REPO_LABEL}</span>
        </a>
      </footer>
    </>
  );
}

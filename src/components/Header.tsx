import { MODEL } from './site';

/** The page header: wordmark, model badge and tagline (the tagline is swapped per language by the console). */
export function Header(){
  return (
    <header>
      <h1>PGD<span className="h-num">-01</span> <span className="h-dx">Portable Gaming Device</span></h1>
      <span className="mk-model">{MODEL}</span>
      <p className="tag" data-i18n="tag">An old home computer on a glowing phosphor monitor. Switch it on, pick a disk, play.</p>
    </header>
  );
}

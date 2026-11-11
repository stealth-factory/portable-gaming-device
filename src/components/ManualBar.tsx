import { LangSwitch } from './LangSwitch';
import { GitHubIcon } from './Icons';
import { REPO_URL } from './site';

/** The bar under the set: the instructions toggle, the language switch and the source link. */
export function ManualBar(){
  return (
    <div className="manual-bar">
      <button type="button" className="manual-btn" id="manualBtn" aria-expanded="false" aria-controls="manual">
        <span className="chev" aria-hidden="true">▾</span><span id="manualLbl">Instructions</span>
      </button>
      <nav className="bar-right" aria-label="Language and source code">
        <LangSwitch />
        <a className="gh-link" href={REPO_URL} target="_blank" rel="noopener" aria-label="PGD on GitHub (opens in a new tab)">
          <GitHubIcon /><span>GitHub</span>
        </a>
      </nav>
    </div>
  );
}

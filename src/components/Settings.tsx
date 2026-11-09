import { useState } from 'react';
import { SETTINGS_EVENT, type SettingsAction } from '../console/settings';

const html = (s: string) => ({ __html: s });

/** The leaflet's two resets, each behind a confirm step: the set back to factory settings (phosphor, switches,
    language), and, kept apart, wiping this device's high scores. The console does the work when it hears
    the `gg:settings` event (src/console/core.ts). */
export function Settings({ T }: { T: Record<string, any> }){
  const [asking, setAsking] = useState<SettingsAction | null>(null);
  const [done, setDone] = useState<SettingsAction | null>(null);
  const run = (what: SettingsAction) => {
    setAsking(null); setDone(what);
    dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: what }));
  };
  const ask = (what: SettingsAction) => { setDone(null); setAsking(what); };
  return (
    <section className="man-settings" aria-labelledby="setH">
      <h3 id="setH" dangerouslySetInnerHTML={html(T.setH)} />
      {asking ? (
        <div className={'set-ask' + (asking === 'scores' ? ' danger' : '')} role="group" aria-labelledby="setQ">
          <p id="setQ" dangerouslySetInnerHTML={html(asking === 'reset' ? T.setResetQ : T.setScoresQ)} />
          <div className="set-row">
            <button type="button" className="set-btn yes" id="setYes" onClick={() => run(asking)}
              dangerouslySetInnerHTML={html(asking === 'reset' ? T.setResetYes : T.setScoresYes)} />
            <button type="button" className="set-btn" id="setNo" autoFocus onClick={() => setAsking(null)} dangerouslySetInnerHTML={html(T.setNo)} />
          </div>
        </div>
      ) : (
        <div className="set-row">
          <button type="button" className="set-btn" id="setReset" onClick={() => ask('reset')} dangerouslySetInnerHTML={html(T.setReset)} />
          <button type="button" className="set-btn danger" id="setScores" onClick={() => ask('scores')} dangerouslySetInnerHTML={html(T.setScores)} />
        </div>
      )}
      <p className="set-done" role="status" aria-live="polite">{done ? (done === 'reset' ? T.setResetDone : T.setScoresDone) : ''}</p>
    </section>
  );
}

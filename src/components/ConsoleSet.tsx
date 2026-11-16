import { Screen } from './Screen';
import { Nameplate } from './Nameplate';
import { PhosphorDial } from './PhosphorDial';
import { Rocker } from './Rocker';
import { PowerPanel } from './PowerPanel';
import { Joystick } from './Joystick';
import { ActionButtons } from './ActionButtons';
import { MODEL } from './site';

/** The whole set: tube, control panel and gamepad. Layout per device comes from CSS (data-layout on <html>). */
export function ConsoleSet(){
  return (
    <div className="tv">
      <div className="tv-face">
        <Screen />
        <div className="controls">
          <Nameplate />
          <PhosphorDial />
          <div className="rockers">
            <Rocker id="muteBtn" label="SOUND" ariaLabel="Sound" pressed />
            <Rocker id="fxBtn" label="GLOW" ariaLabel="Tube glow and scanlines" pressed />
            <Rocker id="pauseBtn" label="HOLD" ariaLabel="Pause" />
            <Rocker id="fullBtn" label="FULL" ariaLabel="Full screen" />
          </div>
          <div className="grille" aria-hidden="true" />
          <PowerPanel />
          <span className="emboss" id="emboss" aria-hidden="true">{MODEL} · 12″ PHOSPHOR MONITOR</span>
        </div>
        <div className="pad" id="pad">
          <Joystick />
          <ActionButtons />
        </div>
      </div>
      <div className="feet" aria-hidden="true"><i /><i /></div>
    </div>
  );
}

import { MODEL, VERSION } from './site';

/** The badge on the set. The console rewrites the phosphor line; the version follows package.json. */
export function Nameplate(){
  return (
    <div className="nameplate">
      <div className="np-badge">
        <b>PGD<span className="np-rest"> · PORTABLE GAMING DEVICE</span></b>
        <span id="plate">{MODEL} · GREEN P1</span>
      </div>
      <small className="np-ver">{`v${VERSION}`}</small>
    </div>
  );
}

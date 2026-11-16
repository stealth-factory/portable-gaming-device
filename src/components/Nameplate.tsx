import { MODEL, VERSION } from './site';

/** The badge on the set. The console rewrites the phosphor line; the version follows package.json. A page framing the
    console can swap the name for its own text or logo (src/console/nameplate.ts): `#np-name` and `#np-logo`. */
export function Nameplate(){
  return (
    <div className="nameplate">
      <div className="np-badge">
        <b id="np-name">PGD<span className="np-rest"> · PORTABLE GAMING DEVICE</span></b>
        <img id="np-logo" className="np-logo" alt="" hidden />
        <span id="plate">{MODEL} · GREEN P1</span>
      </div>
      <small className="np-ver">{`v${VERSION}`}</small>
    </div>
  );
}

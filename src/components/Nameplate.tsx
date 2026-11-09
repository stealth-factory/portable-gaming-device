import { MODEL, VERSION } from './site';

/** The badge on the set. The console rewrites the phosphor line; the version follows package.json. */
export function Nameplate(){
  return (
    <div className="nameplate">
      <div className="np-badge">
        <b>GAME GUY<span className="np-rest"> 3000 DELUXE</span></b>
        <span id="plate">{MODEL} · GREEN P1</span>
      </div>
      <small className="np-ver">{`v${VERSION}`}</small>
    </div>
  );
}

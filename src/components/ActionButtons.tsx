/** FIRE and BOOST, with two extra fire keys either side of FIRE that stay hidden unless the game on screen maps them
    (the `fireL` and `fireR` slots: I Invade's left and right bomb bays). Each game relabels them (JUMP and DUCK in
    Dino Run); BOOST carries a recharge meter. */
export function ActionButtons(){
  return (
    <div className="keyrow">
      <div className="firerow">
        <button className="fire side" id="fireLBtn" type="button" data-i18n="spark" hidden>FIRE</button>
        <button className="fire" id="fireBtn" type="button" data-i18n="spark">FIRE</button>
        <button className="fire side" id="fireRBtn" type="button" data-i18n="spark" hidden>FIRE</button>
      </div>
      <button className="boost" id="boostBtn" type="button">
        <span data-i18n="boost">BOOST</span>
        <i className="bmeter" aria-hidden="true"><b id="boostFill" /></i>
      </button>
    </div>
  );
}

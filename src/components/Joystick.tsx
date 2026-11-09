/** The floating on-screen joystick, and the button pad that takes its place while a game that has no use for a stick
    is playing (`controls: 'pad'` on its disk: I Invade). The pad is six optional slots, `pad1`…`pad6`, in two rows
    of three; each shows only while the game maps it (see src/console/buttons.ts). The sideways console layout
    lifts the three bays and CLUSTER out to the right (see console.css); this markup stays one pad. */
export function Joystick(){
  return (
    <div className="stickzone" id="stickzone" aria-label="Joystick: touch and drag to steer">
      <div className="stickbase" id="stickbase">
        {(['up', 'down', 'left', 'right'] as const).map(d => <span key={d} className="tick" data-d={d} />)}
        <div className="knob" id="knob" />
      </div>
      <span className="hint" data-i18n="stick">DRAG TO STEER</span>
      <div className="btnpad" id="btnpad">
        <div className="bayrow">
          {[1, 2, 3].map(n => <button key={n} className="padkey" id={`pad${n}Btn`} type="button" hidden>{n}</button>)}
        </div>
        {[4, 5, 6].map(n => <button key={n} className="padkey" id={`pad${n}Btn`} type="button" hidden>{n}</button>)}
      </div>
    </div>
  );
}

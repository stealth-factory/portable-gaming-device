/** The tube: the canvas the console draws on, and the card it shows over it (paused, game over). */
export function Screen(){
  return (
    <div className="tube-surround">
      <div className="screen">
        <canvas id="cv" aria-label="PGD-01 Portable Gaming Device screen" />
        <div className="overlay" id="overlay" hidden>
          <h2 id="ovTitle">PGD-01</h2>
          <p id="ovText" />
          <button className="btn" id="ovBtn" type="button"><span className="blink">▶</span> START</button>
        </div>
      </div>
    </div>
  );
}

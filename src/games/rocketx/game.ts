/* Return Burn: land an inbound rocket back on its pad with the main engine and the side thrusters.
   The rocket, the pad, the art, the sound and the code are original. */
import type { CreateGame } from '../types';
import { drawFlame, drawLogo, drawPad, drawPuff, drawRocket, drawSea, drawShip, drawSplash } from './art';
import {
  CONTROLS, DEFAULT_CONTROL, GROUND, METER_SCALE, ROCKETS, SEA_LEVEL, atSea, autoFin, deckAt, gateLevel, landingVy, landingScore,
  levelUses, seaFor,
  setupMove, speedMeter, windMeter, startRocket, stepRocket, touchdown, windFor,
  type Deck, type Input, type LevelGate, type Rocket, type SetupChoice,
} from './rules';

const BOXES = 3;
/** The setup card waits this long, then flies with what's chosen (an arcade's select timer). */
const SETUP_SECS = 8;
/** PILOT and ENGINEER: the thruster buttons in the stick's place. Top row: left thruster, the main engine, right
    thruster; bottom row: the grid fins. The sixth slot stays dark. */
const PAD_ON = {
  pad1: { label: 'rxRcsL', enabled: true }, pad2: { label: 'rxPadBurn', enabled: true }, pad3: { label: 'rxRcsR', enabled: true },
  pad4: { label: 'rxFinL', enabled: true }, pad5: { label: 'rxFinR', enabled: true },
};
const PAD_OFF = { pad1: null, pad2: null, pad3: null, pad4: null, pad5: null };
type Dir4 = 'up' | 'down' | 'left' | 'right';

const create: CreateGame = api => {
  let rocket: Rocket = startRocket(0.5, 1);
  let wind = 0;
  let over = false;
  let fieldTop = 0;
  let fieldBottom = 0;
  let flash = 0;
  let lastOutcome = '';
  // the setup card: kept for as long as this runtime lives, so FLY AGAIN offers the last choice
  // (a device-wide memory needs a storage call in ConsoleAPI: a follow-up)
  let choice: SetupChoice = { row: 1, rocket: 0, control: DEFAULT_CONTROL };
  let setup = false;
  let setupT = 0;
  let lastDir: Dir4 | null = null;
  let gate: LevelGate = { left: Infinity, active: false };
  let lastInput: Input = { main: false, rcs: 0, level: false, fin: 0 };
  // the swell's clock: it runs from the level's start, through READY too, so the ship is already moving
  let seaT = 0;
  let deck: Deck = deckAt(1, 0);
  let splashT = 0;
  const control = () => CONTROLS[choice.control];

  const readField = () => {
    fieldTop = api.HUD + 2;
    fieldBottom = api.LH - 4;
  };
  const px = (x: number) => Math.round(x * api.LW);
  const py = (y: number) => Math.round(fieldTop + y * (fieldBottom - fieldTop));

  function spawn(level: number) {
    rocket = startRocket(0.5, level);
    wind = windFor(level);
    seaT = 0;
    deck = deckAt(level, 0);
    splashT = 0;
    gate = { left: levelUses(control().id, level), active: false };
    syncButtons();
    api.S.mode = 'ready';
    api.S.modeT = 1.4;
  }

  /* the buttons follow the choice: the pad of thrusters for PILOT and ENGINEER, the stick for STICK; LEVEL goes dark
     when this rocket has no uses left */
  function syncButtons() {
    api.setButtons(!setup && control().buttons ? PAD_ON : PAD_OFF);
    api.setButtons({ boost: { enabled: setup || gate.left > 0 || gate.active } });
  }

  function confirmSetup() {
    setup = false;
    api.tone(660, 0.05, 0.03);
    api.tone(990, 0.06, 0.025, 0, 0.05);
    api.track('rocketx_setup', { rocket: ROCKETS[choice.rocket].id, control: control().id });
    spawn(api.S.level);
  }

  function updateSetup(dt: number) {
    const dir = (api.stickDir ?? api.held[api.held.length - 1] ?? null) as Dir4 | null;
    if (dir && dir !== lastDir) {
      const next = setupMove(choice, dir);
      if (next.rocket !== choice.rocket || next.control !== choice.control || next.row !== choice.row) api.tone(440, 0.03, 0.02);
      choice = next;
      setupT = SETUP_SECS;   // a choice being made: give it time
    }
    lastDir = dir;
    const go = api.fireQueued || api.tapQueued || api.boostQueued;
    api.clearFire(); api.clearTap(); api.clearBoost();
    if (go || (setupT -= dt) <= 0) confirmSetup();
  }

  function start() {
    api.fitGrid();
    readField();
    over = false;
    flash = 0;
    lastOutcome = '';
    api.S.score = 0;
    api.S.level = 1;
    api.S.lives = BOXES;
    api.S.charge = 1;
    api.S.boost = 0;
    api.S.boostT = 0;
    // the setup card first: the rocket waits in `ready` until the player flies
    setup = true;
    setupT = SETUP_SECS;
    lastDir = (api.stickDir ?? api.held[api.held.length - 1] ?? null) as Dir4 | null;
    spawn(1);
  }

  const pair = (l: boolean, r: boolean): -1 | 0 | 1 => (l === r ? 0 : r ? 1 : -1);

  /* what the player holds now. STICK: the stick (or arrows) turns it and the fins work themselves; PILOT and
     ENGINEER: a button for each thruster and each fin, and the middle button (or FIRE, or the screen) burns */
  function input(): Input {
    const c = control();
    const main = api.fireHeld || api.tapHeld || (c.buttons && api.button('pad2').held);
    const levelHeld = !!api.button('boost').held;
    if (!c.buttons) {
      const left = api.held.includes('left') || api.stickDir === 'left';
      const right = api.held.includes('right') || api.stickDir === 'right';
      return { main, rcs: pair(left, right), level: levelHeld, fin: c.autoFins ? autoFin(rocket) : 0 };
    }
    return {
      main,
      rcs: pair(api.button('pad1').held, api.button('pad3').held),
      level: levelHeld,
      fin: pair(api.button('pad4').held, api.button('pad5').held),
    };
  }

  function crash(splashed = false) {
    api.S.mode = 'dying';
    api.S.modeT = 1.3;
    api.S.lives = Math.max(0, api.S.lives - 1);
    lastOutcome = splashed ? 'splashed' : 'crashed';
    api.buzz('lose');
    if (splashed) {
      api.tone(320, 0.05, 0.03, -200);
      api.tone(140, 0.3, 0.03, -60, 0.04);
    } else {
      api.tone(196, 0.14, 0.05, -90);
      api.tone(110, 0.22, 0.04, -40, 0.12);
    }
  }

  function land() {
    const gained = landingScore(rocket, api.S.level, control().mult, deck);
    api.S.score += gained;
    api.S.level += 1;
    if (api.S.score > api.best) api.best = api.S.score;
    flash = 0.35;
    lastOutcome = 'landed';
    api.tone(523, 0.06, 0.03);
    api.tone(784, 0.08, 0.028, 60, 0.06);
    api.buzz('pickup');
    spawn(api.S.level);
  }

  function update(dt: number) {
    readField();
    const t = api.S;
    if (t.mode === 'ready' && setup) { updateSetup(dt); return; }
    const lastDeck = deck;
    if (t.mode === 'ready' || t.mode === 'play' || t.mode === 'dying') {
      seaT += dt;
      deck = deckAt(t.level, seaT);
    }
    if (t.mode === 'ready') {
      api.clearFire();
      api.clearTap();
      if ((t.modeT -= dt) <= 0) t.mode = 'play';
      return;
    }
    if (t.mode === 'dying') {
      splashT += dt;
      if ((t.modeT -= dt) <= 0 && !over) {
        if (t.lives > 0) spawn(t.level);
        else { over = true; api.finishGame(); }
      }
      return;
    }
    if (t.mode !== 'play') return;

    const held = input();
    api.clearFire();
    api.clearTap();
    const g = gateLevel(gate, held.level);
    // a use spent, or the last hold let go: LEVEL's button follows (it goes dark once nothing is left)
    const changed = g.gate.left !== gate.left || g.gate.active !== gate.active;
    gate = g.gate;
    held.level = g.on;
    if (changed) syncButtons();
    lastInput = held;
    const before = rocket;
    rocket = stepRocket(rocket, held, dt, wind, { settle: control().settle });
    if (held.main && rocket.fuel > 0 && before.fuel > 0 && Math.floor(t.time * 16) % 3 === 0) {
      api.tone(150, 0.03, 0.012, -20);
    }
    // the nose thrusters hiss while they fire
    if (held.rcs !== 0 && rocket.fuel > 0 && Math.floor(t.time * 20) % 4 === 0) api.tone(2400, 0.015, 0.006, -900);
    if (flash > 0) flash -= dt;

    const aspect = api.LW / Math.max(1, fieldBottom - fieldTop);
    const outcome = touchdown(rocket, t.level, deck, aspect, { x: before.x, y: before.y, deck: lastDeck });
    if (outcome === 'landed') land();
    else if (outcome === 'crashed') crash();
    else if (outcome === 'splashed') crash(true);
  }

  /* the speed meter: a bar down the right of the playfield, zero in the middle. Falling (down) is +, climbing (up) is -.
     The shaded band is the landing window: the rocket must be inside it to touch down. */
  function drawSpeedMeter() {
    const top = fieldTop + 10, bottom = fieldBottom - 10;
    const mid = Math.round((top + bottom) / 2), half = (bottom - top) / 2;
    const x = api.LW - 9, w = 5;
    const bandH = Math.max(1, Math.round((landingVy(api.S.level) / METER_SCALE) * half));
    api.g.fillStyle = api.col('hud');
    api.g.fillRect(x - 1, top, 1, bottom - top);                  // the scale's rail
    api.g.fillRect(x - 1, mid - bandH, w + 2, bandH * 2);         // the landing band
    api.g.fillStyle = api.col('bg');
    api.g.fillRect(x, mid - bandH + 1, w, Math.max(0, bandH * 2 - 2));
    const m = speedMeter(rocket.vy - deck.vy, api.S.level);   // against the deck: the ship heaves too
    const len = Math.round(m.fill * half);
    api.g.fillStyle = api.col(m.inZone ? 'text' : 'hud');
    api.g.fillRect(x, len >= 0 ? mid : mid + len, w, Math.max(1, Math.abs(len)));
    // the markers: a tick either side of the band, wider than the rail, so the safe speeds read at a glance
    api.g.fillStyle = api.col('text');
    api.g.fillRect(x - 4, mid - bandH, w + 8, 1);
    api.g.fillRect(x - 4, mid + bandH, w + 8, 1);
    api.g.fillRect(x - 2, mid, w + 4, 1);                          // zero
    api.txt('-', x + 2, top - 8, 'hud', 'center');
    api.txt('+', x + 2, bottom + 2, 'hud', 'center');
  }

  /* the wind meter: a bar across the top of the playfield, with the centre marked. The fill runs out from the
     centre the way the wind blows, and its length is the force, with an arrowhead at the tip. */
  function drawWindMeter() {
    const { dir, fill } = windMeter(wind);
    const y = fieldTop + 3, half = 30, cx = Math.round(api.LW / 2);
    api.g.fillStyle = api.col('hud');
    api.g.fillRect(cx - half, y, half * 2, 1);                 // the rail
    api.g.fillRect(cx - half, y + 3, half * 2, 1);
    api.g.fillRect(cx - half, y, 1, 4);                        // the end caps
    api.g.fillRect(cx + half - 1, y, 1, 4);
    api.g.fillRect(cx, y - 1, 1, 6);                           // the centre mark
    if (dir !== 0 && fill > 0) {
      const len = Math.max(2, Math.round(fill * half));
      const x0 = dir > 0 ? cx : cx - len, x1 = dir > 0 ? cx + len : cx;
      api.g.fillStyle = api.col('text');
      api.g.fillRect(x0, y + 1, x1 - x0, 2);
      const tip = dir > 0 ? x1 : x0;
      api.g.fillRect(tip - (dir > 0 ? 0 : 1), y - 1, 2, 4);     // the arrowhead
      api.g.fillRect(dir > 0 ? tip - 2 : tip + 1, y - 2, 1, 6);
    }
    api.txt('WIND', cx - half - 4, y - 2, 'hud', 'right');
  }

  function hud() {
    api.g.fillStyle = api.col('bg');
    api.g.fillRect(0, 0, api.LW, api.HUD);
    if (!(flash > 0 && Math.floor(flash * 12) % 2 === 0)) api.txt(String(api.S.score).padStart(4, '0'), 6, 6, 'text');
    api.txt('LVL ' + String(api.S.level).padStart(2, '0'), api.LW / 2, 6, 'hud', 'center');
    api.txt('ROCKETX', api.LW - 6, 6, 'hud', 'right');
    // fuel gauge: a bar under the score
    const full = Math.max(20, Math.round(api.LW * 0.22));
    api.g.fillStyle = api.col('hud');
    api.g.fillRect(6, api.HUD - 4, full, 2);
    api.g.fillStyle = api.col('text');
    api.g.fillRect(6, api.HUD - 4, Math.round(full * rocket.fuel), 2);
    // boxes left, shown as small rockets
    for (let i = 0; i < api.S.lives; i++) api.g.fillRect(api.LW - 8 - i * 6, api.HUD - 4, 3, 2);
    // LEVEL's uses left, as pips under the level number, when they are counted
    if (Number.isFinite(gate.left) && control().id !== 'engineer') {
      const cx = Math.round(api.LW / 2);
      for (let i = 0; i < gate.left; i++) api.g.fillRect(cx - 7 + i * 6, api.HUD - 4, 3, 2);
    }
  }

  /* the setup card: two rows, ROCKET and CONTROL, each changed with left and right; FIRE (or a tap) flies */
  function drawSetup() {
    const cx = Math.round(api.LW / 2);
    const top = fieldTop + Math.max(4, Math.round((fieldBottom - fieldTop - 104) / 3));
    drawLogo(api, cx, top);
    const rows: [string, string, string][] = [
      ['ROCKET', ROCKETS[choice.rocket].name, ROCKETS.some(r => !r.ready) ? 'MORE ROCKETS SOON' : ''],
      ['CONTROL', control().name, control().line],
    ];
    rows.forEach(([label, value, note], i) => {
      const y = top + 32 + i * 28;
      const on = choice.row === i;
      api.txt(label, cx, y, 'hud', 'center');
      const blink = on && Math.floor(api.S.time * 3) % 2 === 0;
      api.txt((on ? (blink ? '< ' : ' <') : '  ') + ' ' + value + ' ' + (on ? (blink ? ' >' : '> ') : '  '), cx, y + 9, on ? 'text' : 'hud', 'center');
      if (note) api.txt(note, cx, y + 18, 'hud', 'center');
    });
    const left = Math.max(0, Math.ceil(setupT));
    api.txt('FIRE TO FLY  ' + left, cx, top + 92, 'text', 'center');
  }

  function draw() {
    if (setup) {
      hud();
      drawSetup();
      return;
    }
    if (deck.ship) {
      const waterY = py(GROUND) + 5;
      const swell = seaFor(api.S.level).heave * (fieldBottom - fieldTop);
      drawShip(api, px(deck.centre - deck.half), px(deck.centre + deck.half), py(deck.y) + 5, deck.roll, waterY, api.S.time);
      drawSea(api, api.LW, waterY, Math.max(1, swell), seaT);
    } else {
      drawPad(api, px(deck.centre - deck.half), px(deck.centre + deck.half), py(GROUND), api.S.time);
    }
    if (lastOutcome === 'splashed' && api.S.mode === 'dying') {
      drawSplash(api, px(rocket.x), py(GROUND) + 5, splashT / 1.0);
    } else {
      const x = px(rocket.x), y = py(rocket.y);
      const flying = api.S.mode === 'play';
      if (flying && lastInput.main && rocket.fuel > 0) drawFlame(api, x, y, rocket.a, api.S.time);
      drawRocket(api, x, y, api.S.mode === 'dying' ? rocket.a + 0.6 : rocket.a, api.S.mode === 'dying', true);
      if (flying && lastInput.rcs !== 0 && rocket.fuel > 0) drawPuff(api, x, y, rocket.a, lastInput.rcs, api.S.time);
    }
    drawWindMeter();
    drawSpeedMeter();
    hud();
    if (api.S.mode === 'ready') {
      drawLogo(api, Math.round(api.LW / 2), fieldTop + 6);
      const sea = atSea(api.S.level);
      api.txt(sea ? (api.S.level === SEA_LEVEL ? 'OUT TO SEA: LAND ON THE SHIP' : 'LAND ON THE SHIP') : 'BURN TO LAND ON THE PAD',
        api.LW / 2, fieldTop + 30, 'hud', 'center');
      if (sea) api.txt('MATCH ITS SWELL', api.LW / 2, fieldTop + 40, 'hud', 'center');
    }
    if ((lastOutcome === 'crashed' || lastOutcome === 'splashed') && api.S.mode === 'dying') {
      api.txt(lastOutcome === 'splashed' ? 'SPLASH' : 'CRASHED', api.LW / 2, fieldTop + 10, 'text', 'center', 16);
    }
  }

  return {
    start, update, draw,
    debug: {
      state: () => ({
        x: rocket.x, y: rocket.y, vy: rocket.vy, a: rocket.a, w: rocket.w, fuel: rocket.fuel, mode: api.S.mode, lives: api.S.lives, level: api.S.level,
        setup, setupT, rocket: ROCKETS[choice.rocket].id, control: control().id, row: choice.row,
        levelLeft: Number.isFinite(gate.left) ? gate.left : -1,
        deck: { ...deck }, seaT, outcome: lastOutcome,
      }),
      /** Pick on the setup card and fly at once: the tests' shortcut. */
      /** Jump to a level (the tests reach the sea this way). */
      level: (n: number) => { api.S.level = Math.max(1, Math.floor(n)); spawn(api.S.level); },
      fly: (control?: 'stick' | 'pilot' | 'engineer') => {
        if (control) choice = { ...choice, control: Math.max(0, CONTROLS.findIndex(c => c.id === control)) };
        if (setup) confirmSetup(); else syncButtons();
      },
    },
  };
};

export default create;

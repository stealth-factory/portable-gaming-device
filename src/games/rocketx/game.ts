/* Return Burn: land an inbound rocket back on its pad with the main engine and the side thrusters.
   The rocket, the pad, the art, the sound and the code are original. */
import type { CreateGame } from '../types';
import { drawFlame, drawLogo, drawPad, drawRocket } from './art';
import {
  GROUND, METER_SCALE, WIND_SCALE, landingVy, landingScore, padFor, speedMeter, windMeter, startRocket, stepRocket, touchdown, windFor,
  type Input, type Rocket,
} from './rules';

const BOXES = 3;

const create: CreateGame = api => {
  let rocket: Rocket = startRocket(0.5, 1);
  let wind = 0;
  let over = false;
  let fieldTop = 0;
  let fieldBottom = 0;
  let flash = 0;
  let lastOutcome = '';

  const readField = () => {
    fieldTop = api.HUD + 2;
    fieldBottom = api.LH - 4;
  };
  const px = (x: number) => Math.round(x * api.LW);
  const py = (y: number) => Math.round(fieldTop + y * (fieldBottom - fieldTop));

  function spawn(level: number) {
    rocket = startRocket(0.5, level);
    wind = windFor(level);
    api.S.mode = 'ready';
    api.S.modeT = 1.4;
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
    spawn(1);
  }

  function input(): Input {
    const left = api.held.includes('left') || api.stickDir === 'left';
    const right = api.held.includes('right') || api.stickDir === 'right';
    const rcs: -1 | 0 | 1 = left === right ? 0 : right ? 1 : -1;
    return {
      main: api.fireHeld || api.tapHeld,
      rcs,
      level: !!api.button('boost').held,
    };
  }

  function crash() {
    api.S.mode = 'dying';
    api.S.modeT = 1.3;
    api.S.lives = Math.max(0, api.S.lives - 1);
    lastOutcome = 'crashed';
    api.buzz('lose');
    api.tone(196, 0.14, 0.05, -90);
    api.tone(110, 0.22, 0.04, -40, 0.12);
  }

  function land() {
    const gained = landingScore(rocket, api.S.level);
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
    if (t.mode === 'ready') {
      api.clearFire();
      api.clearTap();
      if ((t.modeT -= dt) <= 0) t.mode = 'play';
      return;
    }
    if (t.mode === 'dying') {
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
    const before = rocket;
    rocket = stepRocket(rocket, held, dt, wind);
    if (held.main && rocket.fuel > 0 && before.fuel > 0 && Math.floor(t.time * 16) % 3 === 0) {
      api.tone(150, 0.03, 0.012, -20);
    }
    if (flash > 0) flash -= dt;

    const outcome = touchdown(rocket, t.level);
    if (outcome === 'landed') land();
    else if (outcome === 'crashed') crash();
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
    const m = speedMeter(rocket.vy, api.S.level);
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
  }

  function draw() {
    const pad = padFor(api.S.level);
    drawPad(api, px(pad.centre - pad.half), px(pad.centre + pad.half), py(GROUND), api.S.time);
    const left = px(0.12);
    {
      const x = px(rocket.x), y = py(rocket.y);
      if (api.S.mode !== 'dying' && input().main && rocket.fuel > 0) drawFlame(api, x, y, rocket.a, api.S.time);
      drawRocket(api, x, y, api.S.mode === 'dying' ? rocket.a + 0.6 : rocket.a, api.S.mode === 'dying');
    }
    drawWindMeter();
    drawSpeedMeter();
    hud();
    if (api.S.mode === 'ready') {
      drawLogo(api, Math.round(api.LW / 2), fieldTop + 6);
      api.txt('BURN TO LAND ON THE PAD', api.LW / 2, fieldTop + 30, 'hud', 'center');
    }
    if (lastOutcome === 'crashed' && api.S.mode === 'dying') {
      api.txt('CRASHED', api.LW / 2, fieldTop + 10, 'text', 'center', 16);
    }
  }

  return {
    start, update, draw,
    debug: {
      state: () => ({ x: rocket.x, y: rocket.y, vy: rocket.vy, a: rocket.a, fuel: rocket.fuel, mode: api.S.mode, lives: api.S.lives, level: api.S.level }),
    },
  };
};

export default create;

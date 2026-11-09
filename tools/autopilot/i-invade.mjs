// I Invade's autopilots: play the game headless against a stand-in console and print how far each bot gets.
//   node tools/autopilot/i-invade.mjs [runs=8] [bots=idle,spam,timing] [layouts=desk,phone,land]
// idle never presses anything; spam presses every bay every frame; timing fires a bay when its bomb would meet a tank
// (from the tank's speed now) and uses the cluster bomb, UFO and meteors as soon as they're ready.
// Targets (GAM-24): idle is repelled in about 90 s and never lands; spam clears the early waves, then thins out;
// timing clears wave 1 in about 20 to 40 s and is repelled around wave 5 to 8.
import { rolldown } from 'rolldown';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [runs = '8', bots = 'idle,spam,timing', layouts = 'desk,phone,land'] = process.argv.slice(2);
/* the playfield on each layout (LW × LH, read from the browser), with the console's 20 px status bar */
const SIZES = { desk: [360, 260], phone: [360, 332], land: [360, 284] };
const HUD = 20, DT = 1 / 60, LIMIT = 900;

const dir = mkdtempSync(join(tmpdir(), 'ii-auto-'));
const bundle = await rolldown({ input: new URL('../../src/games/i-invade/game.ts', import.meta.url).pathname });
await bundle.write({ file: join(dir, 'game.mjs'), format: 'esm' });
const { default: create } = await import(pathToFileURL(join(dir, 'game.mjs')).href);
rmSync(dir, { recursive: true, force: true });

function play(bot, layout){
  const [LW, LH] = SIZES[layout];
  const S = { mode: 'ready', modeT: 1.2, time: 0, score: 0, level: 1, lives: 3, nextLife: 0 };
  const btn = {}, B = id => (btn[id] ??= { label: id, enabled: true, queued: false, held: false });
  let finished = false;
  const noop = () => {}, g = new Proxy({}, { get: () => noop, set: () => true });
  const api = {
    g, LW, LH, HUD, S, best: 0, col: r => r, txt: noop, banner: noop, tone: noop, buzz: noop, fitGrid: noop, track: noop, saveBest: noop,
    finishGame: () => { finished = true; }, held: [], stickDir: null, tapQueued: false, tapHeld: false, tapX: 0, clearTap: noop,
    button: B, clearButton: id => { B(id).queued = false; },
    setButtons: p => { for (const k in p) if (p[k]) Object.assign(B(k), p[k]); },
    get fireQueued(){ return B('fire').queued; }, get boostQueued(){ return B('boost').queued; },
    clearFire: () => { B('fire').queued = false; }, clearBoost: () => { B('boost').queued = false; },
  };
  const rt = create(api); rt.start();
  const press = id => { if (B(id).enabled) B(id).queued = true; };
  const prev = new Map(), waves = [];
  let wave = 1, waveT = 0, logged = false;
  while (!finished && S.time < LIMIT) {
    S.time += DT; waveT += DT;
    const F = rt.debug.state();
    if (S.mode === 'play' && bot !== 'idle' && F.bays) {
      for (const [k, id] of [['L', 'pad1'], ['M', 'pad2'], ['R', 'pad3']]) {
        if (bot === 'spam') { press(id); continue; }
        const b = F.bays[k], eta = (b.y - (HUD + 10)) / ((170 + S.level * 4) * F.k);
        if (F.tanks.some(t => !t.out && t.downT <= 0 && t.safeT < eta && Math.abs(t.x + (t.x - (prev.get(t) ?? t.x)) / DT * eta + 6.5 - b.x) < 8)) press(id);
      }
      if (bot === 'timing') {
        if (F.tanks.some(t => !t.out && t.downT <= 0 && Math.abs(t.x + 6.5 - F.bays.M.x) < 10)) press('pad4');
        if (S.boost >= 1) press('boost');
        if (F.storm >= 1) press('pad5');
      }
    }
    for (const t of F.tanks) prev.set(t, t.x);
    rt.update(DT);
    if (S.mode === 'clear' && !logged) {
      const G = rt.debug.state();
      waves.push(`${waveT.toFixed(0)}s/${G.aliens.filter(a => a.alive).length}${G.end === 'touchdown' ? 'T' : ''}`); logged = true;
    }
    if (S.level !== wave) { wave = S.level; waveT = 0; logged = false; }
  }
  return { wave: S.level, secs: Math.round(S.time), score: S.score, waves };
}

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
for (const layout of layouts.split(',')) for (const bot of bots.split(',')) {
  const rs = Array.from({ length: +runs }, () => play(bot, layout));
  const landed = rs.filter(r => r.waves.some(w => w.endsWith('T'))).length;
  const first = rs.filter(r => r.waves.length).map(r => parseInt(r.waves[0]));
  console.log(`${bot.padEnd(6)} ${layout.padEnd(5)} waves reached ${JSON.stringify(rs.map(r => r.wave).sort((a, b) => a - b))} (median ${median(rs.map(r => r.wave))}), ` +
    `game ${median(rs.map(r => r.secs))} s, wave 1 cleared in ${first.length ? median(first) + ' s' : '-'}, touchdowns in ${landed}/${rs.length} games`);
}

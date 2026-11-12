/* The sample disk on the /host page: an original one-screen dodge game, written the way an AI harness would send one
   (two plain scripts, the .pgdisk shapes). Kept as strings: the page puts them in the box through <PGDConsole>. */

export const SAMPLE_DISK = `var PGDDisk = { disk: {
  id: 'rock-drop',
  title: 'Rock Drop',
  genre: 'DODGE',
  loadSecs: 1.6,
  blurb: 'Slide left and right. Stay out from under the rocks.',
  drawLoad(api, p, t) {
    const g = api.g, cx = api.LW / 2;
    g.fillStyle = api.col('bg'); g.fillRect(0, 0, api.LW, api.LH);
    api.txt('ROCK DROP', cx, 40, 'text', 'center', 16);
    g.fillStyle = api.col('spark');
    for (let i = 0; i < 5; i++) api.circ(cx - 40 + i * 20, 72 + ((t * 40 + i * 13) % 24), 3);
    api.diskInfo(110, p, t, this);
  },
} };`;

export const SAMPLE_GAME = `var PGDGame = { create(api) {
  const S = api.S;
  let x = 0, rocks = [], spawn = 0, safe = 0, clock = 0;
  const W = 14, H = 4;
  function reset() { x = api.LW / 2; rocks = []; spawn = 0.6; safe = 1.2; }
  return {
    start() { api.fitGrid(); reset(); S.mode = 'ready'; S.modeT = 1.2; clock = 0; },
    update(dt) {
      if (S.mode === 'ready') { api.clearFire(); if ((S.modeT -= dt) <= 0) S.mode = 'play'; return; }
      if (S.mode === 'dying') { if ((S.modeT -= dt) <= 0) { if (S.lives > 0) { reset(); S.mode = 'ready'; S.modeT = 1; } else api.finishGame(); } return; }
      if (S.mode !== 'play') return;
      const d = api.wantDir();
      if (d) x = Math.max(W / 2, Math.min(api.LW - W / 2, x + d.dx * 120 * dt));
      clock += dt; safe -= dt;
      if ((clock % 1) < dt) { S.score += 10 * S.level; if (S.score >= S.level * 200) S.level++; }
      if ((spawn -= dt) <= 0) {
        spawn = Math.max(0.18, 0.7 - S.level * 0.06);
        rocks.push({ x: 4 + Math.random() * (api.LW - 8), y: api.HUD, v: 50 + Math.random() * 40 + S.level * 12, r: 2 + Math.random() * 3 });
      }
      const py = api.LH - 10;
      for (const r of rocks) {
        r.y += r.v * dt;
        if (safe <= 0 && r.y + r.r > py && r.y - r.r < py + H && Math.abs(r.x - x) < W / 2 + r.r) {
          S.lives--; api.buzz('lose'); api.tone(110, 0.3, 0.2, -60); S.mode = 'dying'; S.modeT = 1; break;
        }
      }
      rocks = rocks.filter(r => r.y - r.r < api.LH);
    },
    draw() {
      const g = api.g;
      g.fillStyle = api.col('bg'); g.fillRect(0, 0, api.LW, api.LH);
      g.fillStyle = api.col('spark');
      for (const r of rocks) api.circ(r.x, r.y, r.r);
      if (S.mode !== 'dying' || Math.floor(S.modeT * 8) % 2) {
        g.fillStyle = api.col('text'); g.fillRect(x - W / 2, api.LH - 10, W, H);
      }
      api.txt('SCORE ' + S.score, 6, 6, 'text');
      api.txt('LIVES ' + Math.max(0, S.lives), api.LW - 6, 6, 'hud', 'right');
      if (S.mode === 'ready') api.banner('GET READY', 'LEVEL ' + S.level);
    },
  };
} };`;

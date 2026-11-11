// Makes the share images (public/og-*.png) and the README screenshots (docs/screens/*.png).
// 1. Captures the set from the built site (run `npm run build && npm run preview` first).
// 2. Lays each capture out with the name, tagline and a fan of floppy disks (share.css), and renders it at 1200 × 630.
// 3. With --covers, also writes each game's launcher cover (src/games/<folder>/cover.ts) from the same moment as its
//    play-*.png capture, read from the low-res buffer (no scanlines or bloom). --covers-only writes just the covers.
//    --previews also writes a flipbook preview (src/games/<folder>/preview.ts): 8 frames over 2 s, starting on the
//    cover's frame, by letting the game run on from the paused capture.
// Run: NODE_PATH=$(npm root -g) node tools/share-images/make.cjs [--covers | --covers-only] [--previews]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), BASE = process.env.BASE || 'http://localhost:4173';
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gg-share-'));
const SCREENS = path.join(ROOT, 'docs/screens');
const PREVIEWS = process.argv.includes('--previews');
// a flipbook starts on its cover, so --previews captures covers too
const COVERS = PREVIEWS || process.argv.includes('--covers') || process.argv.includes('--covers-only');
const SHARE = !process.argv.includes('--covers-only');

const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Spectral:ital,wght@0,400;1,400&family=IBM+Plex+Mono:wght@600&family=Permanent+Marker&family=Noto+Sans+TC:wght@500&display=swap';
const disk = (cls, title, file, x, rot, z) =>
  `<div class="disk ${cls}" style="left:${x}px;transform:rotate(${rot}deg);z-index:${z}"><div class="shutter"></div><div class="hole"></div><div class="lab"><b>${title}</b><i>${file}</i></div></div>`;
const page = ({ tv, h1, sub = '', tag, disks }) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>${fs.readFileSync(path.join(__dirname, 'share.css'), 'utf8')}</style></head><body>
<img class="tv" src="${tv}" alt="">
<div class="copy"><h1>${h1}${sub}</h1>
<div class="label"><span class="model">PGD-01</span><span class="mon">12″ phosphor monitor</span></div>
<p class="tag">${tag}</p></div>
<div class="disks">${disks}</div>
<div class="foot">Plays in your browser · offline · <span>EN</span> · 繁中 · 简中</div></body></html>`;

const IMAGES = [
  { out: 'og-image.png', tv: 'play-tunnel.png', h1: 'PGD-01<br>Portable Gaming Device', tag: 'A 1983 home console in your browser. Switch it on, pick a disk, play.',
    disks: disk('c1', 'Tunnel Raider', 'TUNNEL.EXE', 0, -7, 1) + disk('c2', 'Dino Run', 'DINORUN.COM', 148, 2, 2) + disk('c3', 'Invader Force', 'INVFORCE.EXE', 298, 8, 3) },
  { out: 'og-tunnel-raider.png', tv: 'play-tunnel.png', h1: 'Tunnel Raider', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Dig for emeralds, drop gold on the grubs, outwit smarter monsters every level.',
    disks: disk('c1', 'Tunnel Raider', 'TUNNEL.EXE · 46K', 40, -4, 2) + disk('c4', 'Dino Run', 'DINORUN.COM', 190, 7, 1) },
  { out: 'og-invader-force.png', tv: 'play-invader.png', h1: 'Invader Force', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Hold the line against the marching formation. One shot at a time: make it count.',
    disks: disk('c3', 'Invader Force', 'INVFORCE.EXE', 40, -4, 2) + disk('c4', 'Tunnel Raider', 'TUNNEL.EXE', 190, 7, 1) },
  { out: 'og-i-invade.png', tv: 'play-iinvade.png', h1: 'I Invade', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Be the invaders for once. Time the bomb bays, outlast the tanks, call in the UFO.',
    disks: disk('c1', 'I Invade', 'IINVADE.EXE', 40, -4, 2) + disk('c3', 'Invader Force', 'INVFORCE.EXE', 190, 7, 1) },
  { out: 'og-dino-run.png', tv: 'play-dino.png', h1: 'Dino Run', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Jump the cacti, duck the pterosaurs, run as far as the desert goes.',
    disks: disk('c2', 'Dino Run', 'DINORUN.COM · 9K', 40, -4, 2) + disk('c4', 'Tunnel Raider', 'TUNNEL.EXE', 190, 7, 1) },
  { out: 'og-bricks.png', tv: 'play-bricks.png', h1: 'Bricks', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Serve an ember, bounce it off one bat, and clear the wall.',
    disks: disk('c2', 'Bricks', 'BRICKS.EXE · 18K', 40, -4, 2) + disk('c4', 'Dino Run', 'DINORUN.COM', 190, 7, 1) },
  { out: 'og-martian-storm.png', tv: 'play-storm.png', h1: 'Martian Storm', sub: '<small>on the PGD-01 Portable Gaming Device</small>',
    tag: 'Fly a skiff through a Martian dust storm, tuck past the shots and land each leg.',
    disks: disk('c3', 'Martian Storm', 'STORM.EXE · 30K', 40, -4, 2) + disk('c4', 'Bricks', 'BRICKS.EXE', 190, 7, 1) },
];

(async () => {
  const b = await chromium.launch();
  /* ---- 1. capture the set ---- */
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(BASE + '/?test');
  await p.evaluate(() => {   // sample high scores, and no "saved for offline" badge in the shots
    localStorage.setItem('gg-offline', '1');
    localStorage.setItem('gg-board-tunnel', JSON.stringify([{ n: 'WIIIIMM', s: 18450, l: 6 }, { n: 'ACE', s: 9120, l: 4 }]));
    localStorage.setItem('gg-board-dino', JSON.stringify([{ n: 'WIIIIMM', s: 1260, l: 6 }]));
  });
  await p.reload(); await p.waitForTimeout(400);
  const shot = n => p.locator('.tv').screenshot({ path: path.join(TMP, n), omitBackground: true });
  // a game's play capture, and with --covers its launcher cover from the same frame
  const play = async (n, folder) => {
    await shot(n);
    if (!COVERS) return;
    const c = await p.evaluate(() => __gg.cover());
    const file = path.join(ROOT, 'src/games', folder, 'cover.ts');
    fs.writeFileSync(file, `/* Generated by tools/share-images/make.cjs --covers from the ${n} capture. Do not edit by hand. */\n`
      + `import type { Cover } from '../types';\n\n`
      + `export const cover: Cover = { w: ${c.w}, h: ${c.h}, data: '${c.data}' };\n`);
    console.log(path.relative(ROOT, file));
    if (!PREVIEWS) return;
    // the flipbook: the cover's frame, then the game running on for 2 s; paused again afterwards for the next step
    const frames = [c.data];
    await p.evaluate(() => { __gg.S.mode = 'play'; });
    for (let k = 1; k < 8; k++) { await p.waitForTimeout(250); frames.push(await p.evaluate(() => __gg.cover().data)); }
    await p.evaluate(() => { if (__gg.S.mode === 'play') __gg.S.mode = 'paused'; });
    const pf = path.join(ROOT, 'src/games', folder, 'preview.ts');
    fs.writeFileSync(pf, `/* Generated by tools/share-images/make.cjs --previews from the ${n} capture. Do not edit by hand. */\n`
      + `import type { Preview } from '../types';\n\n`
      + `export const preview: Preview = { w: ${c.w}, h: ${c.h}, fps: 4, frames: [\n${frames.map(f => `  '${f}',`).join('\n')}\n] };\n`);
    console.log(path.relative(ROOT, pf));
  };
  const until = (fn, ms = 40000) => p.waitForFunction(fn, null, { polling: 20, timeout: ms });
  await p.click('#powerBtn'); await until(() => __gg.S.mode === 'menu'); await p.waitForTimeout(1200); await shot('menu.png');
  // Tunnel Raider: its loading screen, then a little digging
  await p.evaluate(() => __gg.loadGame(0)); await until(() => __gg.S.loadT > 2.4); await shot('load-tunnel.png');
  await until(() => __gg.S.mode === 'play');
  for (const [k, ms] of [['ArrowRight', 1300], ['ArrowUp', 1000], ['ArrowRight', 700]]) { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); }
  await p.keyboard.press('Space'); await p.waitForTimeout(200); await play('play-tunnel.png', 'tunnel-raider');
  // Dino Run: its loading screen (stretched so the slow capture catches it), then an autopilot run, caught mid-jump
  await p.keyboard.press('KeyG'); await until(() => __gg.S.mode === 'menu');
  await p.evaluate(() => { __gg.loadGame(1); __gg.S.loadLen = 4.2; }); await until(() => __gg.S.loadT > 2.0); await shot('load-dino.png');
  await until(() => __gg.S.mode === 'play');
  await p.evaluate(() => { setInterval(() => {
    const D = __gg.runtime.debug.state(), S = __gg.S; if (S.mode !== 'play') return;
    const o = D.obs.find(o => o.x + o.w > 26); if (!o) return;
    const k = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c })), gap = o.x - 46;
    if (o.kind === 'ptero' && o.y >= 17) { if (o.y < 30 && gap < 40) k('keydown', 'ArrowDown'); else k('keyup', 'ArrowDown'); return; }
    k('keyup', 'ArrowDown');
    if (gap < D.speed * 0.18 && gap > -10 && !D.air) { k('keydown', 'ArrowUp'); setTimeout(() => k('keyup', 'ArrowUp'), 60); }
  }, 16); });
  for (let i = 0; i < 900; i++) {
    await p.waitForTimeout(50);
    const st = await p.evaluate(() => { const D = __gg.runtime.debug.state(), o = D.obs.find(o => o.x + o.w > 26 && o.kind !== 'ptero'); return { mode: __gg.S.mode, score: __gg.S.score, air: D.air, y: D.y, near: o ? o.x - 26 : 999 }; });
    if (st.mode !== 'play') break;
    if (st.score > 330 && st.air && st.y > 18 && st.near < 14 && st.near > -6) { await p.evaluate(() => { __gg.S.mode = 'paused'; }); await p.waitForTimeout(250); await play('play-dino.png', 'dino-run'); break; }
  }
  // Invader Force: its loading screen, then an autopilot fight, caught with a shot in the air
  await p.keyboard.press('KeyG'); await until(() => __gg.S.mode === 'menu');
  await p.evaluate(() => { __gg.loadGame(2); __gg.S.loadLen = 4.2; }); await until(() => __gg.S.loadT > 2.4); await shot('load-invader.png');
  await until(() => __gg.S.mode === 'play');
  await p.evaluate(() => { setInterval(() => {
    const F = __gg.runtime.debug.state(), S = __gg.S; if (S.mode !== 'play') return;
    const k = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c }));
    const al = F.aliens.filter(a => a.alive); if (!al.length) return;
    const tgt = al.reduce((a, b) => (b.r > a.r ? b : a)), tx = F.ox + tgt.c * 16 - 1;
    k('keyup', 'ArrowLeft'); k('keyup', 'ArrowRight');
    if (tx < F.px - 2) k('keydown', 'ArrowLeft'); else if (tx > F.px + 2) k('keydown', 'ArrowRight');
    if (!F.shots.length) { k('keydown', 'Space'); k('keyup', 'Space'); }
  }, 30); });
  await p.waitForTimeout(7000);
  await until(() => { const F = __gg.runtime.debug.state(); return __gg.S.mode === 'play' && F.shots.length && F.shots[0].y < __gg.LH - 60 && F.bombs.length > 0; }, 20000).catch(() => {});
  await p.evaluate(() => { __gg.S.mode = 'paused'; }); await p.waitForTimeout(250); await play('play-invader.png', 'invader-force');
  // I Invade: its loading screen, then an autopilot timing the three bomb bays as the fleet marches, caught mid-UFO run
  await p.keyboard.press('KeyG'); await until(() => __gg.S.mode === 'menu');
  await p.evaluate(() => { __gg.loadGame(3); __gg.S.loadLen = 4.2; }); await until(() => __gg.S.loadT > 2.6); await shot('load-iinvade.png');
  await until(() => __gg.S.mode === 'play');
  await p.evaluate(() => { setInterval(() => {
    const F = __gg.runtime.debug.state(), S = __gg.S; if (S.mode !== 'play' || !F.bays) return;
    const k = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c }));
    for (const [b, key] of [['L', 'ArrowLeft'], ['M', 'ArrowUp'], ['R', 'ArrowRight']]) {
      if (F.tanks.some(t => !t.out && t.downT <= 0 && Math.abs(t.x + 6.5 - F.bays[b].x) < 8)) { k('keydown', key); k('keyup', key); }
    }
  }, 30); });
  // the UFO starts half charged and ignores a call until it's full, so wait for the charge before calling it in
  await until(() => __gg.S.mode === 'play' && __gg.S.boost >= 1, 20000);
  await p.keyboard.press('Shift');
  await until(() => { const F = __gg.runtime.debug.state(); return __gg.S.mode === 'play' && F.ufo && F.ufo.x > __gg.LW * 0.35 && F.ufo.x < __gg.LW * 0.65; }, 20000);   // no catch: a missed UFO fails the run
  await p.evaluate(() => { __gg.S.mode = 'paused'; }); await p.waitForTimeout(250); await play('play-iinvade.png', 'i-invade');
  // Bricks: its loading screen, then a served ember on the way up into the wall
  await p.keyboard.press('KeyG'); await until(() => __gg.S.mode === 'menu');
  await p.evaluate(() => { __gg.loadGame(__gg.DISKS.findIndex(d => d.id === 'bricks')); __gg.S.loadLen = 4.2; });
  await until(() => __gg.S.loadT > 1.1); await shot('load-bricks.png');
  await until(() => __gg.S.mode === 'play');
  await p.keyboard.press('Space');
  await p.evaluate(() => { setInterval(() => {
    const B = __gg.runtime.debug.state(), S = __gg.S; if (S.mode !== 'play' || !B.served) return;
    const k = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c }));
    k('keyup', 'ArrowLeft'); k('keyup', 'ArrowRight');
    if (B.bx + 2 < B.px + 20) k('keydown', 'ArrowLeft');
    else if (B.bx + 2 > B.px + 36) k('keydown', 'ArrowRight');
  }, 30); });
  await until(() => { const B = __gg.runtime.debug.state(); return __gg.S.mode === 'play' && B.served && B.by < __gg.LH * 0.55; }, 8000).catch(() => {});
  await p.evaluate(() => { __gg.S.mode = 'paused'; }); await p.waitForTimeout(250); await play('play-bricks.png', 'bricks');
  // Martian Storm: its loading screen, then a skiff firing up at a flight of spores
  await p.keyboard.press('KeyG'); await until(() => __gg.S.mode === 'menu');
  await p.evaluate(() => { __gg.loadGame(__gg.DISKS.findIndex(d => d.id === 'martian-storm')); __gg.S.loadLen = 4.2; });
  await until(() => __gg.S.loadT > 1.6); await shot('load-storm.png');
  await until(() => __gg.S.mode === 'play');
  // hold fire until a flight of spores is well down the tube, so the cover shows what you shoot at;
  // the skiff can't be hit, so the flipbook after it keeps playing instead of losing a life
  await p.evaluate(() => __gg.runtime.debug.untouchable(true));
  await p.keyboard.down('Space');
  await until(() => __gg.S.mode === 'play' && __gg.runtime.debug.state().craft >= 4, 20000).catch(() => {});
  await p.waitForTimeout(500);
  await p.keyboard.up('Space');
  await p.evaluate(() => { __gg.S.mode = 'paused'; }); await p.waitForTimeout(250); await play('play-storm.png', 'martian-storm');
  if (!SHARE) { await b.close(); return; }
  /* ---- 2. lay out and render the share images ---- */
  const r = await (await b.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  for (const img of IMAGES) {
    const html = path.join(TMP, img.out + '.html');
    fs.writeFileSync(html, page(img));
    await r.goto('file://' + html); await r.waitForLoadState('networkidle').catch(() => {}); await r.waitForTimeout(800);
    await r.screenshot({ path: path.join(ROOT, 'public', img.out) });
    console.log('public/' + img.out);
  }
  /* ---- 3. README screenshots, 720 px wide ---- */
  fs.mkdirSync(SCREENS, { recursive: true });
  const s = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  for (const n of ['menu', 'load-tunnel', 'play-tunnel', 'load-dino', 'play-dino', 'load-invader', 'play-invader', 'load-iinvade', 'play-iinvade', 'load-bricks', 'play-bricks', 'load-storm', 'play-storm']) {
    const html = path.join(TMP, n + '.html');
    fs.writeFileSync(html, `<body style="margin:0;background:transparent"><img src="${n}.png" style="width:720px;display:block"></body>`);
    await s.goto('file://' + html); await s.waitForTimeout(150);
    await s.locator('img').screenshot({ path: path.join(SCREENS, n + '.png'), omitBackground: true });
    console.log('docs/screens/' + n + '.png');
  }
  await b.close();
})();

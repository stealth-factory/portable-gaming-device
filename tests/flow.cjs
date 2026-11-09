// Console flow: boot → disk menu → load each game → play → game over → SELECT back to the menu,
// plus Invader Force's weapon capsules, speed boost and blasts, I Invade's button pad and weapons,
// and Bricks' Enter serve, bowed bat and falling capsules.
// Then every disk on the menu (future games included): choose it with the menu's keys or a tap,
// play, HOLD when the tab is hidden, game over, name entry or the table, G back to the menu.
const { chromium, devices } = require('playwright');
(async () => {
const BASE = process.env.BASE || 'http://localhost:4173/', out = process.env.OUT || '/tmp/shots';
const b = await chromium.launch(); const errs = [];
async function page(tag, opts){ const p = await (await b.newContext(opts)).newPage(); p.on('pageerror', e => errs.push(tag + ': ' + e.message)); p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/_vercel/')) errs.push(tag + ' ' + r.status() + ' ' + r.url()); }); await p.goto(BASE + '?test'); await p.waitForTimeout(500); return p; }
const mode = p => p.evaluate(() => __gg.S.mode);
// disks that have to be on the menu today; the loop below still plays whatever else is listed
const REQUIRED = ['tunnel', 'dino', 'invader', 'iinvade'];
async function backToMenu(p){
  if (await mode(p) !== 'menu') await p.keyboard.press('g');
  await p.waitForFunction(() => __gg.S.mode === 'menu' && globalThis.__ggBus.get().manual === 'console' && document.querySelector('#manH')?.textContent === 'Operating Instructions', null, { timeout: 8000 });
}
// the row's place on the tube, in the same units drawMenu uses, so a tap lands on that disk.
// menuRows is nested because this function is sent to the page: keep it in step with src/console/menu-layout.ts
function diskRow(i){
  function menuRows(n, lh){
    const frame = (rowH, gap, minTop) => {
      const block = 64 + n * (rowH + gap) + 36;
      const top = Math.max(minTop, Math.round((lh - block) / 2));
      return { top, bottom: top + 88 + n * (rowH + gap) };
    };
    let rowH = Math.max(18, Math.min(36, Math.floor((lh - 16 - 64 - 36) / n) - 6));
    let gap = rowH >= 30 ? 6 : 3;
    const first = frame(rowH, gap, 8);
    if (first.bottom <= lh - 1) return { rowH, gap, top: first.top };
    gap = 2;
    for (let rh = Math.min(rowH, 22); rh >= 12; rh--) {
      const next = frame(rh, gap, 4);
      if (next.bottom <= lh - 1) return { rowH: rh, gap, top: next.top };
    }
    return { rowH: 12, gap: 2, top: 4 };
  }
  const LW = __gg.LW, LH = __gg.LH, n = __gg.DISKS.length;
  const { rowH, gap, top } = menuRows(n, LH);
  const bw = Math.min(LW - 16, 300), x0 = Math.round(LW / 2 - bw / 2);
  const y = top + 60 + i * (rowH + gap);
  return { x: (x0 + bw / 2) / LW, y: (y + rowH / 2) / LH };
}
// desk moves the highlight and presses Enter; a phone taps the row. Neither calls loadGame itself
async function chooseDisk(p, tag, i){
  if (tag === 'desk') {
    const n = await p.evaluate(() => __gg.DISKS.length), sel = await p.evaluate(() => __gg.S.menuSel | 0);
    for (let s = 0; s < (i - sel + n) % n; s++) await p.keyboard.press('ArrowDown');
    const now = await p.evaluate(() => __gg.S.menuSel);
    if (now !== i) { errs.push(tag + ' menu keys missed disk ' + i + ' (highlight ' + now + ')'); return false; }
    await p.keyboard.press('Enter');
    return true;
  }
  const box = await p.locator('#cv').boundingBox();
  const pt = await p.evaluate(diskRow, i);
  await p.mouse.click(box.x + pt.x * box.width, box.y + pt.y * box.height);
  return true;
}
// pretend the tab went into the background and came back (headless Chromium never hides a page by itself)
const setHidden = (p, v) => p.evaluate(v => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
}, v);
async function holdOnHide(p){
  const was = await mode(p);
  const look = () => p.evaluate(() => ({ mode: __gg.S.mode, led: document.querySelector('#pauseBtn').getAttribute('aria-pressed'), overlay: !__gg.overlay.hidden }));
  // a sound scheduled for later is still waiting on the shared output when the page hides: hiding must cut that output
  const ringing = await p.evaluate(() => { __gg.tone(440, 0.5, 0.01, 0, 1); globalThis.__ggOut = __gg.audioOut; return !!__gg.audioOut; });
  await setHidden(p, true); const hidden = await look();
  const cut = await p.evaluate(() => !globalThis.__ggOut || (__gg.audioOut !== globalThis.__ggOut && globalThis.__ggOut.gain.value === 0));
  await setHidden(p, false); await p.waitForTimeout(300); const back = await look();
  await p.keyboard.press('p'); const resumed = await look();
  // and the next sound goes out through a fresh, open output
  const fresh = await p.evaluate(() => { __gg.tone(440, 0.02, 0.01); const o = __gg.audioOut; return !!o && o !== globalThis.__ggOut && o.gain.value === 1; });
  const sound = { ringing, cut, fresh: fresh || !ringing };
  const held = s => s.mode === 'paused' && s.led === 'true' && s.overlay;
  return { ok: held(hidden) && held(back) && resumed.mode === was && resumed.led === 'false' && sound.cut && sound.fresh, was, hidden, back, resumed, sound };
}
// one pass per disk: boot is already done; choose it on the menu, play, qualify for the table, then G home
async function playEveryDisk(p, tag){
  await backToMenu(p);
  const disks = await p.evaluate(() => __gg.DISKS.map(d => d.id));
  for (const id of REQUIRED) if (!disks.includes(id)) errs.push(tag + ' menu missing ' + id);
  for (let i = 0; i < disks.length; i++) {
    const id = disks[i];
    if (!await chooseDisk(p, tag, i)) { console.log(tag, 'disk', id, { pick: 'missed' }); continue; }
    await p.waitForFunction(id => (__gg.S.mode === 'load' || __gg.S.mode === 'ready' || __gg.S.mode === 'play') && __gg.game && __gg.game.id === id, id, { timeout: 4000 });
    await p.waitForFunction(id => __gg.S.mode === 'play' && __gg.game && __gg.game.id === id && globalThis.__ggBus.get().manual === id && (document.querySelector('#manH')?.textContent || '') !== 'Operating Instructions', id, { timeout: 12000 });
    // Bricks does not auto-serve. Enter is what the instructions promise, and it is the first key that moves the ember.
    if (id === 'bricks') {
      const before = await p.evaluate(() => { const s = __gg.runtime.debug.state(); return { served: s.served, vx: s.vx, vy: s.vy, mode: __gg.S.mode }; });
      await p.keyboard.press('Enter');
      await p.waitForTimeout(60);
      const after = await p.evaluate(() => { const s = __gg.runtime.debug.state(); return { served: s.served, vx: s.vx, vy: s.vy }; });
      const serveOk = before.mode === 'play' && before.served === false && before.vx === 0 && before.vy === 0 && after.served === true && (after.vx !== 0 || after.vy !== 0);
      if (!serveOk) errs.push(tag + ' bricks enter serve: ' + JSON.stringify({ before, after }));
      console.log(tag, 'bricks enter serve', { before, after });
      const base = await p.evaluate(() => { const s = __gg.runtime.debug.state(); return { bw: s.bw, px: s.px }; });
      await p.keyboard.down('ArrowUp');
      const bowed = await p.waitForFunction(() => __gg.runtime.debug.state().bend > 0.7, null, { timeout: 1500 }).then(() => true, () => false);
      const up = await p.evaluate(() => { const s = __gg.runtime.debug.state(); return { bend: s.bend, px: s.px }; });
      await p.keyboard.up('ArrowUp');
      await p.keyboard.down('ArrowDown');
      const flipped = await p.waitForFunction(() => __gg.runtime.debug.state().bend < -0.7, null, { timeout: 1500 }).then(() => true, () => false);
      await p.keyboard.up('ArrowDown');
      const eased = await p.waitForFunction(() => Math.abs(__gg.runtime.debug.state().bend) < 0.2, null, { timeout: 1500 }).then(() => true, () => false);
      const bowOk = bowed && flipped && eased && up.bend > 0.7 && Math.abs(up.px - base.px) < 2;
      if (!bowOk) errs.push(tag + ' bricks bow: ' + JSON.stringify({ base, up, bowed, flipped, eased }));
      console.log(tag, 'bricks bow', { base, up, bowed, flipped, eased });
      const caught = await p.evaluate(async () => {
        const dbg = __gg.runtime.debug;
        const baseW = dbg.state().bw;
        const take = (kind) => new Promise(resolve => {
          dbg.drop(kind);
          const t0 = performance.now();
          const step = () => {
            const s = dbg.state();
            if (s.size === kind || s.pace === kind || (kind === 'sear' && s.sear === 3) || performance.now() - t0 > 1500) resolve(s);
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        const wide = await take('broad');
        const slim = await take('slim');
        const fast = await take('flare');
        const slow = await take('damp');
        const sear = await take('sear');
        return { baseW, wide, slim, fast, slow, sear, boost: document.querySelector('#boostBtn')?.getAttribute('aria-disabled'), leaflet: document.querySelector('#manual')?.textContent || '' };
      });
      const dropOk = caught.wide.size === 'broad' && caught.wide.bw === Math.round(caught.baseW * 1.5)
        && caught.slim.size === 'slim' && caught.slim.bw === Math.round(base.bw * 0.6)
        && caught.fast.pace === 'flare' && caught.slow.pace === 'damp' && caught.slow.size === 'slim'
        && caught.sear.sear === 3 && caught.boost === 'true'
        && caught.leaflet.includes('Broad') && /bow/i.test(caught.leaflet);
      if (!dropOk) errs.push(tag + ' bricks drops: ' + JSON.stringify({
        base: base.bw, wide: { size: caught.wide.size, bw: caught.wide.bw }, slim: { size: caught.slim.size, bw: caught.slim.bw },
        pace: [caught.fast.pace, caught.slow.pace], sear: caught.sear.sear, boost: caught.boost,
      }));
      console.log(tag, 'bricks drops', { wide: caught.wide.bw, slim: caught.slim.bw, pace: caught.slow.pace, sear: caught.sear.sear, boost: caught.boost });
    } else await p.keyboard.press('Space');
    await p.waitForTimeout(200);
    // hiding the tab mid-game switches HOLD on (LED lit), and it stays on when the tab comes back until the player resumes
    const hold = await holdOnHide(p);
    if (!hold.ok) errs.push(tag + ' disk ' + id + ' hold on hide: ' + JSON.stringify(hold));
    await p.screenshot({ path: `${out}/${tag}-every-${id}.png` });
    const live = await p.evaluate(() => ({ mode: __gg.S.mode, heading: document.querySelector('#manH')?.textContent || '', fireKey: document.querySelector('#fireBtn')?.dataset.i18n || '', runtime: !!__gg.runtime }));
    const ended = await p.evaluate(sc => { if (['ready', 'play', 'dying', 'clear'].includes(__gg.S.mode)) { __gg.S.score = sc; __gg.finishGame(); } return __gg.S.mode; }, 8000 + i);
    let named = false;
    if (ended === 'entry') {
      await p.waitForTimeout(200);
      for (let n = 0; n < 9; n++) await p.keyboard.press('Backspace');
      await p.keyboard.type('GUY'); await p.keyboard.press('Enter');
      await p.waitForFunction(() => __gg.S.mode === 'over', null, { timeout: 4000 });
      named = await p.evaluate(id => {
        let stored = []; try { stored = JSON.parse(localStorage.getItem('gg-board-' + id) || '[]'); } catch (_) {}
        return __gg.S.mode === 'over' && !!__gg.S.showBoard && (__gg.board || []).some(e => e.n === 'GUY') && stored.some(e => e && e.n === 'GUY' && e.s > 0);
      }, id);
      await p.screenshot({ path: `${out}/${tag}-every-${id}-table.png` });
    }
    const playing = ['play', 'dying', 'clear', 'ready'].includes(live.mode) && live.runtime && live.fireKey !== 'menuSel' && !!live.heading && live.heading !== 'Operating Instructions';
    if (!playing || ended !== 'entry' || !named) errs.push(tag + ' disk ' + id + ': ' + JSON.stringify({ live, ended, named }));
    console.log(tag, 'disk', id, { play: live.mode, leaflet: live.heading, end: ended, table: named });
    await backToMenu(p);
  }
  console.log(tag, { everyDisk: disks.join(',') });
}
for (const [tag, opts] of [['desk', { viewport: { width: 1280, height: 860 } }], ['phone', { ...devices['iPhone 15 Pro'] }], ['land', { ...devices['iPhone 15 Pro landscape'] }]]) {
  const p = await page(tag, opts);
  await p.click('#powerBtn'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${tag}-boot.png` });
  await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 8000 });
  await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-menu.png` });
  // the menu maps its own buttons: FIRE reads SELECT, BOOST is dark and ignores presses
  const menuBtns = await p.evaluate(() => ({ fire: document.querySelector('#fireBtn').textContent, boostOff: document.querySelector('#boostBtn').getAttribute('aria-disabled') }));
  await p.keyboard.press('Shift'); const afterBoost = await mode(p);
  if (menuBtns.fire !== 'SELECT' || menuBtns.boostOff !== 'true' || afterBoost !== 'menu') errs.push(tag + ' menu buttons: ' + JSON.stringify({ ...menuBtns, afterBoost }));
  // tunnel raider via FIRE
  const t0 = Date.now(); await p.click('#fireBtn');
  await p.waitForTimeout(2000); await p.screenshot({ path: `${out}/${tag}-load-tunnel.png` });
  await p.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 8000 });
  const tl = (Date.now() - t0) / 1000;
  const gameBtns = await p.evaluate(() => ({ fire: document.querySelector('#fireBtn').textContent, boostOff: document.querySelector('#boostBtn').getAttribute('aria-disabled') }));
  if (gameBtns.fire !== 'FIRE' || gameBtns.boostOff !== 'false') errs.push(tag + ' game buttons: ' + JSON.stringify(gameBtns));
  await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/${tag}-tunnel.png` });
  // SELECT back to the menu, pick Dino Run
  await p.keyboard.press('g'); await p.waitForTimeout(400);   // SELECT's key (the button is hidden for now)
  const afterSel = await mode(p);
  await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 6000 });
  if (tag === 'desk') { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); } else { await p.evaluate(() => __gg.loadGame(1)); }
  const t1 = Date.now(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-load-dino.png` });
  await p.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 8000 });
  const dl = (Date.now() - t1) / 1000 + 0.9;
  await p.waitForTimeout(1500);
  if (tag === 'desk') { for (let i = 0; i < 6; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(450); } }
  else { const c = await p.locator('#cv').boundingBox(); for (let i = 0; i < 6; i++) { await p.mouse.click(c.x + c.width / 2, c.y + c.height / 2); await p.waitForTimeout(450); } }
  await p.screenshot({ path: `${out}/${tag}-dino.png` });
  const st = await p.evaluate(() => ({ mode: __gg.S.mode, score: __gg.S.score, game: __gg.game.id }));
  // force a qualifying game over and enter a name
  await p.evaluate(() => { if (__gg.S.mode === 'play') { __gg.S.score = 777; __gg.finishGame(); } });
  await p.waitForTimeout(300);
  const m2 = await mode(p);
  if (m2 === 'entry') { await p.keyboard.type('DINO'); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${tag}-dino-board.png` }); }
  const boards = await p.evaluate(() => ({ dino: localStorage.getItem('gg-board-dino'), tunnel: localStorage.getItem('gg-board-tunnel') }));
  console.log(tag, { tunnelLoad: tl.toFixed(1), afterSelect: afterSel, dinoLoad: dl.toFixed(1), dino: st, endMode: m2, boards });
  // Invader Force: load it, fire, then catch capsules and try each weapon, the speed boost and the blasts
  await p.keyboard.press('g'); await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 6000 });
  await p.evaluate(() => __gg.loadGame(__gg.DISKS.findIndex(d => d.id === 'invader')));
  await p.waitForFunction(() => __gg.S.mode === 'play', null, { timeout: 10000 });
  const leaflet = await p.evaluate(() => document.querySelector('#manual')?.textContent || '');
  const dbg = () => p.evaluate(() => { const F = __gg.runtime.debug.state(); return { weapon: F.weapon, speed: F.speed, shots: F.shots.length, beam: !!F.beam, capsules: F.capsules.length, blasts: F.blasts.length, alive: F.aliens.filter(a => a.alive).length }; });
  await p.keyboard.press('Space'); await p.waitForTimeout(150);
  const basic = await dbg();
  await p.evaluate(() => __gg.runtime.debug.drop('twin')); await p.waitForTimeout(900);
  const caught = await dbg();
  await p.keyboard.press('Space'); await p.waitForTimeout(120);
  const twin = await dbg();
  await p.evaluate(() => __gg.runtime.debug.arm('spread')); await p.waitForFunction(() => !__gg.runtime.debug.state().shots.length, null, { timeout: 4000 }); await p.keyboard.press('Space'); await p.waitForFunction(() => __gg.runtime.debug.state().shots.length > 0, null, { timeout: 2000 });
  const spread = await dbg(); await p.screenshot({ path: `${out}/${tag}-invader-spread.png` });
  await p.evaluate(() => { __gg.runtime.debug.arm('speed'); __gg.runtime.debug.arm('speed'); __gg.runtime.debug.arm('pierce'); }); await p.waitForTimeout(500);
  await p.keyboard.press('Space'); await p.waitForTimeout(60);
  const pierce = await dbg(); await p.screenshot({ path: `${out}/${tag}-invader-pierce.png` });
  await p.evaluate(() => { const F = __gg.runtime.debug.state(); __gg.S.boostT = 1; __gg.runtime.debug.clash(F.ox + 20, F.oy + 50); __gg.runtime.debug.blast(F.ox + 40, F.oy + 40); }); await p.waitForTimeout(100);
  const blasts = await dbg(); await p.screenshot({ path: `${out}/${tag}-invader-blast.png` });
  await p.waitForTimeout(600);
  // Rapid keeps firing while Space is held down (no key repeat needed)
  await p.evaluate(() => { __gg.runtime.debug.clearWalls(); __gg.S.boostT = 5; __gg.runtime.debug.arm('rapid'); });   // shield up: no walls to hide behind
  await p.waitForFunction(() => !__gg.runtime.debug.state().shots.length, null, { timeout: 4000 });
  await p.keyboard.down('Space'); await p.waitForTimeout(300);
  const rapid = await dbg(); await p.keyboard.up('Space');
  // shoot a capsule right over the cannon: its wide blast reaches the cannon but spares you, even with the shield down
  await p.waitForFunction(() => !__gg.runtime.debug.state().shots.length, null, { timeout: 4000 });
  const livesBefore = await p.evaluate(() => { const F = __gg.runtime.debug.state(); F.bombs = []; F.capsules = []; __gg.S.boostT = 0; __gg.runtime.debug.target('spread'); return __gg.S.lives; });
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  const shotCap = await p.evaluate(() => { const F = __gg.runtime.debug.state(); const near = F.blasts.filter(b => b.r >= 16 && Math.hypot(Math.max(F.px, Math.min(b.x, F.px + 13)) - b.x, Math.max(__gg.runtime.debug.cannonY(), Math.min(b.y, __gg.runtime.debug.cannonY() + 7)) - b.y) <= b.r).length; return { capsules: F.capsules.length, blasts: near, weapon: F.weapon, lives: __gg.S.lives, mode: __gg.S.mode }; });
  await p.screenshot({ path: `${out}/${tag}-invader-shotcap.png` });
  const capOk = shotCap.capsules === 0 && shotCap.blasts >= 1 && shotCap.weapon === 'rapid' && shotCap.lives === livesBefore && shotCap.mode === 'play';
  await p.evaluate(() => { const F = __gg.runtime.debug.state(), a = F.aliens.filter(q => q.alive).sort((p, q) => q.r - p.r)[0]; F.px = F.ox + a.c * 16 - 1; __gg.runtime.debug.arm('nuke'); }); await p.waitForTimeout(200);   // under a live alien
  const label = await p.evaluate(() => document.querySelector('#boostBtn span').textContent);
  await p.keyboard.press('Shift'); await p.waitForTimeout(200);
  const flying = await p.evaluate(() => !!__gg.runtime.debug.state().missile); await p.screenshot({ path: `${out}/${tag}-invader-missile.png` });
  await p.waitForFunction(() => !__gg.runtime.debug.state().missile, null, { timeout: 4000 }); await p.waitForTimeout(80);
  const nuked = await dbg(); await p.screenshot({ path: `${out}/${tag}-invader-nuke.png` });
  const label2 = await p.evaluate(() => document.querySelector('#boostBtn span').textContent);
  // a nuke that clears the wave must not leave its white flash over the next wave
  await p.evaluate(() => { const F = __gg.runtime.debug.state(); F.aliens.forEach(a => { a.alive = a.r === 0 && a.c === 0; }); F.missile = { x: F.ox + 5, y: F.oy + 9 }; });   // a missile about to hit the last alien
  await p.waitForFunction(() => __gg.S.mode === 'ready' && __gg.S.level === 2, null, { timeout: 8000 });
  const flashLeft = await p.evaluate(() => __gg.runtime.debug.state().flash);
  await p.evaluate(() => { if (__gg.S.mode === 'play' || __gg.S.mode === 'ready') { __gg.S.score = 0; __gg.finishGame(); } }); await p.waitForTimeout(300);
  const ok = capOk && flashLeft <= 0 && rapid.shots >= 2 && basic.shots === 1 && caught.weapon === 'twin' && twin.shots === 2 && spread.shots === 3 && pierce.beam && pierce.speed === 2 && blasts.blasts >= 2 && blasts.alive < pierce.alive && /Capsules/.test(leaflet) && label === 'NUKE' && label2 === 'SHIELD' && flying && nuked.alive < blasts.alive;
  if (!ok) errs.push(tag + ' invader weapons: ' + JSON.stringify({ basic, caught, twin, spread, pierce, blasts, label, label2, flying, nuked, flashLeft, rapid, shotCap, livesBefore }));
  console.log(tag, { invader: { basic: basic.shots, caught: caught.weapon, twin: twin.shots, spread: spread.shots, pierce: pierce.beam, speed: pierce.speed, alive: [pierce.alive, blasts.alive, nuked.alive], label: [label, label2], end: await mode(p) } });
  // I Invade has no stick: while it plays, a button pad takes the stick's place (and FIRE's row steps aside). The pad's
  // top row and ← ↑ → (Z X C) bomb from the left, middle and right bays, Space from the middle, one bomb in the air
  // per bay; A drops a cluster bomb once it's armed, S the meteor swarm once charged. The stick is back on the menu.
  await backToMenu(p);
  const padView = () => p.evaluate(() => ({
    pad: document.documentElement.hasAttribute('data-pad'),
    keys: [1, 2, 3, 4, 5, 6].map(n => { const el = document.getElementById(`pad${n}Btn`); return el.hidden || !el.getClientRects().length ? '-' : el.textContent; }).join(' '),
    stick: !!document.getElementById('stickbase').getClientRects().length,
    fire: !!document.getElementById('fireBtn').getClientRects().length,
  }));
  const menuPad = await padView();
  await p.evaluate(() => __gg.loadGame(__gg.DISKS.findIndex(d => d.id === 'iinvade')));
  await p.waitForFunction(() => __gg.S.mode === 'play', null, { timeout: 12000 });
  const gamePad = await padView();
  await p.screenshot({ path: `${out}/${tag}-iinvade-pad.png` });
  const ii = () => p.evaluate(() => { const F = __gg.runtime.debug.state(); return { bombs: F.bombs.map(b => ({ k: b.k, bay: b.bay, x: Math.round(b.x), y: b.y })), meteors: F.meteors.length, bays: F.bays, clusterCD: F.clusterCD }; });
  const holdFire = () => p.evaluate(() => __gg.runtime.debug.holdFire());   // tank shells would knock bombs out mid-check
  const clearSky = () => p.waitForFunction(() => __gg.S.mode === 'play' && !__gg.runtime.debug.state().bombs.length, null, { timeout: 8000 });
  const bays = {}; let one = null, up = null;
  for (const [k, key] of [['L', 'ArrowLeft'], ['M', 'x'], ['R', 'c'], ['S', 'Space'], ['L2', 'z'], ['R2', 'ArrowRight'], ['M2', 'ArrowUp']]) {
    await clearSky(); await holdFire();
    const before = await ii();
    await p.keyboard.press(key);
    await p.waitForFunction(() => __gg.runtime.debug.state().bombs.length > 0, null, { timeout: 1000 }).catch(() => {});
    const after = await ii(), b = after.bombs[0], bay = k[0] === 'S' ? 'M' : k[0];
    bays[k] = !!b && b.bay === bay && Math.abs(b.x - before.bays[bay].x) <= 4;
    if (k === 'R' && b) {   // a second press on the same bay while its bomb is up does nothing, and the bomb is rising
      await p.waitForTimeout(450); await p.keyboard.press('c'); await p.waitForTimeout(60);
      const now = await ii();
      one = now.bombs.filter(q => q.bay === 'R').length === 1; up = now.bombs.length > 0 && now.bombs[0].y < b.y;
    }
  }
  // a tap on a pad key fires its bay and leaves the keyboard where it was (Space still bombs, nothing is focused)
  await clearSky(); await holdFire();
  await p.dispatchEvent('#pad1Btn', 'pointerdown', { pointerId: 7 }); await p.dispatchEvent('#pad1Btn', 'pointerup', { pointerId: 7 });
  await p.dispatchEvent('#pad1Btn', 'click', { detail: 1 }); await p.waitForTimeout(50);
  const tapPad = (await ii()).bombs.some(b => b.bay === 'L');
  const focus = await p.evaluate(() => document.activeElement?.id || '');
  // the cluster bomb arms a moment into the wave; the meteor swarm once charged: 18 rocks
  await p.waitForFunction(() => __gg.runtime.debug.state().clusterCD <= 0, null, { timeout: 8000 });
  await clearSky(); await holdFire(); await p.keyboard.press('a'); await p.waitForTimeout(80);
  const cluster = (await ii()).bombs.some(b => b.k === 'cluster');
  const meteorsDark = await p.evaluate(() => document.getElementById('pad5Btn').getAttribute('aria-disabled'));
  await p.evaluate(() => __gg.runtime.debug.charge()); await p.waitForTimeout(80);
  const meteorsLit = await p.evaluate(() => document.getElementById('pad5Btn').getAttribute('aria-disabled'));
  await p.keyboard.press('s'); await p.waitForTimeout(80);
  const meteors = (await ii()).meteors;
  // a fleet that reaches the tanks' row touches down and wins the wave
  await holdFire();
  await p.evaluate(() => __gg.runtime.debug.climb(-400));
  const landed = await p.waitForFunction(() => __gg.S.mode === 'clear' && __gg.runtime.debug.state().landed, null, { timeout: 4000 }).then(() => true, () => false);
  // the high-score screens are the console's: the stick comes back
  await p.evaluate(() => { __gg.S.score = 0; __gg.finishGame(); }); await p.waitForTimeout(100);
  const overPad = await padView();
  // off the playing screens the pad's keys are the console's again: C still changes the phosphor
  const phos = () => p.evaluate(() => document.documentElement.style.getPropertyValue('--phos') + document.documentElement.style.getPropertyValue('--plastic'));
  const phosBefore = await phos(); await p.keyboard.press('KeyC'); const phosC = (await phos()) !== phosBefore;
  for (let i = 0; i < 12 && (await phos()) !== phosBefore; i++) await p.keyboard.press('KeyC');   // and back round to where it was
  await backToMenu(p);
  const backPad = await padView();
  const want = { menu: { pad: false, keys: '- - - - - -', stick: true, fire: true }, game: { pad: true, keys: '◀ ▲ ▶ CLUSTER METEORS -', stick: false, fire: false } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const iiOk = same(menuPad, want.menu) && same(gamePad, want.game) && same(backPad, want.menu) && !overPad.pad && overPad.stick && Object.values(bays).every(Boolean) && one && up && tapPad && !/^pad/.test(focus) && cluster && meteorsDark === 'true' && meteorsLit === 'false' && meteors === 18 && landed && phosC;
  if (!iiOk) errs.push(tag + ' i invade pad: ' + JSON.stringify({ menuPad, gamePad, overPad, backPad, bays, one, up, tapPad, focus, cluster, meteorsDark, meteorsLit, meteors, landed, phosC }));
  console.log(tag, JSON.stringify({ iinvade: { gamePad, bays, one, up, tapPad, cluster, meteors, landed, phosC, overPad: overPad.pad } }));
  await playEveryDisk(p, tag);
}
console.log(errs.join('\n') || 'no errors'); await b.close();
})();

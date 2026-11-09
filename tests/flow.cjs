// Console flow: boot → disk menu → load each game → play → game over → SELECT back to the menu,
// plus Invader Force's weapon capsules, speed boost and blasts.
const { chromium, devices } = require('playwright');
(async () => {
const BASE = process.env.BASE || 'http://localhost:4173/', out = process.env.OUT || '/tmp/shots';
const b = await chromium.launch(); const errs = [];
async function page(tag, opts){ const p = await (await b.newContext(opts)).newPage(); p.on('pageerror', e => errs.push(tag + ': ' + e.message)); p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/_vercel/')) errs.push(tag + ' ' + r.status() + ' ' + r.url()); }); await p.goto(BASE + '?test'); await p.waitForTimeout(500); return p; }
const mode = p => p.evaluate(() => __gg.S.mode);
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
  await p.evaluate(() => { __gg.runtime.debug.state().bunkers = []; __gg.S.boostT = 5; __gg.runtime.debug.arm('rapid'); });   // shield up: no walls to hide behind
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
}
console.log(errs.join('\n') || 'no errors'); await b.close();
})();

// Haptics and the leaflet's settings reset on a phone (GAM-5): the set's controls tick, games buzz through api.buzz,
// SOUND off keeps the phone still, and the leaflet resets the set and clears the scores, each after a confirm step.
// Run against `npm run preview`: node tests/haptics.cjs
const { chromium, devices } = require('playwright');
(async () => {
const BASE = process.env.BASE || 'http://localhost:4173/', out = process.env.OUT || '/tmp';
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
// record every buzz instead of vibrating (headless Chromium has nothing to shake)
await ctx.addInitScript(() => {
  window.__buzz = [];
  Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(pat){ window.__buzz.push(pat); return true; } });
});
await p.goto(BASE + '?test'); await p.waitForTimeout(500);
// two taps on the set within 350 ms are a double-tap the page swallows (no zoom), so taps here are spaced out
const tap = async sel => { await p.waitForTimeout(400); await p.tap(sel); };
const buzzes = () => p.evaluate(() => window.__buzz.slice());
const since = async (fn) => { const n = (await buzzes()).length; await fn(); await p.waitForTimeout(60); return (await buzzes()).slice(n); };
const expectBuzz = async (what, fn, want) => {
  const got = await since(fn);
  if (JSON.stringify(got) !== JSON.stringify(want)) errs.push(`${what}: buzzed ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};
const click = sel => p.$eval(sel, e => e.click());   // the leaflet's buttons: a script click, as a tap mid-scroll can land on the set
const pressed = sel => p.evaluate(s => document.querySelector(s).getAttribute('aria-pressed'), sel);

// 1. the set's controls tick
await expectBuzz('POWER', () => tap('#powerBtn'), [8]);
await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 8000 });
await expectBuzz('GLOW rocker', () => tap('#fxBtn'), [8]);
await expectBuzz('GLOW back on', () => tap('#fxBtn'), [8]);
await expectBuzz('phosphor dial detent', () => tap('#dialLabels .dl:nth-of-type(2)'), [8]);
await expectBuzz('RESET', () => tap('#resetBtn'), [8]);
await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 8000 });

// 2. SOUND off: nothing buzzes (the press that switches it off still ticks, like its clack)
await expectBuzz('SOUND off', () => tap('#muteBtn'), [8]);
await expectBuzz('GLOW with SOUND off', () => tap('#fxBtn'), []);
// the stick's nudge on a new direction follows SOUND too
const stick = (dx) => p.evaluate(dx => {
  const z = document.querySelector('#stickzone'), r = z.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (t, cx) => z.dispatchEvent(new PointerEvent(t, { pointerId: 31, pointerType: 'touch', clientX: cx, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
  ev('pointerdown', x); ev('pointermove', x + dx); ev('pointerup', x + dx);
}, dx);
await expectBuzz('stick with SOUND off', () => stick(40), []);
await tap('#fxBtn'); await tap('#muteBtn');
if (await pressed('#muteBtn') !== 'true') errs.push('SOUND did not come back on');
await expectBuzz('stick with SOUND on', () => stick(40), [6]);

// 3. in a game: a shot, a lost life, the game over
const ix = await p.evaluate(() => __gg.DISKS.findIndex(d => d.id === 'invader'));
if (ix < 0) errs.push('no Invader Force disk');
await p.evaluate(i => __gg.loadGame(i), ix);
await p.waitForFunction(() => __gg.S.mode === 'play', null, { timeout: 12000 });
await expectBuzz('FIRE key shoots', async () => { await p.keyboard.down('Space'); await p.waitForTimeout(50); await p.keyboard.up('Space'); }, [14]);
await p.waitForTimeout(400);
await expectBuzz('capsule caught', async () => { await p.evaluate(() => __gg.runtime.debug.drop('twin')); await p.waitForTimeout(900); }, [[22, 45, 22]]);
await p.waitForTimeout(300);
await expectBuzz('life lost', () => p.evaluate(() => { const d = __gg.runtime.debug; d.blast(Math.round(d.state().px) + 4, d.cannonY()); }), [160]);
await p.waitForFunction(() => __gg.S.mode !== 'dying', null, { timeout: 5000 });
await expectBuzz('game over', () => p.evaluate(() => __gg.finishGame()), [[260, 90, 320]]);

// 4. the leaflet: reset the set after a confirm, in Traditional Chinese first
await p.evaluate(() => { localStorage.setItem('gg-best-invader', '4321'); localStorage.setItem('gg-board-invader', JSON.stringify([{ n: 'GUY', s: 4321, l: 2 }])); localStorage.setItem('gg-name', 'GUY'); localStorage.setItem('eb-mode', 'amberP3'); });
await tap('#dialLabels .dl:nth-of-type(4)');   // amber
await tap('#fxBtn'); await tap('#muteBtn');  // GLOW off, SOUND off
await p.evaluate(() => document.querySelector('#langSeg [data-lang="zh-hant"]').click());
await click('#manualBtn'); await p.waitForTimeout(200);
const label = await p.textContent('#setReset');
if (label !== '重設設定') errs.push('reset button in zh-hant reads ' + label);
await click('#setReset');
if (!(await p.$('#setYes'))) errs.push('reset: no confirm step');
await click('#setNo');
if (await p.evaluate(() => localStorage.getItem('eb-mode')) !== 'amberP3') errs.push('cancel still reset the phosphor');
// keyboard: Enter on a focused settings button acts on it, not on the console behind (the disk menu would load a game)
await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press('g');
await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 8000 });
await p.focus('#setReset'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
if (!(await p.$('#setNo'))) errs.push('Enter on Reset settings did not open its confirm');
await p.keyboard.press('Enter'); await p.waitForTimeout(100);   // Cancel has focus
if (await p.$('#setNo')) errs.push('Enter on Cancel did not close the confirm');
if (await p.evaluate(() => __gg.S.mode) !== 'menu') errs.push('Enter on a settings button reached the disk menu: ' + await p.evaluate(() => __gg.S.mode));
await click('#setReset'); await p.locator('#setYes').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${out}/haptics-confirm.png` });
await click('#setYes'); await p.waitForTimeout(300);
const after = await p.evaluate(() => ({ mode: localStorage.getItem('eb-mode'), fx: document.querySelector('#fxBtn').getAttribute('aria-pressed'),
  sound: document.querySelector('#muteBtn').getAttribute('aria-pressed'), hold: document.querySelector('#pauseBtn').getAttribute('aria-pressed'),
  full: document.querySelector('#fullBtn').getAttribute('aria-pressed'), lang: document.documentElement.lang, best: localStorage.getItem('gg-best-invader') }));
const want = { mode: 'greenP1', fx: 'true', sound: 'true', hold: 'false', full: 'false', lang: 'en', best: '4321' };
if (JSON.stringify(after) !== JSON.stringify(want)) errs.push('after reset ' + JSON.stringify(after) + ', wanted ' + JSON.stringify(want));
if (!/Settings reset/.test(await p.textContent('.set-done'))) errs.push('no "Settings reset." note');

// 5. clearing the scores is its own button, with its own confirm
await p.evaluate(() => { __gg.S.mode = 'over'; __gg.S.overT = 0; __gg.S.showBoard = true; __gg.overlay.hidden = true; });   // the high-score table is on the tube
await click('#setScores');
const q = await p.textContent('#setQ'); if (!/can’t be undone/.test(q)) errs.push('scores confirm reads ' + q);
await click('#setYes'); await p.waitForTimeout(200);
const left = await p.evaluate(() => Object.keys(localStorage).filter(k => /^gg-(best|board)-|^gg-name$/.test(k)));
if (left.length) errs.push('scores left after clearing: ' + left.join(', '));
if (await p.evaluate(() => __gg.board.length)) errs.push('the loaded game still shows a table');
if (await p.evaluate(() => __gg.S.mode === 'over' && (__gg.S.showBoard || __gg.overlay.hidden))) errs.push('an empty table was left on the tube after clearing');
if (await p.evaluate(() => localStorage.getItem('eb-mode')) !== 'greenP1') errs.push('clearing scores touched the settings');
await p.screenshot({ path: `${out}/haptics-done.png` });

await b.close();
console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'OK: set controls tick, games buzz, SOUND off is silent, reset and clear scores work');
process.exit(errs.length ? 1 : 0);
})();

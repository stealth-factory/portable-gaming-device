// Astro pages: the leaflet island follows the loaded game and language; game pages boot into their disk; offline works.
const { chromium } = require('playwright');
(async () => {
const BASE = process.env.BASE || 'http://localhost:4173', out = process.env.OUT || '/tmp/shots';
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = async url => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(url + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/_vercel|Failed to load resource/.test(m.text())) errs.push(url + ' console: ' + m.text()); }); await p.goto(BASE + url); return p; };
// 1. the leaflet: console → Dino Run → Traditional Chinese
const p = await page('/?test');
await p.waitForTimeout(500); await p.click('#manualBtn');
const head = () => p.evaluate(() => [document.getElementById('manH').textContent, document.querySelectorAll('#manBody .man-sec').length]);
console.log('leaflet before power:', await head());
await p.click('#powerBtn'); await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
await p.evaluate(() => __gg.loadGame(1)); await p.waitForTimeout(200);
console.log('leaflet with Dino Run:', await head());
await p.click('[data-lang="zh-hant"]'); await p.waitForTimeout(200);
console.log('leaflet in zh-hant:', await head(), await p.evaluate(() => document.querySelector('#manBody h3').textContent));
await p.locator('#manual').screenshot({ path: out + '/astro-manual-dino-zh.png' });
// 2. /dino-run boots straight into Dino Run
const d = await page('/dino-run?test');
console.log('/dino-run title:', await d.title());
await d.click('#powerBtn'); await d.waitForFunction(() => __gg.S.mode === 'load', null, { timeout: 30000 });
console.log('/dino-run after boot:', await d.evaluate(() => [__gg.S.mode, __gg.game.id]));
await d.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 30000 });
await d.keyboard.press('KeyG'); await d.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
console.log('/dino-run after G:', await d.evaluate(() => __gg.S.mode));
// 2b. /bricks boots straight into Bricks
const bricks = await page('/bricks?test');
console.log('/bricks title:', await bricks.title());
await bricks.click('#powerBtn'); await bricks.waitForFunction(() => __gg.S.mode === 'load', null, { timeout: 30000 });
console.log('/bricks after boot:', await bricks.evaluate(() => [__gg.S.mode, __gg.game.id]));
await bricks.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 30000 });
await bricks.keyboard.press('KeyG'); await bricks.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
console.log('/bricks after G:', await bricks.evaluate(() => __gg.S.mode));
// 2c. /martian-storm boots straight into Martian Storm
const storm = await page('/martian-storm?test');
console.log('/martian-storm title:', await storm.title());
await storm.click('#powerBtn'); await storm.waitForFunction(() => __gg.S.mode === 'load', null, { timeout: 30000 });
console.log('/martian-storm after boot:', await storm.evaluate(() => [__gg.S.mode, __gg.game.id]));
await storm.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 30000 });
await storm.keyboard.press('KeyG'); await storm.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
console.log('/martian-storm after G:', await storm.evaluate(() => __gg.S.mode));
// 2d. /reef-run boots straight into Reef Run
const reef = await page('/reef-run?test');
console.log('/reef-run title:', await reef.title());
await reef.click('#powerBtn'); await reef.waitForFunction(() => __gg.S.mode === 'load', null, { timeout: 30000 });
console.log('/reef-run after boot:', await reef.evaluate(() => [__gg.S.mode, __gg.game.id]));
await reef.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 30000 });
await reef.keyboard.press('KeyG'); await reef.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
console.log('/reef-run after G:', await reef.evaluate(() => __gg.S.mode));
// 3. offline: once the service worker has cached everything, game pages still open
const w = await page('/');
await w.evaluate(() => navigator.serviceWorker.ready); await w.waitForTimeout(2500);
await ctx.setOffline(true);
const o = await page('/tunnel-raider?test');
console.log('offline /tunnel-raider:', await o.title());
await o.click('#powerBtn'); await o.waitForFunction(() => __gg.S.mode === 'ready' || __gg.S.mode === 'play', null, { timeout: 40000 });
console.log('offline game running:', await o.evaluate(() => __gg.game.id));
await ctx.setOffline(false);
console.log(errs.join('\n') || 'no errors'); await b.close();
})();

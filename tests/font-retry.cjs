// A rejected, empty or hung font attempt must allow an explicit retry without starting on fallback text.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const BASE = (process.env.BASE || 'http://localhost:4173').replace(/\/$/, '');
  const browser = await chromium.launch();
  try {
    for (const failure of ['rejected', 'empty', 'hung']) {
      const context = await browser.newContext();
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let recovered = false, release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://fonts.gstatic.com/**', route => route.abort());
      await page.route('**/*Silkscreen-Regular*.ttf', async route => {
        if (recovered) return route.continue();
        if (failure === 'rejected') return route.abort();
        if (failure === 'empty') return route.fulfill({ status: 200, contentType: 'font/ttf', body: '' });
        await held;
        // The timed-out request was aborted; a late response must not affect its replacement.
        await route.continue().catch(() => {});
      });
      await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => globalThis.__gg);
      await page.click('#powerBtn');
      await page.waitForFunction(() => !__gg.overlay.hidden && document.getElementById('ovTitle').textContent === 'Display unavailable', null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => __gg.S.mode), 'off');
      assert.equal(await page.getAttribute('#powerBtn', 'aria-checked'), 'false');
      const lang = failure === 'empty' ? 'zh-hant' : failure === 'hung' ? 'zh-hans' : 'en';
      await page.evaluate(lang => { location.hash = lang; }, lang);
      if (lang !== 'en') await page.waitForFunction(label => document.getElementById('ovBtn').textContent.includes(label), lang === 'zh-hant' ? '重試' : '重试');
      recovered = true;
      await page.click('#ovBtn');
      await page.waitForFunction(() => __gg.S.mode === 'boot');
      release();
      const width = await page.evaluate(() => {
        const g = document.createElement('canvas').getContext('2d'); g.font = '8px Silkscreen';
        return g.measureText('WWW').width;
      });
      assert.equal(width, 21, 'retry must install the pinned face before booting');
      await page.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
      assert.deepEqual(errors, []);
      console.log(failure + ' font retry ok');
      await context.close();
    }
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    const request = page.waitForRequest(r => /Silkscreen-Regular[^/]*\.ttf$/.test(r.url()));
    await page.route('**/*Silkscreen-Regular*.ttf', async route => { await held; await route.continue(); });
    await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded' });
    await request;
    await page.click('#powerBtn'); await page.click('#powerBtn');
    const faces = await page.evaluate(() => document.fonts.size);
    release();
    await page.waitForFunction(n => document.fonts.size > n, faces);
    assert.equal(await page.evaluate(() => __gg.S.mode), 'off', 'cancelled POWER must not boot when the late font arrives');
    assert.equal(await page.getAttribute('#powerBtn', 'aria-checked'), 'false');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => __gg.S.mode === 'boot');
    assert.deepEqual(errors, []);
    console.log('cancelled pending font boot ok');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

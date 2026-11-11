// The tube's font is local and ready before a queued POWER starts the full boot.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const BASE = (process.env.BASE || 'http://localhost:4173').replace(/\/$/, '');
  const browser = await chromium.launch();
  let releaseFont;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const fontReleased = new Promise(resolve => { releaseFont = resolve; });
    const fontRequest = page.waitForRequest(request => /Silkscreen-Regular[^/]*\.ttf$/.test(request.url()));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.route('**/*Silkscreen-Regular*.ttf', async route => {
      await fontReleased; await route.continue();
    });
    await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded' });
    await fontRequest;
    await page.click('#powerBtn');
    const pending = await page.evaluate(() => ({ mode: __gg.S.mode, power: document.getElementById('powerBtn').getAttribute('aria-checked'), audio: !!__gg.audioOut }));
    assert.deepEqual(pending, { mode: 'off', power: 'true', audio: true }, 'early POWER must unlock audio without starting the boot clock');
    await page.click('#powerBtn');
    assert.equal(await page.getAttribute('#powerBtn', 'aria-checked'), 'false', 'POWER must cancel a queued boot');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => __gg.S.mode), 'off', 'Enter must queue boot until the font is usable');
    releaseFont();
    await page.waitForFunction(() => globalThis.__gg?.S.mode === 'boot');
    const widths = await page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d');
      context.font = '8px Silkscreen';
      return { font: document.fonts.check('8px Silkscreen'), narrow: context.measureText('III').width, wide: context.measureText('WWW').width };
    });
    assert.equal(widths.font, true);
    assert.equal(widths.narrow, 9);
    assert.equal(widths.wide, 21);
    await page.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 30000 });
    assert.deepEqual(errors, []);
    console.log('font ok: local pinned face, matching advances, queued POWER and full boot without Google Fonts');
  } finally { releaseFont?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

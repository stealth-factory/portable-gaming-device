/* The embed bridge (GAM-64), from a page that frames the console: run against `npm run preview`.
   A host page on another origin (a small server here, on port 5199) frames the console with ?embed and speaks the protocol in
   react/index.d.ts: ready, state and events out; power, load, insert and a lazily sent game in. A disk that throws
   while playing is reported and stopped, and an origin outside the allow list (127.0.0.2) can't insert disks. */
const { chromium } = require('playwright');
const http = require('node:http');
const BASE = process.env.BASE || 'http://localhost:4173/';

const DISK = `var PGDDisk = { disk: { id: 'test-disk', title: 'Test Disk', loadSecs: 1, drawLoad(api, p, t) { api.txt('TEST', api.LW / 2, 40, 'text', 'center'); } } };`;
const GAME = `var PGDGame = { create(api) { let t = 0; return {
  start() { t = 0; },
  update(dt) { t += dt; if (api.S.mode === 'ready' && t > 0.5) api.S.mode = 'play'; if (api.S.mode === 'play') api.S.score = 7; if (window.__boom) throw new Error('boom'); },
  draw() { api.g.fillStyle = api.col('bg'); api.g.fillRect(0, 0, api.LW, api.LH); } }; } };`;

const host = `<!doctype html><body style="margin:0"><iframe id="f" style="width:900px;height:760px;border:0"></iframe><script>
  window.log = [];
  const f = document.getElementById('f'), target = new URL(${JSON.stringify(BASE)}).origin;
  addEventListener('message', e => {
    if (e.source !== f.contentWindow) return;
    const m = e.data; window.log.push(m);
    if (m.type === 'need') f.contentWindow.postMessage({ pgd: 1, type: 'command', command: 'game', request: m.request, game: window.GAME }, target);
  });
  window.send = c => f.contentWindow.postMessage({ pgd: 1, type: 'command', ...c }, target);
  f.src = ${JSON.stringify(BASE)} + '?embed';
</script></body>`;

const fail = [];
const check = (ok, what) => { if (!ok) fail.push(what); };

(async () => {
  const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(host); });
  await new Promise(ok => server.listen(5199, '0.0.0.0', ok));
  const b = await chromium.launch();
  async function framed(origin) {
    const p = await b.newPage();
    p.on('pageerror', e => fail.push(`${origin}: ${e.message}`));
    await p.goto(`${origin}/`);
    await p.evaluate(g => { window.GAME = g; }, GAME);
    await p.waitForFunction(() => window.log.some(m => m.type === 'ready'), null, { timeout: 15000 });
    return p;
  }
  const seen = (p, fn) => p.waitForFunction(fn, null, { timeout: 15000 }).then(() => true, () => false);

  // a trusted host (localhost): everything works
  const p = await framed('http://localhost:5199');
  const ready = await p.evaluate(() => window.log.find(m => m.type === 'ready').ready);
  check(ready.disks.length >= 6 && ready.disks.every(d => d.added === false), 'ready lists the console\'s own disks');
  check(await seen(p, () => window.log.some(m => m.type === 'size' && m.layout === 'desk' && m.height > 300)), 'reports its size on the desk layout');

  await p.evaluate(d => window.send({ command: 'insert', disk: { disk: d }, request: 1 }), DISK);
  check(await seen(p, () => window.log.some(m => m.type === 'reply' && m.request === 1 && m.ok && m.disk.id === 'test-disk' && m.disk.added)), 'insert replies with the disk');
  check(await seen(p, () => window.log.some(m => m.type === 'ready' && m.ready.disks.some(d => d.id === 'test-disk'))), 'the new disk is in the box');

  await p.evaluate(() => window.send({ command: 'load', game: 'test-disk' }));
  check(await seen(p, () => window.log.some(m => m.type === 'need' && m.id === 'test-disk')), 'loading asks the page for the game');
  check(await seen(p, () => window.log.some(m => m.type === 'state' && m.state.game === 'test-disk' && m.state.mode === 'play' && m.state.score === 7)), 'the game plays and its score comes out');
  check(await p.evaluate(() => window.log.some(m => m.type === 'event' && m.name === 'game_start')), 'tracked events come out');

  await p.frames()[1].evaluate(() => { window.__boom = true; });
  check(await seen(p, () => window.log.some(m => m.type === 'event' && m.name === 'disk_error' && /^run: boom/.test(m.data.error))), 'a game that throws is reported');
  check(await seen(p, () => window.log.some(m => m.type === 'state' && m.state.mode === 'menu')), 'and the console goes back to the menu');
  await p.frames()[1].evaluate(() => { window.__boom = false; });

  await p.evaluate(() => window.send({ command: 'phosphor', phosphor: 'amberP3' }));
  check(await seen(p, () => window.log.some(m => m.type === 'state' && m.state.phosphor === 'amberP3')), 'phosphor command');
  await p.evaluate(() => window.send({ command: 'power', on: false }));
  check(await seen(p, () => window.log.some(m => m.type === 'state' && m.state.power === false && m.state.mode === 'off')), 'power command');
  await p.close();

  // an origin not on the allow list may watch and drive, but not insert
  const q = await framed('http://127.0.0.2:5199');
  await q.evaluate(d => window.send({ command: 'insert', disk: { disk: d }, request: 2 }), DISK);
  check(await seen(q, () => window.log.some(m => m.type === 'reply' && m.request === 2 && !m.ok && /may not insert/.test(m.error))), 'other origins may not insert');
  await q.evaluate(() => window.send({ command: 'power', on: true }));
  check(await seen(q, () => window.log.some(m => m.type === 'state' && m.state.power === true)), 'other origins can still drive the set');
  await q.close();

  await b.close(); server.close();
  if (fail.length) { console.log('FAIL:\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('embed ok');
})().catch(e => { console.error(e); process.exit(1); });

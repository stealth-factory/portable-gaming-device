// The on-screen joystick on a phone: it steers, lets go, and never sticks or goes deaf when a finger's release is lost
// (WII-54: a touch at the edge of the pad left the stick held and ignoring new touches).
// Run against `npm run preview`: node tests/stick.cjs
const { chromium, devices } = require('playwright');
(async () => {
const BASE = process.env.BASE || 'http://localhost:4173/';
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ ...devices['iPhone 15 Pro'] }); const p = await ctx.newPage();
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(BASE + '?test'); await p.waitForTimeout(500);
const cdp = await ctx.newCDPSession(p);
const zone = await p.evaluate(() => { const r = document.querySelector('#stickzone').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
const dir = () => p.evaluate(() => document.querySelector('#stickzone .tick.on')?.dataset.d ?? null);   // the lit tick shows the stick's direction
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
const check = async (what, want) => { const got = await dir(); if (got !== want) errs.push(`${what}: stick ${got}, wanted ${want}`); };
const synth = (type, id, x, y) => p.evaluate(([type, id, x, y]) => {
  document.querySelector('#stickzone').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
}, [type, id, x, y]);

// 1. real touches: steer right, lift, centred
await touch('touchStart', [[zone.cx, zone.cy, 1]]);
await touch('touchMove', [[zone.cx + 40, zone.cy, 1]]); await check('drag right', 'right');
await touch('touchEnd', []); await check('lift', null);

// 2. a touch at the very edge of the pad, dragged off the pad and off the screen, then lifted
await touch('touchStart', [[zone.l + 2, zone.b - 20, 2]]);   // inside the rounded corner
await touch('touchMove', [[zone.l - 30, zone.b + 40, 2]]); await touch('touchMove', [[0, zone.b + 120, 2]]);
const offEdge = await dir(); if (!offEdge) errs.push('edge drag: no direction');
await touch('touchEnd', []); await check('lift off the edge', null);

// 3. the finger's release never reaches the page (a system edge gesture took it): the next touch must still steer
await synth('pointerdown', 7, zone.cx, zone.cy); await synth('pointermove', 7, zone.cx, zone.cy + 40); await check('lost finger down', 'down');
await synth('pointerdown', 8, zone.cx, zone.cy); await check('new touch takes over', null);
await synth('pointermove', 8, zone.cx - 40, zone.cy); await check('new touch steers', 'left');
await synth('pointermove', 7, zone.cx, zone.cy + 80); await check('lost finger ignored', 'left');
await synth('pointerup', 8, zone.cx - 40, zone.cy); await check('new touch lifts', null);

// 4. release lands elsewhere on the page (capture lost): still lets go
await synth('pointerdown', 9, zone.cx, zone.cy); await synth('pointermove', 9, zone.cx + 40, zone.cy);
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', bubbles: true })));
await check('release elsewhere', null);

// 5. pointer events dropped but the touch ends: no touch left on the pad lets go
await synth('pointerdown', 10, zone.cx, zone.cy); await synth('pointermove', 10, zone.cx, zone.cy - 40); await check('up held', 'up');
await p.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })));
await check('touchend with nothing left', null);

// 6. the window loses focus mid-drag
await synth('pointerdown', 11, zone.cx, zone.cy); await synth('pointermove', 11, zone.cx + 40, zone.cy);
await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await check('blur', null);

await b.close();
if (errs.length) { console.log('FAIL\n' + errs.join('\n')); process.exit(1); }
console.log('stick ok');
})();

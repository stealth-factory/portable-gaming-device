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

// 7. a mouse or pen on the stick ignores another finger lifting elsewhere
await p.evaluate(([x, y]) => { const z = document.querySelector('#stickzone'); for (const [t, dx] of [['pointerdown', 0], ['pointermove', 40]]) z.dispatchEvent(new PointerEvent(t, { pointerId: 12, pointerType: 'mouse', clientX: x + dx, clientY: y, bubbles: true, cancelable: true })); }, [zone.cx, zone.cy]);
await p.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })));
await check('mouse held through an unrelated touchend', 'right');
await synth('pointerup', 12, zone.cx + 40, zone.cy); await check('mouse up', null);

// 8. the switch across the well's top (GAM-112): STICK or D-PAD; the D-pad is a fixed cross that holds diagonals,
// (stickDir staying one direction is in tests/unit/dpad.test.ts), and the choice is kept across a reload
const arms = () => p.evaluate(() => [...document.querySelectorAll('#stickzone .arm.on')].map(e => e.dataset.d).sort().join('+') || null);
const modeOf = () => p.$eval('#padModeBtn', e => e.dataset.mode);
const tapSwitch = async () => { const r = await p.$eval('#padModeBtn', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await p.touchscreen.tap(r.x, r.y); };
if (await p.$$eval('#padModeBtn [data-m]', e => e.length) !== 2) errs.push('switch: should have two settings');
await tapSwitch(); if (await modeOf() !== 'dpad') errs.push('switch: first press should give D-PAD, got ' + await modeOf());
if (await dir() !== null || await arms() !== null) errs.push('tapping the switch steered');
const cross = await p.evaluate(() => { const r = document.querySelector('#dpad').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
if (!cross.w) errs.push('D-PAD: the cross is not shown');
await touch('touchStart', [[cross.x + 30, cross.y + 4, 20]]); { const a = await arms(); if (a !== 'right') errs.push(`D-PAD right arm: ${a}`); }
await touch('touchMove', [[cross.x + 28, cross.y - 28, 20]]);
{ const a = await arms(); if (a !== 'right+up') errs.push(`D-PAD diagonal: ${a}`); }
await touch('touchEnd', []); { const a = await arms(); if (a !== null) errs.push(`D-PAD lift: ${a}`); }
await p.reload(); await p.waitForTimeout(400);
if (await modeOf() !== 'dpad') errs.push('D-PAD not kept across a reload');
await tapSwitch(); if (await modeOf() !== 'stick') errs.push('switch: second press should give STICK');
// the keyboard: Enter or Space on the focused switch steps it, and never reaches the game as FIRE
await p.focus('#padModeBtn'); await p.keyboard.press('Space');
if (await modeOf() !== 'dpad') errs.push('Space on the focused switch should step it to D-PAD, got ' + await modeOf());
await p.keyboard.press('Enter');
if (await modeOf() !== 'stick') errs.push('Enter on the focused switch should step it back to STICK, got ' + await modeOf());

// 9. a game's preferred control (the disk's `joystick`): the switch moves to it when the game loads, the player's flip
// in that game is kept for that game, and the console's screens keep the player's own setting
const inPlay = () => p.waitForFunction(() => ['ready', 'play'].includes(__gg.S.mode), null, { timeout: 9000 });
const toMenu = async () => { await p.keyboard.press('g'); await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 8000 }); };
const load = async id => { await p.evaluate(id => __gg.loadGame(__gg.DISKS.findIndex(d => d.id === id)), id); await inPlay(); };
await p.click('#powerBtn'); await p.waitForFunction(() => __gg.S.mode === 'menu', null, { timeout: 10000 });
await p.evaluate(() => { __gg.DISKS.find(d => d.id === 'dino').joystick = 'dpad'; });
if (await modeOf() !== 'stick') errs.push('menu: the switch should start on STICK, got ' + await modeOf());
await load('dino'); if (await modeOf() !== 'dpad') errs.push("a game preferring the D-pad should load on D-PAD, got " + await modeOf());
await tapSwitch(); if (await modeOf() !== 'stick') errs.push('flipping in a game: ' + await modeOf());
await toMenu(); if (await modeOf() !== 'stick') errs.push("the menu should keep the console's setting, got " + await modeOf());
await tapSwitch();   // the console's setting: D-PAD
await load('dino'); if (await modeOf() !== 'stick') errs.push("the player's own pick in a game should win over its preference, got " + await modeOf());
// the game ends: name entry and the high scores are the console's screens, so the switch shows (and a flip there sets)
// the console's setting, not the game's
await p.evaluate(() => __gg.finishGame()); await p.waitForFunction(() => ['entry', 'over'].includes(__gg.S.mode), null, { timeout: 8000 });
if (await modeOf() !== 'dpad') errs.push("after a game ends the switch should show the console's setting, got " + await modeOf());
await toMenu(); if (await modeOf() !== 'dpad') errs.push("back on the menu the console's D-PAD should return, got " + await modeOf());
await load('tunnel'); if (await modeOf() !== 'dpad') errs.push("a game with no preference should keep the console's setting, got " + await modeOf());
await p.evaluate(() => dispatchEvent(new CustomEvent('gg:settings', { detail: 'reset' })));
if (await modeOf() !== 'stick') errs.push('Settings reset should put STICK back, got ' + await modeOf());
if (await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gg-dpad')).length)) errs.push('Settings reset left joystick keys behind');
await toMenu(); await load('dino'); if (await modeOf() !== 'dpad') errs.push('after a reset the game should be back on its preference, got ' + await modeOf());
// where the browser refuses storage, a flip still holds for the visit
await toMenu(); await p.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
await tapSwitch(); if (await modeOf() !== 'dpad') errs.push('flip with storage refused: ' + await modeOf());
await load('tunnel'); if (await modeOf() !== 'dpad') errs.push("with storage refused, the console's flip should still carry into a game, got " + await modeOf());

await b.close();
if (errs.length) { console.log('FAIL\n' + errs.join('\n')); process.exit(1); }
console.log('stick ok');
})();

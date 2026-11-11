// Makes the app icons and favicon (public/icons/*.png, public/favicon.svg, public/favicon.ico) from one drawing: the set's CRT with the
// joystick on the tube, the power lamp, a silver PGD nameplate and the red and amber keys.
// Run: node tools/icons/make.cjs   (needs Playwright's Chromium and the Silkscreen font from Google Fonts)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'public/icons');
const FONT = 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@700&display=block';

const DEFS = `<defs>
<linearGradient id="body" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4b4f47"/><stop offset=".25" stop-color="#383b34"/><stop offset="1" stop-color="#22241f"/></linearGradient>
<radialGradient id="tube" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#1c3a1f"/><stop offset=".55" stop-color="#121710"/><stop offset="1" stop-color="#0a0907"/></radialGradient>
<pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="4" fill="#000" opacity=".28"/></pattern>
<radialGradient id="ball" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#f2fff4"/><stop offset=".28" stop-color="#a8ffbb"/><stop offset=".7" stop-color="#4fd86c"/><stop offset="1" stop-color="#1f7a33"/></radialGradient>
<linearGradient id="shaft" x1="0" x2="1"><stop offset="0" stop-color="#3fbf5c"/><stop offset=".4" stop-color="#b9ffc8"/><stop offset="1" stop-color="#2a8a3c"/></linearGradient>
<linearGradient id="base" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8dffa6"/><stop offset=".25" stop-color="#4fd86c"/><stop offset="1" stop-color="#1f7a33"/></linearGradient>
<linearGradient id="plate" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ecE9df"/><stop offset=".48" stop-color="#aeab9f"/><stop offset=".52" stop-color="#c6c2b7"/><stop offset="1" stop-color="#8d897f"/></linearGradient>
<linearGradient id="red" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ef5a4a"/><stop offset=".3" stop-color="#d8352a"/><stop offset="1" stop-color="#b42a21"/></linearGradient>
<linearGradient id="amber" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".3" stop-color="#f0b23c"/><stop offset="1" stop-color="#d99a2a"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

// Everything on the face of the set, in a 512 × 512 box.
const FACE = `
<rect x="70" y="74" width="372" height="300" rx="56" fill="#0d0b08"/>
<rect x="88" y="90" width="336" height="268" rx="42" fill="url(#tube)"/>
<rect x="88" y="90" width="336" height="268" rx="42" fill="url(#scan)"/>
<path d="M118 112 Q256 92 394 112" stroke="#6b6e66" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>
<g filter="url(#glow)">
  <rect x="198" y="292" width="116" height="24" rx="7" fill="url(#base)"/>
  <ellipse cx="256" cy="290" rx="30" ry="8" fill="#2a8a3c"/><ellipse cx="256" cy="288" rx="24" ry="5" fill="#6fe08a"/>
  <rect x="250" y="196" width="12" height="94" rx="4" fill="url(#shaft)"/>
  <circle cx="256" cy="176" r="40" fill="url(#ball)"/>
  <ellipse cx="242" cy="160" rx="11" ry="7" fill="#fff" opacity=".55" transform="rotate(-30 242 160)"/>
</g>
<rect x="88" y="90" width="336" height="268" rx="42" fill="url(#scan)" opacity=".6"/>
<circle cx="112" cy="424" r="22" fill="#1d3a22"/><circle cx="112" cy="424" r="12" fill="#b2ffbd"/>
<g>
  <rect x="152" y="403" width="128" height="44" rx="6" fill="#141410" opacity=".55" transform="translate(0 3)"/>
  <rect x="152" y="403" width="128" height="44" rx="6" fill="url(#plate)"/>
  <rect x="152.5" y="403.5" width="127" height="43" rx="5.5" fill="none" stroke="#fff" stroke-opacity=".6"/>
  <text x="216" y="437" text-anchor="middle" font-family="Silkscreen" font-weight="700" font-size="30" letter-spacing="3" fill="#1f1d19">PGD</text>
</g>
<rect x="298" y="405" width="60" height="38" rx="9" fill="url(#red)"/>
<rect x="370" y="405" width="60" height="38" rx="9" fill="url(#amber)"/>`;

const svg = (body, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${DEFS}${body}
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${FACE}</g></svg>`;

const ROUNDED = `<rect x="16" y="16" width="480" height="480" rx="104" fill="url(#body)"/>
<rect x="16.5" y="16.5" width="479" height="479" rx="103.5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/>
<rect x="20" y="20" width="472" height="472" rx="100" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>`;
const SQUARE = `<rect width="512" height="512" fill="url(#body)"/>`;

const ICONS = [
  { out: 'icon-512.png', size: 512, svg: svg(ROUNDED, 1) },
  { out: 'icon-192.png', size: 192, svg: svg(ROUNDED, 1) },
  { out: 'maskable-512.png', size: 512, svg: svg(SQUARE, 0.74) },   // inside the 80 % safe circle
  { out: 'maskable-192.png', size: 192, svg: svg(SQUARE, 0.74) },
  { out: 'apple-touch-icon.png', size: 180, svg: svg(SQUARE, 0.98) },  // iOS rounds the corners itself
];

// The favicon is too small for a readable plate, so the tube says PGD in the console's own 3 × 5 pixel letters.
const LETTERS = { P: ['111', '101', '111', '100', '100'], G: ['111', '100', '101', '101', '111'], D: ['110', '101', '101', '101', '110'] };
function favicon(){
  let px = '';
  [...'PGD'].forEach((ch, i) => LETTERS[ch].forEach((row, y) => [...row].forEach((b, x) => {
    if (b === '1') px += `<rect x="${6 + i * 7 + x * 2}" y="${7 + y * 2}" width="2" height="2"/>`;
  })));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="c" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a5e55"/><stop offset=".2" stop-color="#3a3d36"/><stop offset="1" stop-color="#22241f"/></linearGradient><radialGradient id="g" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#1f4a24"/><stop offset=".6" stop-color="#12160e"/><stop offset="1" stop-color="#0a0806"/></radialGradient></defs>`
    + `<rect width="30" height="30" x="1" y="1" fill="url(#c)" rx="7"/><rect width="30" height="30" x="1" y="1" fill="none" stroke="#000" stroke-opacity=".45" rx="7"/>`
    + `<rect width="26" height="20" x="3" y="3" fill="#0d0b08" rx="4.5"/><rect width="23" height="17" x="4.5" y="4.5" fill="url(#g)" rx="3.5"/>`
    + `<g fill="#8dffa6">${px}</g>`
    + `<circle cx="6" cy="26.8" r="1.3" fill="#b2ffbd"/><rect width="5" height="3" x="18" y="25.3" fill="#d8352a" rx="1"/><rect width="5" height="3" x="24" y="25.3" fill="#f0b23c" rx="1"/></svg>`;
}

// Packs PNGs into an ICO: a 6-byte header, a 16-byte entry per image, then the PNG data.
function ico(pngs){
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ s, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(x => x.buf)]);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const ic of ICONS) {
    await p.setViewportSize({ width: ic.size, height: ic.size });
    await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${FONT}"><style>html,body{margin:0;background:transparent}svg{display:block;width:${ic.size}px;height:${ic.size}px}</style></head><body>${ic.svg}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, ic.out), omitBackground: true, clip: { x: 0, y: 0, width: ic.size, height: ic.size } });
    console.log(ic.out);
  }
  const fav = favicon();
  fs.writeFileSync(path.join(ROOT, 'public/favicon.svg'), fav);
  await p.setViewportSize({ width: 32, height: 32 });
  await p.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${fav}</body></html>`);
  await p.screenshot({ path: path.join(OUT, 'favicon-32.png'), omitBackground: true });
  // favicon.ico (the page's raster fallback): the same drawing at 16, 32 and 48 px, each stored as a PNG inside the ICO.
  const pngs = [];
  for (const s of [16, 32, 48]){
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${s}px;height:${s}px}</style></head><body>${fav}</body></html>`);
    pngs.push({ s, buf: await p.screenshot({ omitBackground: true }) });
  }
  fs.writeFileSync(path.join(ROOT, 'public/favicon.ico'), ico(pngs));
  console.log('favicon.svg, favicon-32.png, favicon.ico');
  await b.close();
})();

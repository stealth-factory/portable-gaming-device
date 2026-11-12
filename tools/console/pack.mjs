/* Packs the self-hosted console (GAM-69): `npm run build:console` builds the site with PUBLIC_PGD_CONSOLE_BUILD=1 into
   .console-build/, and this keeps what another site needs to serve the console (the console page, its scripts, styles
   and font, and the favicon) in console/. Paths in those files start with a placeholder; bin/pgd-console.mjs swaps it
   for the path the site serves the console at when it copies the folder. console/ is not committed on main: the
   console-release workflow builds it and commits it on a console-vX.Y.Z tag, which is what other apps install. */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const PLACEHOLDER = '/__pgd_base__';
const from = '.console-build', to = 'console';
const KEEP = ['index.html', 'favicon.ico', 'favicon.svg', '_astro'];

if (!existsSync(join(from, 'index.html'))) { console.error(`no ${from}/index.html: run npm run build:console`); process.exit(1); }
const html = readFileSync(join(from, 'index.html'), 'utf8');
if (!html.includes(`${PLACEHOLDER}/_astro/`)) { console.error(`${from} was not built with the console base`); process.exit(1); }

rmSync(to, { recursive: true, force: true });
mkdirSync(to);
for (const f of KEEP) cpSync(join(from, f), join(to, f), { recursive: true });

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let files = 0, bytes = 0;
const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else { files++; bytes += statSync(p).size; } } };
walk(to);
writeFileSync(join(to, 'pgd-console.json'), JSON.stringify({ version: pkg.version, placeholder: PLACEHOLDER, files, bytes }, null, 2) + '\n');
rmSync(from, { recursive: true, force: true });
console.log(`console/: PGD ${pkg.version}, ${files} files, ${(bytes / 1024).toFixed(0)} KB`);

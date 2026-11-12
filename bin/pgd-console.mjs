#!/usr/bin/env node
/* pgd-console (GAM-69): copy the self-hosted PGD console into your site, for <PGDConsole src="/pgd/index.html">.

     npx pgd-console public/pgd              # served at /pgd/ (the default path)
     npx pgd-console public/games/pgd --base /games/pgd/

   The console comes from this package's console/ folder, which installs from a console-vX.Y.Z tag
   (github:stealth-factory/portable-gaming-device#console-vX.Y.Z). Its files name their own paths with a placeholder;
   the copy swaps it for --base, the path your site serves the folder at. Served from your own origin, the console
   takes disks from your app with no PUBLIC_PGD_EMBED_ORIGINS. No dependencies: Node 18 or later. */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER = '/__pgd_base__';
const TEXT = /\.(html|js|mjs|css|json|svg|webmanifest|txt|map)$/i;

/** The path the console is served at, as `/pgd/` (always a leading and a trailing slash). */
export function normaliseBase(base = '/pgd/'){
  let b = String(base).trim();
  if (/^[a-z]+:\/\//i.test(b) || b.startsWith('//')) throw new Error('--base is a path on your site, like /pgd/, not a full address');
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  if (/[\s"'<>`\\]/.test(b)) throw new Error(`--base ${base} has characters a path can't hold`);
  return b;
}

/** Swap the placeholder for the real path in one file's text. */
export function rebase(text, base){
  const b = normaliseBase(base);
  return text.split(`${PLACEHOLDER}/`).join(b).split(PLACEHOLDER).join(b === '/' ? '/' : b.slice(0, -1));
}

/** Copy the console from `source` (this package's console/) to `dest`, rewritten for `base`. Returns what it copied. */
export function copyConsole(dest, { base = '/pgd/', source = join(dirname(fileURLToPath(import.meta.url)), '..', 'console') } = {}){
  const b = normaliseBase(base);
  const meta = join(source, 'pgd-console.json');
  if (!existsSync(meta)) {
    throw new Error(`no built console in ${source}. Install a console tag (github:stealth-factory/portable-gaming-device#console-vX.Y.Z), or build one here with npm run build:console`);
  }
  const { version } = JSON.parse(readFileSync(meta, 'utf8'));
  // the copy replaces the folder, so never wipe one that holds anything but an earlier copy (public/, say)
  if (existsSync(dest) && readdirSync(dest).length && !existsSync(join(dest, 'pgd-console.json'))) {
    throw new Error(`${dest} already holds other files. Name a folder of its own, e.g. public/pgd`);
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
  let files = 0;
  const walk = d => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      files++;
      if (TEXT.test(n)) { const t = readFileSync(p, 'utf8'); if (t.includes(PLACEHOLDER)) writeFileSync(p, rebase(t, b)); }
    }
  };
  walk(dest);
  return { version, base: b, files, dest: resolve(dest) };
}

// run as a command (npx and npm scripts call it through a symlink in node_modules/.bin), not imported
const isMain = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch (_) { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    console.log('usage: pgd-console <folder to copy into> [--base /pgd/]\n  copies the PGD console into your site, to serve at --base (default /pgd/)');
    process.exit(args.length ? 0 : 1);
  }
  const i = args.indexOf('--base');
  const base = i >= 0 ? args[i + 1] : '/pgd/';
  if (i >= 0 && (!base || base.startsWith('--'))) { console.error('pgd-console: --base needs a path, e.g. /pgd/'); process.exit(1); }
  const dest = args.find((a, j) => !a.startsWith('--') && !(i >= 0 && j === i + 1));
  try {
    if (!dest) throw new Error('name the folder to copy into, e.g. public/pgd');
    const r = copyConsole(dest, { base });
    console.log(`PGD ${r.version}: ${r.files} files in ${r.dest}, served at ${r.base}. Use <PGDConsole src="${r.base}index.html" />.`);
  } catch (err) { console.error(`pgd-console: ${err.message}`); process.exit(1); }
}

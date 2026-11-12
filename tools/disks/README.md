# Disk files and the catalogue

The iOS and Android apps don't bundle the games. They load each one as a disk file, and learn which disks exist from a signed catalogue on the PGD site (GAM-34). The web console still bundles its games with Vite; none of this changes it.

```sh
node tools/disks/build.mjs            # dist/disks/v1/: every .pgdisk, index.json and index.json.sig
node tools/disks/verify.mjs           # check that folder the way the apps will
node tools/disks/build.mjs --lock     # after raising a disk's version: record it in versions.json
```

`npm run build` runs the first command after Astro, so the files are published with the site. CI runs the second after the build.

## A disk file: `<id>-<version>.pgdisk`

A disk file is a zip. Its entries are stored uncompressed and carry fixed dates, so the same game always makes the same bytes. It holds these files, in this order:

| File | What it holds |
| --- | --- |
| `manifest.json` | `format` (1), then every data field of the disk: `id`, `version`, `contract`, `rating`, `order`, `slug`, `page`, `title`, `nameKey`, `file`, `size`, `loadSecs`, `steps`, `blurb`, `verb`, `tap`, `controls`, `buttons`, `overKey`, `againKey`, `genre`, `players`, `year`, `manual`, `strings`, and `cover` (from the generated `cover.ts`). Optional fields a disk leaves out are absent. |
| `disk.js` | The disk object, functions included (`drawLoad`, and `drawCover` and `drawPreview` where the disk has them). Run as a plain script, it defines the global `PGDDisk`; the disk is `PGDDisk.disk`. |
| `game.js` | The game. Run as a plain script, it defines the global `PGDGame`; the game's factory is `PGDGame.create(api)`. |
| `preview.json` | The flipbook (`{ w, h, fps, frames }`, from the generated `preview.ts`), where the disk has one. |

Both scripts are plain scripts with no `import` or `export`, so JavaScriptCore and QuickJS load them the same way. Each script carries its own copy of any kit or strings module it uses. A host should run `disk.js` and `game.js` in the same realm, give that realm its own seeded `Math.random`, and remove `Date` and `performance`, as `tools/conformance/run.mjs` does.

## The catalogue

`/disks/v1/index.json` lists every disk, sorted by id:

```json
{ "format": 1, "disks": [ { "id": "bricks", "version": 1, "contract": 1, "rating": "4+",
  "sha256": "…", "bytes": 91789, "url": "/disks/v1/bricks-1.pgdisk", "page": "/bricks" } ] }
```

`page` is the disk's own web page, which is also its universal link. `/disks/v1/index.json.sig` is the base64 Ed25519 signature of `index.json`'s exact bytes. An app checks that signature against the public key built into it, then checks each disk file's size and SHA-256 before using it. `vercel.json` serves disk files as immutable for a year, and the catalogue with `must-revalidate`, so that Vercel's ETag decides whether it has changed.

## Keys

`tools/disks/keys/*.pub` holds the public keys as 32 raw bytes in base64. These are what the apps build in.

- **`development.pub`** is the development key. Its private half is derived from a phrase in `pgdisk.mjs`, so anyone can sign with it: local builds, pull-request previews and the tests. Only development builds of the apps trust it.
- **`release.pub`** is the release key. It doesn't exist yet. The owner creates the pair once, commits the public half here, and keeps the private half as the `PGD_DISK_SIGNING_KEY` secret. Its value is the PKCS #8 PEM, or the 32-byte seed in base64. The secret goes in the Vercel production environment, which builds the live site. Release builds of the apps trust only this key, and `verify.mjs --release` accepts only this key. The private key is never committed, because the repo is public.

Until the release key exists, the live catalogue is signed with the development key.

## Versions

Every disk declares a whole-number `version` in its `disk.ts`. `tools/disks/versions.json` records the version and SHA-256 of each built disk file. `tests/unit/disk-files.test.ts` fails if a disk's file has changed while its version hasn't gone up, or if the record is out of date. To fix it, raise the version, then run `--lock`. `--lock` refuses to record a changed file under an old version.

The built file includes everything bundled into it. A change to the kit, a shared string or the bundler (Rolldown, through Vite) can therefore change several disks at once, and each of them then needs a higher version.

The same test also plays each disk file through the conformance runner and checks that it gives the same command stream as the source (`node tools/conformance/run.mjs <file.pgdisk> …`).

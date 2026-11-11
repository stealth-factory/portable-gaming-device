# Releasing

A release is one decision: **merge the release pull request.** Everything
either side of it is automatic.

PGD uses a *pooled* release, adapted from
[stealth-factory/opscope](https://github.com/stealth-factory/opscope/blob/main/docs/releasing.md):
merges to `main` pile up in one standing release PR, and production moves
only when you merge it. Production is gated with a **Promotion Branch**:
Vercel's production branch is `production`, not `main`.

## What happens, in order

```
merge a PR to main
        │
        ├─► Vercel            preview deployment of main (not production)
        ├─► ci.yml            tests and builds it
        │
        └─► release-pr.yml    works out the next version from the commit
                              subjects, writes the changelog entry, bumps
                              package.json, and force-pushes the `release`
                              branch, opening or updating one standing PR
                              titled `release: vX.Y.Z`

           ... this repeats for every merge. Nothing is tagged and
               production does not move. The PR accumulates until you
               decide.

merge the release PR
        │
        └─► tag-release.yml   sees package.json names a version with no
                              tag, tags the merge commit, publishes a
                              GitHub Release with the changelog entry, and
                              fast-forwards `production` to it
                    │
                    └─► Vercel   deploys `production` to the live site
```

## What decides the version

The commit subjects since the last tag, read by `git-cliff` under the rules
in `cliff.toml`. The repository squash-merges with the PR title as the
commit subject, so in practice **the version is decided by PR titles**.

| Title starts with | Effect |
|---|---|
| `feat:` / `feat(scope):` | minor: `0.1.0` → `0.2.0` |
| `fix:`, `perf:`, `revert:` | patch: `0.1.0` → `0.1.1` |
| any type with `!:` | breaking: the minor while below 1.0.0 |
| `docs:`, `chore:`, `ci:`, `style:`, `test:`, `refactor:`, `build:` | rides along with the next release; starts none by itself |
| `release:` | skipped: the machinery's own commits |

A batch of documentation and chores raises no release PR, because it would
release the same game to players. Those commits are not dropped; they appear
in the changelog of whatever release comes next.

`pr-title.yml` checks every PR title. Use the game or `console` as the
scope where it fits: `fix(dino-run): …`, `feat(console): …`.

## Cutting one

1. Open the pull request titled `release: vX.Y.Z`.
2. Read the changelog entry. If something reads badly, fix it on main (the
   PR title that produced it is history now, so edit `CHANGELOG.md` in a
   `docs:` PR after the release, or accept it). Do not commit to the
   `release` branch: it is force-pushed and will discard it.
3. Check its Vercel preview if you want one last look.
4. Merge it. `tag-release.yml` runs in well under a minute, and Vercel's
   production deployment follows.

If no release PR exists, nothing releasable has landed since the last tag.
`release-pr.yml`'s run log says which commits it counted.

## A hotfix

There is no separate path: merge the `fix:` PR, then merge the release PR it
updates. Two merges, a few minutes.

## Rolling back

Use Vercel's **Instant Rollback** on the production deployment. It is
immediate and leaves git alone. Then land the `fix:` and release again;
the next promotion replaces the rolled-back deployment.

Do not move `production` backwards by hand: `tag-release.yml` only ever
moves it forwards and will refuse to promote over a change the tag lacks.

## Never merge into `production`

Only `tag-release.yml` moves `production`. A pull request merged straight
into it (Vercel's bot opens its PRs against the production branch) leaves
`production` holding a commit `main` does not, and the next promotion
stops. That happened with #86 and held the live site at v0.10.0 through
three releases (GAM-62). `production-guard.yml` fails any PR aimed at
`production`; retarget it to `main`.

If it happens anyway, land the same change on `main` and release.
`tag-release.yml` moves `production` past commits whose changes the tag
already contains (merging `production` into the tag would change nothing),
using `--force-with-lease`, and lists them in its log. That push is a
force push, so a ruleset that blocks force pushes on `production` must list
the release App as a bypass actor (`tag-release.yml` pushes as the App when
`RELEASE_APP_CLIENT_ID` is set); ordinary promotions are fast-forwards and
need no bypass. If the tag lacks
any of their changes, it still refuses and names the commits.

## Things worth knowing

**package.json moves ahead of the tag, deliberately.** The release PR bumps
the version so the tag points at a commit whose version already matches it.

**`release-pr.yml` waits for the tag.** Merging the release PR starts both
workflows on the same push. Until `tag-release.yml` has tagged the new
version, `release-pr.yml` sees an untagged version and does nothing, so it
never counts a release's commits twice. The next merge opens the next
release PR.

**The release PR's author decides whether CI runs on it.** `release-pr.yml`
picks the first token it has:

1. **The release GitHub App** (recommended, as opscope does): a
   `RELEASE_APP_CLIENT_ID` repository *variable* and a
   `RELEASE_APP_PRIVATE_KEY` repository *secret*. The workflow mints a
   one-hour token scoped to this repository, and the PR and its commit are
   the App's bot.
2. **`RELEASE_TOKEN`**: a fine-grained PAT with Contents and Pull requests
   read/write on this repository.
3. **`GITHUB_TOKEN`**: the PR is `github-actions[bot]`, and GitHub does not
   run `ci` or `pr-title` on it (Vercel's preview still builds). This needs
   **Settings → Actions → General → Allow GitHub Actions to create and
   approve pull requests**.

Editing an existing PR does not change its author: after switching tokens,
close the open release PR so the next run opens a new one.

To set up the App: **GitHub → Settings → Developer settings → GitHub Apps →
New GitHub App**. Any name and homepage URL; untick *Webhook → Active*;
repository permissions **Contents: Read and write** and **Pull requests:
Read and write** (Metadata read-only comes with them); *Only on this
account*. Create it, note its **Client ID**, generate a **private key**
(a `.pem` download), then **Install App** on this repository only. In the
repository: **Settings → Secrets and variables → Actions**, add the variable
`RELEASE_APP_CLIENT_ID` (the Client ID) and the secret
`RELEASE_APP_PRIVATE_KEY` (the whole `.pem` file).

**Previews are untouched.** Every branch and PR, `main` included, still gets
a Vercel preview. Only the production domain waits for a release.

**Gate in one place only.** Production is gated by the production branch.
Do not also add an Ignored Build Step or `git.deploymentEnabled` in
`vercel.json`; two gates make "why didn't it deploy?" much harder to answer.

## TestFlight (the iOS app)

The iOS app (`native/ios`, from GAM-37) rides the same release.
`.github/workflows/testflight.yml` uploads it in two stages:

| When | What goes to TestFlight | Version |
|---|---|---|
| a merge to `main` touching `native/`, `src/` or `package.json` | an **internal** build, for the internal group with no review | the version the next release will carry (or the next patch when nothing releasable is waiting) |
| the release PR merges | `tag-release.yml` dispatches the workflow at the new `vX.Y.Z` tag: the same upload, then the build joins the **external** group and is submitted for Beta App Review, with "What to Test" from that version's changelog section | `X.Y.Z` |

The build number is whole minutes since the Unix epoch, so every upload is
higher than the last. Branch builds never reach TestFlight, and nothing is
uploaded until `native/ios` exists: until then (and until the secrets below
are set) a push run passes with a notice saying why.

**Where it runs.** Signing happens only on GitHub-hosted macOS (the
`xcode-27` image; the job refuses anything older than Xcode 27.1, which the
iPhone Duo needs). The self-hosted Macs run the unsigned build and test jobs
and never hold a key or certificate (see the `self-hosted-macos-runner`
skill). Xcode signs automatically with the API key and makes a development
certificate on the throwaway Mac; the job revokes it at the end, pass or
fail. **Actions → Apple certificates** lists, then with *apply* revokes, any
left behind ("Your account has reached the maximum number of certificates").

### Setting it up (owner)

In **Settings → Secrets and variables → Actions**, either on this repository
or at the stealth-factory organisation (where they live today). An
organisation secret or variable reaches this repository only if its access is
*All repositories*, or *Selected repositories* with this one ticked. *Private
repositories* leaves it out, because this repository is public.

| Name | Kind | Value |
|---|---|---|
| `APP_STORE_KEY_ID` | secret | the key's id, from App Store Connect → Users and Access → Integrations → **Team Keys** (role **Admin**, so CI can manage signing and revoke its certificates) |
| `APP_STORE_ISSUER_ID` | secret | the issuer id shown above the keys list |
| `APP_STORE_KEY_P8_BASE64` | secret | `base64 -i AuthKey_<id>.p8` (the file downloads once) |
| `APPLE_TEAM_ID` | variable | the 10-character team id (developer.apple.com → Membership) |
| `PGD_CATALOGUE_URL` | variable, optional | the disk catalogue address baked into the app |
| `TESTFLIGHT_EXTERNAL_GROUP` | variable, optional | the external group's name; default `Public beta` |
| `TESTFLIGHT_LOCALE` | variable, optional | the "What to Test" localisation; default `en-US` |

The bundle id, `co.stealth-factory.portable-gaming-device` (GAM-40), is set
in the workflow itself. The team id is a variable, not a commit, as the iOS
spec asks: CI writes both into `native/ios/Config/Local.xcconfig` (ignored by git) and a
temporary `ExportOptions.plist`. On a Mac, copy `Local.xcconfig.example` to
`Local.xcconfig` and fill it in.

In **App Store Connect**:

- the app record for the bundle id (iOS);
- an **internal** group with *Enable automatic distribution* ticked, so every
  upload from `main` reaches it without an API call;
- an **external** group named `Public beta` (or whatever
  `TESTFLIGHT_EXTERNAL_GROUP` says), and the TestFlight **Test Information**
  (feedback email, beta description, review contact) filled in, or Beta App
  Review refuses the submission.

The app's Info.plist must set `ITSAppUsesNonExemptEncryption` to `false`;
the upload job checks, because otherwise every build waits on an export
compliance answer.

**Re-running a stage:** Actions → TestFlight → Run workflow, at `main` for
an internal build or at a `vX.Y.Z` tag for the external one. A release whose
TestFlight dispatch was missed (a re-run of `tag-release.yml` does not
dispatch again) is shipped the same way, at its tag.

## If something goes wrong

**A tag exists but production did not move.** Read `tag-release.yml`'s log,
fix the cause, and run the workflow again from the Actions tab on `main`. It
skips what is already done (tag, GitHub Release) and finishes the rest.

**The release PR is not updating.** Check `release-pr.yml`'s last run. It
exits quietly when nothing releasable has landed, which looks identical to
being broken; the log says which.

**A version was cut by mistake.** Do not delete the tag or the release; cut
the next one.

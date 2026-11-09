# Releasing

A release is one decision: **merge the release pull request.** Everything
either side of it is automatic.

Game Guy uses a *pooled* release, adapted from
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
fast-forwards it and will refuse to promote over a commit it does not know.

## Things worth knowing

**package.json moves ahead of the tag, deliberately.** The release PR bumps
the version so the tag points at a commit whose version already matches it.

**`release-pr.yml` waits for the tag.** Merging the release PR starts both
workflows on the same push. Until `tag-release.yml` has tagged the new
version, `release-pr.yml` sees an untagged version and does nothing, so it
never counts a release's commits twice. The next merge opens the next
release PR.

**`RELEASE_TOKEN` is optional.** Without it the release PR is opened with
`GITHUB_TOKEN`, as `github-actions[bot]`, and GitHub does not run `ci` or
`pr-title` on it (Vercel's preview still builds). That needs the repository
setting **Settings → Actions → General → Allow GitHub Actions to create and
approve pull requests**. With a `RELEASE_TOKEN` secret (a fine-grained PAT
with Contents and Pull requests read/write on this repository) the PR is an
ordinary one and the checks run. Editing an existing bot PR does not change
its author: close it so the next run opens a new one.

**Previews are untouched.** Every branch and PR, `main` included, still gets
a Vercel preview. Only the production domain waits for a release.

**Gate in one place only.** Production is gated by the production branch.
Do not also add an Ignored Build Step or `git.deploymentEnabled` in
`vercel.json`; two gates make "why didn't it deploy?" much harder to answer.

## If something goes wrong

**A tag exists but production did not move.** Read `tag-release.yml`'s log,
fix the cause, and run the workflow again from the Actions tab on `main`. It
skips what is already done (tag, GitHub Release) and finishes the rest.

**The release PR is not updating.** Check `release-pr.yml`'s last run. It
exits quietly when nothing releasable has landed, which looks identical to
being broken; the log says which.

**A version was cut by mistake.** Do not delete the tag or the release; cut
the next one.

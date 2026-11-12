# Third-party notices

PGD's own code is under the PolyForm Noncommercial License 1.0.0 and its images under CC BY-NC-SA 4.0 (see [`LICENSING.md`](LICENSING.md)). The files below come from other projects. They are **not** covered by those licences: each keeps its upstream licence, reproduced here.

## Agent skills (`.agents/skills/`, linked from `.claude/skills/`)

Installed with `npx skills add`; `skills-lock.json` records each skill's source and hash.

### mattpocock/skills (36 skills)

Source: <https://github.com/mattpocock/skills>. Licence: MIT.

`ask-matt`, `chief-of-staff`, `claude-handoff`, `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `git-guardrails-claude-code`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `implement`, `implement-spec`, `improve-codebase-architecture`, `loop-me`, `migrate-to-shoehorn`, `pr`, `prototype`, `research`, `retro`, `scaffold-exercises`, `setup-matt-pocock-skills`, `setup-pre-commit`, `setup-ts-deep-modules`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `writing-beats`, `writing-for-agents`, `writing-fragments`, `writing-shape`

```text
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### cursor/plugins (58 skills)

Source: <https://github.com/cursor/plugins/tree/main/pstack>. Licence: MIT.

`architect`, `arena`, `automate-me`, `benchmark-checklist`, `blast-radius`, `bro`, `correct`, `create-formal-verification-skill`, `create-verification-skill`, `figure-it-out`, `how`, `in-your-own-words`, `interrogate`, `ketchup`, `ketchup-video`, `maintain-formal-verification-skill`, `maintain-verification-skill`, `make-bot-ui`, `no-comments`, `poteto-help`, `poteto-mode`, `principle-attack-the-premise`, `principle-boundary-discipline`, `principle-build-the-lever`, `principle-encode-lessons-in-structure`, `principle-exhaust-the-design-space`, `principle-experience-first`, `principle-explain-the-number`, `principle-fix-root-causes`, `principle-foundational-thinking`, `principle-guard-the-context-window`, `principle-laziness-protocol`, `principle-make-operations-idempotent`, `principle-migrate-callers-then-delete-legacy-apis`, `principle-minimize-reader-load`, `principle-model-the-domain`, `principle-never-block-on-the-human`, `principle-outcome-oriented-execution`, `principle-prove-it-works`, `principle-redesign-from-first-principles`, `principle-separate-before-serializing-shared-state`, `principle-sequence-verifiable-units`, `principle-subtract-before-you-add`, `principle-test-behavior-not-implementation`, `principle-type-system-discipline`, `recall`, `reflect`, `setup-pstack`, `sharpen`, `show-me-your-work`, `statechart`, `swarm`, `tdd`, `teach`, `technical-writing`, `typescript-best-practices`, `unslop`, `why`

```text
MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### stealth-factory/skills (21 skills)

Source: <https://github.com/stealth-factory/skills>. Licence: MIT.

`agents-md-setup`, `autonomous-pr-driver`, `branch-cleanup`, `claude-code-repo-migration`, `code-complexity-stats-pr`, `conventional-commits`, `dual-agent-review`, `fable-style-reasoning`, `git-trunk-branch-and-pr-automation`, `meaningful-linear-issues`, `multi-agent-codebase-audit`, `nextjs-locale-monorepo`, `nextjs-locale-standalone`, `pooled-release`, `production-release-gating`, `resolve-merge-conflicts`, `safari26-liquid-glass`, `semantic-release-automation`, `skill-publishing`, `vercel-deployment-password-gate`, `vercel-preview-cleanup`

```text
MIT License

Copyright (c) 2026 Stealth Company

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### stealth-factory/private-skills (4 skills)

Source: <https://github.com/stealth-factory/private-skills>. © Stealth Company. The upstream repository has no licence file; these skills are included with Stealth Company's permission and no licence to reuse them is granted here.

`claude-software-factory`, `self-hosted-macos-runner`, `turborepo-vercel-monorepo`, `xcode-vercel-release-tracks`

## Fonts

The page loads Silkscreen bold, Noto Sans TC, Noto Sans SC, IBM Plex Mono, Barlow Condensed and Spectral from Google Fonts at run time; each is under the SIL Open Font License 1.1. Silkscreen regular is served locally from the pinned font below and precached for offline use.

`tools/fonts/Silkscreen-Regular.ttf` is the unmodified Silkscreen regular font from [google/fonts at 7e8d490955e9d2629cd3095e8dadd6fafe3c16b8](https://github.com/google/fonts/tree/7e8d490955e9d2629cd3095e8dadd6fafe3c16b8/ofl/silkscreen). Vite emits this font as a hashed asset for the web console. The generated advances in `src/kit/platform/font-metrics.json` and the bitmaps in `native/core/include/pgd/font_atlas.hpp` (drawn by `tools/fonts/atlas.cjs`) come from the same font. Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen). Both keep the SIL Open Font License 1.1, reproduced in full in [`tools/fonts/OFL.txt`](tools/fonts/OFL.txt).

## npm packages

Dependencies installed by `npm install` (listed in `package.json` and `package-lock.json`) are not stored in this repository and keep their own licences, mostly MIT, Apache-2.0, ISC, BSD and MPL-2.0. Each package's licence ships inside it in `node_modules/`.

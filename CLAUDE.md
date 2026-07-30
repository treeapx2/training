# CLAUDE.md — treeapx2/training

Context for Claude Code sessions on this repo. Read this first.

## What this is

A single-file React 18 PWA workout tracker. Hosted on GitHub Pages at
`https://treeapx2.github.io/training`, installed to the home screen on an iPhone.
Owner logs strength sessions set-by-set (weight / reps / RPE) and syncs them to
this repo as JSON.

| | |
|---|---|
| Live app | `index.html` (repo root, `main`) — ~377 KB, compiled |
| Session data | `sessions.json` (repo root, `main`) — 64 sessions, Feb 28–Jul 29 2026 |
| Branch | `main` only. `master` was deleted; `raw.githubusercontent.com` may still serve stale cached copies of it — do not trust those |
| Build | `npm run build` (Babel 8, classic JSX runtime) — see **Build system**, below |

## HARD CONSTRAINTS — violating these produces a white screen

Learned the hard way in Safari and Firefox. Non-negotiable:

1. **React + ReactDOM UMD embedded inline.** No CDN `<script src=…>`. The
   shipped file currently has **zero** external script tags; keep it that way.
2. **Classic JSX runtime.** Babel config must be
   `["@babel/preset-react", { "runtime": "classic" }]`.
   An automatic-runtime build emits `react/jsx-runtime` imports that die in the browser.
3. **No runtime Babel transformation.** Do not ship `@babel/standalone` and
   transform in-page. Precompile.
4. **Single self-contained file output.** `index.html` must work when opened
   directly with no network and no module resolution.

## Build system

`npm run build` runs `scripts/build.js`, which:

1. Compiles `src/app.jsx` via the **`@babel/core` API directly**
   (`babel.transformFileSync`), using `babel.config.js`
   (`@babel/preset-react`, `runtime: "classic"`). There is no `@babel/cli`
   dependency — it was installed early on, never actually invoked anywhere,
   and was the sole source of every `npm audit` finding at the time, so it
   was removed.
2. Reads the two vendor UMD bundles (`vendor/react.production.min.js`,
   `vendor/react-dom.production.min.js`) verbatim — the exact bytes
   extracted from the previously hand-patched `index.html`, never touched by
   Babel.
3. Wraps everything in the HTML shell (`src/shell.head.html` /
   `src/shell.tail.html`) and writes the single self-contained `index.html`
   at the repo root.

Toolchain is pinned to **Babel 8** (`@babel/core`, `@babel/preset-react`,
`@babel/generator`, `@babel/parser`, `@babel/types`, all `^8.x`).
`preset-react`'s `runtime: "classic"` option works unchanged on Babel 8 — this
was confirmed by rebuilding on 8.x and diffing the result against both the
originally-shipped `index.html` and the prior Babel-7 rebuild (see
`scripts/normalize-for-diff.js`); the normalized diff is empty in both
directions.

### File layout

| Path | Purpose |
|---|---|
| `src/app.jsx` | The real JSX source. Edit this, not `index.html`. |
| `src/shell.head.html` / `src/shell.tail.html` | HTML/CSS shell around the three inline `<script>` blocks. |
| `vendor/react.production.min.js`, `vendor/react-dom.production.min.js` | React 18 UMD builds, embedded inline verbatim (hard constraint #1). |
| `babel.config.js` | `@babel/preset-react` with `runtime: "classic"` (hard constraint #2). |
| `scripts/build.js` | `npm run build` — see above. |
| `scripts/test.js` | `npm test` — the validation bar, below. |
| `smoke.js` | jsdom headless-mount check (validation bar step 4). |
| `scripts/decompile.js` | **Historical/documentation only.** The one-time script that reconstructed `src/app.jsx` from the previously shipped, hand-patched `index.html`. Not runnable against current devDependencies — it needs the Babel 7.x line plus `babel-plugin-transform-react-createelement-to-jsx` (unmaintained, relies on legacy `t.jSXIdentifier`-style `@babel/types` builders that Babel 8 removed), both of which were removed once the decompile was done and committed. See the comment in the file for how to temporarily reinstall them if this is ever needed again. |
| `scripts/normalize-for-diff.js` | Parses a compiled app script and re-emits it through `@babel/generator` with fixed formatting, so two semantically-identical scripts (differing only in quote style, escaping, etc.) diff to nothing. Used to prove the JSX reconstruction and the Babel 7→8 upgrade changed no behavior; reusable for future refactors that touch `src/app.jsx`. |
| `index.html` | **Build output.** Don't hand-edit — regenerate via `npm run build`. Still the file that gets committed and deployed (see Deploy, below); there is no separate `dist/`. |

## Validation bar — every change must pass all four

```bash
# 1. extract the app's inline script and syntax-check it
#    (index.html has 3 inline <script> blocks; the app is the 3rd, index 2)
node --check <extracted-app-script>.js

# 2. zero line-start import statements
grep -c '^\s*import ' index.html      # must be 0

# 3. zero automatic-runtime references
grep -c 'react/jsx-runtime' index.html # must be 0

# 4. headless mount — catches white-screen/runtime errors CI-style
#    jsdom with runScripts:"dangerously", assert #root innerHTML > 50 chars
#    and zero jsdomError events
node smoke.js
```

Scripted as `npm test` (`scripts/test.js`). Do not skip #4 — static checks
pass on code that still white-screens. Both `scripts/test.js` and
`smoke.js` have been negative-tested against deliberately broken builds (an
injected `import` statement; a thrown error before mount) to confirm the
checks actually fail rather than rubber-stamping.

## Current architecture

### Data model

```js
BLOCK = {
  flags: [ "…training constraints, injury flags, protocol notes…" ],
  sessions: {
    legs|push|pull: {
      label, color, bg,
      movements: [ { name, current, workSets, reps, target } ]
    }
  }
}
```

- `workSets` / `reps` are **per-movement prescription overrides** (added Jul 2026).
- `buildPlannedSets(mov, type)` is a **wrapper** that calls
  `buildPlannedSetsBase()` (the original ramp logic) then trims/pads working sets
  to `mov.workSets` and overrides working-set reps with `mov.reps`.
  Edit the wrapper, not the base, for prescription changes.

### Session records

```js
{ id, type: "legs"|"push"|"pull", label, date: "Mon D, YYYY", note,
  movements: [ { name, sets: [ { set, weight, reps, rpe, note } ] } ] }
```

`date` is a **display-formatted string**, not ISO. Parsing uses `new Date(str)`.
Do not silently migrate this format — the whole history and the dedup key depend on it.

### Dedup rule — IMPORTANT

**`type + "|" + date` is the primary key. `id` is a fallback only for records
missing type or date.**

Legacy data contained two genuinely different sessions sharing `id: 39`, and an
earlier id-based dedup silently dropped one of them. Never reintroduce
id-as-primary-key. Same reason `del()` matches on `id + type + date` and stops
after the first hit.

Live records use 13-digit `Date.now()` ids; seed records use small ints. They
coexist; the `type+date` key collapses duplicates across both.

### Movement ordering

Sessions are a **flat, per-movement list** — the old muscle-group blocking was
removed. Each movement carries a `_group` label chip (derived from
`MUSCLE_GROUPS` via the `MOVEMENT_GROUP` map / `groupLabelFor()`), plus a
displayed order index and ▲/▼ reorder controls. The actual training order is
recorded, because **queue position materially affects output** — this is a
deliberate product decision, not incidental.

Note: `MUSCLE_GROUPS`, `ORDER_KEY` (`at_group_order_v2`) and
`buildOrderedMovements` are **partially vestigial** — `MUSCLE_GROUPS` is still
the source for group labels, the rest is dead weight from the blocked design.
Clean up carefully.

### Sync layer

- Config in `localStorage` under `at_sync_cfg_v1`:
  `{ token, repo, path, branch, auto }`
- **Read:** `syncPull()` → `raw.githubusercontent.com/{repo}/{branch}/{path}?t={Date.now()}`,
  `cache: "no-store"`. 404 is treated as "no remote file yet", not an error.
- **Write:** `syncPush()` → GitHub contents API `PUT`, GETs the blob `sha` first,
  includes it for updates.
- Auto-push fires on **session finish only** (not on delete). Result cached to
  `at_sync_last`.
- `mergeSessions(a, b)` is **additive only** — it never deletes.

**Live config values differ from the code defaults:** `SYNC_DEFAULTS.path` is
`data/sessions.json`, but the actual deployed file is **`sessions.json` at the
repo root** and the device is configured to match. Reconcile the default to
reality.

### localStorage keys

| Key | Purpose |
|---|---|
| `at_workout_stable` | session history (source of truth on device) |
| `at_session_draft` | in-progress session autosave |
| `at_sync_cfg_v1` | sync config incl. PAT |
| `at_sync_last` | last auto-push result |
| `at_group_order_v2` | **retired** — vestigial group ordering |

### Secrets

The GitHub PAT lives **only** in `localStorage` on the phone, entered via the UI.
It is **never committed** — GitHub secret-scans public repos and auto-revokes
PATs found in code. Never write the token into a source file, a config file, or
a test fixture. Fine-grained, `Contents: read+write`, this repo only.

## Known issues / queued work

Priority order.

**Done:** the original items 1–2 here (reconstruct a real JSX source; add a
build step) are complete — see **Build system**, above. `src/app.jsx` is the
real source, verified AST-equivalent and jsdom-render-equivalent to the
previously shipped `index.html`. Never hand-patch `index.html` again; edit
`src/app.jsx` and run `npm run build`.

1. **Session data is duplicated.** `SEED_SESSIONS` embeds **62 records inside
   `index.html`** (now `src/app.jsx`) while `sessions.json` holds 64. The
   embedded copy has drifted twice already and required manual surgery both
   times. Make `sessions.json` the single source of truth and remove the
   embedded seed (or generate it at build time).
2. **`syncPush` has no 409 retry.** A stale `sha` returns HTTP 409 and the push
   just fails. Reproduces reliably when auto-push (on finish) races a manual
   "push now". Refetch the sha and retry once.
3. **No "replace local from remote".** `mergeSessions` is additive, so a local
   delete is unrecoverable from the repo — a deleted session cannot be restored
   by pulling. This caused real data loss requiring manual JSON repair. Add a
   destructive-but-confirmed "remote wins" action.
4. **Legs A/B not modeled.** Only `legs|push|pull` exist. Programming now uses
   two distinct leg days (A = heavy 8–10 quad emphasis, B = higher-rep 12–15
   posterior). Add a fourth session type.
5. **No cardio/finisher fields.** Stairmaster finishers (duration, level,
   perceived effort) are currently typed into the freeform session note. Add
   first-class fields.
6. **Sync panel is collapsed by default** and easy to miss entirely. Default it
   to expanded until a token is configured.
7. **Cache/staleness footgun.** No service worker; the PWA relies on plain HTTP
   caching, so a pushed fix can take a refresh or two to reach the device. A
   stale build once executed an already-fixed delete bug and destroyed a
   session. Consider a version stamp visible in the UI so the running build is
   identifiable.
8. **No Claude Code session hygiene configured.** No project
   `.claude/settings.json` permission allowlist, no habit of
   checkpoint-committing before a session starts, no end-of-session `git diff`
   review. Adopt: (a) a project `.claude/settings.json` that scopes tool
   permissions instead of relying on ad hoc prompts; (b) commit or stash any
   dirty working tree before starting a new Claude Code session, so
   in-progress work is never ambiguous when a session begins; (c) review
   `git diff`/`git status` at the end of every session before deciding what to
   commit, rather than committing mid-session on trust.

## Deploy

GitHub Pages serves `main`. Commit `index.html` to the repo root and push;
allow a few minutes for CDN propagation, then hard-refresh Safari at the live
URL before relaunching the installed PWA.

## Scope boundary

This repo is the **app**. Training programming, progression decisions, session
analysis and injury-flag management happen in a separate Claude project — the
`BLOCK` object's `current` / `target` / `flags` strings are authored there and
land here as data edits. Don't invent training prescriptions; treat those
strings as content handed in.

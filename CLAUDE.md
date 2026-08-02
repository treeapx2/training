# CLAUDE.md — treeapx2/training

Context for Claude Code sessions on this repo. Read this first.

## What this is

A single-file React 18 PWA workout tracker. Hosted on GitHub Pages at
`https://treeapx2.github.io/training`, installed to the home screen on an iPhone.
Owner logs strength sessions set-by-set (weight / reps / RPE) and syncs them to
this repo as JSON.

| | |
|---|---|
| Live app | `index.html` (repo root, `main`) — ~248 KB, compiled |
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
4. String-replaces the `BUILD_INFO` placeholders (`__BUILD_SHA__` /
   `__BUILD_TIME__`) in the compiled output with the actual short git sha
   and an ISO build timestamp — see **Version stamp**, below.

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
| `scripts/test-sync-last.js` | `npm run test:sync-last` — standalone jsdom behavioral check for the `at_sync_last` "Last synced" tracking (see **Sync layer**). Not part of the validation bar. |
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
  variant: "A"|"B"|undefined,           // legs only, see Legs A/B variants
  cardio: { machine, duration, level, effort }|undefined,  // see Cardio finisher fields
  movements: [ { name, sets: [ { set, weight, reps, rpe, note } ] } ] }
```

`date` is a **display-formatted string**, not ISO. Parsing uses `new Date(str)`.
Do not silently migrate this format — the whole history and the dedup key depend on it.

`label` already has the variant baked in for legs sessions (`"Legs A"` /
`"Legs B"`) so history/handoff/PR displays need no extra branching — `variant`
is there for anyone who needs to filter/query by it specifically.

### Dedup rule — IMPORTANT

**`type + "|" + date` is the primary key. `id` is a fallback only for records
missing type or date.**

Legacy data contained two genuinely different sessions sharing `id: 39`, and an
earlier id-based dedup silently dropped one of them. Never reintroduce
id-as-primary-key. Same reason `del()` matches on `id + type + date` and stops
after the first hit.

Live records use 13-digit `Date.now()` ids; seed records use small ints. They
coexist; the `type+date` key collapses duplicates across both.

**Legs A/B caveat:** `type` stays `"legs"` for both variants (see below), so
the dedup key does **not** distinguish A from B. Logging a Legs A and a Legs B
session on the *same calendar date* would collide on `"legs|<date>"` and one
would be dropped by `mergeSessions`/`del()`. `BLOCK.flags` already prescribes
keeping A and B ≥48h apart, so this shouldn't occur in normal use — it's a
known, accepted edge case, not something to "fix" by keying on variant too
(that would fragment the `type+date` contract this whole dedup rule exists to
protect).

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

### Legs A/B variants

`LEGS_VARIANTS` (near `BLOCK` in `src/app.jsx`) is a per-movement
`{ workSets, reps }` prescription overlay for the two Legs variants, plus
`rest`/`finisher` guidance text — **not** a separate session type and **not**
part of `BLOCK` itself. Session `type` stays `"legs"`; only today's working
set count/rep target differ. This is deliberate: `LEGS_VARIANTS`' movement
keys ("Leg Press", "Leg Curl", ...) match `BLOCK.sessions.legs.movements`
names exactly, so progression history (`getMovementHistory`/`getMovementPR`,
both keyed by movement name across all history regardless of type or variant)
and `current` weights are fully shared between A and B by construction — there
is no separate "A history" vs "B history" to keep in sync.

The variant is threaded through `startSession(type, variant)` →
`sessionMovements` (workSets/reps overridden at session-start time, never on
the shared `BLOCK.sessions.legs.movements` objects themselves) → the draft
autosave/resume round-trip (`saveDraft`/`loadDraft` carry a `variant` field
so a resumed draft reapplies the same overlay) → `finish()`, which records
`entry.variant` and bakes it into `entry.label`.

Numbers in `LEGS_VARIANTS` came directly from TARGETS.md's "Legs A/B note for
whoever implements the toggle" table — treat them as authored prescription
content (like `BLOCK.flags`/`current`/`target`), not code to redesign.

### Cardio finisher fields

`cardio: { machine, duration, level, effort }` on a session record, entered
via SessionScreen's "Cardio finisher" section (below the movement list, above
the session note). `effort` is a closed `easy|moderate|hard` enum
(`CARDIO_EFFORT_OPTIONS`); `machine`/`duration`/`level` are free text/number
so any machine from `BLOCK.flags` (Stairmaster, Z2 bike, elliptical, incline
walk, rower) fits without a fixed dropdown.

`hasCardioData(cardio)` gates every read/write site — a session with no
cardio fields filled in gets no `cardio` key at all, not an empty-string
object. `formatCardio(cardio)` is the single formatter shared by
`HistoryScreen`, `buildHandoff`, and `buildCoachSummary`; add new display
sites through it rather than reformatting inline. Persists through the same
draft autosave/resume path as the Legs A/B variant.

### Sync layer

- Config in `localStorage` under `at_sync_cfg_v1`:
  `{ token, repo, path, branch, auto }`. `SYNC_DEFAULTS.path` is
  `"sessions.json"` (repo root) and `branch` is `"main"` — these now match
  the actual deployed location; they used to default to the wrong
  `"data/sessions.json"`, silently relying on every device having a manually
  corrected local config.
- **Read:** `syncPull()` → `raw.githubusercontent.com/{repo}/{branch}/{path}?t={Date.now()}`,
  `cache: "no-store"`. 404 is treated as "no remote file yet", not an error.
  `sessions.json` is the **single source of truth for history** — there is no
  embedded seed data in `src/app.jsx` anymore; on first load with empty
  `localStorage` and a remote configured, the app holds the loading state
  until this pull resolves (success or failure) instead of flashing an empty
  history.
- **Write:** `syncPush()` → GitHub contents API `PUT`, GETs the blob `sha`
  first, includes it for updates. On HTTP 409 (stale `sha` — auto-push racing
  a manual "push now", or vice versa) it refetches the `sha` and retries
  **exactly once** before giving up.
- Auto-push fires on **session finish only** (not on delete). A failure
  surfaces as a warning banner on the post-finish "Session saved" screen
  (`SessionScreen`'s `autoPushStatus` state).
- `mergeSessions(a, b)` is **additive only** — it never deletes. To recover
  from a local delete that a plain pull can't undo, `SyncPanel` has
  "replace local from remote" — destructive, confirmed via `window.confirm`,
  overwrites `localStorage` with `sessions.json` as pulled.
- `SyncPanel` now lives on the **Session tab**, below the recent-sessions
  list (not Progress), and is expanded by default until a token is
  configured (`useState(() => !loadSyncCfg().token)`), collapsed by default
  once one exists.
- **Last-sync display:** `at_sync_last` (`{ at, direction, ok, err }`,
  `recordSyncOutcome(direction, ok, err, stamp)`) drives a "Last synced: `<date>`,
  `<time>` (`<direction>`)" line above `SyncPanel` on the Session tab —
  `formatSyncLast()` falls back to "Never synced" when `at` is unset, and
  appends "· last attempt failed" whenever the most recent attempt's `ok` is
  `false`, so a broken sync is visible without opening the panel.
  `at`/`direction` only advance (`stamp: true`) on a successful manual
  pull+merge, manual push, auto-push-after-finish, replace-from-remote, or a
  **mount-time pull that actually merges ≥1 new session** — a mount-time
  pull that succeeds with nothing new to merge, or any failed attempt of any
  kind, updates `ok`/`err` (so a failure is still visible) but leaves
  `at`/`direction` untouched. Opening the app is not the same as syncing
  something; the display must not imply otherwise. Every call site (mount
  effect in `App`, `SyncPanel`'s `doPush`/`doPull`/`doReplaceFromRemote`,
  `finish()`'s auto-push) goes through the same `recordSyncOutcome()` so this
  rule can't drift between call sites. Verified in
  `scripts/test-sync-last.js` (`npm run test:sync-last`, standalone — not
  part of the `npm test` validation bar, since that suite validates the
  build artifact, not app behavior).

### localStorage keys

| Key | Purpose |
|---|---|
| `at_workout_stable` | device-local history cache, merged with `sessions.json` on load — see Sync layer |
| `at_session_draft` | in-progress session autosave, incl. `variant`/`cardio` |
| `at_sync_cfg_v1` | sync config incl. PAT |
| `at_sync_last` | last-sync tracking — see **Sync layer** ("Last-sync display") |
| `at_group_order_v2` | **retired** — vestigial group ordering |

### Secrets

The GitHub PAT lives **only** in `localStorage` on the phone, entered via the UI.
It is **never committed** — GitHub secret-scans public repos and auto-revokes
PATs found in code. Never write the token into a source file, a config file, or
a test fixture. Fine-grained, `Contents: read+write`, this repo only.

### Version stamp

`BUILD_INFO` (top of `src/app.jsx`) holds `{ sha: "__BUILD_SHA__", builtAt:
"__BUILD_TIME__" }` placeholders. `scripts/build.js` string-replaces them
with the real short git sha (`git rev-parse --short HEAD`) and an ISO
timestamp *after* Babel compiles, so `src/app.jsx` itself stays valid,
buildable source with sane literal defaults. Rendered via `formatBuildStamp()`
as a small "build `<sha>` · `<date>`" line at the bottom of every tab.

Because `npm run build` runs **before** the commit that ships its output, the
embedded sha is HEAD's parent at commit time, not a literal self-reference —
treat it as "which commit this build's source came from," and lean on the
timestamp as the more precise staleness signal. This exists specifically
because there's no service worker — the PWA relies on plain HTTP caching, so
a pushed fix can take a refresh or two to reach the device, and a stale cached
build once executed an already-fixed delete bug and destroyed a session. The
version stamp makes a stale build identifiable instead of silently re-running
already-fixed code.

## Claude Code session hygiene

`.claude/settings.json` (committed) scopes tool permissions into three tiers
so permission prompts actually mean something instead of ~60-per-session
rubber-stamping:

- **deny** — `git push`, `sudo`, `rm -rf`: irreversible or reaches outside the machine.
- **ask** — edits/writes to `index.html` or `sessions.json`, `git commit`: the
  live app and the training data, worth a real look every time.
- **allow** — `npm`/`npx`/`node`, routine read/list/grep/diff commands, and
  writes/edits under `src/`, `scripts/`, `vendor/`, `build_tmp/`: build noise.

First match wins, deny beats ask beats allow. `.claude/settings.local.json`
(gitignored, auto-managed by the CLI) accumulates additional per-session
allowances on top of this — don't hand-edit it or treat it as the source of
truth for what *should* be allowed.

Two habits this config assumes but can't enforce on its own:

1. **Checkpoint-commit before starting a session** (`git add -A && git commit
   -m "checkpoint"`) so a session always starts from a clean, known tree —
   this is the actual safety net, not the permission config.
2. **Review `git diff`/`git status` at the end of a session**, not
   command-by-command — one diff is realistic to actually read; 60 shell
   commands flying past isn't.

Caveat: `Bash(node:*)` is allowed, and a Node process can write anywhere on
disk — the `Edit`/`Write` path-scoped rules above don't bind shell commands.
There's no config-only fix for that without going back to prompt fatigue,
which is exactly why the checkpoint commit matters more than the permission
list does.

## Known issues / queued work

Nothing queued right now. Everything tracked in the previous revision of this
list is complete — kept here as a changelog for anyone picking this back up,
with pointers to where each is actually documented:

1. **Real JSX source + build step.** `src/app.jsx` reconstructed from the
   previously hand-patched `index.html`, `npm run build`/`npm test` added.
   See **Build system**, above.
2. **Single source of truth.** `SEED_SESSIONS` removed; `sessions.json` (via
   `syncPull`, merged with `localStorage`) is now the only source of history.
   `SYNC_DEFAULTS.path`/`branch` fixed to match the real deployed location.
   See **Sync layer**, above.
3. **Sync robustness.** `syncPush` 409 retry, auto-push failures surfaced in
   the UI, "replace local from remote" destructive recovery action. See
   **Sync layer**, above.
4. **Sync panel moved** to the Session tab below the recent-sessions list,
   expanded by default until a token is configured. See **Sync layer**, above.
5. **Legs A/B** implemented as a prescription overlay (`LEGS_VARIANTS`), not a
   new session type. See **Legs A/B variants**, above.
6. **Cardio finisher fields** added as first-class session fields. See
   **Cardio finisher fields**, above.
7. **Version stamp** visible in the UI so a stale cached build is
   identifiable. See **Version stamp**, above.
8. **Claude Code session hygiene** — `.claude/settings.json` permission
   tiers, checkpoint-commit-before-session and end-of-session-diff-review
   habits. See **Claude Code session hygiene**, above.
9. **Last-sync timestamp accuracy.** The "Last synced" display used to
   advance on every mount-time pull regardless of outcome, so a silently
   broken sync (or one that just found nothing new) looked identical to a
   healthy one. `recordSyncOutcome()` now separates "did the most recent
   attempt succeed" (`ok`/`err`, updated on every attempt) from "when did a
   sync last actually accomplish something" (`at`/`direction`, only advanced
   on a stamp-worthy success). See **Sync layer** → "Last-sync display",
   above.

Add new items here as they come up.

## Deploy

GitHub Pages serves `main`. Commit `index.html` to the repo root and push;
allow a few minutes for CDN propagation, then hard-refresh Safari at the live
URL before relaunching the installed PWA.

**iOS storage isolation — IMPORTANT:** the installed PWA (home-screen icon)
and Safari maintain **separate `localStorage` containers**, even for the same
URL. Safari is used in the deploy flow purely to force a cache refresh so the
installed PWA picks up the new build — it is not a window into the PWA's
state. Never verify session history, sync config, or the stored token by
checking Safari; `localStorage` reads there tell you nothing about what the
installed PWA has. All state verification (history, sync config, token)
must be done inside the installed PWA itself.

## Scope boundary

This repo is the **app**. Training programming, progression decisions, session
analysis and injury-flag management happen in a separate Claude project — the
`BLOCK` object's `current` / `target` / `flags` strings are authored there and
land here as data edits. Don't invent training prescriptions; treat those
strings as content handed in.

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
| Session data | `sessions.json` (repo root, `main`) — 65 sessions, Feb 28–Jul 30 2026 |
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
| `githooks/pre-commit` | Runs `npm run build` and stages `index.html` if it changed; activated via `git config core.hooksPath githooks` (validation bar check #5). |
| `scripts/test-sync-last.js` | jsdom behavioral check for the `at_sync_last` "Last synced" tracking (see **Sync layer**). Validation bar check #6; also runnable alone via `npm run test:sync-last`. |
| `scripts/test-session-variants.js` | jsdom behavioral check for the Legs A/B prescription overlay (see **Session variants**). Validation bar check #7; also runnable alone via `npm run test:session-variants`. |
| `scripts/decompile.js` | **Historical/documentation only.** The one-time script that reconstructed `src/app.jsx` from the previously shipped, hand-patched `index.html`. Not runnable against current devDependencies — it needs the Babel 7.x line plus `babel-plugin-transform-react-createelement-to-jsx` (unmaintained, relies on legacy `t.jSXIdentifier`-style `@babel/types` builders that Babel 8 removed), both of which were removed once the decompile was done and committed. See the comment in the file for how to temporarily reinstall them if this is ever needed again. |
| `scripts/normalize-for-diff.js` | Parses a compiled app script and re-emits it through `@babel/generator` with fixed formatting, so two semantically-identical scripts (differing only in quote style, escaping, etc.) diff to nothing. Used to prove the JSX reconstruction and the Babel 7→8 upgrade changed no behavior; reusable for future refactors that touch `src/app.jsx`. |
| `index.html` | **Build output.** Don't hand-edit — regenerate via `npm run build`. Still the file that gets committed and deployed (see Deploy, below); there is no separate `dist/`. |

## Validation bar — every change must pass all seven

Two tiers, both scripted as `npm test` (`scripts/test.js`) — **one command
runs everything**, checks 1-7:

**Artifact tier (1-5):** is `index.html` a well-formed, non-stale build of
`src/app.jsx`.

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

# 5. staleness — rebuild src/app.jsx to a temp path and diff against the
#    committed index.html (BUILD_INFO's sha/builtAt normalized out first,
#    since those legitimately differ on every rebuild — see Version stamp).
#    Fails with a message to run `npm run build` if they diverge.
node scripts/build.js build_tmp/index.rebuilt.html
# diff (normalized) against index.html
```

Do not skip #4 — static checks pass on code that still white-screens.
`scripts/test.js`, `smoke.js`, and check #5 have all been negative-tested
against deliberately broken builds (an injected `import` statement; a
thrown error before mount; a hand-edited stale `index.html`) to confirm the
checks actually fail rather than rubber-stamping.

Check #5 exists because a prior cycle committed six phases of source
changes without ever rebuilding, so `index.html` silently didn't move even
though `npm test` kept passing — the suite only validates whatever
`index.html` currently contains, so a stale artifact passes checks 1-4
perfectly well. A committed git pre-commit hook backs this up:
`githooks/pre-commit` runs `npm run build` and stages `index.html` if it
changed, activated via `git config core.hooksPath githooks` (wired
automatically by the `prepare` npm script, so `npm install` sets it up on a
fresh clone). Together they mean source and artifact can't diverge in a
commit made through normal `git commit`, and check #5 catches it in `npm
test` regardless.

**Behavior tier (6-7):** does the app actually do the right thing at
runtime, not just have valid syntax. Each check is a standalone jsdom
script (also runnable alone, e.g. `npm run test:sync-last`,
`npm run test:session-variants`) that `scripts/test.js` invokes as a
subprocess:

- **#6** `scripts/test-sync-last.js` — `at_sync_last` timestamp tracking,
  see **Sync layer** → "Last-sync display".
- **#7** `scripts/test-session-variants.js` — Legs A/B prescription
  overlay, see **Session variants**.

Negative-tested the same way as the artifact tier: deliberately
reintroducing the Leg Press `workSets` bug (see **Session variants** →
"`workSets` gotcha") makes check #7 fail with the specific assertion detail
("expected Leg Press (A) to have 5 planned sets, got 6") surfaced directly
in `npm test`'s output — `execFileSync`'s thrown error already includes the
subprocess's stdout/stderr, so no extra plumbing was needed for failures to
be diagnosable from `npm test` alone.

**New test scripts MUST be registered here, in `scripts/test.js`, as a new
numbered check — not left as a standalone-only `npm run test:*` script.**
This has already happened twice (`test-sync-last.js`, then
`test-session-variants.js`, both landed standalone before being wired in
after the fact) — a behavior test nobody runs by default might as well not
exist. `npm test` is the one command that's expected to run everything;
anything that isn't reachable from it doesn't count as covered.

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
  variant: string|undefined,   // only set when the type has >1 variant — see Session variants
  cardio: { machine, duration, level, rpe }|undefined,  // see Cardio finisher fields; older records may carry a retired `effort` string instead of `rpe`
  movements: [ { name, sets: [ { set, weight, reps, rpe, note } ], note, order } ] }
```

`date` is a **display-formatted string**, not ISO. Parsing uses `new Date(str)`.
Do not silently migrate this format — the whole history and the dedup key depend on it.

`label` already has the variant baked in when a type has more than one
variant (`"Legs A"` / `"Legs B"`) so history/handoff/PR displays need no
extra branching — `variant` is there for anyone who needs to filter/query
by it specifically. Push/Pull currently have a single variant each, so
their records never carry a `variant` or a label suffix.

Per-set `note` is legacy (older records only, no longer written by the
entry UI); the movement-level `note` and `order` are current — see
**Exercise notes** and **Movement ordering**, below.

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

### Session variants

`SESSION_VARIANTS[type]` (near `BLOCK` in `src/app.jsx`) is an array of
per-movement prescription overlays, one per session type — `{ id, label,
rest, movements: { <name>: { workSets, reps, weight? } } }` — **not** part
of `BLOCK` itself. Session `type` stays `"legs"`/`"push"`/`"pull"` regardless
of variant; only today's working-set count/rep target/rest text/ramp weight
differ. Legs carries two variants (`A`/`B`); Push and Pull each carry a
single `"standard"` variant. A variant's movement keys ("Leg Press", "Leg
Curl", ...) match `BLOCK.sessions[type].movements` names exactly, so
progression history (`getMovementHistory`/`getMovementPR`, both keyed by
movement name across all history regardless of type or variant) and
`current` weights are fully shared across variants of the same type by
construction — there is no separate "A history" vs "B history" to keep in
sync.

**`weight` is a ramp anchor, not a `current` override:** `buildPlannedSetsBase`
computes today's ramp off `mov.weight || mov.current` — `weight` is optional
per movement-per-variant (only set where the prescription genuinely differs,
e.g. Legs B's Leg Press/Leg Curl/Goblet Squat), and when present it does
**not** touch `mov.current` itself. `mov.current` — the shared progression
baseline shown in the collapsed movement row and used for PR tracking —
never changes based on variant, exactly as documented above. This
distinction matters: merging a `current` override into the movement object
(instead of a separate `weight` field) would have "split history by
variant," which is explicitly the thing not to do.

**Switcher visibility:** `SessionScreen` only renders the in-session A/B
switcher when `SESSION_VARIANTS[type].length > 1` — today that's legs only.
Adding a real second Push or Pull variant is a data-only addition to
`SESSION_VARIANTS`, not a structural change. The same gate controls whether
`entry.label`/`entry.variant` get a variant suffix at all (see **Session
records**, below) — Push/Pull's single "standard" variant is invisible to
the user and never shows up in a record.

**Selecting/switching:** `startSession(type)` picks `SESSION_VARIANTS[type][0]`
by default (no A/B choice at the type-selection screen anymore — one button
per type). Mid-session, `switchVariant(variantId)` is free while no set has
been logged; once any set carries logged data it requires a
`window.confirm` — targets change (workSets/reps/weight overlay), but
logged sets are kept, not discarded. This works via `buildSessionMovements(type,
variantId, carryMap)`, which rebuilds `sessionMovements` from
`BLOCK.sessions[type].movements` + the new variant's overrides and
re-attaches each movement's prior `_loggedSets`/`_exerciseNote` (`carryMap`,
keyed by movement name) — and each movement row is keyed on
`mov.name + ":" + variant` in `SessionScreen`'s render so `MovementRow`
remounts on a switch and recomputes its planned sets against the new
overlay (its lazy `useState` initializer merges the fresh plan with the
carried-over `_loggedSets`, the same mechanism draft-resume already used).
One side effect: switching collapses an open movement panel back closed
(the remount resets `MovementRow`'s own `open` state) — no data is lost,
just a re-tap to reopen.

Persists through `startSession` → `sessionMovements` → the draft
autosave/resume round-trip (`saveDraft`/`loadDraft` carry a `variant`
field so a resumed draft reapplies the same overlay) → `finish()`, which
records `entry.variant` and bakes it into `entry.label` only when
`SESSION_VARIANTS[type].length > 1`.

**Rest text:** each variant's `rest` string renders directly under the
session header for every type (not gated on having multiple variants) —
only the switcher itself is variant-count-gated.

**`workSets` gotcha:** `buildPlannedSets` PADS `mov.workSets` on top of
`buildPlannedSetsBase`'s built-in ramp, it does not simply set the total.
The Legs/Pull compound ramp already bakes in 2 "W"-type sets (on top of 1
warmup + 2 build = 5 total); a movement's `workSets` should match that
built-in count (2) unless you deliberately want MORE working sets than the
ramp's natural 5-set total (Legs B's Leg Curl does — `workSets: 3` there is
intentional, giving 6 total). Setting `workSets` higher than the ramp's
native "W" count for a movement that should stay at 5 total silently pads a
6th set on — this bit Legs A/B's Leg Press (`workSets: 3` on a 2-"W" base
produced 6 sets instead of the intended 5) until it was caught and fixed.
Accessory movements (3 straight "W" sets, no warmup/build) don't have this
trap — `workSets` there trims/pads a flat list with no separate baseline to
exceed.

Numbers in `SESSION_VARIANTS.legs` came directly from TARGETS.md's "Legs A/B
note for whoever implements the toggle" table — treat them as authored
prescription content (like `BLOCK.flags`/`current`/`target`), not code to
redesign. Verified with `scripts/test-session-variants.js` (validation bar
check #7, also runnable alone via `npm run test:session-variants`): every
Legs movement's planned sets differ between A and B, Leg Press is exactly 5
planned sets in both variants, and finishing a Legs B session persists
`variant === "B"` on the record.

### Exercise notes

Each movement carries a single free-text note, entered in `MovementRow`
beneath all of that movement's sets — **not** a per-set field. Internally
it's `_exerciseNote` state synced onto `mov._exerciseNote` via the same
mutate-then-call-`onChange` pattern `_loggedSets` already used, so it flows
through the same machinery: `buildSessionMovements`'s `carryMap` preserves
it across a variant switch (same as logged sets), `saveDraft`/`loadDraft`
carry a per-movement `note` field so a resumed draft restores it, and
`finish()` writes `note` onto each entry in `movements` — a movement is
kept in the finished record if it has logged sets **or** a note (previously
logged-sets-only).

**Migration:** this replaced an older per-set note field (`sets[].note`,
with a "+ note" toggle per set, no longer present in the entry UI).
Historical per-set notes are untouched and still rendered — in
`HistoryScreen` and the Session tab's recent-sessions expander — alongside
the movement-level note when both are present on the same record;
`sessions.json` is never rewritten to migrate old shapes.
`buildHandoff`/`buildCoachSummary` include both: per-set notes from
`sets[].note` and, if present, the movement-level `note`.

### Cardio finisher fields

`cardio: { machine, duration, level, rpe }` on a session record, entered via
SessionScreen's "Cardio finisher" section (below the movement list, above
the session note). `machine` is a fixed dropdown (`CARDIO_MACHINE_OPTIONS`:
Stairmaster, Recumbent bike, Spin bike, Elliptical, Treadmill (incline
walk), Rower, Other); `duration`/`level`/`rpe` are numeric inputs labeled
"min"/"level"/"rpe". `rpe` replaces what used to be a closed
`easy|moderate|hard` effort enum, consistent with how strength sets are
logged.

**Migration:** older records may still carry the retired `effort` string
instead of `rpe` — `hasCardioData`/`formatCardio` still read it (falling
back to displaying `effort` when `rpe` is absent) so history doesn't crash
or silently drop it. New entries always write `rpe` and never write
`effort`; nothing rewrites `sessions.json` to migrate old records.

`hasCardioData(cardio)` gates every read/write site — a session with no
cardio fields filled in gets no `cardio` key at all, not an empty-string
object. `formatCardio(cardio)` is the single formatter shared by
`HistoryScreen`, `buildHandoff`, and `buildCoachSummary`; add new display
sites through it rather than reformatting inline. Persists through the same
draft autosave/resume path as the session variant.

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
  `scripts/test-sync-last.js` (validation bar check #6, also runnable
  alone via `npm run test:sync-last`).

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
5. **Legs A/B** implemented as a prescription overlay, originally
   legs-only (`LEGS_VARIANTS`) and later generalized into a per-type
   `SESSION_VARIANTS[type]` array covering Push/Pull too (each with a
   single variant, switcher hidden), plus an in-session switcher with
   accidental-switch protection once a set is logged. See **Session
   variants**, above.
6. **Cardio finisher fields** added as first-class session fields, later
   reworked from a free-text machine field + easy/moderate/hard effort
   enum to a fixed machine dropdown + numeric `rpe`. See **Cardio
   finisher fields**, above.
7. **Version stamp** visible in the UI so a stale cached build is
   identifiable. See **Version stamp**, above.
8. **Claude Code session hygiene** — `.claude/settings.json` permission
   tiers, checkpoint-commit-before-session and end-of-session-diff-review
   habits. See **Claude Code session hygiene**, above.
9. **Stale-artifact CI check + pre-commit hook.** A prior cycle committed
   six phases of source changes without ever rebuilding, so `index.html`
   silently didn't move even though `npm test` kept passing. Added
   validation bar check #5 (rebuild-and-diff, normalizing the expected
   `BUILD_INFO` drift) plus `githooks/pre-commit` so source and artifact
   can't diverge in a normal commit. See **Validation bar**, above.
10. **Exercise notes** replaced the older per-set note field with one
    note per movement, positioned beneath all of that movement's sets.
    Historical per-set notes are untouched and still rendered. See
    **Exercise notes**, above.
11. **Session-screen noise removed** — the placeholder help text under
    the session note field and the redundant "unlogged movements"/"no
    sets logged" warning banners (movements are often intentionally
    skipped; the warnings just added friction).
12. **Last-sync timestamp** added to the Session tab ("Last synced:
    `<date>`, `<time>`", "Never synced" empty state), then fixed for
    accuracy: it originally advanced on every mount-time pull regardless
    of outcome, so a silently broken sync (or one that just found
    nothing new) looked identical to a healthy one.
    `recordSyncOutcome()` now separates "did the most recent attempt
    succeed" (`ok`/`err`, updated on every attempt) from "when did a
    sync last actually accomplish something" (`at`/`direction`, only
    advanced on a stamp-worthy success). See **Sync layer** →
    "Last-sync display", above.
13. **Session variant bugs fixed.** Legs B was applying no real
    prescription override — `SESSION_VARIANTS` never carried a weight
    field, so `buildPlannedSetsBase` always ramped off the shared
    `mov.current` regardless of variant; added an optional `weight` ramp
    anchor (distinct from `current`, which still never splits by
    variant). Separately, Leg Press's `workSets: 3` exceeded the Legs
    ramp's built-in 2 "W" slots, padding a 6th set onto the intended
    5-set ramp in both A and B. See **Session variants** → "`weight` is
    a ramp anchor" and "`workSets` gotcha", above.
14. **Behavior tests wired into `npm test`.** `test-sync-last.js` and
    `test-session-variants.js` both landed as standalone-only
    `npm run test:*` scripts before being registered as validation bar
    checks #6/#7 — meaning `npm test` alone didn't actually run them,
    twice. See **Validation bar**, above, for the rule going forward:
    new test scripts must be registered there, not left standalone.

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

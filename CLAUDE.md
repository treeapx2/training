# CLAUDE.md — treeapx2/training

Context for Claude Code sessions on this repo. Read this first.

## What this is

A single-file React 18 PWA workout tracker. Hosted on GitHub Pages at
`https://treeapx2.github.io/training`, installed to the home screen on an iPhone.
Owner logs strength sessions set-by-set (weight / reps / RPE) and syncs them to
this repo as JSON.

| | |
|---|---|
| Live app | `index.html` (repo root, `main`) — ~272 KB, compiled |
| Session data | `sessions.json` (repo root, `main`) — 71 sessions, Feb 28–Aug 9 2026 |
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
| `scripts/test-target-picker.js` | jsdom behavioral check for the target picker (see **Target picker**). Validation bar check #7; also `npm run test:target-picker`. |
| `scripts/test-superset.js` | jsdom behavioral check for supersets (see **Supersets**). Validation bar check #8; also `npm run test:superset`. |
| `scripts/test-skip.js` | jsdom behavioral check for the skip button (see **Skip**). Validation bar check #9; also `npm run test:skip`. |
| `scripts/test-cardio-default.js` | jsdom behavioral check for the cardio machine default (see **Cardio finisher fields**). Validation bar check #10; also `npm run test:cardio-default`. |
| `scripts/decompile.js` | **Historical/documentation only.** The one-time script that reconstructed `src/app.jsx` from the previously shipped, hand-patched `index.html`. Not runnable against current devDependencies — it needs the Babel 7.x line plus `babel-plugin-transform-react-createelement-to-jsx` (unmaintained, relies on legacy `t.jSXIdentifier`-style `@babel/types` builders that Babel 8 removed), both of which were removed once the decompile was done and committed. See the comment in the file for how to temporarily reinstall them if this is ever needed again. |
| `scripts/normalize-for-diff.js` | Parses a compiled app script and re-emits it through `@babel/generator` with fixed formatting, so two semantically-identical scripts (differing only in quote style, escaping, etc.) diff to nothing. Used to prove the JSX reconstruction and the Babel 7→8 upgrade changed no behavior; reusable for future refactors that touch `src/app.jsx`. |
| `index.html` | **Build output.** Don't hand-edit — regenerate via `npm run build`. Still the file that gets committed and deployed (see Deploy, below); there is no separate `dist/`. |

## Validation bar — every change must pass all ten

Two tiers, both scripted as `npm test` (`scripts/test.js`) — **one command
runs everything**, checks 1-10:

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

**Behavior tier (6-10):** does the app actually do the right thing at
runtime, not just have valid syntax. Each check is a standalone jsdom
script (also runnable alone, e.g. `npm run test:sync-last`,
`npm run test:target-picker`) that `scripts/test.js` invokes as a
subprocess:

- **#6** `scripts/test-sync-last.js` — `at_sync_last` timestamp tracking,
  see **Sync layer** → "Last-sync display".
- **#7** `scripts/test-target-picker.js` — ramp/derive*/suggestChip/
  positional-downgrade, see **Target picker**.
- **#8** `scripts/test-superset.js` — pre-seeded pairs, per-movement chips,
  link/unlink, see **Supersets**.
- **#9** `scripts/test-skip.js` — skip/un-skip, persistence, coach
  summary/handoff, see **Skip**.
- **#10** `scripts/test-cardio-default.js` — Stairmaster default without
  breaking the "omitted when empty" contract, see **Cardio finisher
  fields**.

Negative-tested the same way as the artifact tier: deliberately
reintroducing the old Leg Press `workSets` bug (a stale ancestor of what's
now `deriveSetCount`) made the equivalent check fail with the specific
assertion detail ("expected Leg Press (A) to have 5 planned sets, got 6")
surfaced directly in `npm test`'s output — `execFileSync`'s thrown error
already includes the subprocess's stdout/stderr, so no extra plumbing was
needed for failures to be diagnosable from `npm test` alone. `test-skip.js`
also documents a real authoring trap it caught: a movement's header
(including its "skip" button) always renders regardless of open/collapsed
state, so a query that isn't scoped to one movement's card container will
silently grab a different movement's button.

**New test scripts MUST be registered here, in `scripts/test.js`, as a new
numbered check — not left as a standalone-only `npm run test:*` script.**
This has already happened twice (`test-sync-last.js`, then the
now-removed `test-session-variants.js`, both landed standalone before
being wired in after the fact) — a behavior test nobody runs by default
might as well not exist. `npm test` is the one command that's expected to
run everything; anything that isn't reachable from it doesn't count as
covered. The reverse matters too: `test-session-variants.js` was deleted
outright (not just unregistered) when Legs A/B was removed, since it
existed purely to assert behavior of a feature that no longer exists —
keeping a passing test for a deleted feature would just be noise.

## Current architecture

### Data model

```js
BLOCK = {
  flags: [ "…training constraints, injury flags, protocol notes…" ],
  sessions: {
    legs|push|pull: {
      label, color, bg, rest,
      movements: [ { name, current, increment|steps, reps, target } ]
    }
  }
}
```

- `rest` is per session type (a plain string), shown under the session
  header for every type.
- `increment` (number) or `steps` (array, irregular dumbbell jumps) drive
  the target picker's down/hold/up chip math — see **Target picker**,
  below. There is no `workSets` field anymore — today's set count is
  derived from logged history (`deriveSetCount`), not authored here.
- `current` is a **fallback only**, consulted by `deriveCurrentWeight`
  exclusively when a movement has zero logged history. `target` (coach
  prose) is secondary UI, collapsed behind a "why?" tap-to-expand — see
  **Target picker**.
- `buildRamp(mov, targetWeight, setCount)` is the ramp generator — see
  **Target picker** for the shape and how `setCount` trims/pads it. It
  replaced the old `buildPlannedSets`/`buildPlannedSetsBase` wrapper
  pair entirely, not just its `workSets` handling.

### Session records

```js
{ id, type: "legs"|"push"|"pull", label, date: "Mon D, YYYY", note,
  cardio: { machine, duration, level, rpe }|undefined,  // see Cardio finisher fields; older records may carry a retired `effort` string instead of `rpe`
  movements: [ { name, sets: [ { set, weight, reps, rpe, note } ], note, order,
                 targetWeight, chipChoice: "down"|"hold"|"up", suggested: "down"|"hold"|"up",
                 supersetId, skipped, skipReason } ] }
```

`date` is a **display-formatted string**, not ISO. Parsing uses `new Date(str)`.
Do not silently migrate this format — the whole history and the dedup key depend on it.

Per movement: `targetWeight`/`chipChoice`/`suggested` are the target
picker's persisted choice (see **Target picker**); `supersetId` is set on
both movements of a linked pair, undefined otherwise (see **Supersets**);
`skipped`/`skipReason` mark a deliberate skip (see **Skip**) — a movement
with `skipped: true` can otherwise have zero `sets` and still belongs in
the record, unlike a genuinely untouched movement. All are `undefined`
(omitted, not empty-string/false) when not applicable, consistent with how
`cardio` itself is omitted rather than written as an all-empty object.

Historical records logged before the Aug 10 2026 removal of session
variants may still carry a `variant` field (e.g. `"A"`/`"B"` on old Legs
sessions) — nothing writes or reads it anymore, but nothing crashes on it
either; `entry.label` already had it baked in as plain text
(`"Legs A"`/`"Legs B"`) at write time, so display needed no dedicated
variant-aware code even when the feature existed. See **Target picker**.

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

One exception to "queue position is recorded as-is": `seedSupersets` (see
**Supersets**, below) moves a pre-seeded pair's second movement to sit
immediately after the first at session-build time, so the two render
adjacent. That's a session-construction step, not a change to
`BLOCK.sessions[type].movements`' own declared order.

### Target picker

**Removed: session variants.** Legs A/B (`SESSION_VARIANTS`, the in-session
switcher, `switchVariant`) is gone as of CHANGES.md's Aug 10 2026 work
order — it solved "lighter day" at session granularity; the target picker
below solves it per-movement, every session type, no extra structure. A
"lighter day" now needs no code: it's just a session where most movements
land on the `down` chip, and because that choice is persisted per movement
(see **Session records**, below), such sessions can be identified
retroactively from data. Historical records with a `variant` field (e.g.
Legs A/B sessions logged before the removal) are untouched in
`sessions.json` and still render — nothing reads `variant` anymore, but
nothing crashes on it either, since `entry.label` already had it baked in
at write time.

**`BLOCK.current`/`BLOCK.target` are now secondary.** The pre-filled set
defaults used to come straight from the hand-authored `BLOCK.current`
string, which went stale between coach updates (repeat log notes like
"need to update the default for this exercise"). Direction of authority is
now flipped:

- `BLOCK.current` is a **fallback only**, used by `deriveCurrentWeight`
  exclusively when a movement has never been logged in history at all.
  Once there's history, `current` is never consulted for the ramp again —
  see below.
- `BLOCK.target` (the coach's prose reasoning) is demoted to a collapsed
  "why?" tap-to-expand element in `SetLogger`, not shown by default. The
  text itself is unchanged and still authored content per **Scope
  boundary** — only its prominence changed.

**Chips:** each movement, before any set is logged, shows three weight
chips — down / hold / up — instead of an auto-filled ramp
(`ChipPicker` component, shared by `SetLogger` for a standalone movement
and `SupersetRow` for a linked pair). Exactly one chip carries a
`suggested` star. Tapping a chip calls `buildRamp` and fills the set rows.
Chips stay visible and re-tappable afterward; once any set is logged,
retapping a different chip requires the same `window.confirm`-and-preserve
pattern the old variant switcher used — targets change, logged sets are
kept by index-matching them onto the new ramp.

**Increments:** each `BLOCK` movement carries an explicit `increment`
(number, e.g. `15` for plate-loaded machines, `5` for cables/DBs) or a
`steps` array for irregular dumbbell jumps (Lateral Raise:
`[12, 15, 20, 25]`) — replacing the old name-based `machineInc()`
classification. `stepWeight(mov, value, n)` steps one chip position from
`value` (`n = -1` down, `+1` up): for `increment` movements it's
`value + n*increment`, clamped at `increment` itself (never zero or
negative); for `steps` movements it walks the array by `n` positions,
clamped at the array's ends.

**Current working weight** (the `hold` chip): `deriveCurrentWeight(history,
mov)` — the heaviest weight *logged* in the most recent session containing
the movement, evaluated against whether that specific top-weight attempt
(not any lighter set that happens to share its rep count) hit the
movement's configured `reps`. This is deliberately **not** "search all of a
session's sets for any that hit target reps" — warmup/build sets are
pre-filled with the same rep target as working sets (see `buildRamp`
below), so that naive approach lets an easy warmup set mask a failed
top-weight attempt. Falls back to `BLOCK.current` only with zero history for
the movement. `movementSessionSummaries(history, movName, targetReps)` is
the shared per-session summarizer underneath both this and `suggestChip`.

**Ramp shape:** `buildRamp(mov, targetWeight, setCount)` replaces the old
`machineInc`/`isAccessory`/DB-Row-special-case branching in
`buildPlannedSetsBase` with one unified shape for every movement —
`[T-2i, T-i, T-i, T, T]` (warmup, 2 build, 2 working) for a chosen target
`T`. `deriveSetCount(history, movName)` supplies `setCount`: the modal
(most frequent) total-set count across the last 3 sessions containing the
movement, defaulting to 5 with no history. `setCount` trims or pads that
5-slot template — trimming drops the 2nd build set first, then the 1st,
then the warmup, and never goes below one working set at `T`; padding
beyond 5 adds more working sets at `T`. (This is also where the earlier
"Leg Press generates 6 sets" bug fix lives now — it used to be a
`workSets`-field mismatch against the ramp's built-in "W" count; now it's
just however many sets `deriveSetCount` actually derives from logged
history, so it can't drift out of sync with a hand-maintained number.)

**Suggestion rules:** `suggestChip(history, movName, targetReps)` evaluates
the last two sessions containing the movement:

| Condition | Suggests |
|---|---|
| Both sessions hit target reps at RPE ≤7 | `up` |
| Last session hit target reps at RPE 8 | `hold` |
| Last session missed target reps, or its top set was RPE ≥9 | `down` |
| Fewer than 2 prior sessions | `hold` |

`applyPositionalDowngrade(suggested, position, total)` then demotes a
computed `up` to `hold` when the movement is in the **last two** positions
of today's `sessionMovements` — queue position materially affects output
(`BLOCK.flags`: "run the lift you want to advance FIRST"), so a movement
run late is never a valid place to suggest a weight increase. First-two and
middle positions are unaffected either way.

**State + persistence:** `useMovementPicker(mov, history, position, total,
onChange)` is the hook holding one movement's chip/ramp/logging/note/skip
state — used directly by `MovementRow`, and twice (once per movement) by
`SupersetRow` so a linked pair each keep their own chip choice independent
of the other. `chipChoice`/`targetWeight`/`suggested` mutate onto
`mov._chipChoice`/`mov._targetWeight`/`mov._suggested` the same
mutate-then-`onChange` pattern `_loggedSets`/`_exerciseNote` already used.
`saveDraft`/`resumeDraft` carry all three so a resumed draft reopens with
its chip choice intact instead of resetting to "no chip tapped yet", and
`finish()` writes `targetWeight`/`chipChoice`/`suggested` onto each
movement in the record (see **Session records**, below) — this is what
makes suggestion quality auditable (how often is the suggestion accepted?)
and enables retroactive "lighter day" labeling.

Verified with `scripts/test-target-picker.js` (validation bar check #7,
also `npm run test:target-picker`): ramp shape/clamping/trim-pad, both
`derive*` functions' history-following and no-history fallback, all four
`suggestChip` rules against fixture history, the positional `up`→`hold`
downgrade, and that finishing persists the three fields on the record.

### Supersets

An annotation on the existing flat movement list, not a nested structure —
a `supersetId` string shared by two adjacent movements in
`sessionMovements`. The flat list and `order` semantics are unchanged; the
two paired movements each still keep their own sets/weight/chips/note.

**Pre-seeded pairs** (`SUPERSET_PAIRS` near `BLOCK`): Pec Fly+Lateral
Raise, Rope Pushdown+Skull Crusher, Cable Curl+Reverse Fly, Leg
Extension+Calf Raise — all already called out in `BLOCK.target` prose
("Superset with X"). `seedSupersets(movements)` applies them at
session-build time (`buildSessionMovements`, i.e. only on a brand-new
`startSession` — a resumed draft restores whatever pairing/unlinking was
already saved with it, never reseeds) by moving the second movement of
each pair to sit immediately after the first (required for the combined
card to render — see below) and assigning both a shared `supersetId`.
**This reordering is not baked into `BLOCK.sessions[type].movements`
itself** — none of the four pairs are adjacent in that array's declared
order today, and reordering it would be a training-programming decision
belonging to the authored content, not something to invent in code (see
**Scope boundary**). Pre-seeded pairs are unlinkable like any other pair —
unlinking just clears `supersetId` on both movements and never touches
logged data.

**Linking/unlinking:** a plain `MovementRow` gets a "link with `<next>`"
affordance on its lower edge whenever the following movement in
`sessionMovements` isn't already paired with something else
(`linkWithNext(idx)` in `SessionScreen`, assigns a fresh `supersetId` to
both). A combined card's header has one "unlink" affordance
(`unlinkSuperset(supersetId)`, clears it on both movements).

**Rendering:** `SessionScreen` groups `sessionMovements` into render groups
each render (`renderGroups` — consecutive movements sharing a `supersetId`
become a `{kind:"pair"}` group, everything else is `{kind:"single"}`);
pairing only renders as a combined card while the two are **adjacent** —
reordering one away from its partner (▲/▼) isn't specially guarded against
and just makes them render as two separate cards again, an accepted edge
case. A pair renders as `SupersetRow`: each movement's own `ChipPicker`
until both have a chosen target, then interleaved set rows (Set 1: movement
A's row, movement B's row; Set 2: ...) up to
`Math.max(pickerA.plannedSets.length, pickerB.plannedSets.length)`. Rest
text is a fixed string, not derived: "Rest: none between · 60s after pair".

**Persistence:** `finish()` writes the shared `supersetId` onto both linked
movements' records (see **Session records**, below), alongside each one's
own `targetWeight`/`chipChoice`/`order` as usual.

**Scope note:** the skip button (below) was only added to standalone
`MovementRow`, not `SupersetRow` — skipping one half of an already-paired
card isn't addressed by CHANGES.md and would need more design than that
phase covered.

Verified with `scripts/test-superset.js` (validation bar check #8, also
`npm run test:superset`): all four pre-seeded pairs render as a combined
card for every session type, each movement's own chips work (including the
`steps`-based Lateral Raise) and `finish()` persists the matching
`supersetId`, unlinking breaks the pair and keeps logged data while a
subsequent finish records no `supersetId`, and a non-pre-seeded pair can be
linked manually.

### Skip

Distinguishes a deliberate skip from a movement that's simply untouched —
previously both looked identical (zero sets logged, maybe a freeform note
like "skipped — in use"), which made skip patterns invisible to analysis.

`skipped`/`skipReason` live in `useMovementPicker` next to the rest of that
hook's state, same mutate-then-`onChange` sync onto
`mov._skipped`/`mov._skipReason`. The "skip" action sits in `MovementRow`'s
header (always rendered, regardless of open/collapsed state — a query that
grabs "the first skip button on the page" instead of scoping to one
movement's card will silently hit the wrong movement, see the test file's
own comment on this). Tapping it shows `SkipPicker`: fixed reason chips
(`SKIP_REASONS` = `machine in use`/`time`/`pain`/`other`), with `other`
revealing a short free-text field. Once skipped, the movement renders
collapsed with the reason visible and no expand/chip/log UI; "un-skip"
clears both fields and is available any time within the session —
reversible, not a one-way action.

**Persistence:** `finish()`'s movement filter keeps a movement with
`skipped: true` even with zero logged sets and no note (previously that
combination would have silently dropped the movement from the record
entirely, same as if it had never been touched).

**Display:** both History rendering sites (the History tab's weekly view
and the Session tab's recent-sessions expander) show "skipped —
`<reason>`" for a `skipped: true` movement. `buildCoachSummary` (the
post-finish summary) shows the same instead of an empty set list;
`buildHandoff` does too for each recent session, plus an all-time "SKIP
COUNTS" section (sorted by count, across all of `history` not just the
recent window) — repeated skips of the same movement are the programming
signal the spec calls for, not just one day's noise.

Verified with `scripts/test-skip.js` (validation bar check #9, also
`npm run test:skip`): collapsed rendering with the reason visible, the
`other` free-text path, un-skip reversibility, `finish()` keeping a
zero-set skipped movement while excluding any genuinely untouched one, and
both `buildCoachSummary`/`buildHandoff` surfacing the skip.

### Exercise notes

Each movement carries a single free-text note, entered in `MovementRow`
beneath all of that movement's sets — **not** a per-set field. Internally
it's `_exerciseNote` state (part of `useMovementPicker`, see **Target
picker**) synced onto `mov._exerciseNote` via the same mutate-then-call-
`onChange` pattern `_loggedSets` already used, so it flows through the same
machinery: `saveDraft`/`loadDraft` carry a per-movement `note` field so a
resumed draft restores it, and `finish()` writes `note` onto each entry in
`movements` — a movement is kept in the finished record if it has logged
sets, a note, **or** `skipped: true` (see **Skip**).

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
walk), Rower, Other), **defaulted to `"Stairmaster"`** (`EMPTY_CARDIO`) —
it came through empty on a real record while duration/level/rpe were all
filled; the full dropdown stays available, this is only the pre-fill.
`duration`/`level`/`rpe` are numeric inputs labeled "min"/"level"/"rpe".
`rpe` replaces what used to be a closed `easy|moderate|hard` effort enum,
consistent with how strength sets are logged.

**Migration:** older records may still carry the retired `effort` string
instead of `rpe` — `hasCardioData`/`formatCardio` still read it (falling
back to displaying `effort` when `rpe` is absent) so history doesn't crash
or silently drop it. New entries always write `rpe` and never write
`effort`; nothing rewrites `sessions.json` to migrate old records.

`hasCardioData(cardio)` gates every read/write site — a session with no
cardio fields filled in gets no `cardio` key at all, not an empty-string
object. Because `machine` now defaults to `"Stairmaster"` instead of `""`,
`hasCardioData` deliberately does **not** count `machine` alone unless it
differs from that default — otherwise the pre-fill alone would make every
single session look like it had cardio data, silently breaking the
"omitted when nothing filled in" contract. `formatCardio(cardio)` is the
single formatter shared by `HistoryScreen`, `buildHandoff`, and
`buildCoachSummary`; add new display sites through it rather than
reformatting inline. Persists through the same draft autosave/resume path
as everything else in `useMovementPicker`.

Verified with `scripts/test-cardio-default.js` (validation bar check #10,
also `npm run test:cardio-default`): the dropdown defaults to Stairmaster
with the full option list still present, an otherwise-untouched session
still omits the `cardio` key entirely, and filling one field records the
default machine alongside it.

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
| `at_session_draft` | in-progress session autosave, incl. `cardio` and per-movement `targetWeight`/`chipChoice`/`suggested`/`supersetId`/`skipped`/`skipReason` |
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
   accidental-switch protection once a set is logged. **Removed
   entirely Aug 10 2026** — see item 15, below, and **Target picker**.
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
13. **Session variant bugs fixed** (Legs B applying no real weight
    override; Leg Press padding a 6th set). Moot now that the whole
    variant system is gone (see item 15) — kept here because the
    underlying "don't let a padded/mismatched set count silently drift
    from what's actually prescribed" lesson carried straight into
    `deriveSetCount`.
14. **Behavior tests wired into `npm test`.** `test-sync-last.js` and
    the (now-removed) `test-session-variants.js` both landed as
    standalone-only `npm run test:*` scripts before being registered as
    validation bar checks #6/#7 — meaning `npm test` alone didn't
    actually run them, twice. See **Validation bar**, above, for the
    rule going forward: new test scripts must be registered there, not
    left standalone.
15. **Session variants removed** in favor of the target picker (item
    16) — Legs A/B solved "lighter day" at session granularity; the
    target picker solves it per-movement, every session type, with no
    extra structure. `SESSION_VARIANTS`, the switcher, and
    `switchVariant` are gone; `scripts/test-session-variants.js` was
    deleted (not just unregistered) since it asserted behavior of a
    now-nonexistent feature. Historical `variant`-carrying records are
    untouched and still render. See **Target picker**, above.
16. **Target picker** replaces pre-filled-from-`BLOCK.current` ramps
    with explicit down/hold/up weight chips, defaults derived from
    logged history instead of a hand-maintained config string that went
    stale between coach updates. `BLOCK.current` is now a fallback for
    movements with no history; `BLOCK.target` prose moved behind a
    collapsed "why?" toggle. See **Target picker**, above.
17. **Supersets** — `supersetId` links two adjacent movements into one
    interleaved card; four pairs are pre-seeded from prose the program
    already called out ("Superset with X"), reordered at session-build
    time only (not in `BLOCK`'s own declared movement order). See
    **Supersets**, above.
18. **Skip button** distinguishes a deliberate skip (with a reason) from
    a genuinely untouched movement — previously indistinguishable, both
    zero sets logged. `buildHandoff` aggregates all-time skip counts per
    movement as a programming signal. See **Skip**, above.
19. **Cardio machine defaults to Stairmaster** — it came through empty
    on a real record while duration/level/rpe were all filled.
    `hasCardioData` was adjusted so the pre-fill alone doesn't make an
    untouched session look like it has cardio data. See **Cardio
    finisher fields**, above.
20. **Docs caught up for the Aug 10 2026 work order** (items 15-19) —
    "Session variants" section replaced with "Target picker" /
    "Supersets" / "Skip"; `Session records` schema, `Data model`,
    `Exercise notes`, `Cardio finisher fields`, `Dedup rule`, `Movement
    ordering`, the `at_session_draft` localStorage row, and the
    `Validation bar` check list/counts all updated to match; the two
    variant-era changelog entries above (5, 13) annotated rather than
    rewritten, since this list is a historical record, not a snapshot
    of current state.

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

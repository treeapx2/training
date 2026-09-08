# CLAUDE.md — treeapx2/training

Context for Claude Code sessions on this repo. Read this first.

## What this is

A single-file React 18 PWA workout tracker. Hosted on GitHub Pages at
`https://treeapx2.github.io/training`, installed to the home screen on an iPhone.
Owner logs strength sessions set-by-set (weight / reps / RPE) and syncs them to
this repo as JSON.

| | |
|---|---|
| Live app | `index.html` (repo root, `main`) — ~288 KB, compiled |
| Session data | `sessions.json` (repo root, `main`) — 77 sessions, Feb 28–Aug 19 2026 |
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
| `scripts/test-dumbbell-steps.js` | jsdom + source-text check for the shared `DUMBBELL_STEPS` rack array (see **Target picker** → "Increments"). Validation bar check #11; also `npm run test:dumbbell-steps`. |
| `scripts/test-ramp-shapes.js` | jsdom behavioral check for the set-count-scaled ramp shapes (see **Target picker** → "Ramp shape"). Validation bar check #12; also `npm run test:ramp-shapes`. |
| `scripts/test-superset-phase3.js` | jsdom behavioral check for superset shared weight and add-round (see **Supersets**). Validation bar check #13; also `npm run test:superset-phase3`. |
| `scripts/test-explicit-logging.js` | jsdom behavioral check for auto-log-on-RPE (see **Explicit set logging**). Validation bar check #14; also `npm run test:explicit-logging`. |
| `scripts/test-unavailable-weight.js` | jsdom behavioral check for the unavailable-weight fallback (see **Target picker** → "Unavailable weight fallback"). Validation bar check #15; also `npm run test:unavailable-weight`. |
| `scripts/test-cardio-trend.js` | jsdom behavioral check for the cardio progress view (see **Cardio finisher fields** → "Cardio trend"). Validation bar check #16; also `npm run test:cardio-trend`. |
| `scripts/test-suggestion-rep-range.js` | jsdom behavioral check for rep-range-aware suggestions (see **Target picker** → "Suggestion rules"). Validation bar check #17; also `npm run test:suggestion-rep-range`. |
| `scripts/test-superset-progression.js` | jsdom behavioral check for superset-aware working-weight derivation and the RPE-8 plateau rule (see **Target picker** → "Suggestion rules"). Validation bar check #18; also `npm run test:superset-progression`. |
| `scripts/test-movement-library.js` | jsdom behavioral check for the movement library, optional adds and per-hand weight labels (see **Movement library**). Validation bar check #19; also `npm run test:movement-library`. |
| `scripts/test-session-timer.js` | jsdom behavioral check for the session timer (see **Session timer**). Validation bar check #20; also `npm run test:session-timer`. |
| `scripts/test-chart-windowing.js` | jsdom behavioral check for chart windowing (see **Chart windowing**). Validation bar check #21; also `npm run test:chart-windowing`. |
| `scripts/test-cardio-skip.js` | jsdom behavioral check for cardio skip and machine substitution (see **Cardio finisher fields** → "Cardio skip"). Validation bar check #22; also `npm run test:cardio-skip`. |
| `scripts/decompile.js` | **Historical/documentation only.** The one-time script that reconstructed `src/app.jsx` from the previously shipped, hand-patched `index.html`. Not runnable against current devDependencies — it needs the Babel 7.x line plus `babel-plugin-transform-react-createelement-to-jsx` (unmaintained, relies on legacy `t.jSXIdentifier`-style `@babel/types` builders that Babel 8 removed), both of which were removed once the decompile was done and committed. See the comment in the file for how to temporarily reinstall them if this is ever needed again. |
| `scripts/normalize-for-diff.js` | Parses a compiled app script and re-emits it through `@babel/generator` with fixed formatting, so two semantically-identical scripts (differing only in quote style, escaping, etc.) diff to nothing. Used to prove the JSX reconstruction and the Babel 7→8 upgrade changed no behavior; reusable for future refactors that touch `src/app.jsx`. |
| `index.html` | **Build output.** Don't hand-edit — regenerate via `npm run build`. Still the file that gets committed and deployed (see Deploy, below); there is no separate `dist/`. |

## Validation bar — every change must pass all twenty-two

Two tiers, both scripted as `npm test` (`scripts/test.js`) — **one command
runs everything**, checks 1-22:

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

**Behavior tier (6-22):** does the app actually do the right thing at
runtime, not just have valid syntax. Each check is a standalone jsdom
script (also runnable alone, e.g. `npm run test:sync-last`,
`npm run test:target-picker`) that `scripts/test.js` invokes as a
subprocess:

- **#6** `scripts/test-sync-last.js` — `at_sync_last` timestamp tracking,
  see **Sync layer** → "Last-sync display".
- **#7** `scripts/test-target-picker.js` — ramp/derive*/suggestChip/
  positional-downgrade, see **Target picker**.
- **#8** `scripts/test-superset.js` — the three revised pre-seeded pairs,
  per-movement chips, link/unlink, see **Supersets**.
- **#9** `scripts/test-skip.js` — skip/un-skip, persistence, coach
  summary/handoff, see **Skip**.
- **#10** `scripts/test-cardio-default.js` — Stairmaster default without
  breaking the "omitted when empty" contract, see **Cardio finisher
  fields**.
- **#11** `scripts/test-dumbbell-steps.js` — the shared `DUMBBELL_STEPS`
  rack array on every dumbbell movement, machine/cable movements
  unaffected, see **Target picker** → "Increments".
- **#12** `scripts/test-ramp-shapes.js` — the four tabulated ramp patterns
  (opener / position 2+ / superset member / 2-set movement), the ≤1 floor,
  a reorder regenerating both the promoted and displaced movements' ramps,
  and a superset pair's four warmup-free rounds, see **Target picker** →
  "Ramp shape".
- **#13** `scripts/test-superset-phase3.js` — a free-weight pair's shared
  weight (and unlink/link weights), a mixed pair never sharing weight,
  "+ add round", see **Supersets**.
- **#14** `scripts/test-explicit-logging.js` — no log button, RPE-entry
  auto-log, x-reverts, only logged sets persist, see **Explicit set
  logging**.
- **#15** `scripts/test-unavailable-weight.js` — the unavailable action
  shifting the whole ramp down and being re-tappable, `substituted`
  persistence, see **Target picker** → "Unavailable weight fallback".
- **#16** `scripts/test-cardio-trend.js` — the Progress-tab cardio trend
  grouped by machine, `buildHandoff`'s CARDIO TRENDS section, see
  **Cardio finisher fields** → "Cardio trend".
- **#17** `scripts/test-suggestion-rep-range.js` — the rep-range-aware
  `suggestChip` rules, the positional first-two-positions guard, and
  `substituted` movements ignored for the baseline weight, see **Target
  picker** → "Suggestion rules".
- **#18** `scripts/test-superset-progression.js` — superset sessions excluded
  from working-weight derivation (the Hammer Curl fixture deriving 25, not
  the 15 lb weight-matched superset round), the best qualifying session in a
  three-session window, `substituted` exclusion confirmed, a superset-only
  movement still progressing, and the RPE-8 plateau rule (the Seated Row
  fixture suggesting `up`) without misfiring on a fresh jump, see **Target
  picker** → "Suggestion rules".
- **#19** `scripts/test-movement-library.js` — the library covering all 27
  movements ever logged (derived from `sessions.json` at test time, not
  hardcoded), every entry usable, overlapping historical names kept distinct,
  an optional movement added to a live session getting working chips, a new
  definition persisting, and per-hand dumbbell weight labels, see **Movement
  library**.
- **#20** `scripts/test-session-timer.js` — the wall-clock arithmetic, the
  timer starting automatically alongside the rest target, a reload
  mid-session coming back with its paused state and elapsed time intact, a
  running timer counting the time the app was away, and
  `durationMin`/`liftingMin`/`cardioMin` reaching the record, history and
  the handoff, see **Session timer**.
- **#21** `scripts/test-chart-windowing.js` — the newest-12 default,
  half-window pan with overlap, clamping at both ends, the 12/25/all presets,
  a per-movement window counting sessions *containing that movement*, and the
  cardio trend windowed the same way, see **Chart windowing**.
- **#22** `scripts/test-cardio-skip.js` — a skipped finisher counting as data
  while an untouched one doesn't, exclusion from the trend but not the
  record, one-tap machine substitution offered before the skip reasons, and
  reversibility, see **Cardio finisher fields** → "Cardio skip".

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
- `increment` (number) or `steps` (array) drive the target picker's
  down/hold/up chip math — see **Target picker**, below. Every dumbbell
  movement shares one `steps: DUMBBELL_STEPS` array (`[5, 10, 12, 15, 20,
  25, 30, 35, 40, 45, 50]` — the rack's actual available plates, 5s to 50
  plus a 12 lb pair as the one exception) instead of a per-movement array;
  machine/cable movements keep a plain `increment` (15 or 5). There is no
  `workSets` field anymore — today's set count is derived from logged
  history (`deriveSetCount`), not authored here.
- `current` is a **fallback only**, consulted by `deriveCurrentWeight`
  exclusively when a movement has zero logged history. `target` (coach
  prose) is secondary UI, collapsed behind a "why?" tap-to-expand — see
  **Target picker**.
- `buildRamp(mov, targetWeight, { position, isSuperset, setCount })` is the
  ramp generator — see **Target picker** → "Ramp shape". Its third argument
  became an options object on Sep 8 2026 when the shape started scaling with
  queue position instead of set count. It replaced the old
  `buildPlannedSets`/`buildPlannedSetsBase` wrapper pair entirely, not just
  its `workSets` handling.
- **Session architecture** (CHANGES.md Sep 8 2026, Phase 3): three muscle
  groups per session, two movements each, exactly one superset placed last.
  Push is DB Bench Press + Pec Fly (Chest), Rope Pushdown + Skull Crusher
  (Triceps), Shoulder Press ⇄ Lateral Raise (Shoulders); Pull is Seated Row +
  Lat Pulldown (Back), DB Row + Reverse Fly (Upper back), Cable Curl ⇄ Hammer
  Curl (Biceps); Legs is Leg Press + Leg Extension (Quads), Leg Curl
  (Posterior), Goblet Squat ⇄ Calf Raise (Posterior/Calves). `MUSCLE_GROUPS`
  carries the matching labels, plus the optional-add movements so an added
  movement still gets a real group chip.
- `BLOCK.sessions[type].movements` is the session DEFAULT list, not the whole
  movement inventory — everything ever logged is reachable through the
  **Movement library**, below. Chest Press (a selectable alternate for the
  chest slot) and Zottman Curl left the defaults on Sep 8 2026 and live there
  now.
- **Weekly context** (informs nothing structural, but explains why Push and
  Pull must be repeatable and Legs need not be): four gym days a week,
  doubling either Push or Pull, plus hockey one to two times a week on
  unpredictable days, plus one to two rest or travel days. Legs runs once a
  week; skating supplies additional lower-body load.

### Session records

```js
{ id, type: "legs"|"push"|"pull", label, date: "Mon D, YYYY", note,
  cardio: { machine, duration, level, rpe, skipped, skipReason }|undefined,  // see Cardio finisher fields; older records may carry a retired `effort` string instead of `rpe`
  durationMin, liftingMin, cardioMin,   // session timer; absent on records logged before Sep 8 2026
  movements: [ { name, sets: [ { set, weight, reps, rpe, note } ], note, order,
                 targetWeight, chipChoice: "down"|"hold"|"up", suggested: "down"|"hold"|"up",
                 supersetId, skipped, skipReason, substituted } ] }
```

`date` is a **display-formatted string**, not ISO. Parsing uses `new Date(str)`.
Do not silently migrate this format — the whole history and the dedup key depend on it.

Per movement: `targetWeight`/`chipChoice`/`suggested` are the target
picker's persisted choice (see **Target picker**); `supersetId` is set on
both movements of a linked pair, undefined otherwise (see **Supersets**);
`skipped`/`skipReason` mark a deliberate skip (see **Skip**) — a movement
with `skipped: true` can otherwise have zero `sets` and still belongs in
the record, unlike a genuinely untouched movement; `substituted: true`
marks a movement where the "unavailable" action was used (see **Target
picker** → "Unavailable weight fallback") — a lighter session forced by
rack availability, distinguishable from a deliberate deload, and excluded
from `deriveCurrentWeight`/`deriveSetCount`/`suggestChip`'s history so it
never lowers the baseline. All are `undefined` (omitted, not
empty-string/false) when not applicable, consistent with how `cardio`
itself is omitted rather than written as an all-empty object.

Per session: `durationMin`/`liftingMin`/`cardioMin` are the session timer's
totals in minutes (see **Session timer**) — `durationMin` is the sum, and all
three are omitted when the clock never ran, so a record can't claim a bogus
0-minute session. Every record logged before Sep 8 2026 lacks them, which is
why `formatSessionDuration()` returns `""` rather than "0 min" for a record
with no `durationMin`. `cardio.skipped`/`cardio.skipReason` mark a
deliberately skipped finisher (see **Cardio finisher fields** → "Cardio
skip") — the cardio counterpart of a movement's `skipped`, and the reason
`hasCardioData` counts a skip as data.

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

### Volume target

**"100 reps per muscle group" is superseded.** The old framework was two
exercises × five sets × ten reps, but the ramp delivered only two of five
sets at working weight, so 60% of each movement was warm-up tax. Effective
volume for hypertrophy is sets taken near failure, so the target is now
**~6 working sets (≈60 reps at working weight) per muscle group**, and ~20
working sets per session at roughly the same total set count.

| | Before | After |
|---|---|---|
| Total sets | ~23 | ~24 |
| **Working sets** | ~14 | **~20** |
| Reps at working weight | ~140 | **~200** |
| Working sets per muscle group | 4 | **6–8** |

Total reps drop slightly; reps that actually drive adaptation rise ~30%. This
is what the Phase 1 ramp table and the Phase 3 session architecture exist to
deliver, inside a 45-minute lifting budget with the cardio finisher as a
separate ~15-minute block after it (see **Session timer**). The owner was
already doing this instinctively on accessories — Lateral Raise, Sep 5:
`15×10` four times, no ramp, one of the most consistent lifts in the log.

This is recorded here as programming context handed in with the Sep 8 2026
work order, not as something the app enforces — see **Scope boundary**.

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
(number, e.g. `15` for plate-loaded machines, `5` for cables) or a `steps`
array — replacing the old name-based `machineInc()` classification. Every
dumbbell movement (Skull Crusher, Hammer Curl, Zottman Curl, DB Row,
Reverse Fly, Lateral Raise, Goblet Squat) shares one `steps: DUMBBELL_STEPS`
array — `[5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50]`, the rack's actual
available plates (5s to 50, plus one 12 lb pair as the only exception to
the 5 lb step) — rather than a per-movement array (CHANGES.md Aug 19 2026,
Phase 1: chips were previously offering weights the rack doesn't have,
e.g. Skull Crusher bouncing 12→15→20). `stepWeight(mov, value, n)` steps
one chip position from `value` (`n = -1` down, `+1` up): for `increment`
movements it's `value + n*increment`, clamped at `increment` itself (never
zero or negative); for `steps` movements it walks the array by `n`
positions (snapping to the nearest entry first if `value` isn't itself in
the array), clamped at the array's ends.

**Current working weight** (the `hold` chip): `deriveCurrentWeight(history,
mov)` — the heaviest weight that reached the rep range's lower bound across
the last **three eligible sessions** containing the movement, evaluated
against whether that specific top-weight attempt (not any lighter set that
happens to share its rep count) hit the range. Reading only sets that hit
target reps would be wrong for the same reason it always was: warmup/build
sets are pre-filled with the same rep target as working sets (see
`buildRamp`), so a naive scan lets an easy warmup mask a failed top-weight
attempt.

Rewritten Sep 8 2026 (CHANGES.md Phase 2) from "the most recent session" to
"the best qualifying session in a three-session window", because a single dip
was resetting the baseline — a weight-matched superset round, a late
placement, a rack substitution, or just a bad day. Concrete case from the
log: Hammer Curl's best is 25 (Aug 9, 10 reps @ RPE 7), but Aug 19 was a
weight-matched superset round at 15, so the engine derived 15 and its
repeated `suggested: up` was pointing at 20 instead of 30. The owner wasn't
disagreeing with the suggestion; the baseline under it was wrong. Goblet
Squat had the same shape (derived 40 against a best of 50). It is a WINDOW,
not an all-time max — a genuinely sustained deload still moves the baseline
down once the old weight ages out. If nothing in the window reached the rep
floor, the most recent top weight is used rather than the window's heaviest
failed attempt.

`movementSessionSummaries(history, movName, targetReps, opts)` is the shared
per-session summarizer underneath this, `deriveSetCount` and `suggestChip`.
It records `inSuperset` per session and can exclude those sessions.
`progressionSummaries()` wraps it with the eligibility rule: **superset
sessions are dropped**, because the owner matches weights across a
free-weight superset to avoid rack trips and places supersets last precisely
to finish a muscle group under fatigue — those sets are intentionally
sub-maximal and must not set the movement's own baseline.

**Flagged deviation** (documented at `progressionSummaries`): Phase 2 says a
superset-only movement should "fall back to the best non-superset session,
then to `BLOCK.current`". Taken literally that means `BLOCK.current`, which
would freeze all six permanent superset members (Shoulder Press, Lateral
Raise, Cable Curl, Hammer Curl, Goblet Squat, Calf Raise) at a hand-authored
string forever — exactly the staleness the target picker exists to remove.
So superset history is used when it is the only history there is; the "a
superset round must never LOWER the baseline" guarantee still holds, because
the window is scored by its best session, never its most recent. Raise this
with the owner if the frozen-baseline reading was intended.

Falls back to `BLOCK.current` only with zero history for the movement.

**Ramp shape:** `buildRamp(mov, targetWeight, { position, isSuperset,
setCount })` scales its shape with the movement's **queue position**, not
with its historical set count (CHANGES.md Sep 8 2026, Phase 1, which replaces
the Aug 19 set-count table outright).

The correcting insight is that warm-up is a per-session need, not a
per-movement need: quads don't need re-warming three times inside one legs
session, so only the opener earns a full ramp. The old shape put just 2 of 5
sets at working weight — 60% warm-up tax — against a target of ~20 working
sets per session inside a 45-minute lifting budget. Measured on the Sep 3
legs session: 23 total sets, ~14 at working weight.

For target weight `T` and step `i` (one chip-step down):

| Movement position | Generated pattern | Sets | Working |
|---|---|---|---|
| Position 1 (opener) | `[T-2i, T-i, T, T, T]` | 5 | 3 |
| Position 2+ | `[T-i, T, T, T]` | 4 | 3 |
| Superset member | `[T, T, T, T]` | 4 | 4 |
| 2-set movement | `[T, T]` | 2 | 2 |
| ≤1 set | `[T]` | 1 | 1 |

- `position` is the movement's index in the session's flat ordered list, so
  the opener is position 0.
- `isSuperset` is read straight off the movement's `supersetId`, so
  linking/unlinking mid-session is picked up without threading another prop
  through `useMovementPicker`. Superset members never carry warm-up sets —
  they sit at the end of a session by design and the muscle group is already
  fully warm — and always get exactly 4 rounds regardless of derived set
  count, since `SupersetRow` interleaves the pair's rows and a mismatched
  count renders ragged.
- `setCount` (from `deriveSetCount`, the modal total-set count across the
  last 3 eligible sessions, defaulting to 5) is now consulted for **one case
  only**: the "2-set movement" row. **Inference flagged in the code** — the
  work order lists that row without saying what makes a movement a 2-set
  movement; reading it as "history says 2 sets" is the only reading that
  leaves the row any work to do. Flag to the owner if it was meant to be an
  explicit per-movement setting instead.
- There is **no padding beyond the tabulated counts** any more. Position
  determines the set count, which is the point of the restructure (capping
  total sets against the time budget); "+ add round" / `handleUpdate("_add")`
  is still how extra sets get added by hand.

**Reordering regenerates the ramp.** `useMovementPicker` watches
`position`/`isSuperset` and rebuilds through the same `applyTarget` helper a
chip tap uses: silent before any set is logged, and behind the existing
confirm-before-change pattern once sets exist. Cancelling keeps the ramp —
the movement still moved, only its shape is left alone. Both the promoted and
the displaced movement regenerate.

(See `scripts/test-ramp-shapes.js`, validation bar check #12. This is also
where the earlier "Leg Press generates 6 sets" bug fix lives — it used to be
a `workSets`-field mismatch against the ramp's built-in "W" count, then a
history-derived count; now the count follows position, so there is no
hand-maintained number left to drift.)

**Suggestion rules:** `suggestChip(history, movName, targetReps)` evaluates
the last two sessions containing the movement, via the shared
`movementSessionSummaries(history, movName, targetReps)`. Rewritten Aug 19
2026 (CHANGES.md Phase 7) — across 33 real movement instances Aug 10-19 the
owner overrode the suggestion in a pattern that clustered on one failure:
treating "missed the exact target rep count" as failure, when fewer reps
at a heavier weight is often genuine progress (the weight just belongs in
a lower rep range). Two changes underlie the new table:

- Each session's `topReps`/`topRpe` now come from the **first** set logged
  at that session's top weight, not the worst across every set at that
  weight — a second/third set at the same top weight is a fatigue backoff,
  not new evidence the top weight itself failed. (Concrete case: Chest
  Press, Aug 11, `135×8 @8` then `135×5 @9` after a `120→135` jump — the
  old worst-case aggregation scored the session a failure off the second
  set; the first set is what the session should be judged on.)
- "Success" is reaching the rep range's **floor** (`targetReps - 2`, so 8
  for a 10-rep target), not the exact target rep count.

| Condition (evaluated in this order) | Suggests |
|---|---|
| Last session's (first) top-weight set was RPE ≥9 | `down` |
| Three or more consecutive sessions at target reps, same top weight, RPE ≤8 | `up` (plateau break — see below) |
| Last session missed the floor, weight was freshly increased vs. the prior session, reps landed in the target-4..target-2 "consolidation" range (~6-8 for a 10-rep target), RPE ≤8 | `hold` (load is being consolidated, not failing) |
| Last session missed the floor (and the consolidation carve-out above doesn't apply) | `down` |
| Both sessions hit the exact target reps at RPE ≤7 | `up` |
| Last session reached the floor but not both `up` conditions | `hold` |
| Fewer than 2 eligible sessions | `hold` |

**The RPE-8 plateau trap** (`isPlateaued`, CHANGES.md Sep 8 2026, Phase 2).
"Target reps at RPE 8" satisfied neither the `up` rule (which wants RPE ≤7
twice running) nor any `down` rule, so a lift parked there could never be
suggested up. Seated Row and Lat Pulldown both sat at `135×10` for seven
sessions, including position-1 attempts, so placement wasn't the cause. Three
or more consecutive sessions like that is consolidation, not a ceiling.

**Interpreted broader than written, flagged in the code**: the work order says
"target reps at RPE 8 for three or more consecutive sessions". Read strictly
as RPE *exactly* 8, the rule fires for neither movement it was written to fix
— Seated Row's and Lat Pulldown's last three sessions are 8 / 8 / 7, not
8 / 8 / 8. So the implemented test is target reps at RPE ≤8, **at the same top
weight**, for the three most recent eligible sessions. The same-weight
requirement is what keeps it from colliding with the Aug 19 consolidation
rule, which deliberately says `hold` for a FRESH weight jump landing at RPE
≤8 — parked at one weight and having just arrived at a new one are opposite
situations. Tell the owner if the literal exactly-RPE-8 reading was meant.

`hitTarget` (exact target reps) is kept alongside `hitFloor` since `up` stays
strict — hitting the floor is enough to avoid `down`, but not enough to
suggest increasing. `movementSessionSummaries` skips any session where the
movement is marked `substituted` (see "Unavailable weight fallback", below) —
a rack-availability drop must not lower the baseline — and `suggestChip` now
reads `progressionSummaries` rather than the raw summaries, so **superset
sessions are excluded from the suggestion too**, not just from the derived
weight. Both come from the same eligibility rule, so a movement's suggestion
and the weight under it can never be computed from different sessions.

Verified against the committed log by `scripts/test-superset-progression.js`
(check #18): Hammer Curl derives 25, Goblet Squat 50, and Seated Row and Lat
Pulldown both suggest `up`.

Verified with `scripts/test-suggestion-rep-range.js` (validation bar check
#17, also `npm run test:suggestion-rep-range`): the named Chest Press
fixture yields `hold` not `down`; a fresh jump landing in the
consolidation range yields `hold`; the same shortfall with no fresh jump
still yields `down` (the carve-out is jump-specific); reps below the
consolidation floor or RPE ≥9 still yield `down` despite a fresh jump; and
a `substituted` session is ignored for the baseline.

`applyPositionalDowngrade(suggested, position, total)` demotes a computed
`up` to `hold` when the movement is in the **last two** positions of
today's `sessionMovements` — queue position materially affects output
(`BLOCK.flags`: "run the lift you want to advance FIRST"), so a movement
run late is never a valid place to suggest a weight increase. The **first
two** positions are now explicitly never downgraded (CHANGES.md Aug 19
2026, Phase 7) regardless of what the "last two" check would say — for a
small `total` (a 2-3 movement session), "first two" and "last two"
otherwise overlap and the very first movement could get wrongly
downgraded.

### Unavailable weight fallback

A per-movement "unavailable" action (CHANGES.md Aug 19 2026, Phase 5 —
four real notes in ten days recorded a wanted weight not being on the
rack, e.g. "15s not available and didnt want to push 20s"). Rendered in
`SetLogger`'s header next to "why?" once a ramp exists (`sets.length > 0`)
for a standalone movement, and per-movement above the round rows in
`SupersetRow`. Tapping it (`useMovementPicker`'s `handleUnavailable`)
steps the current `targetWeight` down one increment/step via the existing
`stepWeight()` and regenerates the ramp via the same `applyTarget` helper
`handleChipTap`/`handleSetWeight` (Phase 3a) use — keeping whatever chip
choice was already made, since this is a rack-availability correction on
top of it, not a new target decision. Re-tappable if the next weight down
turns out to be unavailable too.

**Persistence:** `substituted: true` is set on the movement (mirrors the
`skipped` pattern — mutate onto `mov._substituted`, synced via the same
mutate-then-`onChange` pattern, carried through `saveDraft`/`resumeDraft`,
written by `finish()`) so a lighter session caused by rack availability is
distinguishable from a deliberate deload, and — see "Suggestion rules",
above — is excluded from `movementSessionSummaries` so it can't lower the
baseline for future suggestions.

Verified with `scripts/test-unavailable-weight.js` (validation bar check
#15, also `npm run test:unavailable-weight`): tapping unavailable shifts
the whole ramp to the nearest step down and is re-tappable, `finish()`
persists `substituted: true` only on the affected movement, and the same
affordance works independently per-movement inside a superset pair.

**State + persistence:** `useMovementPicker(mov, history, position, total,
onChange)` is the hook holding one movement's chip/ramp/logging/note/skip/
substituted state — used directly by `MovementRow`, and twice (once per
movement) by `SupersetRow` so a linked pair each keep their own chip
choice independent of the other. `chipChoice`/`targetWeight`/`suggested`/
`substituted` mutate onto `mov._chipChoice`/`mov._targetWeight`/
`mov._suggested`/`mov._substituted` the same mutate-then-`onChange`
pattern `_loggedSets`/`_exerciseNote` already used. `saveDraft`/
`resumeDraft` carry all four so a resumed draft reopens with its chip
choice (and substituted flag) intact instead of resetting, and `finish()`
writes `targetWeight`/`chipChoice`/`suggested`/`substituted` onto each
movement in the record (see **Session records**, below) — this is what
makes suggestion quality auditable (how often is the suggestion accepted?)
and enables retroactive "lighter day" labeling.

Verified with `scripts/test-target-picker.js` (validation bar check #7,
also `npm run test:target-picker`): the opener ramp shape and clamping (see
`test-ramp-shapes.js`, check #12, for the full position table), both
`derive*` functions' history-following and no-history fallback, the base
`suggestChip` rules against fixture history (see `test-suggestion-rep-
range.js`, check #17, for the rep-range-aware rules and
`test-superset-progression.js`, check #18, for the superset-exclusion and
plateau rules), the positional
`up`→`hold` downgrade, and that finishing persists the target-picker
fields on the record.

### Supersets

An annotation on the existing flat movement list, not a nested structure —
a `supersetId` string shared by two adjacent movements in
`sessionMovements`. The flat list and `order` semantics are unchanged; the
two paired movements each still keep their own sets/weight/chips/note.

**Pre-seeded pairs** (`SUPERSET_PAIRS` near `BLOCK`): **exactly one per
session type, always in the final two slots** — Shoulder Press+Lateral Raise
(Push), Cable Curl+Hammer Curl (Pull), Goblet Squat+Calf Raise (Legs).

Revised to this shape Sep 8 2026 (CHANGES.md Phase 3): the superset is now
the session's third muscle group, placed last by design so that group gets
finished under fatigue — which is the same premise Phase 2 relies on when it
excludes superset sessions from baseline derivation (see **Target picker** →
"Suggestion rules"). Rope Pushdown+Skull Crusher and Cable Curl+Reverse Fly
were dropped; Legs gained its first pre-seeded pair. The Aug 19 reasoning
still holds for what remains: no machine+machine pairs ("no supersets with
machines out of respect for the gym goers"), and Shoulder Press+Lateral Raise
is still the one machine-inclusive pair the owner explicitly endorsed as "the
one superset that can include a machine so far."

Because the Phase 3 default lists already put each pair adjacent and last,
`seedSupersets`' reordering is now a no-op for the pre-seeded pairs — it is
kept because it still has to assign the shared `supersetId`, and because
nothing guarantees a future default list stays adjacent. `seedSupersets(movements)` applies the pairs at
session-build time (`buildSessionMovements`, i.e. only on a brand-new
`startSession` — a resumed draft restores whatever pairing/unlinking was
already saved with it, never reseeds) by moving the second movement of
each pair to sit immediately after the first (required for the combined
card to render — see below) and assigning both a shared `supersetId`.
**This reordering is not baked into `BLOCK.sessions[type].movements`
itself** — reordering it would be a training-programming decision
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

**Shared weight for free-weight pairs (Phase 3a):** when both movements in
a pair are dumbbell movements (`mov.steps`, not `mov.increment`),
`SupersetRow` offers one shared down/hold/up chip row (baselined on the
first movement's `deriveCurrentWeight`) instead of two independent
`ChipPicker`s — "easier to keep the supersets with the same weight so im
not going back and forth to the rack too often." Tapping a shared chip
calls each movement's `useMovementPicker.handleSetWeight(choice, weight,
skipConfirm)` — a variant of `handleChipTap` that takes an explicit weight
rather than deriving one from the movement's own history, factored out via
a shared `applyTarget(choice, weight)` both use — driving both movements'
ramps to the identical literal target weight (each still built via its own
`buildRamp`, so rep counts and setCount stay per-movement; only the weight
number is shared). "unlink weights" reverts to two independent pickers for
that pair; "link weights" re-enables the shared one. A mixed
machine+dumbbell pair (e.g. Shoulder Press+Lateral Raise) never shows the
shared picker — a literal shared weight is meaningless across different
equipment.

**Add round (Phase 3b):** once both movements have a chosen target, a
"+ add round" button below the interleaved set rows calls
`handleUpdate("_add", "_add", "_add")` on both movements' pickers at once
— appending one paired working set to both movements in a single tap
("need ability to add more superset rounds").

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
phase covered. The "unavailable" action (see **Target picker** →
"Unavailable weight fallback") IS available per-movement inside
`SupersetRow`, independent for each side of the pair.

Verified with `scripts/test-superset.js` (validation bar check #8, also
`npm run test:superset`): exactly one pre-seeded pair per session type
renders as a combined card and sits in the session's final slots, each
movement's own chips work (including the `steps`-based Lateral Raise) and
`finish()`
persists the matching `supersetId`, unlinking breaks the pair and keeps
logged data while a subsequent finish records no `supersetId`, and a
non-pre-seeded pair can be linked manually. Shared-weight and add-round
behavior is covered separately in `scripts/test-superset-phase3.js`
(validation bar check #13, also `npm run test:superset-phase3`): a
manually-linked free-weight pair shares one weight and both ramps match
set-for-set, unlink/link weights toggles it, a mixed pair never shares
weight, and add round appends to both movements.

### Explicit set logging

A set commits (`logged: true`, locks its weight/reps/rpe inputs) the
instant its RPE field is filled in and loses focus — no separate "log"
button. CHANGES.md Aug 19 2026, Phase 4 ("selecting an RPE should log the
set - need for a log button") explicitly required confirming intent with
the owner before implementing, since the app already had SOME
log/lock/✕-to-clear mechanism predating every CHANGES.md work order and it
wasn't obvious the note described a real gap. The owner's clarification:
*"The idea is not even to have a log button. as soon as an RPE is set, the
log action executes and the button is replaced with an x that removes the
RPE and unlogs the set if it needs to be cancelled."*

`useMovementPicker.handleRpeCommit(idx)` fires on the RPE input's `onBlur`
— specifically the **`focusout`** browser event, not `blur`, which is what
React's `onBlur` actually listens for under the hood; a synthetic
`dispatchEvent(new Event("blur"))` in a jsdom test does nothing, it has to
be `focusout` (see `scripts/test-explicit-logging.js`'s and
`scripts/test-target-picker.js`'s comments, and this gotcha applies to any
future `onBlur`-driven test). It fires on blur rather than `onChange`
specifically so a multi-keystroke decimal RPE entry (e.g. "7.5") doesn't
get locked out mid-type the instant the first digit lands — logging on
every keystroke would disable the input after typing "7", before "7.5"
could be finished. A set with no RPE entered never auto-logs; weight/reps
edits alone never log a set. The existing `handleDelete` (the ✕ button,
shown once a set is logged) is the only way back to uncommitted — it
already cleared both `logged` and `rpe`, unchanged by this phase. Only
logged sets are counted toward history-derived calculations
(`mov._loggedSets`, unchanged).

Verified with `scripts/test-explicit-logging.js` (validation bar check
#14, also `npm run test:explicit-logging`): no "log" button exists
anywhere on an open movement card, filling weight/reps alone never
auto-logs, filling RPE and losing focus auto-logs (locks inputs, shows
✕), tapping ✕ reverts to uncommitted without touching weight/reps, and
`finish()` only persists logged sets.

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

**Cardio trend (Phase 6):** cardio was logged as structured fields since
Aug 2 but never surfaced beyond the individual session — "are we tracking
stairmaster progress?" `getCardioHistory(history)` flattens every
session's cardio finisher into one chronological (oldest first) list;
`groupCardioByMachine(entries)` buckets it by machine so progress on one
machine isn't diluted by entries from another. `CardioTrendCard` renders
this on the **Progress tab** (below the weekly breakdown, above the coach
handoff card) as a plain per-machine table — date/duration/level/RPE (or
`effort` for older records with no numeric RPE) for the most recent 8
entries per machine — deliberately not `MovementChart`, which is
weight/lb-specific. Renders nothing when no session has cardio data. "The
signal that matters: output at a given RPE. Duration and level rising
while RPE stays flat is aerobic progress" — all three fields are shown
side by side specifically so that comparison is visible at a glance.

`buildHandoff` gained a CARDIO TRENDS section (grouped by machine, last 6
entries each, oldest first) alongside the pre-existing per-recent-session
"Cardio: ..." lines — the per-session lines cover session detail, this
section covers the aggregate trend the coach needs for comparison.
Omitted entirely when there's no cardio data.

Verified with `scripts/test-cardio-trend.js` (validation bar check #16,
also `npm run test:cardio-trend`): the Progress-tab trend renders grouped
by machine with duration/level/RPE all visible, is absent with no cardio
data, and `buildHandoff`'s CARDIO TRENDS section mirrors both.

**Cardio skip (Phase 7):** cardio was skipped entirely on Aug 25
("stairmaster taken") rather than substituted, losing the finisher for that
session — and losing it invisibly, since a session with no `cardio` key looks
identical whether the finisher was deliberately skipped or simply never
tracked. `cardio.skipped`/`cardio.skipReason` mirror the per-movement
**Skip** pattern, reusing `SkipPicker` and its reasons (machine in use /
time / pain / other).

- `hasCardioData` counts a skip as data, so a skipped finisher is written to
  the record. An untouched cardio section is still omitted entirely — the
  "omitted when nothing filled in" contract is unchanged.
- **Substitution is offered before the skip reasons.** Tapping "skip" first
  surfaces one-tap machine alternatives under "Machine taken? Switch instead
  of skipping". The dropdown already existed; it just wasn't in front of the
  owner at the moment they were deciding to give up. One tap switches machine
  and keeps the entry.
- Reversible within the session ("un-skip"), like a movement skip.
- `formatCardio` renders "skipped — `<reason>`", so history, the post-finish
  summary and the coach handoff all surface it through the one formatter.
  `getCardioHistory` excludes skips from the trend — a skip has no
  duration/level/RPE to plot — while the record still shows it, which is
  exactly what makes a missing finisher distinguishable from an untracked one.

Verified with `scripts/test-cardio-skip.js` (validation bar check #22, also
`npm run test:cardio-skip`).

### Movement library

Every movement ever logged is available as an optional add, not just the
current defaults (CHANGES.md Sep 8 2026, Phase 4). The concrete cost of a
closed list is already in the log: DB Bench Press was written twice as prose
inside a zero-set movement note (`30s×10×3 @5–6`, `35s×10×2 @7`) purely
because it wasn't selectable.

`sessions.json` holds **27** distinct movement names. `getMovementLibrary()`
merges three sources, first definition per name winning:

1. `BLOCK.sessions[*].movements` — the 17 Phase 3 session defaults.
2. `OPTIONAL_MOVEMENTS` — the other 10: Chest Press (the chest slot's
   selectable alternate), Zottman Curl, OHE, Shoulder Press (DB), RDL, Glute
   Bridge, Incline DB Press, Flat DB Press, Floor Press, Rows.
3. `loadCustomMovements()` — anything the owner defined in-app, persisted
   under `at_custom_movements_v1`.

Every entry gets a `_group` label (`MUSCLE_GROUPS` lists the optional adds
alongside the defaults) so an added movement never falls through to "Other".

**UI:** "+ add movement" on any session opens `AddMovementPicker` — the
library with this session type's own muscle groups first and everything else
below a divider, plus a define-a-movement form taking name, muscle group,
equipment (dumbbell steps / machine 15 / cable 5) and rep target. Added
movements append to the END, since position drives the ramp shape now (see
**Target picker** → "Ramp shape") — where a movement sits is a training
decision, left to the owner's reorder controls.

**`resumeDraft` resolves against the whole library**, not just the active
type's `BLOCK` list. Without that, a resumed draft containing an optional add
or a custom definition would silently lose its `steps`/`increment`/`reps`
and come back with dead chips.

**Dumbbell weights are per hand.** The owner logs "35s" meaning 35 lb in each
hand. `weightLabelFor(mov)` is the single source both rendering sites use —
`SetLogger`'s column header and `SupersetRow`'s rows — so they can't drift;
it keys off `steps`, which is exactly the dumbbell classification the rack
array encodes. `SupersetRow` had no column header at all and gained one; a
mixed pair keeps a plain "lb" header and names the per-hand movement
underneath. `ChipPicker` shows a "lb per hand" line, since the chips are
weights too.

**Do not merge or rename historical movements.** `Rows`/`DB Row`,
`Flat DB Press`/`DB Bench Press` and `Shoulder Press`/`Shoulder Press (DB)`
may well be the same lift in practice, but merging would rewrite history.
They stay distinct and `test-movement-library.js` pins it; consolidation is
the owner's call.

**Scope boundary:** the nine never-before-configured adds carry no invented
prescription — their `target` says outright that no coach target is authored
and repeats only facts already in the log, and `reps: 10` is the program's
usual placeholder. Same for DB Bench Press's `current: "35 lb"`, which is
quoted from the owner's own Sep 5 note. Shoulder Press (DB) was logged at 70
lb per hand, above the current rack's 50 lb ceiling, so its chips snap to
what the rack has — flagged for the owner to confirm.

Verified with `scripts/test-movement-library.js` (validation bar check #19,
also `npm run test:movement-library`): the library covers all 27 logged
movements (derived from `sessions.json` at test time, not hardcoded, so a
future sync that adds a movement fails loudly instead of leaving it
unreachable).

### Session timer

> *"would be helpful to automatically start a timer when a session is
> selected — would need pause and resume functionality and a record of the
> total workout time — this would be for the full session"* — Cable Curl
> note, Aug 26

The timer (CHANGES.md Sep 8 2026, Phase 5) banks accumulated milliseconds per
**phase** plus, while running, the wall clock the current stretch started at:
`{ phase, liftingMs, cardioMs, running, startedAt }`. Storing a start
timestamp rather than a running counter is the whole reason it survives app
backgrounding and reload — iOS freezes timers in a backgrounded PWA, so a
tick-based counter would silently under-count any session the owner walked
away from, which on a phone is most of them. `timerNow` state exists only to
re-render the clock once a second; the elapsed value is always recomputed
from the clock, never replayed.

- **Two phases**, because the budget has two parts: **45 minutes of lifting**
  (`LIFTING_TARGET_MIN`) and a separate **~15-minute cardio finisher**
  (`CARDIO_TARGET_MIN`) that is *not* inside it. "start cardio"
  (`timerCardioStarted`) closes the lifting block and opens the cardio one,
  so the 45/15 split stays visible instead of collapsing into one 60-minute
  total. One-way by design — it records what happened, it isn't a mode toggle.
- Starts automatically on session start; pause/resume sit in the session
  header alongside the rest target, with the elapsed clock and the target.
  `timerBanked` is the single transition helper (pause, phase switch,
  finish), so a running stretch can never be dropped or double-counted.
- Persisted into the draft, so a reload mid-session comes back with its
  paused state and elapsed time intact; a timer left running correctly counts
  the time the app was closed.
- `finish()` banks the clock before reading it, then writes
  `durationMin`/`liftingMin`/`cardioMin` onto the record (see **Session
  records**). All three are omitted when the clock never ran.
- Shown in both history sites and in the coach handoff.
  `formatSessionDuration()` returns `""` for a record with no `durationMin`,
  so the pre-Sep-8-2026 back catalogue renders nothing rather than "0 min".
- Past 45 minutes of lifting the clock turns amber and nothing else happens:
  "no alarms, no blocking".

Verified with `scripts/test-session-timer.js` (validation bar check #20, also
`npm run test:session-timer`).

### Chart windowing

Charts became unreadable as history grew — months of data crushed into 320px
with date labels overlapping. Each chart now shows the most recent **12**
points by default, with **12 / 25 / all** presets and a pan control
(CHANGES.md Sep 8 2026, Phase 6).

**Windowed by data points, not calendar dates**, and deliberately so: for a
per-movement chart, 12 means 12 sessions *containing that movement*. Twelve
calendar sessions is only about four legs sessions — legs runs once a week —
which would make leg charts far sparser than cardio charts for no reason the
reader could see.

- `windowSlice` / `maxChartOffset` / `chartPanStep` are the shared
  arithmetic and `ChartWindowControls` the shared UI, so the per-movement
  charts and the cardio trend can't drift apart.
- Pan steps by **half** a window rather than a whole page, so consecutive
  views overlap and a trend running across a window boundary stays readable.
  Switching preset re-anchors to the newest data rather than stranding the
  reader at an offset the new range may not reach.
- The y-axis scales to the **window**, not the whole series, so a window of
  similar weights uses the full height instead of flattening against an
  all-time max that isn't on screen.
- Controls stay hidden when the whole series already fits in one window.
- The cardio trend's per-machine tables (`CardioMachineTable`) are windowed
  the same way, each holding its own state: Stairmaster has far more entries
  than the machines used once or twice, so a shared offset would mean
  something different in each table. This replaced its fixed `.slice(-8)`.
- "all" earns its place because the zoomed-out view answers a question the
  windowed one can't: am I trending up over months.

Note the per-movement progression charts live on the **Block** tab (and,
compact, inside an open movement card); the **Progress** tab carries the
weekly breakdown and the cardio trend.

Verified with `scripts/test-chart-windowing.js` (validation bar check #21,
also `npm run test:chart-windowing`).

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
| `at_session_draft` | in-progress session autosave, incl. `cardio` (with its skip), the session `timer`, and per-movement `targetWeight`/`chipChoice`/`suggested`/`supersetId`/`skipped`/`skipReason`/`substituted` |
| `at_sync_cfg_v1` | sync config incl. PAT |
| `at_sync_last` | last-sync tracking — see **Sync layer** ("Last-sync display") |
| `at_custom_movements_v1` | movements the owner defined in-app — see **Movement library** |
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

No code work queued. Every numbered item below is complete — the list is a
changelog for anyone picking this back up, with pointers to where each is
actually documented. What IS outstanding is a short list of **open questions
for the owner** at the end: readings this session had to make where the work
order was ambiguous or self-contradictory, plus one data-sync gap.

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
    interleaved card; four pairs were originally pre-seeded from prose the
    program already called out ("Superset with X"), reordered at
    session-build time only (not in `BLOCK`'s own declared movement
    order). **Revised to three pairs Aug 19 2026** — see item 21, below,
    and **Supersets**.
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
21. **Free-weight increments unified to the rack's real steps** — several
    dumbbell movements had wrong/inconsistent increments (Skull Crusher
    bouncing 12→15→20 because the picker offered unavailable weights).
    Every dumbbell movement now shares one `DUMBBELL_STEPS` array (5s to
    50 plus a 12 lb pair); machine/cable movements unaffected. See
    **Target picker** → "Increments", above.
22. **Ramp shape scales with set count** — the old fixed 5-slot
    `[T-2i, T-i, T-i, T, T]` shape spent a warmup+build overhead even on
    short accessory movements the owner didn't want it on. `buildRamp`
    now generates a different shape per set count (5/4/3/2/≤1), tabulated
    in **Target picker** → "Ramp shape", above.
23. **Superset improvements** — shared weight for free-weight pairs (one
    chip row drives both movements to the identical literal weight, with
    an unlink/link-weights toggle), an "add round" action, and the
    pre-seeded pairs revised to stop including machine+machine pairs
    (Leg Extension+Calf Raise removed; Shoulder Press+Lateral Raise
    replaces Pec Fly+Lateral Raise — flagged as an inference where the
    source notes didn't explicitly say). See **Supersets**, above.
24. **Explicit set logging** — a set now auto-logs the instant its RPE
    field is filled in and loses focus; the "log" button is gone
    entirely. Required confirming intent with the owner first (the
    document said so explicitly), since the app already had some
    log/lock mechanism predating every CHANGES.md work order. See
    **Explicit set logging**, above.
25. **Unavailable weight fallback** — a per-movement "unavailable" action
    shifts the whole generated ramp to the nearest available step down
    in one tap; persists `substituted: true` so a rack-forced lighter
    session is distinguishable from a deliberate deload, and is excluded
    from the history `suggestChip`/`deriveCurrentWeight`/`deriveSetCount`
    read to compute future targets. See **Target picker** → "Unavailable
    weight fallback", above.
26. **Cardio progress tracking** — a Progress-tab trend view grouped by
    machine (duration/level/RPE per entry), plus a CARDIO TRENDS section
    in the coach handoff export grouped the same way. Cardio data existed
    since Aug 2 but was never surfaced beyond the individual session. See
    **Cardio finisher fields** → "Cardio trend", above.
27. **Suggestion logic made rep-range-aware** — across 33 real movement
    instances Aug 10-19, the owner overrode `suggestChip`'s call in a
    pattern that clustered on one failure: scoring "missed the exact
    target rep count" as failure, when fewer reps at a heavier weight is
    often genuine progress. Success is now reaching the rep range's floor
    (target - 2), not the exact target; a fresh weight jump landing in a
    lower-but-respectable range at RPE≤8 suggests hold, not down; each
    session is now scored on the FIRST set at its top weight, not the
    worst across every set at that weight; the positional `up`→`hold`
    downgrade never fires in the first two positions; and a movement
    marked `substituted` is excluded from the baseline entirely. See
    **Target picker** → "Suggestion rules", above.
28. **Docs caught up for the Aug 19 2026 work order** (items 21-27) —
    `Data model`, `Session records` schema, `Target picker` (increments,
    ramp shape, suggestion rules, new "Unavailable weight fallback"
    subsection), `Supersets` (revised pre-seed list, shared weight, add
    round), new "Explicit set logging" section, `Cardio finisher fields`
    (new "Cardio trend" subsection), the `at_session_draft` localStorage
    row, and the `Validation bar` check list/counts (6→17) all updated to
    match. Item 17 above annotated rather than rewritten, same reasoning
    as item 20.

29. **Position-aware ramp generation** replaces the Aug 19 set-count table.
    The old shape landed only 2 of 5 sets at working weight — 60% warm-up
    tax — because it re-warmed the muscle group on every movement. Warm-up
    is a per-session need, so only the opener earns a full ramp; everything
    after it starts at one build set, and superset members carry none.
    `buildRamp`'s third argument became an options object, and reordering a
    movement now regenerates its ramp. See **Target picker** → "Ramp shape".
30. **Superset-aware progression** — superset sessions no longer set a
    movement's baseline (they're deliberately sub-maximal: weight-matched
    across the pair and run last under fatigue), and the working weight now
    comes from the best qualifying session in a three-session window rather
    than the most recent one. Hammer Curl was deriving 15 against a best of
    25; Goblet Squat 40 against 50. Their repeatedly-ignored `suggested: up`
    was correct all along — the baseline under it was wrong. See **Target
    picker** → "Suggestion rules".
31. **RPE-8 plateau break** — "target reps at RPE 8" satisfied no rule, so a
    lift parked there could never be suggested up. Seated Row and Lat
    Pulldown sat at `135×10` for seven sessions, including position-1
    attempts. Three or more consecutive such sessions now suggest `up`.
    Interpreted slightly broader than written (RPE ≤8 at the same weight
    rather than exactly 8) because the literal rule fires for neither
    movement it was written to fix — flagged in the code. See **Target
    picker** → "Suggestion rules".
32. **Session architecture formalized** — three muscle groups per session,
    two movements each, exactly one pre-seeded superset placed last.
    `SUPERSET_PAIRS` dropped to one pair per type; Legs gained its first.
    Zottman Curl left the Pull defaults (skipped three of the last four Pull
    sessions); DB Bench Press became the default chest slot and Chest Press
    a selectable alternate. `MUSCLE_GROUPS` re-cut to match. See **Data
    model** and **Supersets**.
33. **Full movement library with optional adds** — every one of the 27
    movements ever logged is reachable, plus in-app definitions that
    persist. DB Bench Press had been getting written as prose inside a
    zero-set note purely because it wasn't selectable. Dumbbell weight
    fields are now labelled per hand. See **Movement library**.
34. **Session timer** with pause/resume, a lifting/cardio split matching the
    45/15 budget, survival across reload and iOS backgrounding, and
    `durationMin`/`liftingMin`/`cardioMin` on the record and in the handoff.
    See **Session timer**.
35. **Chart windowing** — newest 12 points by default with 12/25/all presets
    and a half-window pan, counted in data points rather than calendar dates
    so a per-movement window means 12 sessions containing that movement.
    Applies to the per-movement charts and the cardio trend. See **Chart
    windowing**.
36. **Cardio skip and substitution** — a finisher skipped with a reason is
    now distinguishable from one that was never tracked (Aug 25's
    "stairmaster taken" lost the finisher invisibly), and skipping offers
    one-tap machine substitution first. See **Cardio finisher fields** →
    "Cardio skip".
37. **Docs caught up for the Sep 8 2026 work order** (items 29-36) — "Ramp
    shape" and "Suggestion rules" rewritten, new **Volume target**,
    **Movement library**, **Session timer** and **Chart windowing**
    sections, `Data model` and `Session records` updated for the session
    architecture and `durationMin`/`cardio.skipped`, `Supersets`' pre-seed
    list revised, the `at_session_draft` and `at_custom_movements_v1`
    localStorage rows, and the `Validation bar` check list/counts (17→22).
    Earlier entries annotated rather than rewritten, same reasoning as items
    20 and 28.

**Open questions for the owner**, all flagged at the code as well:

- Phase 1's "2-set movements" row doesn't say what makes a movement a 2-set
  movement; read as "history says 2 sets". Should it be an explicit
  per-movement setting instead?
- Phase 2's superset-only fallback is implemented as "use superset history
  when it's the only history there is" rather than the literal "fall back to
  `BLOCK.current`", which would freeze all six permanent superset members.
- Phase 2's plateau rule is implemented as RPE ≤8 at the same weight, not
  RPE exactly 8 (see item 31).
- DB Bench Press and the nine optional adds have no coach-authored `target`;
  they say so in place of one. Shoulder Press (DB)'s 70 lb log is above the
  current rack's 50 lb ceiling.
- `BLOCK.flags` still says "Hockey SUSPENDED. Weekly TENNIS is the
  skating-prep substitute", but the Sep 8 work order's weekly context has
  hockey back at one to two times a week. `flags` is authored in the training
  project (see **Scope boundary**), so it was left alone — it needs an update
  from there.
- `sessions.json` in this repo ends **Aug 19 2026**, but the Sep 8 work
  order cites sessions through Sep 7 (Sep 3 legs, Sep 5 Lateral Raise and DB
  Bench Press, Sep 7 Zottman Curl, Aug 25-27). Those sessions are on the
  phone and haven't been synced/committed. Everything here derives from live
  history at runtime, so it's not blocking, but the committed log is a
  few weeks behind the notes the work order is written from.

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

# CHANGES.md — work order, Aug 10 2026

Supersedes the previous version of this file. Read alongside CLAUDE.md.

Six phases. Commit after each. `npm run build && npm test` must pass before every
commit. Do not push — the owner pushes.

These phases change behavior. Equivalence with the previous `index.html` will not
hold. Verify each phase with targeted jsdom checks on real flows.

---

## Background: why this refactor

The prose `target` strings (`"TEST 165 — broke the 8-rep wall..."`) are authored
by the coach every couple of weeks and displayed on each movement. **The owner
does not read them** — his attention is on the pre-filled set defaults, which are
generated from the hand-authored `current` field. That field goes stale between
coach updates, producing repeated log notes like *"need to update the default for
this exercise"* (Cable Curl, Aug 5 and Aug 9 — it had been at 47.5 for two
sessions while the preset still ramped to 42.5).

**Fix the direction of authority.** Defaults should derive from *logged history*,
which is always current, rather than from a hand-maintained config string. Coach
prose becomes optional commentary behind a tap, not the primary surface.

---

## PHASE 1 — remove session variants

The A/B variant system is being removed. It solved "lighter day" at session
granularity; Phase 2's per-movement down/hold/up chips solve it better and work
for every session type without extra structure.

- Remove the variant switcher UI. One button per session type: Legs, Push, Pull.
- Remove `SESSION_VARIANTS` and the `weight` overlay mechanism it introduced.
- **Historical records must still render.** Sessions from Aug 3 and Aug 7 carry
  `variant: "A"`. Do not delete or rewrite that field in `sessions.json`. If a
  record has a variant, history may display it as a small label; it must not
  crash on records without one.
- Rest target becomes **per session type** rather than per variant:

| Session | Rest target |
|---|---|
| Legs | `Opener 2–2.5 min · accessories 60s` |
| Push | `Opener 2 min · supersets 45–60s` |
| Pull | `Opener 2 min · supersets 45–60s` |

A future "lighter day" needs no code: it is a session where most movements are
set to `down`. Because Phase 2 records the chip choice per movement, such
sessions can be labelled retroactively from data.

---

## PHASE 2 — target picker (the core change)

Replace the pre-filled-from-`current` behavior with an explicit weight choice
that generates the ramp.

### UI

Each movement, before any sets are logged, shows **three weight chips**:

```
Cable Curl                              Biceps ▸
   [ 42.5 ]   [ 47.5 ]★  [ 52.5 ]
    down       hold        up
```

- Left = one increment **down**, middle = **hold** at current working weight,
  right = one increment **up**.
- Exactly one chip carries a **suggested** highlight (see rules below).
- Tapping a chip generates the full set ramp and fills the defaults.
- Chips remain visible and re-tappable until a set is logged. After that,
  changing requires the same confirmation pattern used elsewhere: targets change,
  logged sets are preserved.
- Labels under the chips are `down` / `hold` / `up`.

### Increments

Machine-determined and stable, so configure explicitly per movement rather than
inferring. Add an `increment` field (number) or, for irregular dumbbell
progressions, a `steps` array of available weights.

Known values from history:

| Movement | Increment |
|---|---|
| Leg Press, Leg Extension, Leg Curl | 15 |
| Chest Press, Pec Fly, Shoulder Press | 15 |
| Seated Row, Lat Pulldown | 15 |
| Goblet Squat, Calf Raise | 5 |
| Rope Pushdown, Cable Curl | 5 |
| DB Row, Skull Crusher, Hammer Curl, Zottman Curl | 5 |
| Lateral Raise | steps: `[12, 15, 20, 25]` |

### Current working weight

Derived from history, not from `BLOCK.current`: the **heaviest weight completed at
target reps in the most recent session** containing that movement. If the movement
has never been logged, fall back to `BLOCK.current`.

### Ramp generation

The established pattern across the log is, for a target `T` and increment `i`:

```
[ T-2i,  T-i,  T-i,  T,  T ]
```

- Set count comes from **history** — the modal number of sets across the last
  three sessions containing that movement (e.g. Leg Press 5, Skull Crusher 4,
  Calf Raise 3).
- With fewer sets, drop build sets first, then warmups; never drop below one
  working set at `T`.
- Reps default to the movement's configured `reps`.
- Never generate a negative or below-minimum weight; clamp at the lowest
  available increment.

### Suggestion rules

Evaluate against the last two sessions containing the movement:

| Condition | Suggest |
|---|---|
| Both sessions hit target reps at RPE ≤7 | **up** |
| Last session hit target reps at RPE 8 | **hold** |
| Last session missed target reps, or any working set at RPE ≥9 | **down** |
| Fewer than two prior sessions | **hold** |

Positional modifier — queue position materially affects output (documented in
CLAUDE.md):

- Movement in the **first two positions** of the session: keep the suggestion as
  computed.
- Movement in the **last two positions**: downgrade `up` to `hold`. A movement run
  late is not a valid place to attempt a weight increase.

### Persistence

Store on each movement in the session record:
- `targetWeight` — the weight chosen
- `chipChoice` — `"down" | "hold" | "up"`
- `suggested` — which chip was highlighted

This makes suggestion quality auditable (how often is the suggestion accepted?)
and enables retroactive session labelling.

### Coach prose

Demote `target` to a collapsed, tap-to-expand element (e.g. a small `why?`
affordance). Do not show it expanded by default. Keep the text intact — it is
still the reasoning behind the numbers, just no longer the primary surface.

---

## PHASE 3 — superset UI

The program prescribes supersets throughout, but the data model has no concept of
them, so pairing is lost to prose (Aug 8: *"did alternate shoulders: 4 sets 10
raises then quickly into 10 presses"* — which is also why Lateral Raise shows only
2 sets that day).

Implement as an **annotation on the existing flat movement list**. Do not
introduce a nested structure; the flat list and `_order` semantics must be
preserved.

- Each movement card gets a small chain affordance on its lower edge. Tapping it
  links that movement with the one **below** it.
- Linked movements render as a single card with interleaved set rows:

```
┌─ SUPERSET · Lateral Raise + Shoulder Press ──── unlink ─┐
│  Rest: none between · 60s after pair                    │
│  Set 1   Raise  [15] [10] [6]                           │
│          Press  [60] [10] [6]                           │
│  Set 2   Raise  [15] [10] [7]                           │
│          Press  [60] [10] [7]                           │
│  Note: ____________________________                     │
└─────────────────────────────────────────────────────────┘
```

- One rest target for the pair (rest *after* the pair, not between).
- Unlink affordance on the card; unlinking preserves all logged data.
- Data model: a shared `supersetId` on both movement entries. Each movement keeps
  its own sets, weight, chips, and note.
- Each movement in a pair keeps its own target chips from Phase 2.

**Pre-seed the program's intended pairs** so linking is not manual every session —
this is what makes the feature actually get used:

- Pec Fly ⇄ Lateral Raise
- Rope Pushdown ⇄ Skull Crusher
- Cable Curl ⇄ Reverse Fly
- Leg Extension ⇄ Calf Raise

Pre-seeded pairs must be unlinkable like any other.

---

## PHASE 4 — skip button

Movements are currently skipped by logging zero sets plus a freeform note
(*"skipped — in use"*, *"benches weren't open"*). That makes a deliberate skip
indistinguishable from an untouched movement in analysis.

- Add a **skip** action to each movement card.
- On skip, prompt for a reason as tappable chips: `machine in use`, `time`,
  `pain`, `other`. `other` reveals a short text field.
- Persist `skipped: true` and `skipReason` on the movement entry.
- Skipped movements render collapsed with the reason visible, in the session and
  in history.
- Skipping is reversible within the session.
- Include skip counts and reasons in the coach handoff export — repeated skips of
  the same movement are a programming signal.

---

## PHASE 5 — cardio machine default

`machine` came through empty on the Aug 5 record while duration, level, and rpe
were all filled.

- Default `machine` to `Stairmaster`.
- Keep the full dropdown available.

---

## PHASE 6 — docs

- Update CLAUDE.md: remove the session-variants section; document the target
  picker (increments, current-weight derivation, ramp shape, suggestion rules,
  persisted fields), the superset annotation model, skip fields, and the new
  session-record schema.
- Note explicitly that `BLOCK.current` is now a **fallback only** for movements
  with no logged history, and that `BLOCK.target` prose is secondary UI.
- Changelog entry.
- Per the existing rule: any new test script must be registered in
  `scripts/test.js`, not left standalone.

---

## Verification for every phase

- `npm run build && npm test` — all seven checks, both tiers
- Targeted jsdom checks on real flows: start session → tap a target chip → confirm
  the generated ramp matches `[T-2i, T-i, T-i, T, T]` → log sets → link/unlink a
  superset → skip a movement with a reason → finish → assert the persisted record
  shape
- Assert the suggestion rules directly against fixture history, including the
  positional downgrade of `up` to `hold` for late-position movements
- Open the pre-existing `pull` / `May 22, 2026` record (id 39) and the
  `legs` / `Aug 3, 2026` record (which has `variant: "A"`) and confirm both render
  with no crash and no missing-field artifacts
- `git status` — `sessions.json` must never appear

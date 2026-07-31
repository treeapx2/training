# CHANGES.md — work order, Jul 30 2026

Current work order for the training app. Supersedes any earlier version of this
file. Read alongside CLAUDE.md.

Seven phases. Commit after each. Run `npm run build && npm test` before every
commit. Do not push — the owner pushes.

**These phases change behavior.** AST/runtime equivalence with the previous
`index.html` will not hold and should not be expected. Verify each phase with
targeted jsdom checks on the real flows instead.

---

## PHASE 0 — close the stale-artifact hole (do this first)

A stale `index.html` shipped last cycle: all six phases were committed in source,
but `index.html` was never rebuilt, so the live app was unchanged. `npm test`
passed anyway, because it validates whatever `index.html` currently contains —
the old artifact passes all four checks perfectly well.

Fix:

1. Add a fifth check to `npm test`: rebuild the artifact to a temp path and diff
   it against the committed `index.html`. **Fail if they differ.** Message should
   say explicitly that `npm run build` needs to be run.
2. Add a git pre-commit hook that runs `npm run build` and stages `index.html`
   if it changed, so source and artifact cannot diverge.

Do not proceed to Phase 1 until a deliberately stale `index.html` makes
`npm test` fail.

---

## PHASE 1 — generalized session variants (replaces the Legs A/B toggle)

The current implementation is clunky: Legs A and Legs B appear as separate
session options. Restructure so variants live *inside* a session.

**Behavior:**

- Session type list shows **one** "Legs" option (plus Push, Pull). No A/B at
  the selection level.
- Once inside a session, a variant switcher (A / B) adjusts the prescription —
  target weights, rep ranges, set counts, and the rest target.
- Progression state and per-movement `current` weights are **shared across
  variants**, as they are today. Do not split history by variant.

**Accidental-switch protection:**

- Variant is freely switchable while no set data has been entered.
- Once **any** set has a weight or reps logged, switching requires an explicit
  confirmation dialog: changing targets, logged sets are kept, not discarded.
- Never switch on a single stray tap once data exists.

**Scalability — this is the point of the refactor:**

Implement as a generic structure keyed by session type, e.g.
`SESSION_VARIANTS[type] = [{ id, label, rest, movements: {...overrides} }]`.

- Legs gets two variants (A, B).
- Push and Pull get a single default variant now, and **the switcher must not
  render when a type has only one variant.**
- Adding a Push or Pull variant later must require only a data addition to
  `SESSION_VARIANTS`, no structural change.

Persist the selected variant in the session record and in the draft autosave, so
resuming a draft restores the variant and history shows which was performed.

**Variant prescriptions:** see the Legs A/B table at the end of TARGETS.md.

---

## PHASE 2 — rest target in the session header

Show a rest target directly under the session header on session pages. **Nothing
else** — no other information added to the header.

Rest is per session type and variant. Store it on the variant object (`rest`).

| Session | Rest target string |
|---|---|
| Legs A | `Opener 2–2.5 min · accessories 60s` |
| Legs B | `45–75s throughout` |
| Push | `Opener 2 min · supersets 45–60s` |
| Pull | `Opener 2 min · supersets 45–60s` |

---

## PHASE 3 — cardio finisher field rework

Current fields are machine / duration / level / effort, with effort as
easy-moderate-hard. Change to:

1. **Machine** — a dropdown. Label is just `Machine`. No help text.
   Options: `Stairmaster`, `Recumbent bike`, `Spin bike`, `Elliptical`,
   `Treadmill (incline walk)`, `Rower`, `Other`.
2. Beneath the dropdown, three inputs side by side, labeled exactly:
   **`min`**, **`level`**, **`rpe`**. Numeric.
3. **Remove the easy / moderate / hard selector entirely.** RPE replaces it,
   consistent with how strength sets are logged.

**Migration:** existing session records may carry the old `effort` string. Do not
crash on them and do not silently delete them — render an existing `effort`
value in history if present. New entries write `rpe`.

---

## PHASE 4 — one note per exercise

Currently every set has its own note field. Replace with a single note per
exercise, positioned **beneath all of that exercise's sets**.

**Migration matters here.** Historical records have per-set notes containing real
information — for example a `"read heavy cold"` note on a Hammer Curl set from
7/25. Requirements:

- Existing per-set notes must still be **visible in history**. Do not drop them.
- Only the entry UI changes: one note field per exercise going forward.
- Do not destructively migrate `sessions.json`. Reading old shapes gracefully is
  the requirement, not rewriting the data.

---

## PHASE 5 — remove noise

- Remove the help text under the session note field. Keep the field.
- Remove the "unlogged movements" warning.
- Remove the "no set logged" warning.

These are no longer useful — movements are intentionally skipped (machine in use,
deliberate substitution) and the warnings just add friction.

---

## PHASE 6 — last-sync timestamp on the home page

Display the date and time of the last successful sync on the Session (home) tab,
near the sync panel.

- Update on **both** a successful pull and a successful push.
- Extend the existing `at_sync_last` localStorage key rather than adding a new one.
- Format compactly, e.g. `Last synced: Jul 30, 3:42 PM`.
- If there has never been a successful sync, show `Never synced`.

---

## Verification for every phase

- `npm run build && npm test` — all checks including the new Phase 0 staleness check
- Targeted jsdom checks on real flows: start session → switch variant → log sets →
  add exercise note → fill cardio fields → finish → confirm the record shape
- Open a **pre-existing** session record (e.g. `pull` / `May 22, 2026`) and confirm
  it renders with no variant, no cardio fields, and per-set notes intact
- `git status` — `sessions.json` must never appear

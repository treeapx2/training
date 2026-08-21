# CHANGES.md — work order, Aug 19 2026

Supersedes the previous version. Read alongside CLAUDE.md.

Seven phases. Commit after each. `npm run build && npm test` must pass before
every commit. Do not push — the owner pushes.

Every item below comes from a note the owner wrote in the log between Aug 10 and
Aug 19. Quoted notes are the source of truth for intent.

---

## PHASE 1 — free-weight increments are wrong

> *"update this to use the same increments as other free weight exercises (5s up
> to 50 with 12s the only extra weight available)"* — Skull Crusher, Aug 17

The dumbbell rack is 5 lb increments to 50, plus a 12 lb pair. Several movements
are configured with wrong increments, and Skull Crusher in particular has been
bouncing 12 → 15 → 20 because the picker offered unavailable weights.

Set a shared `steps` array for **all dumbbell movements** — Skull Crusher, Hammer
Curl, Zottman Curl, DB Row, Reverse Fly, Lateral Raise, Goblet Squat:

```
[5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50]
```

Chips step through adjacent entries in this array, not by a fixed number.
Machine movements keep their 15 lb (or 5 lb cable) increments.

---

## PHASE 2 — ramp shape must scale with set count

> *"no warmups for a three set exercise"* — Hammer Curl, Aug 15
> *"one weight or two weight pattern when doing machines at 4-sets or less"* —
> Shoulder Press, Aug 11

The `[T-2i, T-i, T-i, T, T]` ramp is correct for 5 sets but wrong for short
movements — it spends warmups the owner doesn't want on 3-set accessories.

| Set count | Generated pattern |
|---|---|
| 5 | `[T-2i, T-i, T-i, T, T]` (unchanged) |
| 4 | `[T-i, T, T, T]` |
| 3 | `[T, T, T]` — no warmups |
| 2 | `[T, T]` |

Confirmed by actual logs: Skull Crusher Aug 17 ran `15×10` four times; Hammer
Curl Aug 19 ran `15×10` three times.

---

## PHASE 3 — superset improvements

Three separate notes:

**3a. Shared weight for free-weight supersets.**

> *"easier to keep the supersets with the same weight so im not going back and
> forth to the rack too often"* — Calf Raise, Aug 10
> *"keeping weights the same for a free weight superset"* — Reverse Fly, Aug 15

When both movements in a superset are dumbbell movements, offer a **single shared
weight** for the pair — one set of chips governing both, rather than two
independent pickers. Include a way to unlink the weights if the owner wants them
different.

**3b. Add superset rounds.**

> *"need ability to add more superset rounds"* — Calf Raise, Aug 16

The merged superset card needs an "add round" action that appends a paired set
row to both movements at once.

**3c. Do not pre-seed machine+machine pairs.**

> *"no supersets with machines out of respect for the gym goers"* — Aug 16
> *"this is the one superset that can include a machine so far"* — Lateral Raise
> ⇄ Shoulder Press, Aug 17

Occupying two machines at once is antisocial in a busy gym. Revise the pre-seeded
pairs:

- **Remove** Leg Extension ⇄ Calf Raise (two machines)
- **Keep** Cable Curl ⇄ Reverse Fly, Rope Pushdown ⇄ Skull Crusher
- **Keep** Lateral Raise ⇄ Shoulder Press — the owner has explicitly endorsed
  this one as the acceptable machine-inclusive pair
- Manual linking of any pair stays available

---

## PHASE 4 — explicit set logging

> *"selecting an RPE should log the set - need for a log button (can still use
> the x to clear)"* — Lat Pulldown, Aug 15

**Confirm intent with the owner before implementing.** The likely reading: an
explicit **Log** button should commit a set, rather than a set being implicitly
complete once an RPE is tapped. The `x` continues to clear a logged set.

Implement as: weight / reps / RPE are editable inputs; a **Log** action commits
the set and visually marks it complete; `x` reverts it to uncommitted. Only
committed sets count toward history-derived calculations.

---

## PHASE 5 — unavailable weight fallback

Four notes in ten days record a wanted weight being unavailable:

> *"15s not available and didnt want to push 20s"* — Aug 11
> *"45s not available"* — Aug 16
> *"20s not available"* — Aug 19

Add a quick action on a movement — e.g. a small `unavailable` affordance next to
the chips — that shifts the whole generated ramp to the nearest available step
**down**, in one tap, without hand-editing every set row.

Record it: persist `substituted: true` when used, so a lighter session caused by
rack availability is distinguishable from a deliberate deload in later analysis.

---

## PHASE 6 — cardio progress tracking

> *"are we tracking stairmaster progress?"* — session note, Aug 17

Cardio has been logged as structured fields since Aug 2 but is never surfaced
beyond the individual session. Add a cardio view (Progress tab is the natural
home):

- Trend of the cardio finisher over time: duration, level, and RPE
- Grouped by machine
- Include cardio in the coach handoff export — currently absent, and the coach
  has been reading it out of session notes

The signal that matters: **output at a given RPE**. Duration and level rising
while RPE stays flat is aerobic progress. Present it so that comparison is
possible.

---

## PHASE 7 — suggestion logic: rep-range awareness

The stored `suggested` vs `chipChoice` fields make the engine auditable. Across
33 movement instances Aug 10–19, the owner accepted the suggestion 21 times
(~64%). The disagreements cluster in one systematic failure:

**The engine treats "missed target reps" as failure, when hitting fewer reps at a
heavier weight is often progress.**

Concrete case. Chest Press, Aug 11: `135×8 @8, 135×5 @9` after a 120→135 jump.
The engine scored that a failure and suggested `down` on Aug 17. But 8 reps at
135 is a genuine strength gain over 10 reps at 120 — the weight simply belongs in
a lower rep range. The owner overrode to `hold` both times. Same for Pec Fly,
which was suggested `down` on Aug 17 and then completed `135×10 @7, ×10 @8` — a
clean pass the engine had advised against.

Required change:

- Treat a working set as **successful** if it reaches the **lower bound of the
  movement's rep range**, not only the target rep count.
- Where a weight was newly increased and reps landed in a lower but respectable
  range (roughly 6–8 for a 10-rep target) at RPE ≤8, suggest **hold** — the load
  is being consolidated — rather than `down`.
- Reserve `down` for genuine failure: reps below the range's lower bound, or any
  working set at RPE ≥9.

Also add, in the same pass:

- Do not fire the positional `up`→`hold` downgrade when the movement is in the
  **first two positions**. (Rope Pushdown, Aug 17, position 3, was suggested
  `hold`; the owner chose `up`. Related note, Aug 11: *"tough to push weight here
  unless we test as the very first exercise"*.)
- Ignore movements marked `substituted` (Phase 5) when deriving current working
  weight — a rack-availability drop should not lower the baseline.

Add a test asserting the Chest Press Aug 11 → Aug 17 fixture yields `hold`, not
`down`.

---

## PHASE 8 — docs

- CLAUDE.md: update the target-picker section for the new step arrays, ramp
  shapes by set count, revised suggestion rules, and the `substituted` field.
  Update the superset section for shared weights, added rounds, and the revised
  pre-seed list. Document the cardio view and the explicit-log behavior.
- Update the session-record schema block with `substituted` and any new fields.
- Changelog entry.
- Register any new test script in `scripts/test.js`.

---

## Verification

- `npm run build && npm test` — all checks, both tiers
- Assert the four ramp shapes (5/4/3/2 sets) generate exactly as tabulated
- Assert dumbbell chips step through the `steps` array including the 12 lb entry
- Assert a free-weight superset shares one weight and that "add round" appends to
  both movements
- Assert the Chest Press rep-range fixture suggests `hold`
- Open legacy records `pull` / `May 22, 2026` (id 39) and `legs` / `Aug 3, 2026`
  (has `variant: "A"`) and confirm both render cleanly
- `git status` — `sessions.json` must never appear

# CHANGES.md — work order, Sep 8 2026

Supersedes the previous version. Read alongside CLAUDE.md.

Eight phases. Commit after each. `npm run build && npm test` must pass before
every commit. Do not push — the owner pushes.

---

## Background: the volume restructure

The owner's framework has been **100 reps per muscle group** — two exercises ×
five sets × ten reps. The current ramp `[T-2i, T-i, T-i, T, T]` delivers those
reps, but only **two of five sets land at working weight**. Effective volume for
hypertrophy is sets taken near failure, so 60% of each movement is warm-up tax.

Measured against the Sep 3 legs session: 23 total sets, ~14 at working weight.

**The correcting insight: warm-up is a per-session need, not a per-movement
need.** Quads do not need re-warming three times inside one legs session. Only
the opener requires a full ramp.

New target: **~20 working sets per session at the same total set count**, inside
a **45-minute lifting budget**. The cardio finisher is a **separate 15-minute
block after** the 45 minutes — it is not inside the lifting budget.

| | Now | After |
|---|---|---|
| Total sets | ~23 | ~24 |
| **Working sets** | ~14 | **~20** |
| Reps at working weight | ~140 | **~200** |
| Working sets per muscle group | 4 | **6–8** |

Time budget for the 45 minutes of lifting, at disciplined rests:

| Slot | Time |
|---|---|
| Movement 1 — 5 sets, rests 60s / 60s / 150s / 150s | ~10.5 min |
| Movement 2 — 4 sets, rests 60s / 120s / 120s | ~7.5 min |
| Movements 3 and 4 — 4 sets, rests 45s / 90s / 90s | ~6.5 min each |
| Superset (movements 5+6) — 4 rounds, 60s after each pair | ~9.5 min |
| **Total** | **~40.5 min** |

That leaves roughly 4 minutes of slack for transitions and waiting on a machine.
Movements 1 and 2 get the longest rests because they carry the progression
attempts; the superset is deliberately dense.

Total reps drop slightly; reps that actually drive adaptation rise ~30%. Answer
to "is 100 reps still the target": no — **60 reps at working weight per muscle
group** replaces it. The owner is already doing this instinctively on
accessories (Lateral Raise, Sep 5: `15×10` four times, no ramp — one of the most
consistent lifts in the log).

---

## PHASE 1 — position-aware ramp generation

Replace the fixed ramp with one that scales by queue position.

| Movement position | Pattern | Sets | Working |
|---|---|---|---|
| Position 1 (opener) | `[T-2i, T-i, T, T, T]` | 5 | 3 |
| Position 2+ | `[T-i, T, T, T]` | 4 | 3 |
| Superset members | `[T, T, T, T]` | 4 | 4 |
| 2-set movements | `[T, T]` | 2 | 2 |

- Position is the movement's index in the session's flat ordered list.
- Reordering a movement should regenerate its ramp accordingly, before sets are
  logged. After sets are logged, use the existing confirm-before-change pattern.
- Supersets never carry warm-up sets — they sit at the end of a session by
  design and the muscle group is already fully warm.

Replaces the Aug 19 set-count table.

---

## PHASE 2 — superset-aware progression (important bug)

**The bug.** Current working weight is derived from the most recent logged
session containing the movement, with no awareness of superset context. But the
owner deliberately (a) matches weights across a free-weight superset to avoid
rack trips, and (b) places supersets at the end of a session precisely so a
muscle group gets finished under fatigue. Sets performed there are intentionally
sub-maximal.

The engine has been reading those as regression:

| Movement | Best logged | Engine's derived current | Cause |
|---|---|---|---|
| Hammer Curl | `25×8×3 @7–8` (Jul 30) | 15 | superset partner, weight-matched |
| Goblet Squat | `50×10 @7` (Jul 29) | 45 | superset partner, weight-matched |

Both movements have had `suggested: up` ignored repeatedly because the baseline
was wrong, not because the owner disagreed.

**Required changes:**

1. **Exclude superset-position sets from working-weight derivation.** A movement
   performed with a `supersetId` must not lower its own baseline. If a movement
   has *only* superset history, fall back to the best non-superset session, then
   to `BLOCK.current`.
2. **Derive current weight from the best qualifying session in the last three**
   containing the movement — the heaviest weight that reached the rep-range lower
   bound — not from the most recent session alone. A one-off dip (rack
   availability, fatigue, late placement) must not reset the baseline.
3. **Exclude `substituted: true` sessions** from derivation (already specified
   Aug 19; confirm it is actually applied).
4. **Break the RPE-8 plateau trap.** The rule "target reps at RPE 8 → hold"
   means a lift parked at RPE 8 can never be suggested up. Seated Row and Lat
   Pulldown have sat at `135×10×2 @ RPE 8` for **seven sessions**, including
   position-1 attempts, so it is not placement. Add: target reps at RPE 8 for
   **three or more consecutive sessions** → suggest `up`. That is consolidation,
   not a ceiling.

Add tests for each: a Hammer Curl fixture with superset-only recent history must
derive 25, not 15; a Seated Row fixture with three RPE-8 sessions must suggest
`up`.

---

## PHASE 3 — session architecture: 3 muscle groups × 2 movements

Formalize the structure the owner is targeting: **three muscle groups per
session, two movements each, one superset per session placed last.**

Default movement lists and group assignments:

**Push** (6 movements)

| # | Movement | Group |
|---|---|---|
| 1 | DB Bench Press | Chest |
| 2 | Pec Fly | Chest |
| 3 | Rope Pushdown | Triceps |
| 4 | Skull Crusher | Triceps |
| 5+6 | Shoulder Press ⇄ Lateral Raise | Shoulders (superset) |

**Pull** (6 movements)

| # | Movement | Group |
|---|---|---|
| 1 | Seated Row | Back |
| 2 | Lat Pulldown | Back |
| 3 | DB Row | Upper back |
| 4 | Reverse Fly | Upper back |
| 5+6 | Cable Curl ⇄ Hammer Curl | Biceps (superset) |

**Legs** (5 movements)

| # | Movement | Group |
|---|---|---|
| 1 | Leg Press | Quads |
| 2 | Leg Extension | Quads |
| 3 | Leg Curl | Posterior |
| 4+5 | Goblet Squat ⇄ Calf Raise | Posterior / Calves (superset) |

**Weekly context** (informs nothing structural in the app, but explains why Push
and Pull need to be repeatable and Legs does not): the owner targets **four gym
days per week**, doubling either Push or Pull, plus **hockey one to two times per
week on unpredictable days**, plus one to two rest or travel days. Legs runs once
per week; skating supplies additional lower-body load.

Notes:

- **Exactly one pre-seeded superset per session**, always in the final slots.
  Remove any other pre-seeded pairs. Manual linking stays available.
- **Zottman Curl is removed from the default Pull list** — skipped three of the
  last four Pull sessions (time, time, "biceps crushed from superset"). Keep it
  available as an optional add, not a default.
- **Chest Press (machine) and DB Bench Press both remain available.** DB Bench
  Press is the current default for the chest slot; Chest Press machine is a
  selectable alternate.

---

## PHASE 4 — full movement library with optional adds

**Every movement ever logged must be available as an optional add**, not just the
current defaults. Twenty-seven distinct movements exist in `sessions.json`.

`DB Bench Press` already exists in history (Apr 6 2026, 45 lb) — it is a
**restore to the library**, not a new movement. It has since been logged twice as
prose inside a zero-set movement note (Aug 27, Sep 5: `30s×10×3 @5–6`,
`35s×10×2 @7`) because it is not currently selectable.

**Requirements:**

1. Add an **add movement** action to any session: pick from the library, or
   define a new movement (name, muscle group, increment or steps array). New
   definitions persist.
2. Seed the library with all 27 historical movements. Defaults per Phase 3;
   everything else is an optional add.

**Current defaults** (18): Leg Press, Leg Extension, Leg Curl, Goblet Squat,
Calf Raise, DB Bench Press, Pec Fly, Rope Pushdown, Skull Crusher,
Shoulder Press, Lateral Raise, Seated Row, Lat Pulldown, DB Row, Reverse Fly,
Cable Curl, Hammer Curl, Chest Press (alternate for the chest slot).

**Optional adds** (9), with last-logged date and max weight for reference:

| Movement | Last logged | Max |
|---|---|---|
| Zottman Curl | Sep 7 2026 | 20 |
| OHE (overhead extension) | May 15 2026 | 20 |
| Shoulder Press (DB) | May 15 2026 | 70 |
| RDL | Apr 24 2026 | 25 |
| Glute Bridge | Apr 24 2026 | 35 |
| DB Bench Press | Apr 6 2026 | 45 |
| Incline DB Press | Mar 29 2026 | 40 |
| Flat DB Press | Mar 29 2026 | 45 |
| Floor Press | Mar 16 2026 | 35 |
| Rows | Mar 16 2026 | 35 |

Several of these are from an earlier home-gym setup and may not be performable at
the current gym; list them regardless — the owner decides, not the app.

3. **Dumbbell weights are per-hand.** The owner logs "35s" meaning 35 lb in each
   hand. Label the weight field so this is unambiguous, and keep it consistent
   across all dumbbell movements.
4. **Do not merge or rename historical movements.** `Rows` and `DB Row`,
   `Flat DB Press` and `DB Bench Press`, `Shoulder Press` and
   `Shoulder Press (DB)` may overlap in practice, but merging would rewrite
   history. Surface them as distinct and leave consolidation to the owner.

---

## PHASE 5 — session timer

> *"would be helpful to automatically start a timer when a session is selected —
> would need pause and resume functionality and a record of the total workout
> time — this would be for the full session"* — Cable Curl note, Aug 26

- Timer starts automatically when a session is started.
- Pause and resume, with the paused state surviving app backgrounding and
  reload (persist to the draft, not just in memory).
- Elapsed time visible in the session header, alongside the rest target.
- Total elapsed persists on the finished session record (`durationMin` or
  similar) and appears in history.
- Target is **45 minutes of lifting**, with the cardio finisher as a separate
  ~15-minute block afterward. Optionally surface a subtle indicator as the
  45-minute mark is approached — no alarms, no blocking.
- Ideally track the lifting time and the cardio time separately, so the 45/15
  split is visible rather than a single 60-minute total.
- Include session duration in the coach handoff export.

---

## PHASE 6 — chart windowing

Charts are unreadable as history grows; date labels are overlapping.

- Default each chart to the most recent **12 data points**, with a pan control to
  move further back.
- **Window by data points, not calendar dates** — for a per-movement chart, 12
  means 12 sessions *containing that movement*. Twelve calendar sessions is only
  about four legs sessions, which would make leg charts far sparser than cardio
  charts.
- Add range presets (`12` / `25` / `all`) alongside the pan control. The
  zoomed-out view answers "am I trending up over months", which the windowed view
  cannot.
- Applies to per-movement progression charts and the cardio trend view.

---

## PHASE 7 — cardio skip and substitution

Cardio was skipped entirely on Aug 25 (`"stairmaster taken"`) rather than
substituted, losing the finisher for that session.

- Allow cardio to be **skipped with a reason**, matching the movement skip
  pattern, so a missing finisher is distinguishable from an untracked one.
- When a machine is unavailable, make substitution one tap: the machine dropdown
  already exists, so surface it prominently rather than requiring the owner to
  abandon the entry.
- Record which machine was actually used (already stored) so the cardio trend can
  group by machine.

---

## PHASE 8 — docs

- CLAUDE.md: replace the ramp-shape section with the position-aware table;
  document superset-aware derivation and the RPE-8 plateau rule; document the
  3-groups × 2-movements architecture and the one-superset-per-session rule;
  document DB Bench Press, the movement library, the session timer, chart
  windowing, and cardio skip.
- Update the session-record schema for `durationMin` and any new fields.
- Note that the "100 reps per muscle group" target is superseded by "~6 working
  sets per muscle group".
- Changelog entry. Register any new test script in `scripts/test.js`.

---

## Verification

- `npm run build && npm test` — all checks, both tiers
- Assert all four ramp patterns generate exactly as tabulated, and that changing
  a movement's position regenerates its ramp
- Assert the Hammer Curl superset-history fixture derives 25, not 15
- Assert the Seated Row three-consecutive-RPE-8 fixture suggests `up`
- Assert exactly one pre-seeded superset per session type, in the final slots
- Assert the timer survives a reload mid-session with its paused state intact
- Assert per-movement chart windowing counts sessions containing that movement
- Open legacy records `pull` / `May 22, 2026` (id 39) and `legs` / `Aug 3, 2026`
  (has `variant: "A"`) and confirm both render cleanly
- `git status` — `sessions.json` must never appear

# BLOCK targets — update as of Jul 30, 2026

Replace the entire `BLOCK` object in the app source with the version below.
All `current` / `target` / `flags` strings are authored content — use them verbatim.

## What changed and why

| Movement | Was | Now | Evidence |
|---|---|---|---|
| Leg Press | 170, TEST 185 | **185**, bank at RPE 7 → 200 | 185×10×2 @ RPE 8 (7/29) — test passed at rep ceiling |
| Leg Extension | 150, HOLD | **TEST 165** | Broke the 8-rep wall: 10×2 @ RPE 8 (7/26), then @ RPE 7 (7/29) |
| Leg Curl | 90, HOLD, hamstring-gated | **90, confirm once → 105** | Clean 10s on 7/26 and 7/29, no low-back compensation |
| Goblet Squat | 45, TEST 50 | **50**, 2 clean → 55 | 50×10 @ RPE 7 then 8 (7/29) |
| Calf Raise | 35, TEST 40 | **TEST 45** | 40×20×3 @ RPE 6–7 (7/29) |
| Chest Press | 120, build 2nd clean | **TEST 135** | 120×10×2 @ RPE 7–8 as fresh opener (7/28) |
| Pec Fly | 120, build | **TEST 135** | 120×10×2 @ RPE 7 (7/28) |
| Skull Crusher | 20, HOLD | **TEST 25** | 20×10×4 @ RPE 6–7 (7/28) |
| Shoulder Press | 90, confirm | **HOLD 90, needs fresh lead** | Dropped to 75×8 @ RPE 8 when run 2nd (7/28) — placement artifact |
| Lateral Raise | 15, build | **15, run earlier** | 12×10×4 hit RPE 8 at position #4 (7/28) |
| Cable Curl | 42.5, confirm | **TEST 47.5** | Two clean sessions @ 42.5 (7/4, 7/25) |
| Reverse Fly | 15, build | **TEST 20** | 15×10×3 all @ RPE 6 (7/25) |
| DB Row | 50, build | **50** (unchanged) | 45×10 @ RPE 7 as fresh opener (7/25) |

Flag changes: hamstring/low-back downgraded to resolved-monitor. Hockey still
suspended; weekly tennis added. Aerobic intensity restriction lifted. Legs A/B
and stairmaster finisher policy documented.

## The object

```js
const BLOCK = {
  flags: [
    "ON BLOOD THINNERS (PE precaution, likely false positive) — NO contact or fall-risk activity. No failure/grinding reps: strains bruise and bleed more. Keep working sets RPE \u22648; a 'test' is a controlled top set leaving 2+ in reserve. No restriction on aerobic conditioning.",
    "Hockey SUSPENDED. Weekly TENNIS is the skating-prep substitute (repeated-sprint + lateral movement). Ease in — 60 min hitting, not hard competitive singles.",
    "LEGS A/B: A = heavy 8-10, quad emphasis. B = higher-rep 12-15, posterior emphasis (Leg Press ~140-155, Leg Curl ~75). Keep \u226548h apart.",
    "STAIRMASTER FINISHER on every session. Hard on push/pull days (12-15 min, L4-5 steady). EASY on legs days (8-10 min, L2-3) — don't tax what you just trained. Build duration before level. Change ONE variable at a time.",
    "PROGRESSION VALIDITY: run the lift you want to advance FIRST, while fresh. Reps logged late in a session are fatigue artifacts, not regressions. Confirmed repeatedly: shoulder press 90\u219275 and lateral raise RPE 8 both came from queue position, not loss of strength.",
    "Groin asymmetry (L>R) — daily butterfly + lateral lunge holds. Extra relevant now that tennis is in: adductor strain is the classic first-week-back injury.",
    "Left knee below patella — monitor all squat/hinge. Bilateral leg press only. Bail on Leg Press or Goblet if it bites.",
    "Hamstring / low back — RESOLVED, keep monitoring. Leg Curl 90 collapsed to 6 reps with low-back compensation on 7/22, then hit clean 10s on both 7/26 and 7/29. Keep foam rolling before legs; stop the set if the back starts taking over.",
    "Thumb — watch on Shoulder Press; prior 75 ceiling, now clean at 90.",
    "Elbow — Skull Crusher pull/stretch is normal adaptation; sharp pain is a stop signal.",
    "Core stack on any non-lifting day: dead bug, bird dog, side plank, Pallof press, RKC plank."
  ],
  sessions: {
    legs: {
      label: "Legs",
      color: "#3B6D11",
      bg: "#EAF3DE",
      movements: [
        { name: "Leg Press", current: "185 lb", workSets: 3, reps: 10, target: "BANK 185 at RPE 7 \u2014 test passed 7/29 (185x10x2 @ RPE 8) but that's the rep ceiling. Two clean sessions at RPE 7, then TEST 200. Fresh opener, straight sets, 2-2.5 min rest." },
        { name: "Leg Extension", current: "150 lb", workSets: 2, reps: 10, target: "TEST 165 \u2014 broke the 8-rep wall: 150x10x2 @ RPE 8 (7/26) then @ RPE 7 (7/29). The old plateau was fatigue placement, not a ceiling." },
        { name: "Leg Curl", current: "90 lb", workSets: 2, reps: 10, target: "One more clean 10x10 @ 90, RPE \u22647, then TEST 105. Low-back compensation resolved (clean 7/26 and 7/29). Stop the set if the back takes over." },
        { name: "Goblet Squat", current: "50 lb", workSets: 2, reps: 10, target: "Two clean sessions at 50 (10 @ RPE 7 then 8 on 7/29), then 55. Controlled depth, knee-monitor." },
        { name: "Calf Raise", current: "40 lb", workSets: 3, reps: 15, target: "TEST 45 \u2014 40x20x3 @ RPE 6-7 (7/29) was the easiest pass of the day. Superset with Leg Extension." }
      ]
    },
    push: {
      label: "Push",
      color: "#185FA5",
      bg: "#E6F1FB",
      movements: [
        { name: "Chest Press", current: "120 lb", workSets: 2, reps: 10, target: "TEST 135 \u2014 second clean 10/10 @ RPE 7-8 as fresh opener (7/28). Run this FIRST." },
        { name: "Shoulder Press", current: "90 lb", workSets: 2, reps: 10, target: "HOLD 90 \u2014 needs a FRESH lead to confirm. Hit 90x10x2 when run first (7/5), dropped to 75x8 @ RPE 8 when run second (7/28). Confirm then 105. Thumb watch." },
        { name: "Pec Fly", current: "120 lb", workSets: 2, reps: 10, target: "TEST 135 \u2014 120x10x2 @ RPE 7 (7/28), room to spare. Superset with Lateral Raise." },
        { name: "Rope Pushdown", current: "42.5 lb", workSets: 2, reps: 10, target: "Confirm 2nd clean 10/10 @ 42.5 then 47.5. Skipped 7/28 (machine in use). Superset with Skull Crusher." },
        { name: "Lateral Raise", current: "15 lb", workSets: 2, reps: 12, target: "Back to 15 and run EARLIER \u2014 12x10x4 reached RPE 8 at position #4 (7/28). 15x10x2 already done 7/5." },
        { name: "Skull Crusher", current: "20 lb", workSets: 2, reps: 10, target: "TEST 25 \u2014 20x10x4 @ RPE 6-7 (7/28), elbow quiet. Sharp pain = stop." }
      ]
    },
    pull: {
      label: "Pull",
      color: "#3C3489",
      bg: "#EEEDFE",
      movements: [
        { name: "DB Row", current: "50 lb", workSets: 2, reps: 10, target: "Build 8-10 @ 50 \u2014 45x10 @ RPE 7 as fresh opener (7/25), best DB Row log to date. Keep LEADING the session with this; it's fatigue-sensitive." },
        { name: "Seated Row", current: "135 lb", workSets: 2, reps: 10, target: "Back to 135 \u2014 build clean 10/10 then 150. (7/25 was a deliberate deload to 120x10x2 @ RPE 7 on upper re-entry, not a regression.)" },
        { name: "Lat Pulldown", current: "135 lb", workSets: 2, reps: 10, target: "Confirm 2nd clean 10/10 @ 135 (7/13 clean) then 150." },
        { name: "Cable Curl", current: "42.5 lb", workSets: 2, reps: 10, target: "TEST 47.5 \u2014 two clean sessions at 42.5 (7/4, and 7/25 4x10 @ RPE 6-7). Superset with Reverse Fly." },
        { name: "Hammer Curl", current: "20 lb", workSets: 2, reps: 10, target: "HOLD 20 \u2014 read heavy cold (7/25: 20x8 @ RPE 8, dropped to 15). TEST 25 only on a day this LEADS the session." },
        { name: "Zottman Curl", current: "20 lb", workSets: 2, reps: 10, target: "Chase 10 reps @ 20 (stuck at 6) \u2014 slow eccentric." },
        { name: "Reverse Fly", current: "15 lb", workSets: 2, reps: 12, target: "TEST 20 for 8s \u2014 15x10x3 all @ RPE 6 (7/25) clears the consistency gate." }
      ]
    }
  }
};
```

## Legs A/B note for whoever implements the toggle

Legs A and Legs B share the same five movements and the same `current` weights.
They differ only in prescription:

| | Legs A | Legs B |
|---|---|---|
| Leg Press | 185, 8-10 reps, 3 sets | ~140-155, 12-15 reps, 3 sets |
| Leg Curl | 90, 8-10, 2 sets | ~75, 12, 3 sets |
| Leg Extension | 150, 10-12, 2 sets | 150 or lighter, 15, 2 sets |
| Goblet Squat | 50, 10, 2 sets | 45-50, 12-15, 2 sets |
| Calf Raise | 40, 12-15, 3 sets | 40, 15-20, 3 sets |
| Rest | 2-2.5 min on opener | 45-75s throughout |
| Finisher | 8-10 min @ L2-3 easy | 8-10 min @ L3 easy |

So a variant toggle on the existing `legs` type is a reasonable implementation —
same movement list and progression state, different `workSets` / `reps` /
target-weight guidance. A fully separate session type also works; the constraint
is that both variants must share progression history for a given movement,
because `current` weights and clean-session counts are per-movement, not per-variant.

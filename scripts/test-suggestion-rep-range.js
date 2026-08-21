#!/usr/bin/env node
// Behavioral jsdom check for rep-range-aware suggestions (see CLAUDE.md
// "Target picker" — CHANGES.md Aug 19 2026, Phase 7). Registered as
// validation bar check #17; also runnable alone via
// `npm run test:suggestion-rep-range`.
//
// Across 33 movement instances Aug 10-19 the engine's suggestion clustered
// one systematic failure: treating "missed the exact target rep count" as
// failure, when fewer reps at a heavier weight is often genuine progress.
//
// Covers:
//   - The named fixture: Chest Press, Aug 11 (135x8 @8, 135x5 @9, after a
//     120->135 jump) must yield "hold", not "down", when evaluated on
//     Aug 17.
//   - A fresh weight jump landing below the floor but in the
//     "consolidation" range (roughly target-4..target-2 reps) at RPE<=8
//     still yields "hold".
//   - The same shortfall at the SAME weight (no fresh jump) yields "down"
//     -- the consolidation carve-out is jump-specific.
//   - Reps below even the consolidation floor, or RPE>=9, still yield
//     "down" regardless of a fresh jump.
//   - The positional up->hold downgrade never fires in the first two
//     positions, even when total is small enough that "first two" and
//     "last two" would otherwise overlap.
//   - A movement marked substituted is ignored entirely when deriving
//     current working weight -- the baseline falls back to the last
//     non-substituted session, not the lighter substituted one.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

async function mount() {
  const html = fs.readFileSync(indexPath, "utf8");
  const dom = new JSDOM(html, {
    url: "https://example.invalid/",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  }
  await new Promise((r) => window.setTimeout(r, 100));
  return { window };
}

// One session's worth of a movement's sets: earlier sets are lighter
// warmup/build filler, the last set is the "working" top-weight attempt
// (matching how a real ramp is logged) -- unless `extraTopSet` adds a
// SECOND set at the same top weight (the Chest Press fixture's fatigue
// backoff set).
function session(date, weight, reps, rpe, totalSets, extraTopSet) {
  const sets = [];
  for (let i = 0; i < totalSets; i++) {
    const isLast = i === totalSets - 1;
    sets.push({
      set: i + 1,
      weight: String(isLast ? weight : Math.max(weight - 15, 15)),
      reps: String(isLast ? reps : 10),
      rpe: isLast ? String(rpe) : "",
      note: "",
    });
  }
  if (extraTopSet) {
    sets.push({ set: totalSets + 1, weight: String(weight), reps: String(extraTopSet.reps), rpe: String(extraTopSet.rpe), note: "" });
  }
  return { id: date.length, type: "push", label: "Push", date, note: "", movements: [{ name: "Chest Press", sets, note: "", order: 0 }] };
}

async function checkChestPressFixtureYieldsHoldNotDown() {
  const { window } = await mount();
  // Aug 4: 120x10 @7 (the pre-jump baseline).
  // Aug 11: 120->135 jump. First top-weight set 135x8 @8 (a pass against
  // the 8-rep floor), second top-weight set 135x5 @9 (fatigue backoff) --
  // the FIRST set is what the session should be scored on.
  const history = [
    session("Aug 4, 2026", 120, 10, 7, 5),
    session("Aug 11, 2026", 135, 8, 8, 5, { reps: 5, rpe: 9 }),
  ];
  const result = window.suggestChip(history, "Chest Press", 10);
  console.log("Chest Press Aug 11 -> Aug 17 suggestion:", result);
  if (result !== "hold") {
    throw new Error(`expected 'hold' for the Chest Press Aug 11 fixture, got '${result}'`);
  }
  console.log("PASS: the Chest Press Aug 11 fixture (135x8 @8, 135x5 @9 after a 120->135 jump) yields hold, not down");
  window.close();
}

async function checkFreshJumpInConsolidationRangeYieldsHold() {
  const { window } = await mount();
  // 120 -> 135 jump, landing at 7 reps (below the 8-rep floor, but within
  // the target-4..target-2 = 6-8 consolidation range) at RPE 7.
  const history = [
    session("Aug 4, 2026", 120, 10, 7, 5),
    session("Aug 11, 2026", 135, 7, 7, 5),
  ];
  const result = window.suggestChip(history, "Chest Press", 10);
  if (result !== "hold") {
    throw new Error(`expected 'hold' for a fresh jump landing in the consolidation range, got '${result}'`);
  }
  console.log("PASS: a fresh weight jump landing in the 6-8 consolidation range at RPE<=8 yields hold");
  window.close();
}

async function checkSameShortfallWithoutAJumpYieldsDown() {
  const { window } = await mount();
  // Same 7-rep/RPE7 shortfall as above, but the weight did NOT change
  // between sessions -- the consolidation carve-out is jump-specific, so
  // this should be a genuine down.
  const history = [
    session("Aug 4, 2026", 135, 10, 7, 5),
    session("Aug 11, 2026", 135, 7, 7, 5),
  ];
  const result = window.suggestChip(history, "Chest Press", 10);
  if (result !== "down") {
    throw new Error(`expected 'down' for the same shortfall with no fresh weight jump, got '${result}'`);
  }
  console.log("PASS: the same rep shortfall at an unchanged weight (no fresh jump) still yields down");
  window.close();
}

async function checkBelowConsolidationFloorOrHighRpeStillYieldsDown() {
  const { window } = await mount();
  // Below even the consolidation floor (5 reps < 6) despite a fresh jump.
  let history = [session("Aug 4, 2026", 120, 10, 7, 5), session("Aug 11, 2026", 135, 5, 7, 5)];
  let result = window.suggestChip(history, "Chest Press", 10);
  if (result !== "down") throw new Error(`expected 'down' below the consolidation floor even with a fresh jump, got '${result}'`);

  // Within the consolidation range (7 reps) but RPE 9 -- genuine failure.
  history = [session("Aug 4, 2026", 120, 10, 7, 5), session("Aug 11, 2026", 135, 7, 9, 5)];
  result = window.suggestChip(history, "Chest Press", 10);
  if (result !== "down") throw new Error(`expected 'down' at RPE>=9 even within the consolidation range, got '${result}'`);
  console.log("PASS: reps below the consolidation floor, or RPE>=9, still yield down despite a fresh jump");
  window.close();
}

async function checkPositionalDowngradeNeverFiresInFirstTwoPositions() {
  const { window } = await mount();
  // Small total where "first two" and "last two" would otherwise overlap
  // -- position 0 of a 2-movement session is also, trivially, in the
  // "last two". The first-two guard must win.
  if (window.applyPositionalDowngrade("up", 0, 2) !== "up") {
    throw new Error("position 0 of a 2-movement session should keep 'up' despite overlapping with 'last two'");
  }
  if (window.applyPositionalDowngrade("up", 1, 3) !== "up") {
    throw new Error("position 1 of a 3-movement session should keep 'up' despite overlapping with 'last two'");
  }
  // Sanity: position 2 of a 3-movement session (not in the first two, and
  // is in the last two) still downgrades as before.
  if (window.applyPositionalDowngrade("up", 2, 3) !== "hold") {
    throw new Error("position 2 of a 3-movement session (last two, not first two) should still downgrade to 'hold'");
  }
  console.log("PASS: the positional up->hold downgrade never fires in the first two positions, even for a small total");
  window.close();
}

async function checkSubstitutedMovementIgnoredForBaseline() {
  const { window } = await mount();
  const history = [
    session("Aug 4, 2026", 135, 10, 7, 5),
    // Aug 11: rack was short 15s, substituted down to 120 -- must not
    // become the new baseline.
    {
      id: 99,
      type: "push",
      label: "Push",
      date: "Aug 11, 2026",
      note: "",
      substituted: true,
      movements: [
        {
          name: "Chest Press",
          substituted: true,
          sets: [{ set: 1, weight: "120", reps: "10", rpe: "6", note: "" }],
          note: "",
          order: 0,
        },
      ],
    },
  ];
  const mov = { name: "Chest Press", reps: 10, increment: 15, current: "120 lb" };
  const current = window.deriveCurrentWeight(history, mov);
  console.log("deriveCurrentWeight with a substituted session in between:", current);
  if (current !== 135) {
    throw new Error(`expected the substituted session to be ignored (baseline stays 135), got ${current}`);
  }
  console.log("PASS: a movement marked substituted is ignored when deriving current working weight");
  window.close();
}

async function main() {
  await checkChestPressFixtureYieldsHoldNotDown();
  await checkFreshJumpInConsolidationRangeYieldsHold();
  await checkSameShortfallWithoutAJumpYieldsDown();
  await checkBelowConsolidationFloorOrHighRpeStillYieldsDown();
  await checkPositionalDowngradeNeverFiresInFirstTwoPositions();
  await checkSubstitutedMovementIgnoredForBaseline();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

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

// A probe set above the owner's own recorded targetWeight is not the
// session's verdict (Oct 12 2026 notes review). The real Oct 5 2026 shape:
// Seated Row ran four sets up to 150 cleanly and then one 165x5 @ RPE 9 to see
// whether the next step was there. The engine scored the session "165, 5 reps,
// RPE 9", fired the RPE>=9 down rule, and put Oct 10's star on 135 — two steps
// below a weight that had never failed. "not sure why we targeted 135 - need
// to hit at least 150 on the seated rows and lat pulldowns from now on."
async function checkProbeAboveTargetWithholdsUpInsteadOfForcingDown() {
  const { window } = await mount();

  // A completed session at the planned 150, plus one failed attempt at 165.
  const probeSession = (date) => ({
    id: date.length, type: "pull", label: "Pull", date, note: "",
    movements: [{
      name: "Seated Row", note: "", order: 0, targetWeight: 150, chipChoice: "hold",
      sets: [
        { set: 1, weight: "135", reps: "10", rpe: "6", note: "" },
        { set: 2, weight: "150", reps: "10", rpe: "7", note: "" },
        { set: 3, weight: "150", reps: "10", rpe: "7", note: "" },
        { set: 4, weight: "150", reps: "10", rpe: "8", note: "" },
        { set: 5, weight: "165", reps: "5", rpe: "9", note: "" },
      ],
    }],
  });
  const clean = (date, weight) => ({
    id: date.length, type: "pull", label: "Pull", date, note: "",
    movements: [{
      name: "Seated Row", note: "", order: 0, targetWeight: weight, chipChoice: "hold",
      sets: [1, 2, 3].map((n) => ({ set: n, weight: String(weight), reps: "10", rpe: "7", note: "" })),
    }],
  });

  const hist = [probeSession("Oct 5, 2026"), clean("Sep 29, 2026", 150)];
  const sums = window.movementSessionSummaries(hist, "Seated Row", 10);

  // The session is scored on the planned weight that was actually worked.
  if (sums[0].topWeight !== 150 || sums[0].topReps !== 10 || sums[0].topRpe !== 7) {
    throw new Error(`the probe session must be scored on the worked 150x10 @7, got ${sums[0].topWeight}x${sums[0].topReps} @${sums[0].topRpe}`);
  }
  if (!sums[0].hitFloor) throw new Error("a completed session at the planned weight must read as a pass");
  if (sums[0].probeWeight !== 165) {
    throw new Error(`the probe must be recorded as 165, got ${sums[0].probeWeight}`);
  }
  console.log("PASS: a set above targetWeight is scored as a probe, not as the session's top weight");

  // The baseline is the worked weight, never the failed probe.
  const mov = { name: "Seated Row", reps: 10, increment: 15, current: "135 lb" };
  if (window.deriveCurrentWeight(hist, mov) !== 150) {
    throw new Error(`expected a 150 baseline, got ${window.deriveCurrentWeight(hist, mov)}`);
  }

  // And the call is `hold`, not `down` (the old bug) and not `up` (the probe
  // is evidence 165 is not there yet) — two clean 150x10 @7 sessions would
  // otherwise satisfy the up rule outright.
  const got = window.suggestChip(hist, "Seated Row", 10);
  if (got !== "hold") {
    throw new Error(`expected hold after a failed probe above target, got ${got}`);
  }
  console.log("PASS: a failed probe withholds up rather than forcing down");

  // Without the probe, those same two sessions DO suggest up — so the
  // withholding is the probe's doing, not an unrelated block.
  const noProbe = [clean("Oct 5, 2026", 150), clean("Sep 29, 2026", 150)];
  if (window.suggestChip(noProbe, "Seated Row", 10) !== "up") {
    throw new Error("two clean sessions at target and RPE<=7 must still suggest up");
  }
  console.log("PASS: the same history without a probe still suggests up");

  // A heavier single set that CLEARS the floor is not a probe — it is a new
  // top weight and must count.
  const cleared = JSON.parse(JSON.stringify(probeSession("Oct 5, 2026")));
  cleared.movements[0].sets[4] = { set: 5, weight: "165", reps: "10", rpe: "7", note: "" };
  const clearedSums = window.movementSessionSummaries([cleared, clean("Sep 29, 2026", 150)], "Seated Row", 10);
  if (clearedSums[0].probeWeight != null || clearedSums[0].topWeight !== 165) {
    throw new Error(`a heavier set that clears the floor is a new top weight, got ${clearedSums[0].topWeight} probe=${clearedSums[0].probeWeight}`);
  }
  console.log("PASS: a heavier set that clears the rep floor counts as a new top weight, not a probe");

  // Two sets above target is not one probe — that is a session that drifted
  // heavy, and its failure is real.
  const drifted = JSON.parse(JSON.stringify(probeSession("Oct 5, 2026")));
  drifted.movements[0].sets.push({ set: 6, weight: "165", reps: "4", rpe: "9", note: "" });
  const driftedSums = window.movementSessionSummaries([drifted, clean("Sep 29, 2026", 150)], "Seated Row", 10);
  if (driftedSums[0].probeWeight != null) {
    throw new Error("two sets above target must not read as a single probe");
  }
  if (window.suggestChip([drifted, clean("Sep 29, 2026", 150)], "Seated Row", 10) !== "down") {
    throw new Error("a session that drifted heavy and failed twice still yields down");
  }
  console.log("PASS: two failed sets above target is a real failure, not a probe");

  // A record with no targetWeight at all (anything before the target picker,
  // Aug 10 2026) keeps its old scoring.
  const legacy = JSON.parse(JSON.stringify(probeSession("Oct 5, 2026")));
  delete legacy.movements[0].targetWeight;
  const legacySums = window.movementSessionSummaries([legacy, clean("Sep 29, 2026", 150)], "Seated Row", 10);
  if (legacySums[0].probeWeight != null || legacySums[0].topWeight !== 165) {
    throw new Error("a record with no targetWeight must keep its original scoring");
  }
  console.log("PASS: records predating the target picker are scored exactly as before");
  window.close();
}

// The live log, not a fixture: both movements the Oct 10 note named must now
// sit at 150 and hold there.
async function checkOct5ProbeInTheCommittedLog() {
  const { window } = await mount();
  const hist = JSON.parse(fs.readFileSync(path.join(repoRoot, "sessions.json"), "utf8"));
  [["Seated Row", 15], ["Lat Pulldown", 15]].forEach(([name, increment]) => {
    const sums = window.movementSessionSummaries(hist, name, 10);
    const oct5 = sums.find((x) => x.date === "Oct 5, 2026");
    if (!oct5) throw new Error(`no Oct 5 session found for ${name}`);
    if (oct5.probeWeight !== 165) {
      throw new Error(`${name} Oct 5 should record a 165 probe, got ${oct5.probeWeight}`);
    }
    if (oct5.topWeight !== 150 || !oct5.hitFloor) {
      throw new Error(`${name} Oct 5 should score as a clean 150, got ${oct5.topWeight} floor=${oct5.hitFloor}`);
    }
    const derived = window.deriveCurrentWeight(hist, { name, reps: 10, increment, current: "135 lb" });
    if (derived !== 150) {
      throw new Error(`${name} should derive 150 ("need to hit at least 150 ... from now on"), got ${derived}`);
    }
    const call = window.suggestChip(hist, name, 10);
    if (call === "down") {
      throw new Error(`${name} must not suggest down off a probe session`);
    }
    console.log(`PASS: ${name} derives 150 and suggests ${call} against the committed log`);
  });
  window.close();
}

async function main() {
  await checkChestPressFixtureYieldsHoldNotDown();
  await checkFreshJumpInConsolidationRangeYieldsHold();
  await checkSameShortfallWithoutAJumpYieldsDown();
  await checkBelowConsolidationFloorOrHighRpeStillYieldsDown();
  await checkPositionalDowngradeNeverFiresInFirstTwoPositions();
  await checkSubstitutedMovementIgnoredForBaseline();
  await checkProbeAboveTargetWithholdsUpInsteadOfForcingDown();
  await checkOct5ProbeInTheCommittedLog();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

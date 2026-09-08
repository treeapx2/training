#!/usr/bin/env node
// Behavioral jsdom check for superset-aware progression (see CLAUDE.md
// "Target picker" — CHANGES.md Sep 8 2026, Phase 2). Registered as
// validation bar check #18; also runnable alone via
// `npm run test:superset-progression`.
//
// Two real bugs, both of which made the engine read a deliberate choice as a
// regression:
//
//   1. Current working weight came from the most recent logged session with
//      no awareness of superset context. But the owner matches weights across
//      a free-weight superset (to avoid rack trips) and places supersets last
//      (to finish a muscle group under fatigue) — those sets are
//      intentionally sub-maximal. Hammer Curl's best is 25, yet a
//      weight-matched superset round at 15 was setting the baseline, so its
//      repeated `suggested: up` pointed at 20 instead of 30.
//   2. "Target reps at RPE 8" satisfied no rule — not the up rule (RPE <= 7
//      twice) and no down rule — so a lift parked there could never be
//      suggested up. Seated Row and Lat Pulldown sat at 135x10 for seven
//      sessions, including position-1 attempts.
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
  const errors = [];
  window.onerror = (msg) => errors.push(String(msg));
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  }
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

// One session containing one movement, all sets at the same weight/reps/rpe.
// `supersetId` present means the movement was performed as half of a pair.
function session(date, name, weight, reps, rpe, opts) {
  const o = opts || {};
  const sets = [1, 2, 3].map((n) => ({
    set: n,
    weight: String(weight),
    reps: String(reps),
    rpe: String(rpe),
    note: "",
  }));
  const mov = { name, sets, note: "", order: 0 };
  if (o.supersetId) mov.supersetId = o.supersetId;
  if (o.substituted) mov.substituted = true;
  return {
    id: date,
    type: o.type || "pull",
    label: o.label || "Pull",
    date,
    note: "",
    movements: [mov],
  };
}

async function checkSupersetHistoryDoesNotLowerTheBaseline() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  // The real Hammer Curl shape: 25 solo in early August, then two
  // weight-matched superset rounds that drop to 20 and 15.
  // Mirrors the committed log: 25x8 @7 (Jul 30), 20x10 @7 (Aug 5),
  // 25x10 @7 (Aug 9), then two weight-matched superset rounds at 20 and 15.
  const history = [
    session("Jul 30, 2026", "Hammer Curl", 25, 8, 7),
    session("Aug 5, 2026", "Hammer Curl", 20, 10, 7),
    session("Aug 9, 2026", "Hammer Curl", 25, 10, 7),
    session("Aug 15, 2026", "Hammer Curl", 20, 10, 7, { supersetId: "link_1" }),
    session("Aug 19, 2026", "Hammer Curl", 15, 10, 5, { supersetId: "link_2" }),
  ];
  const mov = { name: "Hammer Curl", reps: 10, steps: window.DUMBBELL_STEPS, current: "20 lb" };

  // Guard the fixture itself: the most recent session really is the 15 lb
  // superset round, so a derived 25 can only come from excluding it.
  const all = window.movementSessionSummaries(history, "Hammer Curl", 10);
  if (all[0].topWeight !== 15) {
    throw new Error(`fixture broken: expected the most recent session to be the 15 lb superset round, got ${all[0].topWeight}`);
  }
  if (!all[0].inSuperset) throw new Error("fixture broken: most recent session should be flagged inSuperset");

  const derived = window.deriveCurrentWeight(history, mov);
  if (derived !== 25) {
    throw new Error(`expected Hammer Curl to derive 25 (its best solo session), got ${derived}`);
  }
  console.log("PASS: superset-only recent history derives 25, not the 15 lb weight-matched superset round");

  // The suggestion under that corrected baseline is up — which is what the
  // owner was "ignoring": the call was right, the weight under it was wrong.
  const suggested = window.suggestChip(history, "Hammer Curl", 10);
  if (suggested !== "up") {
    throw new Error(`expected up on the corrected solo history, got ${suggested}`);
  }
  console.log("PASS: the suggestion off solo history is up (the baseline was the bug, not the call)");
  window.close();
}

async function checkBestQualifyingSessionInTheLastThree() {
  const { window, errors } = await mount();
  const mov = { name: "Seated Row", reps: 10, increment: 15, current: "135 lb" };

  // A one-off dip — rack availability, fatigue, late placement — must not
  // reset the baseline, because the window is scored by its best session.
  const dip = [
    session("Aug 5, 2026", "Seated Row", 135, 10, 7),
    session("Aug 9, 2026", "Seated Row", 135, 10, 7),
    session("Aug 15, 2026", "Seated Row", 120, 10, 7),
  ];
  if (window.deriveCurrentWeight(dip, mov) !== 135) {
    throw new Error(`a single dip reset the baseline: got ${window.deriveCurrentWeight(dip, mov)}, expected 135`);
  }
  console.log("PASS: a one-off dip inside the window does not lower the baseline (135)");

  // But it is a WINDOW, not an all-time max: a weight three sessions back has
  // aged out, so a genuine sustained deload does move the baseline down.
  const deload = [
    session("Jul 1, 2026", "Seated Row", 150, 10, 7),
    session("Aug 5, 2026", "Seated Row", 120, 10, 7),
    session("Aug 9, 2026", "Seated Row", 120, 10, 7),
    session("Aug 15, 2026", "Seated Row", 120, 10, 7),
  ];
  if (window.deriveCurrentWeight(deload, mov) !== 120) {
    throw new Error(`expected an aged-out 150 to leave the window, got ${window.deriveCurrentWeight(deload, mov)}`);
  }
  console.log("PASS: the window is the last three sessions, not an all-time max (a sustained deload still lands)");

  // Nothing in the window reached the rep-range floor -> use the most recent
  // top weight, not the window's heaviest failed attempt.
  const allMissed = [
    session("Aug 5, 2026", "Seated Row", 150, 4, 9),
    session("Aug 9, 2026", "Seated Row", 135, 5, 9),
    session("Aug 15, 2026", "Seated Row", 120, 5, 9),
  ];
  if (window.deriveCurrentWeight(allMissed, mov) !== 120) {
    throw new Error(`expected a fully-missed window to fall back to the most recent top weight (120), got ${window.deriveCurrentWeight(allMissed, mov)}`);
  }
  console.log("PASS: a window where nothing hit the rep floor falls back to the most recent top weight");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkSubstitutedSessionsAreExcluded() {
  const { window, errors } = await mount();
  const mov = { name: "Seated Row", reps: 10, increment: 15, current: "135 lb" };

  // Specified Aug 19 (Phase 5/7) — confirming it is actually applied, as
  // Phase 2 item 3 asks.
  const history = [
    session("Aug 5, 2026", "Seated Row", 135, 10, 7),
    session("Aug 9, 2026", "Seated Row", 135, 10, 7),
    session("Aug 15, 2026", "Seated Row", 105, 10, 6, { substituted: true }),
  ];
  const derived = window.deriveCurrentWeight(history, mov);
  if (derived !== 135) {
    throw new Error(`a substituted session lowered the baseline: got ${derived}, expected 135`);
  }
  const summaries = window.movementSessionSummaries(history, "Seated Row", 10);
  if (summaries.some((s) => s.topWeight === 105)) {
    throw new Error("a substituted session is still present in movementSessionSummaries");
  }
  console.log("PASS: substituted sessions are excluded from derivation (confirmed, per Phase 2 item 3)");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkSupersetOnlyMovementStillProgresses() {
  const { window, errors } = await mount();
  // A movement that lives permanently inside a superset has no solo history
  // to fall back to. Its superset sessions are then used — see
  // progressionSummaries' flagged deviation — scored by the window's BEST
  // session, so a weight-matched round can raise but never lower it.
  const history = [
    session("Aug 5, 2026", "Hammer Curl", 25, 10, 7, { supersetId: "link_1" }),
    session("Aug 9, 2026", "Hammer Curl", 20, 10, 7, { supersetId: "link_2" }),
    session("Aug 15, 2026", "Hammer Curl", 20, 10, 6, { supersetId: "link_3" }),
  ];
  const mov = { name: "Hammer Curl", reps: 10, steps: window.DUMBBELL_STEPS, current: "20 lb" };
  const derived = window.deriveCurrentWeight(history, mov);
  if (derived !== 25) {
    throw new Error(`expected a superset-only movement to still derive its best (25), got ${derived}`);
  }
  console.log("PASS: a superset-only movement derives from its best superset session, not a frozen BLOCK.current");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkRpe8PlateauSuggestsUp() {
  const { window, errors } = await mount();

  // The real Seated Row shape: parked at 135x10, RPE 8 / 8 / 7.
  const plateau = [
    session("Jul 25, 2026", "Seated Row", 120, 10, 7),
    session("Aug 9, 2026", "Seated Row", 135, 10, 7),
    session("Aug 15, 2026", "Seated Row", 135, 10, 8),
    session("Aug 19, 2026", "Seated Row", 135, 10, 8),
  ];
  const suggested = window.suggestChip(plateau, "Seated Row", 10);
  if (suggested !== "up") {
    throw new Error(`expected three consecutive target-rep sessions at RPE <= 8 to suggest up, got ${suggested}`);
  }
  console.log("PASS: three consecutive sessions parked at target reps / RPE 8 suggest up (plateau broken)");

  // Two is not three — the rule needs a real streak, so this still holds.
  const twoOnly = [
    session("Aug 15, 2026", "Seated Row", 135, 10, 8),
    session("Aug 19, 2026", "Seated Row", 135, 10, 8),
  ];
  if (window.suggestChip(twoOnly, "Seated Row", 10) !== "hold") {
    throw new Error(`expected two RPE-8 sessions to still hold, got ${window.suggestChip(twoOnly, "Seated Row", 10)}`);
  }
  console.log("PASS: two RPE-8 sessions is not a plateau yet (still hold)");

  // A FRESH jump landing at RPE 8 must still hold, not up — the Aug 19
  // consolidation rule. This is what the same-weight requirement protects.
  const freshJump = [
    session("Aug 5, 2026", "Seated Row", 120, 10, 7),
    session("Aug 9, 2026", "Seated Row", 120, 10, 7),
    session("Aug 15, 2026", "Seated Row", 135, 10, 8),
  ];
  if (window.suggestChip(freshJump, "Seated Row", 10) !== "hold") {
    throw new Error(`expected a fresh jump at RPE 8 to hold, got ${window.suggestChip(freshJump, "Seated Row", 10)}`);
  }
  console.log("PASS: a freshly increased weight at RPE 8 still holds (consolidation, not a plateau)");

  // RPE 9 is a genuine failure signal and still outranks the plateau rule —
  // BLOCK.flags keeps working sets at RPE <= 8 while on blood thinners.
  const rpe9 = [
    session("Aug 9, 2026", "Seated Row", 135, 10, 8),
    session("Aug 15, 2026", "Seated Row", 135, 10, 8),
    session("Aug 19, 2026", "Seated Row", 135, 10, 9),
  ];
  if (window.suggestChip(rpe9, "Seated Row", 10) !== "down") {
    throw new Error(`expected RPE 9 to still suggest down, got ${window.suggestChip(rpe9, "Seated Row", 10)}`);
  }
  console.log("PASS: an RPE-9 session still suggests down, outranking the plateau rule");

  // A plateau at reps BELOW target isn't a plateau — the rule is about a lift
  // parked at its target, not one stuck short of it.
  const shortOfTarget = [
    session("Aug 9, 2026", "Seated Row", 135, 8, 8),
    session("Aug 15, 2026", "Seated Row", 135, 8, 8),
    session("Aug 19, 2026", "Seated Row", 135, 8, 8),
  ];
  if (window.suggestChip(shortOfTarget, "Seated Row", 10) !== "hold") {
    throw new Error(`expected a sub-target plateau to hold, got ${window.suggestChip(shortOfTarget, "Seated Row", 10)}`);
  }
  console.log("PASS: three sessions short of target reps hold rather than suggesting up");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkAgainstRealHistory() {
  const { window, errors } = await mount();
  const history = JSON.parse(fs.readFileSync(path.join(repoRoot, "sessions.json"), "utf8"));

  // The four movements the work order names, against the committed log.
  const expected = [
    { name: "Hammer Curl", reps: 10, steps: true, current: "20 lb", derived: 25 },
    { name: "Goblet Squat", reps: 10, steps: true, current: "50 lb", derived: 50 },
    { name: "Seated Row", reps: 10, increment: 15, current: "135 lb", suggested: "up" },
    { name: "Lat Pulldown", reps: 10, increment: 15, current: "135 lb", suggested: "up" },
  ];
  expected.forEach((e) => {
    const mov = {
      name: e.name,
      reps: e.reps,
      current: e.current,
      ...(e.steps ? { steps: window.DUMBBELL_STEPS } : { increment: e.increment }),
    };
    if (e.derived != null) {
      const got = window.deriveCurrentWeight(history, mov);
      if (got !== e.derived) {
        throw new Error(`${e.name}: expected derived ${e.derived} against real history, got ${got}`);
      }
    }
    if (e.suggested != null) {
      const got = window.suggestChip(history, e.name, e.reps);
      if (got !== e.suggested) {
        throw new Error(`${e.name}: expected ${e.suggested} against real history, got ${got}`);
      }
    }
  });
  console.log("PASS: against the committed log — Hammer Curl 25, Goblet Squat 50, Seated Row/Lat Pulldown up");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkSupersetHistoryDoesNotLowerTheBaseline();
  await checkBestQualifyingSessionInTheLastThree();
  await checkSubstitutedSessionsAreExcluded();
  await checkSupersetOnlyMovementStillProgresses();
  await checkRpe8PlateauSuggestsUp();
  await checkAgainstRealHistory();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

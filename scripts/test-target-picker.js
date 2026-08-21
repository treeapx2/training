#!/usr/bin/env node
// Behavioral jsdom check for the target picker (see CLAUDE.md "Target
// picker" — CHANGES.md Aug 10 2026, Phase 2). Not part of the `npm test`
// artifact tier; registered as a validation bar behavior check (like
// test-sync-last.js) so `npm test` alone still runs it.
//
// Covers, against fixture history:
//   - buildRamp produces the exact [T-2i, T-i, T-i, T, T] shape and clamps
//     at the lowest available increment.
//   - deriveCurrentWeight: heaviest weight completed at target reps in the
//     most recent session; falls back to BLOCK.current with no history.
//   - deriveSetCount: modal total-set count across the last three sessions.
//   - suggestChip's four rules (up / hold / down / <2 sessions -> hold).
//   - applyPositionalDowngrade: up -> hold only in the last two positions.
//   - End-to-end: tapping a chip in a live session and finishing persists
//     targetWeight/chipChoice/suggested on the record.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

async function mount(seed) {
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
  window.confirm = () => true;
  if (seed) window.localStorage.setItem("at_workout_stable", JSON.stringify({ history: seed }));
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

// Fixture sessions for "Leg Press" (increment 15, target reps 10).
// Dates ascending so the most recent is listed last; suggestChip/derive*
// sort internally so the order here doesn't matter for correctness.
function legPressSession(date, weight, reps, rpe, totalSets) {
  const sets = [];
  for (let i = 0; i < totalSets; i++) {
    // Only the last set is the "working" set at `weight`/`reps`/`rpe` —
    // earlier ones are lighter warmup/build filler, consistent with how a
    // real ramp is logged.
    const isLast = i === totalSets - 1;
    sets.push({
      set: i + 1,
      weight: String(isLast ? weight : Math.max(weight - 15, 15)),
      reps: String(isLast ? reps : 10),
      rpe: isLast ? String(rpe) : "",
      note: "",
    });
  }
  return { id: date.length, type: "legs", label: "Legs", date, note: "", movements: [{ name: "Leg Press", sets, note: "", order: 0 }] };
}

async function checkRampShape() {
  const { window, errors } = await mount(null);
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));
  const mov = { name: "Leg Press", reps: 10, increment: 15, current: "185 lb" };
  const ramp = window.buildRamp(mov, 185, 5);
  const shape = ramp.map((s) => s.weight);
  if (JSON.stringify(shape) !== JSON.stringify(["155", "170", "170", "185", "185"])) {
    throw new Error("ramp shape wrong: " + JSON.stringify(shape));
  }
  if (JSON.stringify(ramp.map((s) => s.type)) !== JSON.stringify(["WU", "B", "B", "W", "W"])) {
    throw new Error("ramp types wrong: " + JSON.stringify(ramp.map((s) => s.type)));
  }
  // Clamp: a target near the increment must not go negative/zero.
  const clamped = window.buildRamp(mov, 20, 5);
  if (clamped.some((s) => Number(s.weight) < 15)) {
    throw new Error("ramp did not clamp at the lowest increment: " + JSON.stringify(clamped.map((s) => s.weight)));
  }
  console.log("PASS: buildRamp 5-set shape and clamping (see test-ramp-shapes.js for the full 5/4/3/2/1-set table)");
  window.close();
}

async function checkDeriveCurrentWeightAndSetCount() {
  const history = [
    legPressSession("Aug 1, 2026", 185, 10, 7, 5),
    legPressSession("Aug 4, 2026", 185, 10, 6, 5),
    legPressSession("Aug 7, 2026", 200, 10, 7, 4),
  ];
  const { window, errors } = await mount(history);
  const mov = { name: "Leg Press", reps: 10, increment: 15, current: "185 lb" };
  const current = window.deriveCurrentWeight(history, mov);
  if (current !== 200) throw new Error(`expected deriveCurrentWeight 200 (most recent session), got ${current}`);
  console.log("PASS: deriveCurrentWeight uses the most recent qualifying session (200)");

  const setCount = window.deriveSetCount(history, "Leg Press");
  // Last 3 sessions: 5, 5, 4 -> modal is 5.
  if (setCount !== 5) throw new Error(`expected modal set count 5, got ${setCount}`);
  console.log("PASS: deriveSetCount picks the modal count across the last 3 sessions (5)");

  const noHistoryWeight = window.deriveCurrentWeight([], mov);
  if (noHistoryWeight !== 185) throw new Error(`expected fallback to BLOCK.current (185), got ${noHistoryWeight}`);
  const noHistoryCount = window.deriveSetCount([], "Leg Press");
  if (noHistoryCount !== 5) throw new Error(`expected fallback set count 5, got ${noHistoryCount}`);
  console.log("PASS: both derive* functions fall back correctly with no history");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkSuggestionRules() {
  const { window } = await mount(null);

  // Rule: fewer than two prior sessions -> hold.
  let h = [legPressSession("Aug 7, 2026", 185, 10, 7, 5)];
  if (window.suggestChip(h, "Leg Press", 10) !== "hold") {
    throw new Error("expected 'hold' with <2 prior sessions");
  }
  console.log("PASS: <2 prior sessions -> hold");

  // Rule: both sessions hit target reps at RPE <=7 -> up.
  h = [legPressSession("Aug 1, 2026", 185, 10, 6, 5), legPressSession("Aug 4, 2026", 185, 10, 7, 5)];
  if (window.suggestChip(h, "Leg Press", 10) !== "up") {
    throw new Error("expected 'up' when both sessions clean at RPE<=7");
  }
  console.log("PASS: both sessions hit target at RPE<=7 -> up");

  // Rule: last session hit target reps at RPE 8 -> hold.
  h = [legPressSession("Aug 1, 2026", 185, 10, 6, 5), legPressSession("Aug 4, 2026", 185, 10, 8, 5)];
  if (window.suggestChip(h, "Leg Press", 10) !== "hold") {
    throw new Error("expected 'hold' when last session hit target at RPE 8");
  }
  console.log("PASS: last session hit target at RPE 8 -> hold");

  // Rule: last session missed target reps -> down.
  h = [legPressSession("Aug 1, 2026", 185, 10, 7, 5), legPressSession("Aug 4, 2026", 185, 8, 8, 5)];
  if (window.suggestChip(h, "Leg Press", 10) !== "down") {
    throw new Error("expected 'down' when last session missed target reps");
  }
  console.log("PASS: last session missed target reps -> down");

  // Rule: any (qualifying) working set at RPE>=9 -> down, even if reps hit.
  h = [legPressSession("Aug 1, 2026", 185, 10, 7, 5), legPressSession("Aug 4, 2026", 185, 10, 9, 5)];
  if (window.suggestChip(h, "Leg Press", 10) !== "down") {
    throw new Error("expected 'down' when last session's top set hit RPE 9");
  }
  console.log("PASS: last session RPE>=9 -> down");

  window.close();
}

async function checkPositionalDowngrade() {
  const { window } = await mount(null);
  // First two positions: keep "up" as computed.
  if (window.applyPositionalDowngrade("up", 0, 5) !== "up") throw new Error("position 0 of 5 should keep 'up'");
  if (window.applyPositionalDowngrade("up", 1, 5) !== "up") throw new Error("position 1 of 5 should keep 'up'");
  // Last two positions: downgrade "up" to "hold".
  if (window.applyPositionalDowngrade("up", 3, 5) !== "hold") throw new Error("position 3 of 5 should downgrade to 'hold'");
  if (window.applyPositionalDowngrade("up", 4, 5) !== "hold") throw new Error("position 4 of 5 (last) should downgrade to 'hold'");
  // Non-"up" suggestions are never touched by the positional rule.
  if (window.applyPositionalDowngrade("down", 4, 5) !== "down") throw new Error("'down' must not be altered by position");
  if (window.applyPositionalDowngrade("hold", 4, 5) !== "hold") throw new Error("'hold' must not be altered by position");
  console.log("PASS: positional downgrade only demotes 'up' to 'hold' in the last two positions");
  window.close();
}

async function checkFinishPersistsTargetPickerFields() {
  const { window, errors } = await mount(null);
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const byText = (tag, text) =>
    Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

  click(byText("button", "Legs"));
  await sleep(30);
  const header = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === "Leg Press");
  let node = header;
  while (node && !(node.getAttribute("style") || "").includes("cursor: pointer")) node = node.parentElement;
  click(node);
  await sleep(30);

  // No history -> suggestChip returns "hold", hold chip = BLOCK.current (185).
  const holdBtn = byText("button", "185 ★");
  if (!holdBtn) {
    const allButtons = Array.from(window.document.querySelectorAll("button")).map((b) => b.textContent.trim());
    throw new Error("suggested hold chip '185 ★' not found; buttons: " + JSON.stringify(allButtons));
  }
  click(holdBtn);
  await sleep(30);

  const logBtn = byText("button", "log");
  click(logBtn);
  await sleep(30);
  click(byText("button", "finish session"));
  await sleep(80);

  if (errors.length) throw new Error("jsdom errors during finish flow: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const legPress = entry.movements.find((m) => m.name === "Leg Press");
  console.log("Persisted Leg Press movement:", JSON.stringify(legPress));
  if (legPress.targetWeight !== "185") throw new Error(`expected targetWeight '185', got ${legPress.targetWeight}`);
  if (legPress.chipChoice !== "hold") throw new Error(`expected chipChoice 'hold', got ${legPress.chipChoice}`);
  if (legPress.suggested !== "hold") throw new Error(`expected suggested 'hold', got ${legPress.suggested}`);
  console.log("PASS: finishing a session persists targetWeight/chipChoice/suggested");
  window.close();
}

async function main() {
  await checkRampShape();
  await checkDeriveCurrentWeightAndSetCount();
  await checkSuggestionRules();
  await checkPositionalDowngrade();
  await checkFinishPersistsTargetPickerFields();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Behavioral jsdom check for the Legs A/B session variant overlay (see
// CLAUDE.md "Session variants"). Not part of the `npm test` validation bar
// (that suite validates the build artifact, not app behavior) — run
// standalone via `npm run test:session-variants`.
//
// Regression coverage for two bugs:
//   1. Legs B applied no real prescription override (SESSION_VARIANTS
//      carried only workSets/reps, never weight, so buildPlannedSetsBase
//      always ramped off the shared mov.current regardless of variant).
//   2. Leg Press's workSets (3) exceeded the Legs ramp's built-in 2 "W"
//      slots, so buildPlannedSets padded a 6th set on top of the 5-set
//      ramp (1 warmup + 2 build + 2 working) instead of the intended 5.
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
  window.confirm = () => true;
  await new Promise((r) => window.setTimeout(r, 80));
  return { window, errors };
}

async function checkVariantsProduceDifferentPlannedSets() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const legsMovNames = ["Leg Press", "Leg Curl", "Leg Extension", "Goblet Squat", "Calf Raise"];
  const movsA = window.buildSessionMovements("legs", "A", null);
  const movsB = window.buildSessionMovements("legs", "B", null);

  const findMov = (list, name) => list.find((m) => m.name === name);

  let allDiffer = true;
  const report = {};
  for (const name of legsMovNames) {
    const movA = findMov(movsA, name);
    const movB = findMov(movsB, name);
    if (!movA || !movB) throw new Error(`movement '${name}' missing from A or B session movements`);
    const plannedA = window.buildPlannedSets(movA, "legs");
    const plannedB = window.buildPlannedSets(movB, "legs");
    const jsonA = JSON.stringify(plannedA.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type })));
    const jsonB = JSON.stringify(plannedB.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type })));
    report[name] = { A: JSON.parse(jsonA), B: JSON.parse(jsonB) };
    if (jsonA === jsonB) {
      allDiffer = false;
      console.error(`FAIL DETAIL: '${name}' planned sets are identical between Legs A and Legs B`);
    }
  }

  console.log("Planned sets by movement:\n" + JSON.stringify(report, null, 2));

  if (!allDiffer) {
    throw new Error("not every Legs movement produced different planned sets between variant A and B");
  }
  console.log("PASS: every Legs movement produces different planned sets between variant A and B");

  // Bug 2 regression: Leg Press must be 5 total sets (1 warmup + 2 build +
  // 2 working), not 6, in both variants.
  const legPressA = window.buildPlannedSets(findMov(movsA, "Leg Press"), "legs");
  const legPressB = window.buildPlannedSets(findMov(movsB, "Leg Press"), "legs");
  if (legPressA.length !== 5) {
    throw new Error(`expected Leg Press (A) to have 5 planned sets, got ${legPressA.length}`);
  }
  if (legPressB.length !== 5) {
    throw new Error(`expected Leg Press (B) to have 5 planned sets, got ${legPressB.length}`);
  }
  console.log("PASS: Leg Press has exactly 5 planned sets in both Legs A and Legs B");

  // Bug 1 regression, explicit: Leg Press's working-set weight must
  // actually be lighter in B (140-155 lb range) than A (185 lb, unchanged
  // shared `current`), not identical.
  const workingA = legPressA.filter((s) => s.type === "W");
  const workingB = legPressB.filter((s) => s.type === "W");
  const weightA = Number(workingA[0].weight);
  const weightB = Number(workingB[0].weight);
  if (weightA !== 185) throw new Error(`expected Legs A Leg Press working weight 185, got ${weightA}`);
  if (weightB < 140 || weightB > 155) {
    throw new Error(`expected Legs B Leg Press working weight in [140,155], got ${weightB}`);
  }
  console.log(`PASS: Leg Press working weight differs (A=${weightA}, B=${weightB}, B within 140-155)`);

  window.close();
}

async function checkFinishPersistsVariant() {
  const { window, errors } = await mount();

  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const byText = (text) =>
    Array.from(window.document.querySelectorAll("button")).find((b) => b.textContent.trim() === text);

  click(byText("Legs"));
  await sleep(30);
  click(byText("B"));
  await sleep(30);

  // Expand Leg Press and log its first set so the movement is kept in the
  // finished record.
  const header = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === "Leg Press",
  );
  let node = header;
  while (node && !(node.getAttribute("style") || "").includes("cursor: pointer")) node = node.parentElement;
  click(node);
  await sleep(30);

  const logBtn = byText("log");
  if (!logBtn) throw new Error("no 'log' button found after expanding Leg Press");
  click(logBtn);
  await sleep(30);

  const finishBtn = byText("finish session");
  if (!finishBtn) throw new Error("finish session button not found");
  click(finishBtn);
  await sleep(80);

  if (errors.length) throw new Error("jsdom errors during finish flow: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = (stored.history || [])[0];
  if (!entry) throw new Error("no session record written to localStorage after finish");
  console.log("Finished record:", JSON.stringify({ type: entry.type, label: entry.label, variant: entry.variant }));

  if (entry.variant !== "B") {
    throw new Error(`expected entry.variant === 'B', got ${JSON.stringify(entry.variant)}`);
  }
  if (entry.label !== "Legs B") {
    throw new Error(`expected entry.label === 'Legs B', got ${JSON.stringify(entry.label)}`);
  }
  console.log("PASS: finishing a Legs B session persists variant === 'B' (and label 'Legs B')");

  window.close();
}

async function main() {
  await checkVariantsProduceDifferentPlannedSets();
  await checkFinishPersistsVariant();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Behavioral jsdom check for the shared dumbbell steps array (see
// CLAUDE.md "Target picker" — CHANGES.md Aug 19 2026, Phase 1). Registered
// as validation bar check #11; also runnable alone via
// `npm run test:dumbbell-steps`.
//
// The dumbbell rack is 5 lb plates to 50 plus a single 12 lb pair — chips
// were previously offering unavailable weights (Skull Crusher bouncing
// 12 -> 15 -> 20 because its old fixed 5 lb increment never actually
// produced 12 consistently).
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");
const appSrcPath = path.join(repoRoot, "src", "app.jsx");

const DUMBBELL_MOVEMENTS = [
  "Skull Crusher",
  "Hammer Curl",
  "Zottman Curl",
  "DB Row",
  "Reverse Fly",
  "Lateral Raise",
  "Goblet Squat",
];
const MACHINE_OR_CABLE_MOVEMENTS = ["Leg Press", "Chest Press", "Rope Pushdown", "Cable Curl", "Calf Raise"];

// Source-config check: every dumbbell movement's BLOCK entry uses
// `steps: DUMBBELL_STEPS` and no fixed `increment`, while machine/cable
// movements keep a plain `increment` and no `steps`. BLOCK itself isn't
// reachable from a mounted page (it's a `const`, not a `function`
// declaration, so classic-script globals don't expose it on `window`) —
// reading the source directly is the straightforward way to verify the
// authored data shape, distinct from the behavioral checks below.
function checkSourceConfig() {
  const src = fs.readFileSync(appSrcPath, "utf8");
  const movLineFor = (name) => {
    const re = new RegExp(`name: "${name}"[^}]*`);
    const m = src.match(re);
    if (!m) throw new Error(`could not find a BLOCK entry for '${name}' in src/app.jsx`);
    return m[0];
  };
  DUMBBELL_MOVEMENTS.forEach((name) => {
    const line = movLineFor(name);
    if (!/steps: DUMBBELL_STEPS/.test(line)) {
      throw new Error(`expected ${name} to use 'steps: DUMBBELL_STEPS', got: ${line}`);
    }
    if (/\bincrement:/.test(line)) {
      throw new Error(`expected ${name} to have no fixed increment now that it uses steps: ${line}`);
    }
  });
  MACHINE_OR_CABLE_MOVEMENTS.forEach((name) => {
    const line = movLineFor(name);
    if (!/increment: \d/.test(line)) {
      throw new Error(`expected ${name} (machine/cable) to keep a numeric increment: ${line}`);
    }
    if (/\bsteps:/.test(line)) {
      throw new Error(`expected ${name} (machine/cable) to have no steps array: ${line}`);
    }
  });
  if (!/const DUMBBELL_STEPS = \[5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50\];/.test(src)) {
    throw new Error("expected a shared DUMBBELL_STEPS constant with the exact rack values");
  }
  console.log("PASS: all 7 dumbbell movements use the shared DUMBBELL_STEPS array; machine/cable movements keep a plain increment");
}

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

const sleep = (window, ms) => new Promise((r) => window.setTimeout(r, ms));
const click = (window, el) =>
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (window, tag, text) =>
  Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);
async function openCard(window, name) {
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === name);
  let header = nameDiv;
  while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) header = header.parentElement;
  const container = header.parentElement;
  click(window, header);
  await sleep(window, 40);
  return container;
}

async function checkChipsStepThroughAdjacentEntriesInTheLiveApp() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  // Hammer Curl is standalone (not part of a pre-seeded superset pair,
  // unlike Skull Crusher/DB Row-adjacent movements). current is "20 lb";
  // the shared steps array's adjacent entries around 20 are 15 and 25 --
  // not a naive current-5/current+5.
  const card = await openCard(window, "Hammer Curl");
  const buttons = Array.from(card.querySelectorAll("button")).map((b) => b.textContent.trim());
  console.log("Hammer Curl chip buttons:", JSON.stringify(buttons));
  if (!buttons.some((b) => b.startsWith("15"))) throw new Error("expected a 15 lb (down) chip for Hammer Curl");
  if (!buttons.some((b) => b.includes("20") && b.includes("★"))) throw new Error("expected a suggested 20 lb (hold) chip");
  if (!buttons.some((b) => b.startsWith("25"))) throw new Error("expected a 25 lb (up) chip for Hammer Curl");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: Hammer Curl's chips reflect the shared dumbbell steps array in the live app");
  window.close();
}

async function checkMachineMovementUnaffectedInTheLiveApp() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);
  // Chest Press: increment 15, current 120 -> down/up should be 105/135.
  const card = await openCard(window, "Chest Press");
  const buttons = Array.from(card.querySelectorAll("button")).map((b) => b.textContent.trim());
  if (!buttons.some((b) => b.startsWith("105"))) throw new Error("expected Chest Press down chip to be 105 (15 lb increment)");
  if (!buttons.some((b) => b.startsWith("135"))) throw new Error("expected Chest Press up chip to be 135 (15 lb increment)");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: a machine movement's fixed-increment chips are unaffected");
  window.close();
}

// Direct pure-function check that chips step through the 12 lb entry
// specifically (CHANGES.md Aug 19 2026 verification: "assert dumbbell
// chips step through the steps array including the 12 lb entry") --
// stepWeight() reads whatever `steps` array is on the mov object passed
// in, so this doesn't need DUMBBELL_STEPS itself to be reachable from
// `window` (see checkSourceConfig's comment on why BLOCK/consts aren't).
async function checkStepsThroughThe12lbEntry() {
  const { window, errors } = await mount();
  const mov = { steps: [5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50] };
  if (window.stepWeight(mov, 15, -1) !== 12) {
    throw new Error(`expected stepping down from 15 to land on 12, got ${window.stepWeight(mov, 15, -1)}`);
  }
  if (window.stepWeight(mov, 10, 1) !== 12) {
    throw new Error(`expected stepping up from 10 to land on 12, got ${window.stepWeight(mov, 10, 1)}`);
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: stepWeight steps through the 12 lb entry from both directions (15->12 down, 10->12 up)");
  window.close();
}

async function main() {
  checkSourceConfig();
  await checkChipsStepThroughAdjacentEntriesInTheLiveApp();
  await checkMachineMovementUnaffectedInTheLiveApp();
  await checkStepsThroughThe12lbEntry();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

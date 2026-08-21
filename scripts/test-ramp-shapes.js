#!/usr/bin/env node
// Behavioral jsdom check for ramp shape scaling with set count (see
// CLAUDE.md "Target picker" — CHANGES.md Aug 19 2026, Phase 2). Registered
// as validation bar check #12; also runnable alone via
// `npm run test:ramp-shapes`.
//
// The old fixed 5-slot ramp always spent a warmup + build overhead, which
// was wrong for short movements — confirmed by real logs: Skull Crusher
// ran `15×10` four times (no warmup), Hammer Curl ran `15×10` three times
// (no warmup, no build).
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
  // Must be set before the sleep below (i.e. before React's mount effect
  // actually runs and reads localStorage) — seeding after `mount()`
  // returns is too late, the app has already loaded with empty history.
  if (seed) window.localStorage.setItem("at_workout_stable", JSON.stringify({ history: seed }));
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

async function checkAllFourTabulatedShapes() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  // Leg Press: increment 15, target 185 -> wu=155, b=170.
  const mov = { name: "Leg Press", reps: 10, increment: 15, current: "185 lb" };

  const cases = [
    { setCount: 5, types: ["WU", "B", "B", "W", "W"], weights: ["155", "170", "170", "185", "185"] },
    { setCount: 4, types: ["B", "W", "W", "W"], weights: ["170", "185", "185", "185"] },
    { setCount: 3, types: ["W", "W", "W"], weights: ["185", "185", "185"] },
    { setCount: 2, types: ["W", "W"], weights: ["185", "185"] },
  ];

  for (const c of cases) {
    const ramp = window.buildRamp(mov, 185, c.setCount);
    const types = ramp.map((s) => s.type);
    const weights = ramp.map((s) => s.weight);
    if (JSON.stringify(types) !== JSON.stringify(c.types)) {
      throw new Error(`${c.setCount}-set shape types wrong: expected ${JSON.stringify(c.types)}, got ${JSON.stringify(types)}`);
    }
    if (JSON.stringify(weights) !== JSON.stringify(c.weights)) {
      throw new Error(`${c.setCount}-set shape weights wrong: expected ${JSON.stringify(c.weights)}, got ${JSON.stringify(weights)}`);
    }
  }
  console.log("PASS: all four tabulated ramp shapes (5/4/3/2 sets) generate exactly as specified");

  // Floor: 1 set (and 0, defensively) never goes below one working set.
  const one = window.buildRamp(mov, 185, 1);
  if (one.length !== 1 || one[0].type !== "W" || one[0].weight !== "185") {
    throw new Error(`expected a 1-set floor of [{type:"W", weight:"185"}], got ${JSON.stringify(one)}`);
  }
  const zero = window.buildRamp(mov, 185, 0);
  if (zero.length !== 1 || zero[0].type !== "W") {
    throw new Error(`expected setCount 0 to still floor at one working set, got ${JSON.stringify(zero)}`);
  }
  console.log("PASS: setCount <= 1 floors at exactly one working set");

  // Padding beyond 5 still adds working sets onto the full shape.
  const six = window.buildRamp(mov, 185, 6);
  if (JSON.stringify(six.map((s) => s.type)) !== JSON.stringify(["WU", "B", "B", "W", "W", "W"])) {
    throw new Error(`expected 6-set shape to pad one extra W onto the full 5-slot ramp, got ${JSON.stringify(six.map((s) => s.type))}`);
  }
  console.log("PASS: setCount > 5 pads extra working sets onto the full 5-slot ramp");
  window.close();
}

async function checkShortRampsInTheLiveApp() {
  // Seed history so Hammer Curl's modal set count (last 3 sessions) is 3,
  // matching the real "no warmups for a three set exercise" note.
  const history = [1, 2, 3].map((n) => ({
    id: n,
    type: "pull",
    label: "Pull",
    date: `Aug ${n}, 2026`,
    note: "",
    movements: [
      {
        name: "Hammer Curl",
        sets: [
          { set: 1, weight: "20", reps: "10", rpe: "6", note: "" },
          { set: 2, weight: "20", reps: "10", rpe: "7", note: "" },
          { set: 3, weight: "20", reps: "10", rpe: "7", note: "" },
        ],
        note: "",
        order: 0,
      },
    ],
  }));
  const { window, errors } = await mount(history);
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const byText = (tag, text) =>
    Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

  click(byText("button", "Pull"));
  await sleep(40);
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === "Hammer Curl");
  let header = nameDiv;
  while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) header = header.parentElement;
  const card = header.parentElement;
  click(header);
  await sleep(40);

  const starred = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  if (!starred) throw new Error("no suggested chip found for Hammer Curl");
  click(starred);
  await sleep(40);

  // Scope to Hammer Curl's own card -- other movements' (and cardio's)
  // number inputs are on the same page regardless of open/collapsed state.
  const weightInputs = Array.from(card.querySelectorAll('input[type="number"]'))
    .filter((_, i) => i % 3 === 0)
    .map((i) => i.value);
  console.log("Hammer Curl ramp weights (3-set history):", JSON.stringify(weightInputs));
  if (weightInputs.length !== 3) {
    throw new Error(`expected exactly 3 sets generated (no warmup) for a movement with a 3-set history, got ${weightInputs.length}`);
  }
  if (new Set(weightInputs).size !== 1) {
    throw new Error(`expected all 3 sets at the same (working) weight with no warmup, got ${JSON.stringify(weightInputs)}`);
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: a movement with a 3-session history of 3 sets each generates a no-warmup 3-set ramp in the live app");
  window.close();
}

async function main() {
  await checkAllFourTabulatedShapes();
  await checkShortRampsInTheLiveApp();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

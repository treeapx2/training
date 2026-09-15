#!/usr/bin/env node
// Behavioral jsdom check for the TWO-WEIGHT ramp (see CLAUDE.md "Target
// picker" — CHANGES-2026-09-13, Phase 1). Registered as validation bar check
// #12; also runnable alone via `npm run test:ramp-shapes`.
//
// > "there's no need for three different weights in one exercise. We are
// > starting at a heavy but established weight and then moving to a higher
// > weight."
//
// The load-bearing invariant is the one the work order states outright: never
// generate a third distinct weight. Set counts are authored per movement
// rather than derived from position or history, and are calibrated against
// real timing (Sep 8 push, 5/4/4/4/4/4 = 25 sets, 43 minutes).
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");
const appSrcPath = path.join(repoRoot, "src", "app.jsx");

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

// Weight inputs only — each set row renders weight/reps/rpe in that order.
function rampWeightsIn(scope) {
  return Array.from(scope.querySelectorAll('input[type="number"]'))
    .filter((_, i) => i % 3 === 0)
    .map((i) => i.value);
}

// The wrapper div around one movement: the first ancestor of its name div that
// contains a ▲ reorder button (the card itself has none).
function wrapperFor(window, name) {
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === name,
  );
  if (!nameDiv) throw new Error(`no name div found for ${name}`);
  let el = nameDiv;
  while (el && !Array.from(el.querySelectorAll("button")).some((b) => b.textContent.trim() === "▲")) {
    el = el.parentElement;
  }
  if (!el) throw new Error(`no reorder wrapper found for ${name}`);
  return el;
}

function cardHeaderIn(wrapper) {
  const header = Array.from(wrapper.querySelectorAll("div")).find(
    (d) => (d.getAttribute("style") || "").includes("cursor: pointer"),
  );
  if (!header) throw new Error("no tappable card header found");
  return header;
}

async function checkTheFourTabulatedPatterns() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  // Leg Press: increment 15, target 185 -> established 170.
  const mov = { name: "Leg Press", reps: 10, increment: 15, current: "185 lb" };

  const cases = [
    { sets: 5, types: ["E", "E", "W", "W", "W"], weights: ["170", "170", "185", "185", "185"] },
    { sets: 4, types: ["E", "W", "W", "W"], weights: ["170", "185", "185", "185"] },
    { sets: 3, types: ["W", "W", "W"], weights: ["185", "185", "185"] },
    { sets: 2, types: ["W", "W"], weights: ["185", "185"] },
  ];

  for (const c of cases) {
    const ramp = window.buildRamp(mov, 185, { setCount: c.sets });
    const types = ramp.map((s) => s.type);
    const weights = ramp.map((s) => s.weight);
    if (JSON.stringify(types) !== JSON.stringify(c.types)) {
      throw new Error(`${c.sets}-set types wrong: expected ${JSON.stringify(c.types)}, got ${JSON.stringify(types)}`);
    }
    if (JSON.stringify(weights) !== JSON.stringify(c.weights)) {
      throw new Error(`${c.sets}-set weights wrong: expected ${JSON.stringify(c.weights)}, got ${JSON.stringify(weights)}`);
    }
  }
  console.log("PASS: all four tabulated patterns (5/4/3/2 sets) generate exactly as specified");

  // THE invariant: never a third distinct weight. Checked across set counts,
  // both equipment kinds, and a range of targets — including ones where the
  // step lands on the dumbbell rack's irregular 12 lb entry.
  const movs = [
    { name: "Leg Press", reps: 10, increment: 15 },
    { name: "Cable Curl", reps: 10, increment: 5 },
    { name: "Skull Crusher", reps: 10, steps: window.DUMBBELL_STEPS },
  ];
  const targets = [5, 10, 12, 15, 20, 42.5, 50, 135, 185];
  movs.forEach((m) => {
    targets.forEach((t) => {
      for (let sets = 1; sets <= 8; sets++) {
        const ramp = window.buildRamp(m, t, { setCount: sets });
        const distinct = new Set(ramp.map((s) => s.weight));
        if (distinct.size > 2) {
          throw new Error(
            `${m.name} @ ${t} x${sets} produced ${distinct.size} distinct weights: ${JSON.stringify([...distinct])}`,
          );
        }
        if (ramp.length !== sets) {
          throw new Error(`${m.name} @ ${t} x${sets} produced ${ramp.length} sets`);
        }
      }
    });
  });
  console.log("PASS: never more than two distinct weights, across both equipment kinds and 1-8 sets");

  // 3 and 2 sets are single-weight by design.
  [3, 2, 1].forEach((sets) => {
    const distinct = new Set(window.buildRamp(mov, 185, { setCount: sets }).map((s) => s.weight));
    if (distinct.size !== 1) {
      throw new Error(`${sets} sets should be a single weight, got ${JSON.stringify([...distinct])}`);
    }
  });
  console.log("PASS: 3 and 2 sets are a single weight (and 1 set floors at one working set)");

  // Adding sets in-session must not grow a third weight — still 2 established.
  const six = window.buildRamp(mov, 185, { setCount: 6 });
  if (six.filter((s) => s.type === "E").length !== 2) {
    throw new Error("beyond 5 sets the established count should stay at 2");
  }
  console.log("PASS: beyond 5 sets the established count stays at 2 rather than adding a third weight");

  // Clamping: a target at the bottom of the range can't step below it, which
  // collapses to a single weight rather than producing something negative.
  const clamped = window.buildRamp(mov, 15, { setCount: 5 });
  if (clamped.some((s) => Number(s.weight) < 15)) {
    throw new Error(`ramp did not clamp at the lowest increment: ${JSON.stringify(clamped.map((s) => s.weight))}`);
  }
  console.log("PASS: the established weight clamps at the lowest available increment");

  // No opts at all still has to produce something sane.
  const bare = window.buildRamp(mov, 185);
  if (bare.length !== 5 || new Set(bare.map((s) => s.weight)).size !== 2) {
    throw new Error(`expected a default 5-set two-weight ramp with no opts, got ${JSON.stringify(bare)}`);
  }
  console.log("PASS: buildRamp with no opts defaults to the 5-set two-weight ramp");
  window.close();
}

// The Phase 1 tables, asserted against the authored BLOCK data rather than
// against whatever the UI happens to render — a set count that drifts here is
// a programming change, not a rendering bug.
const EXPECTED_SETS = {
  legs: [["Leg Press", 5], ["Leg Extension", 5], ["Leg Curl", 4], ["Goblet Squat", 4], ["Calf Raise", 4]],
  push: [["DB Bench Press", 5], ["Pec Fly", 4], ["Skull Crusher", 4], ["Rope Pushdown", 4], ["Shoulder Press", 4], ["Lateral Raise", 4]],
  pull: [["Seated Row", 5], ["Lat Pulldown", 4], ["DB Row", 4], ["Reverse Fly", 4], ["Cable Curl", 4], ["Hammer Curl", 4]],
};

function checkAuthoredSetCounts() {
  // BLOCK is a `const`, not a function declaration, so it isn't reachable on
  // `window` from a mounted page — read the source, same approach
  // test-dumbbell-steps.js uses for the authored data shape.
  const src = fs.readFileSync(appSrcPath, "utf8");
  Object.entries(EXPECTED_SETS).forEach(([type, rows]) => {
    rows.forEach(([name, sets]) => {
      const re = new RegExp(`\\{ name: "${name}",[^}]*?\\bsets: (\\d+)`);
      const m = src.match(re);
      if (!m) throw new Error(`no authored sets found for ${name} (${type})`);
      if (Number(m[1]) !== sets) {
        throw new Error(`${name} (${type}): expected sets: ${sets}, got ${m[1]}`);
      }
    });
  });
  const total = Object.values(EXPECTED_SETS).flat().length;
  console.log(`PASS: all ${total} default movements carry their tabulated set count`);

  // Declared ORDER matters, not just membership — queue position drives which
  // movement gets the fresh slot. Skull Crusher ahead of Rope Pushdown is the
  // Phase 2 fix: "cant do 20s after pushdowns" (Sep 8). Skull Crusher dropped
  // every time it followed the pushdowns — Aug 27 (20x10,8,5 then down to 12),
  // Sep 5 (20x8,6 then down to 15), Sep 8 (15x10x4, chip `down`).
  Object.entries(EXPECTED_SETS).forEach(([type, rows]) => {
    const block = src.match(new RegExp(`\\b${type}: \\{[\\s\\S]*?movements: \\[([\\s\\S]*?)\\n      \\]`));
    if (!block) throw new Error(`could not read the ${type} movement list`);
    const declared = [...block[1].matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
    const expected = rows.map(([name]) => name);
    if (JSON.stringify(declared) !== JSON.stringify(expected)) {
      throw new Error(
        `${type} default order wrong:\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(declared)}`,
      );
    }
  });
  const push = EXPECTED_SETS.push.map(([n]) => n);
  if (push.indexOf("Skull Crusher") > push.indexOf("Rope Pushdown")) {
    throw new Error("this test's own table has the triceps pair the wrong way round");
  }
  console.log("PASS: default movement order matches the Phase 1 tables, Skull Crusher ahead of Rope Pushdown");

  // A movement with no authored count falls back to the default rather than
  // generating nothing.
  const totals = Object.fromEntries(
    Object.entries(EXPECTED_SETS).map(([t, rows]) => [t, rows.reduce((a, [, n]) => a + n, 0)]),
  );
  if (totals.push !== 25) throw new Error(`Push should total 25 sets (the measured 43-minute session), got ${totals.push}`);
  if (totals.legs !== 22) throw new Error(`Legs should total 22 sets, got ${totals.legs}`);
  if (totals.pull !== 25) throw new Error(`Pull should total 25 sets, got ${totals.pull}`);
  console.log("PASS: session set totals are 22 legs / 25 push / 25 pull");
}

async function checkSetCountFallbackAndLiveRamp() {
  const { window, errors } = await mount();
  if (window.setCountFor({ name: "X" }) !== 5) {
    throw new Error("a movement with no authored sets should fall back to 5");
  }
  if (window.setCountFor({ name: "X", sets: 4 }) !== 4) {
    throw new Error("an authored set count should win");
  }
  console.log("PASS: setCountFor uses the authored count and falls back to 5");

  // Live app: the Legs opener generates its authored 5 sets as two weights.
  click(window, byText(window, "button", "Legs"));
  await sleep(window, 60);
  const wrap = wrapperFor(window, "Leg Press");
  click(window, cardHeaderIn(wrap));
  await sleep(window, 40);
  const starred = Array.from(wrap.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  if (!starred) throw new Error("no suggested chip found for Leg Press");
  click(window, starred);
  await sleep(window, 60);
  const weights = rampWeightsIn(wrap);
  if (weights.length !== 5) {
    throw new Error(`expected Leg Press's authored 5 sets, got ${weights.length}: ${JSON.stringify(weights)}`);
  }
  if (new Set(weights).size !== 2) {
    throw new Error(`expected exactly two distinct weights in the live app, got ${JSON.stringify(weights)}`);
  }
  if (weights[0] !== weights[1] || weights[2] !== weights[4]) {
    throw new Error(`expected [E, E, T, T, T], got ${JSON.stringify(weights)}`);
  }
  console.log("PASS: the Legs opener generates its authored 5 sets as [E, E, T, T, T] in the live app");

  // Leg Curl is authored at 4 -> one established set.
  const curl = wrapperFor(window, "Leg Curl");
  click(window, cardHeaderIn(curl));
  await sleep(window, 40);
  const curlChip = Array.from(curl.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  click(window, curlChip);
  await sleep(window, 60);
  const curlWeights = rampWeightsIn(curl);
  if (curlWeights.length !== 4) {
    throw new Error(`expected Leg Curl's authored 4 sets, got ${curlWeights.length}`);
  }
  if (new Set(curlWeights).size !== 2 || curlWeights[1] !== curlWeights[3]) {
    throw new Error(`expected [E, T, T, T] for a 4-set movement, got ${JSON.stringify(curlWeights)}`);
  }
  console.log("PASS: a 4-set movement generates [E, T, T, T]");

  // In-session adjustability: the owner explicitly wants to add work when
  // time permits, and doing so must not introduce a third weight.
  const addBtn = Array.from(curl.querySelectorAll("button")).find((b) => b.textContent.trim().startsWith("+"));
  if (!addBtn) throw new Error("no add-set affordance on a movement card");
  click(window, addBtn);
  await sleep(window, 60);
  const grown = rampWeightsIn(curl);
  if (grown.length !== 5) throw new Error(`expected 5 sets after adding one, got ${grown.length}`);
  if (new Set(grown).size !== 2) {
    throw new Error(`adding a set introduced a third weight: ${JSON.stringify(grown)}`);
  }
  console.log("PASS: set counts stay adjustable in-session without introducing a third weight");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkSupersetMembersUseTheSameTable() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 60);
  const pairHeader = Array.from(window.document.querySelectorAll("div")).find(
    (d) =>
      (d.getAttribute("style") || "").includes("cursor: pointer") &&
      d.textContent.trim().startsWith("SUPERSET ·"),
  );
  if (!pairHeader) throw new Error("no superset card header found on Pull");
  const card = pairHeader.parentElement;
  click(window, pairHeader);
  await sleep(window, 40);
  const stars = Array.from(card.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  if (!stars.length) throw new Error("no suggested chip on the superset card");
  for (const s of stars) {
    click(window, s);
    await sleep(window, 40);
  }
  await sleep(window, 40);

  // Superset members are authored at 4 sets, so they follow the same table as
  // anything else at 4: one established set, three at target. (Under the Sep 8
  // rules they got four straight working sets; the two-weight table is
  // unconditional and supersedes that.)
  const rounds = Array.from(card.querySelectorAll("div")).filter((d) =>
    /^Set \d+$/.test(d.textContent.trim()),
  );
  if (rounds.length !== 4) throw new Error(`expected 4 superset rounds, got ${rounds.length}`);
  const rows = rampWeightsIn(card);
  if (rows.length !== 8) throw new Error(`expected 8 rows (4 rounds x 2 movements), got ${rows.length}`);
  const perMovement = [rows.filter((_, i) => i % 2 === 0), rows.filter((_, i) => i % 2 === 1)];
  perMovement.forEach((weights, n) => {
    const distinct = new Set(weights);
    if (distinct.size > 2) {
      throw new Error(`superset movement ${n} generated ${distinct.size} distinct weights: ${JSON.stringify(weights)}`);
    }
    if (weights[1] !== weights[3]) {
      throw new Error(`superset movement ${n} should be [E, T, T, T], got ${JSON.stringify(weights)}`);
    }
  });
  console.log("PASS: superset members follow the same 4-set table ([E, T, T, T]), never a third weight");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkTheFourTabulatedPatterns();
  checkAuthoredSetCounts();
  await checkSetCountFallbackAndLiveRamp();
  await checkSupersetMembersUseTheSameTable();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

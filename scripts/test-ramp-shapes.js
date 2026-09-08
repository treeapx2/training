#!/usr/bin/env node
// Behavioral jsdom check for POSITION-AWARE ramp generation (see CLAUDE.md
// "Target picker" — CHANGES.md Sep 8 2026, Phase 1). Registered as
// validation bar check #12; also runnable alone via
// `npm run test:ramp-shapes`.
//
// Replaces the Aug 19 set-count table. The old shape landed only 2 of 5 sets
// at working weight — 60% warm-up tax — because it re-warmed the muscle
// group on every movement. Warm-up is a per-session need, so only the opener
// earns a full ramp; everything after it starts at one build set, and
// superset members (which sit last, on an already-warm muscle group) carry
// no warm-up at all.
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

// The wrapper div around one movement — it holds the reorder controls
// (▲/▼, the "#n" position label) as well as the movement's own card. Walking
// up from the name div, the FIRST ancestor containing a ▲ button is this
// wrapper: the card itself has no reorder controls, and every ancestor above
// the wrapper holds every other movement's controls too.
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

// Weight inputs only — each set row renders weight/reps/rpe in that order.
function rampWeightsIn(scope) {
  return Array.from(scope.querySelectorAll('input[type="number"]'))
    .filter((_, i) => i % 3 === 0)
    .map((i) => i.value);
}

async function checkAllFourTabulatedShapes() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  // Leg Press: increment 15, target 185 -> wu=155, b=170.
  const mov = { name: "Leg Press", reps: 10, increment: 15, current: "185 lb" };

  const cases = [
    {
      label: "position 1 (opener)",
      opts: { position: 0 },
      types: ["WU", "B", "W", "W", "W"],
      weights: ["155", "170", "185", "185", "185"],
    },
    {
      label: "position 2",
      opts: { position: 1 },
      types: ["B", "W", "W", "W"],
      weights: ["170", "185", "185", "185"],
    },
    {
      label: "position 6",
      opts: { position: 5 },
      types: ["B", "W", "W", "W"],
      weights: ["170", "185", "185", "185"],
    },
    {
      label: "superset member",
      opts: { position: 4, isSuperset: true },
      types: ["W", "W", "W", "W"],
      weights: ["185", "185", "185", "185"],
    },
    {
      label: "2-set movement",
      opts: { position: 0, setCount: 2 },
      types: ["W", "W"],
      weights: ["185", "185"],
    },
  ];

  for (const c of cases) {
    const ramp = window.buildRamp(mov, 185, c.opts);
    const types = ramp.map((s) => s.type);
    const weights = ramp.map((s) => s.weight);
    if (JSON.stringify(types) !== JSON.stringify(c.types)) {
      throw new Error(`${c.label} shape types wrong: expected ${JSON.stringify(c.types)}, got ${JSON.stringify(types)}`);
    }
    if (JSON.stringify(weights) !== JSON.stringify(c.weights)) {
      throw new Error(`${c.label} shape weights wrong: expected ${JSON.stringify(c.weights)}, got ${JSON.stringify(weights)}`);
    }
  }
  console.log("PASS: all four tabulated ramp patterns (opener / position 2+ / superset / 2-set) generate exactly as specified");

  // Working-set counts are the point of the restructure: 3/3/4 working sets,
  // versus 2 of 5 under the old shape.
  const working = (opts) => window.buildRamp(mov, 185, opts).filter((s) => s.type === "W").length;
  if (working({ position: 0 }) !== 3) throw new Error("opener must land 3 working sets");
  if (working({ position: 1 }) !== 3) throw new Error("position 2+ must land 3 working sets");
  if (working({ position: 4, isSuperset: true }) !== 4) throw new Error("superset member must land 4 working sets");
  console.log("PASS: working-set counts are 3 / 3 / 4 (opener / position 2+ / superset member)");

  // A superset member is 4 rounds regardless of derived set count — the pair's
  // rows are interleaved, so a mismatched count renders ragged.
  const supersetTwo = window.buildRamp(mov, 185, { position: 4, isSuperset: true, setCount: 2 });
  if (supersetTwo.length !== 4) {
    throw new Error(`superset member must stay at 4 rounds even with a 2-set history, got ${supersetTwo.length}`);
  }
  console.log("PASS: superset membership overrides a 2-set derived count (4 rounds, interleaving stays aligned)");

  // Floor: 1 set (and 0, defensively) never goes below one working set.
  const one = window.buildRamp(mov, 185, { position: 0, setCount: 1 });
  if (one.length !== 1 || one[0].type !== "W" || one[0].weight !== "185") {
    throw new Error(`expected a 1-set floor of [{type:"W", weight:"185"}], got ${JSON.stringify(one)}`);
  }
  const zero = window.buildRamp(mov, 185, { position: 0, setCount: 0 });
  if (zero.length !== 1 || zero[0].type !== "W") {
    throw new Error(`expected setCount 0 to still floor at one working set, got ${JSON.stringify(zero)}`);
  }
  console.log("PASS: a derived set count <= 1 floors at exactly one working set");

  // No opts at all still has to produce something sane (opener shape).
  const bare = window.buildRamp(mov, 185);
  if (bare.length !== 5 || bare[0].type !== "WU") {
    throw new Error(`expected the opener shape with no opts, got ${JSON.stringify(bare.map((s) => s.type))}`);
  }
  console.log("PASS: buildRamp with no opts defaults to the opener shape");
  window.close();
}

async function checkPositionAwareRampsInTheLiveApp() {
  const { window, errors } = await mount();
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const byText = (tag, text) =>
    Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

  click(byText("button", "Legs"));
  await sleep(40);

  // Leg Press is the Legs opener (position 1) -> full ramp, 5 sets.
  const openerWrap = wrapperFor(window, "Leg Press");
  click(cardHeaderIn(openerWrap));
  await sleep(40);
  let starred = Array.from(openerWrap.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  if (!starred) throw new Error("no suggested chip found for Leg Press");
  click(starred);
  await sleep(40);
  let weights = rampWeightsIn(openerWrap);
  if (weights.length !== 5) {
    throw new Error(`expected the opener to generate 5 sets, got ${weights.length}: ${JSON.stringify(weights)}`);
  }
  if (new Set(weights).size < 3) {
    throw new Error(`expected the opener's ramp to carry a warmup and a build set, got ${JSON.stringify(weights)}`);
  }
  console.log("PASS: the session opener generates a full 5-set ramp in the live app");

  // Leg Extension sits at position 2 -> one build set, 4 sets total.
  const secondWrap = wrapperFor(window, "Leg Extension");
  click(cardHeaderIn(secondWrap));
  await sleep(40);
  starred = Array.from(secondWrap.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  if (!starred) throw new Error("no suggested chip found for Leg Extension");
  click(starred);
  await sleep(40);
  weights = rampWeightsIn(secondWrap);
  if (weights.length !== 4) {
    throw new Error(`expected a position-2 movement to generate 4 sets, got ${weights.length}: ${JSON.stringify(weights)}`);
  }
  if (new Set(weights).size !== 2) {
    throw new Error(`expected exactly one build set below three working sets, got ${JSON.stringify(weights)}`);
  }
  console.log("PASS: a position-2+ movement generates a 4-set ramp with one build set");

  // Reordering it up to position 1 must regenerate the ramp (no sets logged,
  // so this is silent — no confirm).
  const up = Array.from(secondWrap.querySelectorAll("button")).find((b) => b.textContent.trim() === "▲");
  if (!up) throw new Error("no ▲ reorder button found for Leg Extension");
  click(up);
  await sleep(60);
  const movedWrap = wrapperFor(window, "Leg Extension");
  weights = rampWeightsIn(movedWrap);
  if (weights.length !== 5) {
    throw new Error(`expected the ramp to regenerate to 5 sets after moving to position 1, got ${weights.length}: ${JSON.stringify(weights)}`);
  }
  if (new Set(weights).size < 3) {
    throw new Error(`expected a warmup + build after the move to position 1, got ${JSON.stringify(weights)}`);
  }
  console.log("PASS: reordering a movement to position 1 regenerates its ramp to the opener shape");

  // And the movement it displaced drops from 5 sets to 4.
  const demotedWrap = wrapperFor(window, "Leg Press");
  weights = rampWeightsIn(demotedWrap);
  if (weights.length !== 4) {
    throw new Error(`expected the displaced opener to regenerate to 4 sets, got ${weights.length}: ${JSON.stringify(weights)}`);
  }
  console.log("PASS: the displaced movement regenerates to the position-2+ shape");

  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkSupersetMembersCarryNoWarmup() {
  const { window, errors } = await mount();
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const byText = (tag, text) =>
    Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

  click(byText("button", "Pull"));
  await sleep(40);

  // The pre-seeded Pull superset renders as one combined card, headed
  // "SUPERSET · A + B". Open it and drive both movements' chips; every
  // generated row must sit at its own movement's target weight, with no
  // warmup or build row anywhere.
  const pairHeader = Array.from(window.document.querySelectorAll("div")).find(
    (d) =>
      (d.getAttribute("style") || "").includes("cursor: pointer") &&
      d.textContent.trim().startsWith("SUPERSET ·"),
  );
  if (!pairHeader) throw new Error("no superset card header found on Pull");
  const card = pairHeader.parentElement;
  click(pairHeader);
  await sleep(40);
  const stars = Array.from(card.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  if (!stars.length) throw new Error("no suggested chip found on the superset card");
  for (const s of stars) {
    click(s);
    await sleep(40);
  }
  await sleep(40);

  // Four interleaved rounds, each rendering one row per movement -> 8 rows.
  const roundLabels = Array.from(card.querySelectorAll("div")).filter((d) =>
    /^Set \d+$/.test(d.textContent.trim()),
  );
  if (roundLabels.length !== 4) {
    throw new Error(`expected exactly 4 superset rounds, got ${roundLabels.length}`);
  }
  const rows = rampWeightsIn(card);
  if (rows.length !== 8) {
    throw new Error(`expected 8 set rows (4 rounds x 2 movements), got ${rows.length}: ${JSON.stringify(rows)}`);
  }
  // Each movement's own 4 rows are all at that movement's working weight;
  // the two movements are different equipment here, so their weights differ.
  const perMovement = [rows.filter((_, i) => i % 2 === 0), rows.filter((_, i) => i % 2 === 1)];
  perMovement.forEach((weights, n) => {
    if (new Set(weights).size !== 1) {
      throw new Error(`superset movement ${n} generated a warmup/build row: ${JSON.stringify(weights)}`);
    }
  });
  console.log("PASS: superset members generate 4 working-weight-only rounds (no warmup, no build)");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkAllFourTabulatedShapes();
  await checkPositionAwareRampsInTheLiveApp();
  await checkSupersetMembersCarryNoWarmup();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

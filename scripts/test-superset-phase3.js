#!/usr/bin/env node
// Behavioral jsdom check for superset Phase 3a/3b (see CLAUDE.md
// "Supersets" — CHANGES.md Aug 19 2026, Phase 3). Registered as validation
// bar check #13; also runnable alone via `npm run test:superset-phase3`.
//
// Covers:
//   - A free-weight pair (both movements use `steps`) can share one
//     down/hold/up chip row instead of two independent pickers, and tapping a
//     shared chip drives both movements to the identical target weight.
//     DB Row + Reverse Fly is the only dumbbell+dumbbell adjacent pair in the
//     app (Calf Raise is `increment`, so the Legs pre-seeded pair is mixed),
//     so it is linked manually here.
//   - Sharing is no longer the DEFAULT for a far-apart pair (Oct 12 2026
//     notes review): DB Row derives 50 and Reverse Fly 15, seven chip
//     positions apart, and defaulting to shared targeted Reverse Fly at
//     50 lb/hand on Oct 5 2026. A pair only starts shared when the two
//     baselines are within SHARED_WEIGHT_MAX_STEPS. Since that is the only
//     free-weight pair here, the effect is that sharing is opt-in — one tap
//     of "link weights", which is what the rest of this test exercises.
//   - "unlink weights" reverts to two independent ChipPickers for that pair;
//     "link weights" enables the shared picker.
//   - A mixed pair (one dumbbell, one machine — Shoulder Press + Lateral
//     Raise, pre-seeded) never shows the shared-weight picker at all.
//   - "+ add round" appends one more set to both movements at once.
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
  window.confirm = () => true;
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
const clickableWithText = (window, text) =>
  Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === text && (d.getAttribute("style") || "").includes("cursor: pointer"),
  );

async function checkFreeWeightPairSharesOneWeight() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);

  // DB Row and Reverse Fly are adjacent, both dumbbell movements, and
  // neither is pre-seeded into a pair — link them manually.
  const linkBtn = byText(window, "button", "⛓ link with Reverse Fly");
  if (!linkBtn) throw new Error("expected a manual link affordance between DB Row and Reverse Fly");
  click(window, linkBtn);
  await sleep(window, 40);

  const header = clickableWithText(window, "SUPERSET · DB Row + Reverse Flyunlink");
  if (!header) throw new Error("DB Row + Reverse Fly superset header not found");
  // Scope subsequent queries to this pair's own card -- other cards on the
  // page (and non-set inputs like the cardio finisher) share the same
  // input[type="number"] shape and would otherwise pollute the count.
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);

  // DB Row (50) and Reverse Fly (15) are seven chip positions apart, so this
  // pair must NOT start shared — that default is what targeted Reverse Fly at
  // 50 lb/hand on Oct 5 2026, more than three times its working weight.
  if (card.textContent.includes("shared weight")) {
    throw new Error("a pair whose baselines are 7 steps apart must not default to a shared weight");
  }
  const optIn = Array.from(card.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "link weights",
  );
  if (!optIn) throw new Error("expected a 'link weights' affordance to opt into sharing");
  click(window, optIn);
  await sleep(window, 40);

  const rootText = card.textContent;
  if (!rootText.includes("shared weight")) {
    throw new Error("expected a shared-weight picker after opting in");
  }

  const chipRow = Array.from(card.querySelectorAll("button")).filter((b) =>
    /^\d+(\.\d+)?\s*★?$/.test(b.textContent.trim()),
  );
  if (chipRow.length !== 3) throw new Error(`expected exactly 3 shared chips (down/hold/up), found ${chipRow.length}`);
  const middle = chipRow[1];
  click(window, middle);
  await sleep(window, 40);

  // Both movements are fresh (no history), so each gets the default 5-set
  // tapered ramp (WU/B/B/W/W) -- weights within a movement's own ramp are
  // NOT all identical, but the two movements' ramps (interleaved A/B per
  // round) must match each other set-for-set, since both were built from
  // the same shared target weight.
  const weightInputs = Array.from(card.querySelectorAll('input[type="number"]')).filter(
    (_, i) => i % 3 === 0,
  );
  const values = weightInputs.map((i) => i.value);
  console.log("Interleaved A/B weight column after shared chip tap:", JSON.stringify(values));
  if (values.length < 4 || values.length % 2 !== 0) {
    throw new Error(`expected an even number of >=4 weight values (interleaved per round), got ${JSON.stringify(values)}`);
  }
  const movAWeights = values.filter((_, i) => i % 2 === 0);
  const movBWeights = values.filter((_, i) => i % 2 === 1);
  if (JSON.stringify(movAWeights) !== JSON.stringify(movBWeights)) {
    throw new Error(
      `expected both movements' ramps to match set-for-set (same shared weight), got A=${JSON.stringify(movAWeights)} B=${JSON.stringify(movBWeights)}`,
    );
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: a far-apart free-weight pair starts independent, and opting in shares one weight across both ramps set-for-set");
  window.close();
}

async function checkUnlinkAndRelinkWeights() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  click(window, byText(window, "button", "⛓ link with Reverse Fly"));
  await sleep(window, 40);
  click(window, clickableWithText(window, "SUPERSET · DB Row + Reverse Flyunlink"));
  await sleep(window, 40);

  // The default is now independent for this pair, so link first, then unlink —
  // the toggle has to work in both directions either way.
  let rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("DB Row") || !rootText.includes("Reverse Fly")) {
    throw new Error("both movement names should render as independent chip pickers");
  }
  const linkBtn = byText(window, "button", "link weights");
  if (!linkBtn) throw new Error("expected a 'link weights' affordance for a free-weight pair");
  click(window, linkBtn);
  await sleep(window, 40);
  rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("shared weight")) {
    throw new Error("shared-weight picker should appear after 'link weights'");
  }

  const unlinkWeightsBtn = byText(window, "button", "unlink weights");
  if (!unlinkWeightsBtn) throw new Error("expected an 'unlink weights' affordance once weights are shared");
  click(window, unlinkWeightsBtn);
  await sleep(window, 40);
  rootText = window.document.getElementById("root").textContent;
  if (rootText.includes("shared weight")) {
    throw new Error("shared-weight picker should be gone after 'unlink weights'");
  }
  if (!rootText.includes("DB Row") || !rootText.includes("Reverse Fly")) {
    throw new Error("both movement names should still render as independent chip pickers");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: 'link weights' / 'unlink weights' toggles the shared picker without breaking the superset pairing");
  window.close();
}

async function checkMixedPairNeverSharesWeight() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);
  click(window, clickableWithText(window, "SUPERSET · Shoulder Press + Lateral Raiseunlink"));
  await sleep(window, 40);

  const rootText = window.document.getElementById("root").textContent;
  if (rootText.includes("shared weight")) {
    throw new Error("a mixed machine+dumbbell pair (Shoulder Press + Lateral Raise) must never offer a shared weight");
  }
  if (!rootText.includes("Shoulder Press") || !rootText.includes("Lateral Raise")) {
    throw new Error("expected two independent chip pickers for the mixed pair");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: a mixed machine+dumbbell pair (Shoulder Press + Lateral Raise) never shows the shared-weight picker");
  window.close();
}

async function checkAddRoundAppendsToBothMovements() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  const header = clickableWithText(window, "SUPERSET · Cable Curl + Hammer Curlunlink");
  if (!header) throw new Error("Cable Curl + Hammer Curl superset header not found");
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);

  const starred = Array.from(card.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  starred.forEach((b) => click(window, b));
  await sleep(window, 40);

  const setLabelCountBefore = Array.from(card.querySelectorAll("div")).filter(
    (d) => /^Set \d+$/.test(d.textContent.trim()),
  ).length;

  const addRoundBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "+ add round");
  if (!addRoundBtn) throw new Error("expected a '+ add round' button once both movements have planned sets");
  click(window, addRoundBtn);
  await sleep(window, 40);

  const setLabelCountAfter = Array.from(card.querySelectorAll("div")).filter(
    (d) => /^Set \d+$/.test(d.textContent.trim()),
  ).length;
  console.log(`Set rows before/after add round: ${setLabelCountBefore} -> ${setLabelCountAfter}`);
  if (setLabelCountAfter !== setLabelCountBefore + 1) {
    throw new Error(`expected exactly one new "Set N" row after add round, went from ${setLabelCountBefore} to ${setLabelCountAfter}`);
  }

  const weightInputs = Array.from(card.querySelectorAll('input[type="number"]')).filter(
    (_, i) => i % 3 === 0,
  );
  if (weightInputs.length !== setLabelCountAfter * 2) {
    throw new Error(
      `expected add round to append a set to BOTH movements (${setLabelCountAfter * 2} weight inputs), got ${weightInputs.length}`,
    );
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: '+ add round' appends one paired set to both movements at once");
  window.close();
}

// The closeness gate itself (Oct 12 2026). No pair of adjacent defaults is
// both free-weight AND close, so the "starts shared" branch is covered here
// directly rather than through the UI.
async function checkSharedWeightClosenessGate() {
  const { window } = await mount();
  const rack = [5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50];
  const db = { name: "X", steps: rack, reps: 10 };
  const d = (a, b) => window.stepDistance(db, a, b);

  if (d(45, 45) !== 0) throw new Error("the same weight is zero steps apart");
  if (d(45, 50) !== 1) throw new Error("45 and 50 are one chip apart");
  if (d(40, 50) !== 2) throw new Error("40 and 50 are two chips apart");
  if (d(15, 50) !== 7) throw new Error(`DB Row vs Reverse Fly should be 7 chips apart, got ${d(15, 50)}`);
  // Order must not matter — the pair is symmetric.
  if (d(50, 15) !== d(15, 50)) throw new Error("step distance must be symmetric");
  // An unknown baseline must never read as close enough to link.
  if (d(0, 50) !== Infinity) throw new Error("a missing baseline is never close enough");
  if (window.stepDistance(null, 45, 50) !== Infinity) throw new Error("a missing movement is never close enough");
  // The rack's irregular 12 lb entry is walked, not assumed.
  if (d(10, 15) !== 2) throw new Error(`10 -> 12 -> 15 is two chips, got ${d(10, 15)}`);

  // A module-level const is not reachable on window — read the authored
  // threshold out of the source, the way the other authored-data checks do.
  const srcText = fs.readFileSync(path.join(repoRoot, "src/app.jsx"), "utf8");
  const m = srcText.match(/const SHARED_WEIGHT_MAX_STEPS = (\d+);/);
  if (!m) throw new Error("could not read SHARED_WEIGHT_MAX_STEPS from src/app.jsx");
  const maxSteps = Number(m[1]);
  if (!(maxSteps >= 1)) {
    throw new Error("SHARED_WEIGHT_MAX_STEPS must allow at least one step of difference");
  }
  if (d(15, 50) <= maxSteps) {
    throw new Error("the DB Row + Reverse Fly pair must fall outside the sharing threshold");
  }
  if (d(45, 50) > maxSteps) {
    throw new Error("a one-chip gap must fall inside the sharing threshold");
  }
  console.log(`PASS: stepDistance gates shared weight at ${maxSteps} chips (DB Row/Reverse Fly is 7)`);
  window.close();
}

async function main() {
  await checkFreeWeightPairSharesOneWeight();
  await checkUnlinkAndRelinkWeights();
  await checkMixedPairNeverSharesWeight();
  await checkSharedWeightClosenessGate();
  await checkAddRoundAppendsToBothMovements();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

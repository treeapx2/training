#!/usr/bin/env node
// Behavioral jsdom check for superset Phase 3a/3b (see CLAUDE.md
// "Supersets" — CHANGES.md Aug 19 2026, Phase 3). Registered as validation
// bar check #13; also runnable alone via `npm run test:superset-phase3`.
//
// Covers:
//   - A free-weight pair (both movements use `steps`, e.g. Rope Pushdown +
//     Skull Crusher... no, Rope Pushdown is cable-machine — the real
//     free-weight pre-seeded pair is none of the three by default, so this
//     test manually links two dumbbell movements: Hammer Curl + Zottman
//     Curl) offers one shared down/hold/up chip row instead of two
//     independent pickers, and tapping a shared chip drives both movements
//     to the identical target weight.
//   - "unlink weights" reverts to two independent ChipPickers for that pair;
//     "link weights" re-enables the shared picker.
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

  // Hammer Curl and Zottman Curl are adjacent, both dumbbell movements, and
  // neither is pre-seeded into a pair — link them manually.
  const linkBtn = byText(window, "button", "⛓ link with Zottman Curl");
  if (!linkBtn) throw new Error("expected a manual link affordance between Hammer Curl and Zottman Curl");
  click(window, linkBtn);
  await sleep(window, 40);

  const header = clickableWithText(window, "SUPERSET · Hammer Curl + Zottman Curlunlink");
  if (!header) throw new Error("Hammer Curl + Zottman Curl superset header not found");
  // Scope subsequent queries to this pair's own card -- other cards on the
  // page (and non-set inputs like the cardio finisher) share the same
  // input[type="number"] shape and would otherwise pollute the count.
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);

  const rootText = card.textContent;
  if (!rootText.includes("shared weight")) {
    throw new Error("expected a shared-weight picker for a free-weight (dumbbell+dumbbell) pair");
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
  console.log("PASS: a free-weight superset offers one shared weight and drives both movements' ramps to it set-for-set");
  window.close();
}

async function checkUnlinkAndRelinkWeights() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  click(window, byText(window, "button", "⛓ link with Zottman Curl"));
  await sleep(window, 40);
  click(window, clickableWithText(window, "SUPERSET · Hammer Curl + Zottman Curlunlink"));
  await sleep(window, 40);

  const unlinkWeightsBtn = byText(window, "button", "unlink weights");
  if (!unlinkWeightsBtn) throw new Error("expected an 'unlink weights' affordance for a free-weight pair");
  click(window, unlinkWeightsBtn);
  await sleep(window, 40);

  let rootText = window.document.getElementById("root").textContent;
  if (rootText.includes("shared weight")) {
    throw new Error("shared-weight picker should be gone after 'unlink weights'");
  }
  if (!rootText.includes("Hammer Curl") || !rootText.includes("Zottman Curl")) {
    throw new Error("both movement names should still render as independent chip pickers");
  }

  const relinkBtn = byText(window, "button", "link weights");
  if (!relinkBtn) throw new Error("expected a 'link weights' affordance to re-enable the shared picker");
  click(window, relinkBtn);
  await sleep(window, 40);
  rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("shared weight")) {
    throw new Error("shared-weight picker should reappear after 'link weights'");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: 'unlink weights' / 'link weights' toggles the shared picker without breaking the superset pairing");
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
  const header = clickableWithText(window, "SUPERSET · Cable Curl + Reverse Flyunlink");
  if (!header) throw new Error("Cable Curl + Reverse Fly superset header not found");
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

async function main() {
  await checkFreeWeightPairSharesOneWeight();
  await checkUnlinkAndRelinkWeights();
  await checkMixedPairNeverSharesWeight();
  await checkAddRoundAppendsToBothMovements();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

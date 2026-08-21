#!/usr/bin/env node
// Behavioral jsdom check for supersets (see CLAUDE.md "Supersets" —
// CHANGES.md Aug 10 2026, Phase 3, revised Aug 19 2026 Phase 3c). Registered
// as validation bar check #8 so `npm test` alone still runs it; also
// runnable alone via `npm run test:superset`.
//
// Covers:
//   - The three revised pre-seeded pairs (Shoulder Press+Lateral Raise,
//     Rope Pushdown+Skull Crusher, Cable Curl+Reverse Fly) render as a
//     combined SUPERSET card by default; Legs has none (Leg Extension +
//     Calf Raise, a machine+machine pair, was removed).
//   - Each movement in a pair keeps its own target chips (including a
//     steps-based movement, Lateral Raise) and its own ramp.
//   - Finishing persists a shared supersetId on both movements, plus each
//     movement's own targetWeight/chipChoice/order.
//   - Unlinking removes the pairing (both visually and in a subsequent
//     finish()) and does not discard already-logged sets.
//   - A non-pre-seeded pair can be linked manually.
//
// Shared-weight (3a) and add-round (3b) behavior for free-weight pairs is
// covered separately in test-superset-phase3.js — this file is scoped to
// the pre-existing superset-card mechanics that Phase 3c's pair reshuffle
// touches.
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
// Header divs render their own clickable container's text PLUS every
// descendant's (e.g. "unlink"), and ancestor wrapper divs repeat that same
// aggregated text — so match on both text and the actual cursor:pointer
// handler element, not just the first textContent match in document order.
const clickableWithText = (window, text) =>
  Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === text && (d.getAttribute("style") || "").includes("cursor: pointer"),
  );
const expandMovement = async (window, name) => {
  const header = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === name);
  let node = header;
  while (node && !(node.getAttribute("style") || "").includes("cursor: pointer")) node = node.parentElement;
  click(window, node);
  await sleep(window, 40);
};

async function checkPreSeededPairsRenderForEveryType() {
  const { window, errors } = await mount();
  const expected = {
    Push: ["SUPERSET · Shoulder Press + Lateral Raiseunlink", "SUPERSET · Rope Pushdown + Skull Crusherunlink"],
    Pull: ["SUPERSET · Cable Curl + Reverse Flyunlink"],
    Legs: [],
  };
  for (const [typeLabel, headers] of Object.entries(expected)) {
    click(window, byText(window, "button", typeLabel));
    await sleep(window, 40);
    for (const h of headers) {
      if (!clickableWithText(window, h)) {
        throw new Error(`expected pre-seeded superset header not found for ${typeLabel}: "${h}"`);
      }
    }
    if (typeLabel === "Legs") {
      const anySuperset = Array.from(window.document.querySelectorAll("div")).some((d) =>
        d.textContent.trim().startsWith("SUPERSET ·"),
      );
      if (anySuperset) {
        throw new Error("Legs should have no pre-seeded superset pairs (Leg Extension + Calf Raise was removed, machine+machine)");
      }
    }
    // Cancel back out to the type-selection screen for the next type.
    const cancelBtn = byText(window, "button", "cancel");
    if (cancelBtn) {
      click(window, cancelBtn);
      await sleep(window, 40);
    }
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: the three revised pre-seeded pairs render as combined cards; Legs has none");
  window.close();
}

async function checkChipsAndFinishPersistSupersetId() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);

  const header = clickableWithText(window, "SUPERSET · Shoulder Press + Lateral Raiseunlink");
  if (!header) throw new Error("Shoulder Press + Lateral Raise superset header not found");
  click(window, header);
  await sleep(window, 40);

  const starred = Array.from(window.document.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  if (starred.length !== 2) throw new Error(`expected 2 suggested chips (one per movement), found ${starred.length}`);
  starred.forEach((b) => click(window, b));
  await sleep(window, 40);

  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("Set 1")) throw new Error("interleaved set rows did not appear after both chips tapped");

  const logBtns = () => Array.from(window.document.querySelectorAll("button")).filter((b) => b.textContent.trim() === "log");
  // Log one set for each movement (first two "log" buttons belong to the
  // two interleaved rows of Set 1 — Shoulder Press then Lateral Raise).
  let lb = logBtns();
  click(window, lb[0]);
  await sleep(window, 30);
  lb = logBtns();
  click(window, lb[0]);
  await sleep(window, 30);

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 80);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const shoulderPress = entry.movements.find((m) => m.name === "Shoulder Press");
  const lateralRaise = entry.movements.find((m) => m.name === "Lateral Raise");
  console.log("Persisted pair:", JSON.stringify({ shoulderPress, lateralRaise }));
  if (!shoulderPress || !lateralRaise) throw new Error("both paired movements should be in the finished record");
  if (!shoulderPress.supersetId || shoulderPress.supersetId !== lateralRaise.supersetId) {
    throw new Error(`expected matching supersetId on both movements, got ${shoulderPress.supersetId} / ${lateralRaise.supersetId}`);
  }
  if (shoulderPress.sets.length !== 1 || lateralRaise.sets.length !== 1) {
    throw new Error("expected exactly 1 logged set per movement");
  }
  if (!shoulderPress.targetWeight || !lateralRaise.targetWeight) {
    throw new Error("expected each movement to have its own targetWeight persisted");
  }
  console.log("PASS: chips work per-movement (incl. steps-based Lateral Raise) and finish persists a shared supersetId");
  window.close();
}

async function checkUnlinkPreservesLoggedDataAndBreaksThePair() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);
  click(window, clickableWithText(window, "SUPERSET · Shoulder Press + Lateral Raiseunlink"));
  await sleep(window, 40);

  const starred = Array.from(window.document.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  starred.forEach((b) => click(window, b));
  await sleep(window, 40);

  const logBtns = () => Array.from(window.document.querySelectorAll("button")).filter((b) => b.textContent.trim() === "log");
  click(window, logBtns()[0]);
  await sleep(window, 30);

  const unlinkBtns = Array.from(window.document.querySelectorAll("button")).filter((b) => b.textContent.trim() === "unlink");
  if (!unlinkBtns.length) throw new Error("no unlink button found");
  click(window, unlinkBtns[0]);
  await sleep(window, 40);

  if (clickableWithText(window, "SUPERSET · Shoulder Press + Lateral Raiseunlink")) {
    throw new Error("superset card should be gone after unlinking");
  }

  await expandMovement(window, "Shoulder Press");
  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("sets logged")) {
    throw new Error("expected Shoulder Press's logged set to survive unlinking");
  }

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 80);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const shoulderPress = entry.movements.find((m) => m.name === "Shoulder Press");
  if (!shoulderPress) throw new Error("Shoulder Press should still be in the finished record after unlinking");
  if (shoulderPress.supersetId) throw new Error(`expected no supersetId after unlinking, got ${shoulderPress.supersetId}`);
  if (shoulderPress.sets.length !== 1) throw new Error("expected the pre-unlink logged set to survive");
  console.log("PASS: unlinking breaks the pair, keeps logged data, and finish() records no supersetId");
  window.close();
}

async function checkManualLinkOfNonSeededPair() {
  const { window, errors } = await mount();
  // Legs has no pre-seeded pairs as of Phase 3c (Leg Extension + Calf Raise,
  // a machine+machine pair, was removed) — Leg Press and Leg Extension are
  // both unpaired and adjacent, so manual linking is exercised here.
  click(window, byText(window, "button", "Legs"));
  await sleep(window, 40);

  const linkBtn = byText(window, "button", "⛓ link with Leg Extension");
  if (!linkBtn) throw new Error("expected a manual link affordance between Leg Press and Leg Extension");
  click(window, linkBtn);
  await sleep(window, 40);

  if (!clickableWithText(window, "SUPERSET · Leg Press + Leg Extensionunlink")) {
    throw new Error("manually linked pair did not render as a combined card");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: a non-pre-seeded pair can be linked manually");
  window.close();
}

async function main() {
  await checkPreSeededPairsRenderForEveryType();
  await checkChipsAndFinishPersistSupersetId();
  await checkUnlinkPreservesLoggedDataAndBreaksThePair();
  await checkManualLinkOfNonSeededPair();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

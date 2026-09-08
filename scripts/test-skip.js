#!/usr/bin/env node
// Behavioral jsdom check for the skip button (see CLAUDE.md "Skip" —
// CHANGES.md Aug 10 2026, Phase 4). Registered as validation bar check #9;
// also runnable alone via `npm run test:skip`.
//
// Covers:
//   - Skipping a movement with a fixed reason chip renders it collapsed
//     with the reason visible, and it's excluded from the normal
//     expand/chip/log UI.
//   - "other" reveals a free-text reason field.
//   - Un-skip is reversible within the session.
//   - finish() persists skipped/skipReason, and a skipped movement with
//     zero logged sets is still included in the record (it would
//     otherwise be filtered out like any untouched movement).
//   - buildCoachSummary/buildHandoff surface the skip instead of an empty
//     set list, and buildHandoff aggregates all-time skip counts.
//
// Every button query below is scoped to the specific movement's own card
// container — every movement's header (skip button included) is always
// rendered regardless of open/collapsed state, so an unscoped "first
// skip button on the page" query silently grabs the wrong movement's.
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

// Expands a movement's card and returns its card container element, scoped
// so subsequent button queries can't accidentally hit a different movement.
async function openMovementCard(window, name) {
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === name);
  let header = nameDiv;
  while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) header = header.parentElement;
  if (!header) throw new Error(`could not find clickable header for '${name}'`);
  const cardContainer = header.parentElement;
  click(window, header);
  await sleep(window, 40);
  return cardContainer;
}
const within = (container, tag, text) =>
  Array.from(container.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

async function checkSkipRendersCollapsedAndBlocksNormalUi() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);

  const card = await openMovementCard(window, "DB Row");
  const skipBtn = within(card, "button", "skip");
  if (!skipBtn) throw new Error("no 'skip' button found within DB Row's card");
  click(window, skipBtn);
  await sleep(window, 40);

  const painBtn = within(card, "button", "pain");
  if (!painBtn) throw new Error("skip reason chips did not render");
  click(window, painBtn);
  await sleep(window, 40);

  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("skipped — pain")) throw new Error("expected 'skipped — pain' to render");
  // Skipped movements render collapsed — no chip picker or set rows.
  if (rootText.includes("down") && rootText.includes("hold") && card.textContent.includes("down")) {
    throw new Error("skipped movement should not still show its chip picker");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: skipping renders the movement collapsed with the reason visible");
  window.close();
}

async function checkOtherReasonFreeText() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  const card = await openMovementCard(window, "Reverse Fly");
  click(window, within(card, "button", "skip"));
  await sleep(window, 40);
  click(window, within(card, "button", "other"));
  await sleep(window, 40);
  const textInput = card.querySelector('input[placeholder="reason..."]');
  if (!textInput) throw new Error("expected a free-text reason field for 'other'");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(textInput, "traveling, no equipment");
  textInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 20);
  // Two "skip" buttons exist in the card at this point: the header's toggle
  // (which would just re-hide the picker) and the picker's own confirm
  // button, which sits right next to the text input — scope to that.
  const confirmSkipBtn = Array.from(textInput.parentElement.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "skip",
  );
  if (!confirmSkipBtn) throw new Error("could not find the 'other' reason's confirm button");
  click(window, confirmSkipBtn);
  await sleep(window, 40);
  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("skipped — traveling, no equipment")) {
    throw new Error("expected the free-text reason to be recorded");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: 'other' reveals a free-text reason field that gets used");
  window.close();
}

async function checkUnskipIsReversible() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  const card = await openMovementCard(window, "DB Row");
  click(window, within(card, "button", "skip"));
  await sleep(window, 40);
  click(window, within(card, "button", "pain"));
  await sleep(window, 40);
  if (!window.document.getElementById("root").textContent.includes("skipped — pain")) {
    throw new Error("expected skip to take effect before testing un-skip");
  }
  const unskipBtn = within(card, "button", "un-skip");
  if (!unskipBtn) throw new Error("no 'un-skip' button found");
  click(window, unskipBtn);
  await sleep(window, 40);
  if (window.document.getElementById("root").textContent.includes("skipped — pain")) {
    throw new Error("expected un-skip to clear the skipped state");
  }
  if (!within(card, "button", "skip")) {
    throw new Error("expected the normal card (with a 'skip' button) to return after un-skipping");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: un-skip is reversible within the session");
  window.close();
}

async function checkFinishPersistsSkipAndIncludesZeroSetMovement() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  const card = await openMovementCard(window, "DB Row");
  click(window, within(card, "button", "skip"));
  await sleep(window, 40);
  click(window, within(card, "button", "time"));
  await sleep(window, 40);

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const dbRow = entry.movements.find((m) => m.name === "DB Row");
  console.log("Persisted DB Row:", JSON.stringify(dbRow));
  if (!dbRow) throw new Error("a skipped movement with 0 sets must still be included in the record");
  if (dbRow.skipped !== true) throw new Error(`expected skipped: true, got ${dbRow.skipped}`);
  if (dbRow.skipReason !== "time") throw new Error(`expected skipReason 'time', got ${dbRow.skipReason}`);
  if (dbRow.sets.length !== 0) throw new Error("expected zero logged sets for a skipped movement");

  // No other, untouched movement should sneak into the record.
  const untouched = entry.movements.find((m) => m.name === "Seated Row");
  if (untouched) throw new Error("an untouched (not skipped, not logged) movement should not be in the record");

  console.log("PASS: finish() persists skipped/skipReason and keeps a zero-set skipped movement in the record");
  window.close();
}

async function checkCoachSummaryAndHandoffSurfaceSkips() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);
  const card = await openMovementCard(window, "Reverse Fly");
  click(window, within(card, "button", "skip"));
  await sleep(window, 40);
  click(window, within(card, "button", "machine in use"));
  await sleep(window, 40);
  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));

  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("SKIPPED")) {
    throw new Error("expected the post-finish coach summary to mention the skip");
  }

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const handoff = window.buildHandoff(stored.history);
  if (!handoff.includes("SKIP COUNTS (all-time):")) throw new Error("expected a SKIP COUNTS section in the handoff");
  if (!handoff.includes("Reverse Fly: 1×")) throw new Error("expected Reverse Fly's skip count in the handoff");
  if (!handoff.includes("Reverse Fly: SKIPPED — machine in use")) {
    throw new Error("expected the recent-sessions section to show the skip with its reason");
  }
  console.log("PASS: coach summary and handoff both surface the skip (with reason, and an all-time count)");
  window.close();
}

async function main() {
  await checkSkipRendersCollapsedAndBlocksNormalUi();
  await checkOtherReasonFreeText();
  await checkUnskipIsReversible();
  await checkFinishPersistsSkipAndIncludesZeroSetMovement();
  await checkCoachSummaryAndHandoffSurfaceSkips();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

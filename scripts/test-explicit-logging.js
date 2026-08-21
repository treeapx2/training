#!/usr/bin/env node
// Behavioral jsdom check for auto-log-on-RPE (see CLAUDE.md "Explicit set
// logging" — CHANGES.md Aug 19 2026, Phase 4). Registered as validation bar
// check #14; also runnable alone via `npm run test:explicit-logging`.
//
// Owner's clarification when asked to confirm intent (the document itself
// required confirming before implementing): "The idea is not even to have a
// log button. as soon as an RPE is set, the log action executes and the
// button is replaced with an x that removes the RPE and unlogs the set if
// it needs to be cancelled."
//
// Covers:
//   - No "log" button exists anywhere on an open movement card.
//   - Filling in weight/reps alone (no RPE) never logs a set.
//   - Filling in RPE and losing focus auto-logs the set: inputs lock, a x
//     button appears in its place.
//   - Tapping x reverts the set to uncommitted (clears rpe, unlocks inputs,
//     x disappears) without touching weight/reps.
//   - Only logged sets are persisted by finish().
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
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

const sleep = (window, ms) => new Promise((r) => window.setTimeout(r, ms));
const click = (window, el) =>
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (window, tag, text) =>
  Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);
// React's onBlur listens on the native "focusout" event (not "blur", which
// doesn't bubble) -- see CLAUDE.md "Explicit set logging" gotcha.
const setValueAndBlur = async (window, input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 20);
  input.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  await sleep(window, 20);
};

async function openLegPress(window) {
  click(window, byText(window, "button", "Legs"));
  await sleep(window, 40);
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === "Leg Press");
  let header = nameDiv;
  while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) header = header.parentElement;
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);
  const holdBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  click(window, holdBtn);
  await sleep(window, 40);
  return card;
}

async function checkNoLogButtonExistsAnywhere() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  const logBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "log");
  if (logBtn) throw new Error("expected no 'log' button anywhere on an open movement card");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: no explicit 'log' button exists");
  window.close();
}

async function checkWeightRepsAloneNeverLogs() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  const weightInput = card.querySelectorAll('input[type="number"]')[0];
  await setValueAndBlur(window, weightInput, "190");
  if (card.textContent.includes("sets logged")) {
    throw new Error("filling weight alone (no RPE) must not log the set");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: filling weight/reps without an RPE never auto-logs a set");
  window.close();
}

async function checkRpeAutoLogsAndXReverts() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  const inputs = card.querySelectorAll('input[type="number"]');
  const [weightInput, repsInput, rpeInput] = inputs;

  await setValueAndBlur(window, rpeInput, "7");
  if (!card.textContent.includes("1/5 sets logged") && !card.textContent.includes("sets logged")) {
    throw new Error("expected the set to auto-log after RPE was filled in and blurred");
  }
  if (!weightInput.disabled || !repsInput.disabled || !rpeInput.disabled) {
    throw new Error("expected weight/reps/rpe inputs to lock once the set is logged");
  }
  const xBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "✕");
  if (!xBtn) throw new Error("expected a x button to appear once the set is logged");

  const weightBefore = weightInput.value;
  const repsBefore = repsInput.value;
  click(window, xBtn);
  await sleep(window, 40);

  if (weightInput.disabled || repsInput.disabled || rpeInput.disabled) {
    throw new Error("expected inputs to unlock after tapping x");
  }
  if (rpeInput.value !== "") throw new Error(`expected x to clear rpe, got '${rpeInput.value}'`);
  if (weightInput.value !== weightBefore || repsInput.value !== repsBefore) {
    throw new Error("x should only clear rpe/logged state, not weight/reps");
  }
  const xBtnAfter = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "✕");
  if (xBtnAfter) throw new Error("x button should disappear once the set is uncommitted again");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: filling RPE auto-logs the set (locks inputs, shows x); tapping x reverts to uncommitted");
  window.close();
}

async function checkOnlyLoggedSetsPersist() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  const inputs = card.querySelectorAll('input[type="number"]');
  // Log only the first working set (index 3 = set 4's rpe, the first "W").
  await setValueAndBlur(window, inputs[2], "7");
  // Touch set 2's weight but never give it an RPE -- must not persist.
  await setValueAndBlur(window, inputs[3], "160");

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const legPress = entry.movements.find((m) => m.name === "Leg Press");
  console.log("Persisted Leg Press sets:", JSON.stringify(legPress.sets));
  if (legPress.sets.length !== 1) {
    throw new Error(`expected exactly 1 persisted set (the logged one), got ${legPress.sets.length}`);
  }
  if (legPress.sets[0].rpe !== "7") throw new Error(`expected the persisted set's rpe to be '7', got '${legPress.sets[0].rpe}'`);
  console.log("PASS: finish() only persists logged sets");
  window.close();
}

async function main() {
  await checkNoLogButtonExistsAnywhere();
  await checkWeightRepsAloneNeverLogs();
  await checkRpeAutoLogsAndXReverts();
  await checkOnlyLoggedSetsPersist();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

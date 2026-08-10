#!/usr/bin/env node
// Behavioral jsdom check for the cardio machine default (see CLAUDE.md
// "Cardio finisher fields" — CHANGES.md Aug 10 2026, Phase 5). Registered
// as validation bar check #10; also runnable alone via
// `npm run test:cardio-default`.
//
// machine came through empty on a real record while duration/level/rpe
// were all filled, so it now defaults to Stairmaster — but must stay a
// pre-fill, not something that makes an otherwise-untouched session
// falsely look like it has cardio data (see hasCardioData).
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

async function checkDropdownDefaultsToStairmaster() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);
  const select = window.document.querySelector("select");
  if (!select) throw new Error("no machine <select> found");
  if (select.value !== "Stairmaster") {
    throw new Error(`expected the machine dropdown to default to Stairmaster, got '${select.value}'`);
  }
  // Full dropdown must still be available, not locked to the default.
  const options = Array.from(select.options).map((o) => o.value).filter(Boolean);
  if (!options.includes("Rower") || options.length < 6) {
    throw new Error(`expected the full machine option list to still be present, got ${JSON.stringify(options)}`);
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: machine dropdown defaults to Stairmaster, full option list still available");
  window.close();
}

async function checkUntouchedCardioStaysOmitted() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);
  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  if ("cardio" in entry) {
    throw new Error(
      `expected no 'cardio' key when nothing but the default machine was present, got ${JSON.stringify(entry.cardio)}`,
    );
  }
  console.log("PASS: finishing without touching any cardio field omits the cardio key entirely");
  window.close();
}

async function checkFillingAFieldRecordsTheDefaultMachine() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);
  const durationInput = window.document.querySelector('input[type="number"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(durationInput, "10");
  durationInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 30);

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  console.log("Record cardio:", JSON.stringify(entry.cardio));
  if (!entry.cardio || entry.cardio.machine !== "Stairmaster" || entry.cardio.duration !== "10") {
    throw new Error(`expected cardio {machine: 'Stairmaster', duration: '10', ...}, got ${JSON.stringify(entry.cardio)}`);
  }
  console.log("PASS: filling one cardio field records the default machine alongside it");
  window.close();
}

async function main() {
  await checkDropdownDefaultsToStairmaster();
  await checkUntouchedCardioStaysOmitted();
  await checkFillingAFieldRecordsTheDefaultMachine();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

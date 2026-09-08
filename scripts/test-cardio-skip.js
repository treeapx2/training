#!/usr/bin/env node
// Behavioral jsdom check for cardio skip and substitution (see CLAUDE.md
// "Cardio finisher fields" — CHANGES.md Sep 8 2026, Phase 7). Registered as
// validation bar check #22; also runnable alone via
// `npm run test:cardio-skip`.
//
// Cardio was skipped entirely on Aug 25 ("stairmaster taken") rather than
// substituted, losing the finisher for that session — and, worse, losing it
// invisibly: a session with no cardio key looks identical whether the
// finisher was deliberately skipped or simply never tracked.
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
const rootText = (window) => window.document.getElementById("root").textContent;

async function checkSkipIsDataNotAbsence() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const skipped = { machine: "Stairmaster", duration: "", level: "", rpe: "", skipped: true, skipReason: "machine in use" };
  const untouched = { machine: "Stairmaster", duration: "", level: "", rpe: "", skipped: false, skipReason: "" };

  if (!window.hasCardioData(skipped)) {
    throw new Error("a deliberately skipped finisher must count as cardio data");
  }
  if (window.hasCardioData(untouched)) {
    throw new Error("an untouched cardio section must still count as no data");
  }
  console.log("PASS: a skipped finisher is data; an untouched one still isn't (the distinction Aug 25 lost)");

  const formatted = window.formatCardio(skipped);
  if (!formatted.includes("skipped") || !formatted.includes("machine in use")) {
    throw new Error(`expected a skip with its reason, got "${formatted}"`);
  }
  console.log("PASS: formatCardio renders the skip and its reason");

  // A skip has no duration/level/RPE, so it stays out of the trend — while
  // remaining visible on the record.
  const history = [
    { id: 1, type: "push", label: "Push", date: "Aug 20, 2026", note: "", cardio: { machine: "Stairmaster", duration: "12", level: "4", rpe: "6" }, movements: [] },
    { id: 2, type: "push", label: "Push", date: "Aug 25, 2026", note: "", cardio: skipped, movements: [] },
  ];
  const trend = window.getCardioHistory(history);
  if (trend.length !== 1) {
    throw new Error(`expected the skipped session out of the trend, got ${trend.length} entries`);
  }
  if (trend[0].duration !== "12") throw new Error("the wrong entry survived into the trend");
  console.log("PASS: a skipped finisher is excluded from the cardio trend but kept on the record");

  const handoff = window.buildHandoff(history);
  if (!handoff.includes("skipped — machine in use")) {
    throw new Error("the coach handoff should surface a skipped finisher");
  }
  console.log("PASS: the coach handoff surfaces a skipped finisher");
  window.close();
}

async function checkSkipFlowInTheLiveApp() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);

  if (!rootText(window).includes("Cardio finisher")) throw new Error("no cardio section on the session screen");
  const skipBtn = Array.from(window.document.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "skip" && b.closest("div"),
  );
  // The movement cards also carry "skip" buttons, so scope to the one after
  // the Cardio finisher label.
  const labels = Array.from(window.document.querySelectorAll("div")).filter(
    (d) => d.textContent.trim() === "Cardio finisher",
  );
  if (!labels.length) throw new Error("no Cardio finisher label found");
  const cardioHeader = labels[labels.length - 1].parentElement;
  const cardioSkip = Array.from(cardioHeader.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "skip",
  );
  if (!cardioSkip) throw new Error("no skip action on the cardio finisher");
  if (!skipBtn) throw new Error("expected skip buttons to exist at all");
  click(window, cardioSkip);
  await sleep(window, 60);

  // Substitution is offered BEFORE the skip reasons — the Aug 25 case is
  // exactly one the owner should have solved by switching machines.
  const text = rootText(window);
  if (!text.includes("Machine taken? Switch instead of skipping")) {
    throw new Error("expected machine substitution to be offered before skipping");
  }
  if (!byText(window, "button", "Rower")) {
    throw new Error("expected one-tap machine alternatives");
  }
  if (!byText(window, "button", "machine in use")) {
    throw new Error("expected the shared skip reasons (machine in use / time / pain / other)");
  }
  console.log("PASS: skipping cardio offers one-tap machine substitution before the skip reasons");

  // One tap on an alternate machine keeps the entry rather than abandoning it.
  click(window, byText(window, "button", "Rower"));
  await sleep(window, 60);
  const draftAfterSwitch = JSON.parse(window.localStorage.getItem("at_session_draft") || "{}");
  if (!draftAfterSwitch.cardio || draftAfterSwitch.cardio.machine !== "Rower") {
    throw new Error(`expected the machine switched to Rower, got ${JSON.stringify(draftAfterSwitch.cardio)}`);
  }
  if (draftAfterSwitch.cardio.skipped) throw new Error("switching machines must not skip the finisher");
  if (!rootText(window).includes("Machine")) throw new Error("the cardio fields should be back after substituting");
  console.log("PASS: one tap on an alternate machine substitutes and keeps the entry");

  // Now actually skip it.
  const cardioHeader2 = Array.from(window.document.querySelectorAll("div"))
    .filter((d) => d.textContent.trim() === "Cardio finisher")
    .pop().parentElement;
  click(window, Array.from(cardioHeader2.querySelectorAll("button")).find((b) => b.textContent.trim() === "skip"));
  await sleep(window, 60);
  click(window, byText(window, "button", "machine in use"));
  await sleep(window, 60);

  if (!rootText(window).includes("skipped — machine in use")) {
    throw new Error("a skipped finisher should show its reason");
  }
  if (!byText(window, "button", "un-skip")) throw new Error("a skipped finisher should be reversible");
  console.log("PASS: cardio can be skipped with a reason, matching the movement skip pattern");

  // Reversible, like the movement skip.
  click(window, byText(window, "button", "un-skip"));
  await sleep(window, 60);
  if (rootText(window).includes("skipped — machine in use")) {
    throw new Error("un-skip should clear the skip");
  }
  console.log("PASS: un-skip is reversible within the session");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkFinishPersistsTheSkip() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);
  const cardioHeader = Array.from(window.document.querySelectorAll("div"))
    .filter((d) => d.textContent.trim() === "Cardio finisher")
    .pop().parentElement;
  click(window, Array.from(cardioHeader.querySelectorAll("button")).find((b) => b.textContent.trim() === "skip"));
  await sleep(window, 60);
  click(window, byText(window, "button", "machine in use"));
  await sleep(window, 60);
  click(window, byText(window, "button", "finish session"));
  await sleep(window, 120);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  console.log("Persisted cardio:", JSON.stringify(entry.cardio));
  if (!entry.cardio) throw new Error("a skipped finisher must still be written to the record");
  if (entry.cardio.skipped !== true) throw new Error(`expected skipped: true, got ${entry.cardio.skipped}`);
  if (entry.cardio.skipReason !== "machine in use") {
    throw new Error(`expected skipReason 'machine in use', got ${entry.cardio.skipReason}`);
  }
  console.log("PASS: finish() persists the cardio skip and its reason onto the record");

  // The record shows the skip in history rather than looking untracked.
  if (!rootText(window).includes("skipped — machine in use")) {
    throw new Error("the finished session should surface the cardio skip");
  }
  console.log("PASS: a skipped finisher is visible in the session summary");
  window.close();
}

async function checkUntouchedCardioStillOmitted() {
  // The "omitted when nothing filled in" contract predates this phase and
  // must survive it — a session where cardio was simply never touched still
  // gets no cardio key at all.
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 60);
  click(window, byText(window, "button", "finish session"));
  await sleep(window, 120);
  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  if (entry.cardio) {
    throw new Error(`an untouched cardio section must be omitted, got ${JSON.stringify(entry.cardio)}`);
  }
  console.log("PASS: an untouched cardio section is still omitted entirely");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkSkipIsDataNotAbsence();
  await checkSkipFlowInTheLiveApp();
  await checkFinishPersistsTheSkip();
  await checkUntouchedCardioStillOmitted();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

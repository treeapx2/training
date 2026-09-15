#!/usr/bin/env node
// Behavioral jsdom check for the 45-minute cardio reminder (see CLAUDE.md
// "Session timer" → "Cardio reminder" — CHANGES-2026-09-13, Phase 3).
// Registered as validation bar check #23; also runnable alone via
// `npm run test:cardio-reminder`.
//
// > "Instead of automatically switching to cardio, add a reminder at 45 mins
// > that asks me to switch to cardio."
//
// The problem is a measurement one: the owner lifted straight through the
// cardio block on Sep 9, so liftingMin recorded 52 when actual lifting was
// ~39 — the stairmaster time was banked as lifting.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");
const MIN = 60000;

async function mount(seedDraft) {
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
  if (seedDraft) window.localStorage.setItem("at_session_draft", JSON.stringify(seedDraft));
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

const sleep = (window, ms) => new Promise((r) => window.setTimeout(r, ms));
const click = (window, el) =>
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (window, tag, text) =>
  Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);
// index.html ships the app as one inline <script>, so body.textContent holds
// the source too — on-screen assertions scope to #root.
const rootText = (window) => window.document.getElementById("root").textContent;

function draftWithTimer(timer) {
  return {
    type: "legs",
    note: "",
    cardio: null,
    sessionDate: "2026-09-13",
    date: "Sep 13, 2026",
    timer,
    movements: [
      { name: "Leg Press", _group: "Quads", _loggedSets: [], note: "", targetWeight: null, chipChoice: null, suggested: null, supersetId: null, skipped: false, skipReason: "", substituted: false },
    ],
  };
}

async function checkReminderArithmetic() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const lifting = (mins, extra) => ({
    phase: "lifting",
    liftingMs: mins * MIN,
    cardioMs: 0,
    running: false,
    startedAt: null,
    remindersDismissed: 0,
    lastReminderMin: 0,
    ...extra,
  });
  const el = (mins) => ({ liftingMs: mins * MIN, cardioMs: 0 });

  if (window.cardioReminderDue(lifting(44), el(44))) {
    throw new Error("the reminder must not fire before 45 minutes");
  }
  if (!window.cardioReminderDue(lifting(45), el(45))) {
    throw new Error("the reminder must fire at 45 minutes of lifting");
  }
  console.log("PASS: the reminder fires at 45 minutes of lifting, not before");

  // Already in the cardio phase -> nothing to remind about.
  if (window.cardioReminderDue({ ...lifting(60), phase: "cardio" }, el(60))) {
    throw new Error("no reminder once the cardio phase has started");
  }
  console.log("PASS: no reminder once cardio has started");

  // Dismissed once: silent until well later, then exactly one more.
  const dismissed = window.timerReminderDismissed(lifting(45), el(45));
  if ((dismissed.remindersDismissed || 0) !== 1) throw new Error("dismissal should be recorded on the timer");
  if (window.cardioReminderDue(dismissed, el(50))) {
    throw new Error("a dismissed reminder must not nag five minutes later");
  }
  if (window.cardioReminderDue(dismissed, el(59))) {
    throw new Error("a dismissed reminder must stay quiet until the gap has passed");
  }
  if (!window.cardioReminderDue(dismissed, el(60))) {
    throw new Error("one further reminder is due after the gap");
  }
  console.log("PASS: a dismissed reminder stays quiet, then returns once, well later");

  // Dismissed twice: never again.
  const twice = window.timerReminderDismissed(dismissed, el(60));
  if ((twice.remindersDismissed || 0) !== 2) throw new Error("the second dismissal should be recorded");
  [61, 75, 120, 600].forEach((m) => {
    if (window.cardioReminderDue(twice, el(m))) {
      throw new Error(`the reminder must never fire a third time (fired at ${m} min)`);
    }
  });
  console.log("PASS: after two dismissals the reminder never fires again");

  // A timer with no reminder fields at all (a draft written before this
  // phase) must not crash or fire spuriously.
  const legacy = { phase: "lifting", liftingMs: 46 * MIN, cardioMs: 0, running: false, startedAt: null };
  if (!window.cardioReminderDue(legacy, el(46))) {
    throw new Error("a pre-Phase-3 timer should still get its first reminder");
  }
  console.log("PASS: a timer saved before this phase still behaves sanely");
  window.close();
}

async function checkNoAutomaticSwitch() {
  // The whole point: at 45 minutes the app asks, it does not switch.
  const { window, errors } = await mount(draftWithTimer({
    phase: "lifting", liftingMs: 46 * MIN, cardioMs: 0, running: false, startedAt: null,
    remindersDismissed: 0, lastReminderMin: 0,
  }));
  click(window, byText(window, "button", "resume session"));
  await sleep(window, 80);

  const draft = JSON.parse(window.localStorage.getItem("at_session_draft") || "{}");
  if (draft.timer.phase !== "lifting") {
    throw new Error("the app switched to cardio on its own — it must only ask");
  }
  if (!rootText(window).includes("switch to cardio?")) {
    throw new Error("expected the reminder prompt on screen past 45 minutes");
  }
  if (!byText(window, "button", "not yet")) throw new Error("the prompt must offer a dismiss action");
  console.log("PASS: past 45 minutes the app prompts and does NOT switch automatically");

  // Non-blocking: the rest of the session screen is still usable, and no
  // modal dialog was raised (a window.confirm would have thrown in jsdom).
  if (!rootText(window).includes("Leg Press")) {
    throw new Error("the prompt should not replace or block the session screen");
  }
  console.log("PASS: the prompt is non-blocking — the session screen stays usable");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkDismissAndSwitchInTheLiveApp() {
  const { window, errors } = await mount(draftWithTimer({
    phase: "lifting", liftingMs: 46 * MIN, cardioMs: 0, running: false, startedAt: null,
    remindersDismissed: 0, lastReminderMin: 0,
  }));
  click(window, byText(window, "button", "resume session"));
  await sleep(window, 80);

  click(window, byText(window, "button", "not yet"));
  await sleep(window, 80);
  if (rootText(window).includes("switch to cardio?")) {
    throw new Error("dismissing should hide the prompt");
  }
  const afterDismiss = JSON.parse(window.localStorage.getItem("at_session_draft") || "{}");
  if ((afterDismiss.timer.remindersDismissed || 0) !== 1) {
    throw new Error("the dismissal must persist to the draft, so backgrounding doesn't resurrect it");
  }
  if (afterDismiss.timer.phase !== "lifting") throw new Error("dismissing must not switch phase");
  console.log("PASS: 'not yet' hides the prompt and the dismissal persists to the draft");
  window.close();

  // Fresh mount, prompt up, this time take the switch.
  const second = await mount(draftWithTimer({
    phase: "lifting", liftingMs: 46 * MIN, cardioMs: 0, running: false, startedAt: null,
    remindersDismissed: 0, lastReminderMin: 0,
  }));
  const w2 = second.window;
  click(w2, byText(w2, "button", "resume session"));
  await sleep(w2, 80);
  const startBtn = Array.from(w2.document.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "start cardio",
  );
  if (!startBtn) throw new Error("the prompt must offer a switch action");
  click(w2, startBtn);
  await sleep(w2, 80);

  const afterSwitch = JSON.parse(w2.localStorage.getItem("at_session_draft") || "{}");
  if (afterSwitch.timer.phase !== "cardio") throw new Error("switching should start the cardio phase");
  if (!afterSwitch.timer.running) throw new Error("switching should start the cardio timer running");
  if (Math.round(afterSwitch.timer.liftingMs / MIN) !== 46) {
    throw new Error(`lifting time should be banked at 46 min, got ${afterSwitch.timer.liftingMs / MIN}`);
  }
  if (rootText(w2).includes("switch to cardio?")) {
    throw new Error("the prompt should be gone once cardio has started");
  }
  console.log("PASS: 'start cardio' banks lifting time, starts the cardio timer, and clears the prompt");

  // And lifting stops accruing — which is the Sep 9 bug this phase fixes.
  const before = w2.timerElapsed(afterSwitch.timer, Date.now());
  const later = w2.timerElapsed(afterSwitch.timer, Date.now() + 10 * MIN);
  if (later.liftingMs !== before.liftingMs) {
    throw new Error("lifting time must stop accruing once cardio starts");
  }
  if (later.cardioMs - before.cardioMs !== 10 * MIN) {
    throw new Error("cardio time should accrue after the switch");
  }
  console.log("PASS: after switching, lifting stops accruing and cardio starts (the Sep 9 miscount)");
  if (second.errors.length) throw new Error("jsdom errors: " + second.errors.join("; "));
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  w2.close();
}

async function checkReminderSurvivesBackgrounding() {
  // A session left running and backgrounded past the 45-minute mark: the
  // reminder is derived from elapsed time, so it's already due on return
  // rather than having missed a scheduled fire.
  const { window, errors } = await mount(draftWithTimer({
    phase: "lifting",
    liftingMs: 10 * MIN,
    cardioMs: 0,
    running: true,
    startedAt: Date.now() - 40 * MIN,
    remindersDismissed: 0,
    lastReminderMin: 0,
  }));
  click(window, byText(window, "button", "resume session"));
  await sleep(window, 80);
  if (!rootText(window).includes("switch to cardio?")) {
    throw new Error("a session backgrounded past 45 minutes should find the reminder due on return");
  }
  console.log("PASS: the reminder survives backgrounding — 10 min banked + 40 min away is due on return");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkReminderArithmetic();
  await checkNoAutomaticSwitch();
  await checkDismissAndSwitchInTheLiveApp();
  await checkReminderSurvivesBackgrounding();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Behavioral jsdom check for the session timer (see CLAUDE.md "Session
// timer" — CHANGES.md Sep 8 2026, Phase 5). Registered as validation bar
// check #20; also runnable alone via `npm run test:session-timer`.
//
// > "would be helpful to automatically start a timer when a session is
// > selected — would need pause and resume functionality and a record of the
// > total workout time — this would be for the full session"
// >   — Cable Curl note, Aug 26
//
// The timer banks accumulated milliseconds per phase plus a start timestamp
// for the stretch currently running, rather than counting ticks. That is the
// whole reason it survives a reload or an iOS background freeze: elapsed time
// is recomputed from the wall clock, never replayed.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

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
  // Must land before React's mount effect reads localStorage.
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
// the source too — every on-screen assertion scopes to #root.
const rootText = (window) => window.document.getElementById("root").textContent;

const MIN = 60000;

async function checkTimerArithmetic() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const t0 = 1_000_000;
  let t = window.startedTimer(t0);
  if (!t.running || t.phase !== "lifting") throw new Error("a started timer must be running, in the lifting phase");

  // Elapsed is read from the clock, not accumulated — 10 minutes of wall time
  // is 10 minutes even if nothing ticked (a backgrounded PWA).
  let e = window.timerElapsed(t, t0 + 10 * MIN);
  if (e.liftingMs !== 10 * MIN) throw new Error(`expected 10 min of lifting, got ${e.liftingMs}`);
  console.log("PASS: elapsed time is recomputed from the wall clock, not accumulated tick by tick");

  // Pause banks the running stretch and stops the clock; later wall time
  // doesn't accrue.
  t = window.timerPaused(t, t0 + 10 * MIN);
  if (t.running) throw new Error("a paused timer must not be running");
  e = window.timerElapsed(t, t0 + 30 * MIN);
  if (e.liftingMs !== 10 * MIN) {
    throw new Error(`a paused timer must not accrue: expected 10 min, got ${e.liftingMs / MIN}`);
  }
  // Resume picks up from the banked total, not from zero and not from the
  // original start.
  t = window.timerResumed(t, t0 + 30 * MIN);
  e = window.timerElapsed(t, t0 + 35 * MIN);
  if (e.liftingMs !== 15 * MIN) {
    throw new Error(`expected 10 banked + 5 running = 15 min, got ${e.liftingMs / MIN}`);
  }
  console.log("PASS: pause banks the running stretch and resume continues from the banked total");

  // Starting cardio closes the lifting block and STOPS the clock for good.
  // The cardio block is not timed — its minutes come from the finisher entry.
  t = window.timerCardioStarted(t, t0 + 45 * MIN);
  if (t.phase !== "cardio") throw new Error("starting cardio must switch phase");
  if (t.running) throw new Error("starting cardio must stop the clock, not keep it running");
  // However long the session then sits — minutes, hours, days — lifting is
  // frozen and nothing else accrues. This is the Sep 13 record, which banked
  // 3151 minutes of "cardio" because the clock kept running for two days.
  [57, 120, 60 * 24 * 2].forEach((mins) => {
    const at = window.timerElapsed(t, t0 + mins * MIN);
    if (at.liftingMs !== 25 * MIN) {
      throw new Error(`lifting must stay frozen at 25 min, got ${at.liftingMs / MIN} after ${mins} min`);
    }
  });
  console.log("PASS: starting cardio stops the clock — nothing accrues, however late the session is finished");

  // Cardio minutes come from the entered duration, not a clock.
  if (window.cardioMinutesFrom({ machine: "Stairmaster", duration: "13" }) !== 13) {
    throw new Error("cardio minutes should come from the entered duration");
  }
  if (window.cardioMinutesFrom({ duration: "13", skipped: true }) !== 0) {
    throw new Error("a skipped finisher contributes no cardio minutes");
  }
  if (window.cardioMinutesFrom({ duration: "" }) !== 0) {
    throw new Error("an unentered duration contributes no cardio minutes");
  }
  if (window.cardioMinutesFrom(null) !== 0) throw new Error("no cardio at all contributes nothing");
  console.log("PASS: cardio minutes come from the entered duration, and skips contribute none");

  if (window.formatDuration(0) !== "0:00") throw new Error("formatDuration(0) should be 0:00");
  if (window.formatDuration(65 * 1000) !== "1:05") throw new Error("formatDuration should be m:ss");
  if (window.durationMinutes(90 * 1000) !== 2) throw new Error("durationMinutes should round to the nearest minute");
  console.log("PASS: duration formatting and minute rounding");
  window.close();
}

async function checkTimerStartsAutomaticallyAndPauses() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Legs"));
  await sleep(window, 60);

  const text = rootText(window);
  if (!/\d+:\d\d/.test(text)) throw new Error("no elapsed clock rendered in the session header");
  if (!text.includes("45m target")) {
    throw new Error("expected the 45-minute lifting target alongside the clock");
  }
  if (!text.includes("rest ")) throw new Error("the clock should sit alongside the rest target");
  // Running, so a pause action is offered rather than a resume.
  if (!byText(window, "button", "pause")) throw new Error("timer did not start automatically (no pause action)");
  if (byText(window, "button", "resume")) throw new Error("a freshly started timer should not offer resume");
  console.log("PASS: the timer starts automatically when a session is started, alongside the rest target");

  click(window, byText(window, "button", "pause"));
  await sleep(window, 40);
  if (!byText(window, "button", "resume")) throw new Error("pause did not switch the control to resume");
  if (!rootText(window).includes("paused")) throw new Error("a paused timer should say so");
  click(window, byText(window, "button", "resume"));
  await sleep(window, 40);
  if (!byText(window, "button", "pause")) throw new Error("resume did not switch the control back to pause");
  console.log("PASS: pause and resume are both available and reflected in the UI");

  // The draft carries the timer, which is what makes a reload survivable.
  const draft = JSON.parse(window.localStorage.getItem("at_session_draft") || "{}");
  if (!draft.timer) throw new Error("the draft must carry the timer state");
  if (draft.timer.phase !== "lifting") throw new Error("a new session's timer starts in the lifting phase");
  console.log("PASS: the timer is persisted to the draft, not just held in memory");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkPausedStateSurvivesAReload() {
  // A draft as it would have been written just before the app was closed:
  // 22 minutes of lifting banked, paused. Reloading must come back paused at
  // 22 minutes — not running, and not counting the time the app was shut.
  const draft = {
    type: "legs",
    note: "",
    cardio: null,
    sessionDate: "2026-09-08",
    date: "Sep 8, 2026",
    timer: { phase: "lifting", liftingMs: 22 * MIN, cardioMs: 0, running: false, startedAt: null },
    movements: [
      { name: "Leg Press", _group: "Quads", _loggedSets: [], note: "", targetWeight: null, chipChoice: null, suggested: null, supersetId: null, skipped: false, skipReason: "", substituted: false },
    ],
  };
  const { window, errors } = await mount(draft);
  const resume = byText(window, "button", "resume session");
  if (!resume) {
    const buttons = Array.from(window.document.querySelectorAll("button")).map((b) => b.textContent.trim());
    throw new Error(`no resume-session action offered for the saved draft. Buttons: ${JSON.stringify(buttons)}`);
  }
  click(window, resume);
  await sleep(window, 80);

  const text = rootText(window);
  if (!text.includes("22:00")) {
    throw new Error(`expected the reloaded session to show 22:00 of banked lifting time, got: ${text.slice(0, 300)}`);
  }
  if (!text.includes("paused")) throw new Error("a reloaded session must come back paused, not running");
  if (!byText(window, "button", "resume")) throw new Error("a reloaded paused timer must offer resume");
  console.log("PASS: the timer survives a reload mid-session with its paused state and elapsed time intact");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkRunningTimerCountsTimeTheAppWasAway() {
  // The same reload, but the timer was left RUNNING — the clock kept going in
  // the real world, so the resumed session must account for it. This is the
  // case a tick-based counter gets wrong.
  const startedAt = Date.now() - 17 * MIN;
  const draft = {
    type: "legs",
    note: "",
    cardio: null,
    sessionDate: "2026-09-08",
    date: "Sep 8, 2026",
    timer: { phase: "lifting", liftingMs: 3 * MIN, cardioMs: 0, running: true, startedAt },
    movements: [
      { name: "Leg Press", _group: "Quads", _loggedSets: [], note: "", targetWeight: null, chipChoice: null, suggested: null, supersetId: null, skipped: false, skipReason: "", substituted: false },
    ],
  };
  const { window, errors } = await mount(draft);
  click(window, byText(window, "button", "resume session"));
  await sleep(window, 80);
  const text = rootText(window);
  // 3 minutes banked + 17 minutes of wall time while the app was away.
  if (!text.includes("20:0")) {
    throw new Error(`expected ~20:00 (3 banked + 17 away), got: ${text.slice(0, 300)}`);
  }
  if (text.includes("paused")) throw new Error("a timer left running must resume running");
  console.log("PASS: a timer left running counts the time the app spent backgrounded or closed");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkDurationPersistsOnTheRecordAndInHistory() {
  const draft = {
    type: "legs",
    note: "",
    // 14 entered cardio minutes — the clock does not time the cardio block.
    cardio: { machine: "Stairmaster", duration: "14", level: "4", rpe: "6", skipped: false, skipReason: "" },
    sessionDate: "2026-09-08",
    date: "Sep 8, 2026",
    timer: { phase: "cardio", liftingMs: 44 * MIN, running: false, startedAt: null },
    movements: [
      { name: "Leg Press", _group: "Quads", _loggedSets: [{ set: 1, weight: "185", reps: "10", rpe: "7", note: "" }], note: "", targetWeight: "185", chipChoice: "hold", suggested: "hold", supersetId: null, skipped: false, skipReason: "", substituted: false },
    ],
  };
  const { window, errors } = await mount(draft);
  click(window, byText(window, "button", "resume session"));
  await sleep(window, 80);
  click(window, byText(window, "button", "finish session"));
  await sleep(window, 120);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  console.log("Persisted duration fields:", JSON.stringify({
    durationMin: entry.durationMin,
    liftingMin: entry.liftingMin,
    cardioMin: entry.cardioMin,
  }));
  if (entry.durationMin !== 58) throw new Error(`expected durationMin 58 (44 + 14), got ${entry.durationMin}`);
  if (entry.liftingMin !== 44) throw new Error(`expected liftingMin 44, got ${entry.liftingMin}`);
  if (entry.cardioMin !== 14) throw new Error(`expected cardioMin 14, got ${entry.cardioMin}`);
  console.log("PASS: finish() persists the total and the lifting/cardio split — clock for lifting, entry for cardio");

  // The runaway-clock case: a session left in the cardio phase for two days
  // must still record the entered cardio minutes, not the elapsed time. This
  // is the Sep 13 record, which went out with cardioMin: 3151.
  const stale = {
    type: "push",
    note: "",
    cardio: { machine: "Stairmaster", duration: "13", level: "4", rpe: "6", skipped: false, skipReason: "" },
    sessionDate: "2026-09-13",
    date: "Sep 13, 2026",
    timer: { phase: "cardio", liftingMs: 46 * MIN, running: false, startedAt: Date.now() - 52 * 60 * MIN },
    movements: [
      { name: "Pec Fly", _group: "Chest", _loggedSets: [{ set: 1, weight: "150", reps: "10", rpe: "8", note: "" }], note: "", targetWeight: "150", chipChoice: "up", suggested: "up", supersetId: null, skipped: false, skipReason: "", substituted: false },
    ],
  };
  const second = await mount(stale);
  const w2 = second.window;
  click(w2, byText(w2, "button", "resume session"));
  await sleep(w2, 80);
  click(w2, byText(w2, "button", "finish session"));
  await sleep(w2, 120);
  const rec = JSON.parse(w2.localStorage.getItem("at_workout_stable") || "{}").history[0];
  if (rec.cardioMin !== 13) {
    throw new Error(`expected the entered 13 cardio minutes, got ${rec.cardioMin}`);
  }
  if (rec.liftingMin !== 46) throw new Error(`expected 46 lifting minutes, got ${rec.liftingMin}`);
  if (rec.durationMin !== 59) throw new Error(`expected 59 total, got ${rec.durationMin}`);
  console.log("PASS: a session left in the cardio phase for two days still records the entered minutes (was 3151)");
  w2.close();

  // It shows up in history, and in the coach handoff.
  const formatted = window.formatSessionDuration(entry);
  if (!formatted.includes("58 min") || !formatted.includes("44m lifting") || !formatted.includes("14m cardio")) {
    throw new Error(`unexpected duration formatting: ${formatted}`);
  }
  const handoff = window.buildHandoff([entry]);
  if (!handoff.includes("Duration: 58 min")) {
    throw new Error("expected the session duration in the coach handoff export");
  }
  console.log("PASS: the duration appears in history formatting and in the coach handoff");

  // A record from before the timer existed renders nothing rather than "0 min".
  if (window.formatSessionDuration({ id: 1, date: "May 22, 2026" }) !== "") {
    throw new Error("a pre-timer record must not render a bogus duration");
  }
  const legacyHandoff = window.buildHandoff([{ id: 1, type: "pull", label: "Pull", date: "May 22, 2026", note: "", movements: [] }]);
  if (legacyHandoff.includes("Duration:")) {
    throw new Error("a pre-timer record must not get a Duration line in the handoff");
  }
  console.log("PASS: records that predate the timer render no duration at all");
  window.close();
}

async function checkImplausibleDurationsAreGuarded() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  // Stopping the clock at the cardio transition prevents NEW bad values, but
  // records written before that fix can still carry one. Three hours is well
  // above any real session and well below a timer left running overnight.
  const at = (durationMin, extra) => ({ id: 1, type: "push", label: "Push", date: "Sep 13, 2026", durationMin, ...extra });
  if (!window.isPlausibleDuration(at(59, { liftingMin: 46, cardioMin: 13 }))) {
    throw new Error("a 59-minute session is plausible");
  }
  if (!window.isPlausibleDuration(at(180))) {
    throw new Error("180 minutes is the inclusive boundary");
  }
  if (window.isPlausibleDuration(at(181))) {
    throw new Error("181 minutes is over the bound");
  }
  if (window.isPlausibleDuration(at(3197))) {
    throw new Error("the Sep 13 shape must not read as plausible");
  }
  if (window.isPlausibleDuration({ id: 1 })) {
    throw new Error("a record with no duration at all is not a plausible duration");
  }
  console.log("PASS: isPlausibleDuration bounds sessions at 180 minutes inclusive");

  // An implausible total renders as an OUTLIER, never as a number — showing
  // 3197 minutes as a duration would assert something false.
  const shown = window.formatSessionDuration(at(3197, { liftingMin: 46, cardioMin: 3151 }));
  if (/3197|3151/.test(shown)) {
    throw new Error(`an implausible duration must not render as a number, got "${shown}"`);
  }
  if (!/overran/.test(shown)) {
    throw new Error(`expected an obvious outlier marker, got "${shown}"`);
  }
  // The lifting half is usually the trustworthy one and rides along.
  if (!/46m lifting/.test(shown)) {
    throw new Error(`expected the plausible lifting figure alongside the marker, got "${shown}"`);
  }
  console.log(`PASS: an implausible duration renders as an outlier: "${shown}"`);

  // If lifting is implausible too, nothing numeric is claimed at all.
  const bothBad = window.formatSessionDuration(at(5000, { liftingMin: 4000, cardioMin: 1000 }));
  if (/\d/.test(bothBad)) {
    throw new Error(`nothing numeric should be claimed when lifting is bad too, got "${bothBad}"`);
  }
  console.log("PASS: when the lifting figure is implausible too, no number is shown at all");

  // A plausible record is unaffected.
  const good = window.formatSessionDuration(at(59, { liftingMin: 46, cardioMin: 13 }));
  if (good !== "59 min (46m lifting + 13m cardio)") {
    throw new Error(`a plausible duration must render normally, got "${good}"`);
  }
  console.log("PASS: plausible durations are unaffected by the guard");

  // Against the committed log: every recorded duration is now plausible, and
  // the Sep 13 record specifically reads as lifting + entered cardio.
  const hist = JSON.parse(fs.readFileSync(path.join(repoRoot, "sessions.json"), "utf8"));
  const withDuration = hist.filter((s) => s.durationMin != null);
  const bad = withDuration.filter((s) => !window.isPlausibleDuration(s));
  if (bad.length) {
    throw new Error(`implausible durations in the committed log: ${JSON.stringify(bad.map((s) => [s.date, s.durationMin]))}`);
  }
  const sep13 = hist.find((s) => s.type === "push" && s.date === "Sep 13, 2026");
  if (sep13) {
    const entered = parseFloat(sep13.cardio && sep13.cardio.duration);
    if (sep13.cardioMin !== Math.round(entered)) {
      throw new Error(`Sep 13 cardioMin ${sep13.cardioMin} should equal the entered ${entered}`);
    }
    if (sep13.durationMin !== sep13.liftingMin + sep13.cardioMin) {
      throw new Error(`Sep 13 durationMin should be lifting + cardio, got ${sep13.durationMin}`);
    }
  }
  console.log(`PASS: all ${withDuration.length} recorded durations in the committed log are plausible`);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkTimerArithmetic();
  await checkTimerStartsAutomaticallyAndPauses();
  await checkPausedStateSurvivesAReload();
  await checkRunningTimerCountsTimeTheAppWasAway();
  await checkDurationPersistsOnTheRecordAndInHistory();
  await checkImplausibleDurationsAreGuarded();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

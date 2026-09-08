#!/usr/bin/env node
// Behavioral jsdom check for chart windowing (see CLAUDE.md "Chart
// windowing" — CHANGES.md Sep 8 2026, Phase 6). Registered as validation bar
// check #21; also runnable alone via `npm run test:chart-windowing`.
//
// Charts became unreadable as history grew, with date labels overlapping.
// Each chart now defaults to the most recent 12 data points, with 12/25/all
// presets and a pan control.
//
// The load-bearing detail is that the window counts DATA POINTS, not calendar
// dates: for a per-movement chart, 12 means 12 sessions containing that
// movement. Twelve calendar sessions would be roughly four legs sessions,
// which would make leg charts far sparser than cardio charts for no visible
// reason.
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
  if (seed) window.localStorage.setItem("at_workout_stable", JSON.stringify({ history: seed }));
  await new Promise((r) => window.setTimeout(r, 100));
  return { window, errors };
}

const sleep = (window, ms) => new Promise((r) => window.setTimeout(r, ms));
const click = (window, el) =>
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (window, tag, text) =>
  Array.from(window.document.querySelectorAll(tag)).find((b) => b.textContent.trim() === text);

async function checkWindowSliceArithmetic() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const arr = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30, oldest first

  // Default: the most recent 12, in order.
  const recent = window.windowSlice(arr, 12, 0);
  if (recent.length !== 12 || recent[0] !== 19 || recent[11] !== 30) {
    throw new Error(`expected the newest 12 (19..30), got ${JSON.stringify(recent)}`);
  }
  // Panning back by a half-window step keeps overlap, so a trend crossing the
  // boundary stays readable.
  const step = window.chartPanStep(12);
  if (step !== 6) throw new Error(`expected a half-window pan step of 6, got ${step}`);
  const older = window.windowSlice(arr, 12, step);
  if (older[0] !== 13 || older[11] !== 24) {
    throw new Error(`expected the window to pan back to 13..24, got ${JSON.stringify(older)}`);
  }
  if (!older.some((v) => recent.includes(v))) {
    throw new Error("consecutive windows should overlap");
  }
  // Panning cannot run off the start of history.
  const max = window.maxChartOffset(30, 12);
  if (max !== 18) throw new Error(`expected a max offset of 18, got ${max}`);
  const oldest = window.windowSlice(arr, 12, max);
  if (oldest[0] !== 1 || oldest[11] !== 12) {
    throw new Error(`expected the oldest window to be 1..12, got ${JSON.stringify(oldest)}`);
  }
  // Presets.
  if (window.windowSlice(arr, 25, 0).length !== 25) throw new Error("the 25 preset should show 25 points");
  if (window.windowSlice(arr, "all", 0).length !== 30) throw new Error("the all preset should show everything");
  if (window.maxChartOffset(30, "all") !== 0) throw new Error("the all preset cannot pan");
  // Fewer points than the window: show them all, don't pad or crash.
  if (window.windowSlice([1, 2, 3], 12, 0).length !== 3) throw new Error("a short series should render whole");
  console.log("PASS: windowSlice shows the newest 12 by default, pans back with overlap, and clamps at both ends");
  console.log("PASS: the 12 / 25 / all presets each select the right number of points");
  window.close();
}

// n sessions containing `movName`, interleaved with sessions that don't —
// which is exactly what makes point-windowing differ from date-windowing.
function buildHistory(movName, n, otherName) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = i + 1;
    out.push({
      id: 1000 + i,
      type: "legs",
      label: "Legs",
      date: `Jan ${day}, 2026`,
      note: "",
      movements: [
        {
          name: movName,
          sets: [{ set: 1, weight: String(100 + i * 5), reps: "10", rpe: "7", note: "" }],
          note: "",
          order: 0,
        },
      ],
    });
    // Two sessions without the movement between each one that has it.
    if (otherName) {
      for (let k = 0; k < 2; k++) {
        out.push({
          id: 5000 + i * 10 + k,
          type: "push",
          label: "Push",
          date: `Jan ${day}, 2026`,
          note: "",
          movements: [
            { name: otherName, sets: [{ set: 1, weight: "50", reps: "10", rpe: "7", note: "" }], note: "", order: 0 },
          ],
        });
      }
    }
  }
  return out;
}

async function checkPerMovementChartCountsSessionsContainingThatMovement() {
  // 20 Leg Press sessions, each separated by two Push sessions that don't
  // contain it. A date-based window would show ~4 points; a point-based one
  // shows 12.
  const history = buildHistory("Leg Press", 20, "Pec Fly");
  const { window, errors } = await mount(history);

  const data = window.getMovementHistory(history, "Leg Press");
  if (data.length !== 20) {
    throw new Error(`fixture broken: expected 20 Leg Press data points, got ${data.length}`);
  }
  if (history.length !== 60) {
    throw new Error(`fixture broken: expected 60 total sessions, got ${history.length}`);
  }
  const windowed = window.windowSlice(data, 12, 0);
  if (windowed.length !== 12) {
    throw new Error(`expected 12 Leg Press points in the default window, got ${windowed.length}`);
  }
  // Every point in the window is a session that actually contains the
  // movement — the whole distinction this phase draws.
  if (!windowed.every((d) => d.weight)) {
    throw new Error("the window must only contain sessions with logged data for that movement");
  }
  console.log("PASS: a per-movement window counts sessions containing THAT movement, not calendar sessions");

  // In the live app: the Block tab's per-movement chart renders the newest 12
  // dots. (The Progress tab carries the weekly breakdown and the cardio trend;
  // the per-movement progression charts are on Block.)
  click(window, byText(window, "button", "Block"));
  await sleep(window, 60);
  const legPress = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === "Leg Press",
  );
  if (!legPress) throw new Error("Leg Press not listed on the Block tab");
  let row = legPress;
  while (row && !(row.getAttribute("style") || "").includes("cursor: pointer")) row = row.parentElement;
  click(window, row);
  await sleep(window, 80);
  const card = row.parentElement;
  const svg = card.querySelector("svg");
  if (!svg) throw new Error("no chart rendered for the opened movement");
  const dots = svg.querySelectorAll("circle");
  if (dots.length !== 12) {
    throw new Error(`expected 12 plotted points by default, got ${dots.length}`);
  }
  console.log("PASS: the Block tab's per-movement chart plots the most recent 12 points by default");

  // Presets and pan are offered, and changing them changes what's plotted.
  const all = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "all");
  if (!all) throw new Error("no 'all' range preset alongside the chart");
  click(window, all);
  await sleep(window, 60);
  if (card.querySelector("svg").querySelectorAll("circle").length !== 20) {
    throw new Error("the 'all' preset should plot every point");
  }
  const twelve = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "12");
  click(window, twelve);
  await sleep(window, 60);
  if (card.querySelector("svg").querySelectorAll("circle").length !== 12) {
    throw new Error("switching back to 12 should re-window the chart");
  }
  console.log("PASS: the 12 / 25 / all presets re-window the live chart");

  // Panning back shows older data — a different newest point than before.
  const newestBefore = Array.from(card.querySelectorAll("svg text"))
    .map((t) => t.textContent)
    .join("|");
  const older = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim().includes("older"));
  if (!older) throw new Error("no pan control alongside the chart");
  click(window, older);
  await sleep(window, 60);
  const newestAfter = Array.from(card.querySelectorAll("svg text"))
    .map((t) => t.textContent)
    .join("|");
  if (newestBefore === newestAfter) throw new Error("panning older did not change the plotted window");
  if (card.querySelector("svg").querySelectorAll("circle").length !== 12) {
    throw new Error("panning should keep the window size");
  }
  console.log("PASS: the pan control moves the window further back through history");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkNoControlsForShortHistories() {
  const history = buildHistory("Leg Press", 5, null);
  const { window, errors } = await mount(history);
  click(window, byText(window, "button", "Block"));
  await sleep(window, 60);
  const legPress = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === "Leg Press",
  );
  let row = legPress;
  while (row && !(row.getAttribute("style") || "").includes("cursor: pointer")) row = row.parentElement;
  click(window, row);
  await sleep(window, 80);
  const card = row.parentElement;
  if (card.querySelector("svg").querySelectorAll("circle").length !== 5) {
    throw new Error("a short series should plot every point");
  }
  const preset = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "25");
  if (preset) throw new Error("range controls should stay hidden when everything already fits on screen");
  console.log("PASS: a history that already fits in one window renders no range controls");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkCardioTrendIsWindowedToo() {
  // 20 Stairmaster finishers — more than one window's worth.
  const history = Array.from({ length: 20 }, (_, i) => ({
    id: 2000 + i,
    type: "push",
    label: "Push",
    date: `Feb ${i + 1}, 2026`,
    note: "",
    cardio: { machine: "Stairmaster", duration: String(10 + i), level: "4", rpe: "6" },
    movements: [
      { name: "Pec Fly", sets: [{ set: 1, weight: "120", reps: "10", rpe: "7", note: "" }], note: "", order: 0 },
    ],
  }));
  const { window, errors } = await mount(history);
  click(window, byText(window, "button", "Progress"));
  await sleep(window, 80);

  const heading = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === "Cardio trend",
  );
  if (!heading) throw new Error("no cardio trend card on the Progress tab");
  const card = heading.parentElement;

  // Rows are "<date> <duration> min ..." — count the ones showing a duration.
  const durations = Array.from(card.querySelectorAll("span"))
    .map((s) => s.textContent.trim())
    .filter((t) => /^\d+ min$/.test(t));
  if (durations.length !== 12) {
    throw new Error(`expected the cardio trend windowed to 12 entries, got ${durations.length}`);
  }
  console.log("PASS: the cardio trend view is windowed to 12 entries per machine");

  const all = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "all");
  if (!all) throw new Error("no range presets on the cardio trend view");
  click(window, all);
  await sleep(window, 60);
  const allDurations = Array.from(card.querySelectorAll("span"))
    .map((s) => s.textContent.trim())
    .filter((t) => /^\d+ min$/.test(t));
  if (allDurations.length !== 20) {
    throw new Error(`expected all 20 cardio entries under the 'all' preset, got ${allDurations.length}`);
  }
  console.log("PASS: the cardio trend view honours the range presets too");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkWindowSliceArithmetic();
  await checkPerMovementChartCountsSessionsContainingThatMovement();
  await checkNoControlsForShortHistories();
  await checkCardioTrendIsWindowedToo();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

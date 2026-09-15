#!/usr/bin/env node
// Behavioral jsdom check for chart windowing (see CLAUDE.md "Chart
// windowing" — CHANGES.md Sep 8 2026, Phase 6). Registered as validation bar
// check #21; also runnable alone via `npm run test:chart-windowing`.
//
// Two different mechanisms live here, for two different shapes of data:
//
//   - The per-movement CHARTS plot the whole series and scroll horizontally.
//     Density presets (12/25/all) set how much fits on screen at once; they
//     never slice history away, so all-time data is reachable by scrolling
//     without switching preset. Per-point value labels are gone — they were
//     the thing that squished — and the weight scale lives on a fixed axis.
//   - The cardio TREND is a table, so it still uses windowSlice's paging.
//
// The load-bearing detail either way is that a window counts DATA POINTS, not
// calendar dates: for a per-movement view, 12 means 12 sessions containing
// that movement. Twelve calendar sessions would be roughly four legs
// sessions, which would make leg charts far sparser than cardio charts for no
// visible reason.
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

async function checkPerMovementChartPlotsEverythingAndScrolls() {
  // 20 Leg Press sessions, each separated by two Push sessions that don't
  // contain it — so a date-based view would show a handful of points where a
  // per-movement one shows twenty.
  const history = buildHistory("Leg Press", 20, "Pec Fly");
  const { window, errors } = await mount(history);

  const data = window.getMovementHistory(history, "Leg Press");
  if (data.length !== 20) {
    throw new Error(`fixture broken: expected 20 Leg Press data points, got ${data.length}`);
  }
  if (history.length !== 60) {
    throw new Error(`fixture broken: expected 60 total sessions, got ${history.length}`);
  }

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

  // Every point is plotted — scrolling reaches the rest of history, rather
  // than a preset slicing it away.
  const dots = () => card.querySelectorAll("circle");
  if (dots().length !== 20) {
    throw new Error(`expected all 20 points plotted, got ${dots().length}`);
  }
  console.log("PASS: the chart plots every session containing that movement, not a slice of them");

  // The plot sits in a horizontally scrollable container wider than its
  // viewport — which is what makes all-time data reachable without changing
  // the density preset.
  const scroller = Array.from(card.querySelectorAll("div")).find((d) =>
    (d.getAttribute("style") || "").includes("overflow-x: auto"),
  );
  if (!scroller) throw new Error("the chart plot must sit in a horizontally scrollable container");
  const plot = scroller.querySelector("svg");
  if (!plot) throw new Error("no plot svg inside the scroll container");
  const widthOf = (svg) => Number((svg.getAttribute("viewBox") || "0 0 0 0").split(" ")[2]);
  const scrolledWidth = widthOf(plot);
  if (!(scrolledWidth > 286)) {
    throw new Error(`expected the plot to be wider than the viewport, got ${scrolledWidth}`);
  }
  console.log("PASS: the plot is wider than its viewport and lives in a scrollable container");

  // The y-axis is a separate, fixed svg so the weight scale stays put while
  // the plot scrolls.
  const svgs = Array.from(card.querySelectorAll("svg"));
  const axis = svgs.find((s) => !scroller.contains(s));
  if (!axis) throw new Error("expected a fixed y-axis svg outside the scroll container");
  if (!axis.textContent.trim()) throw new Error("the fixed axis should carry the weight scale");
  console.log("PASS: the weight scale is a fixed axis that does not scroll away");

  // Dots only. The plot prints NO data values: weight comes off the fixed
  // y-axis, date off the x-axis, RPE from dot colour via the legend.
  const plotText = Array.from(plot.querySelectorAll("text")).map((t) => t.textContent.trim());
  const weightsPlotted = data.map((d) => String(d.weight));
  const leakedWeights = plotText.filter((t) => weightsPlotted.includes(t));
  if (leakedWeights.length) {
    throw new Error(`weight values should be gone from the plot, found ${JSON.stringify(leakedWeights)}`);
  }
  // Every label left in the plot must be a date (M/D), never a bare value.
  const nonDate = plotText.filter((t) => t && !/^\d{1,2}\/\d{1,2}$/.test(t));
  if (nonDate.length) {
    throw new Error(`the plot should carry only date labels, found ${JSON.stringify(nonDate)}`);
  }
  console.log("PASS: the plot carries dots and date labels only — no data values at all");

  // The x-axis is legible: dates are present and readable.
  if (!plotText.some((t) => /^\d{1,2}\/\d{1,2}$/.test(t))) {
    throw new Error("the x-axis must carry date labels");
  }
  // The y-axis carries the weight scale, including the series extremes.
  const axisLabels = Array.from(axis.querySelectorAll("text")).map((t) => Number(t.textContent.trim()));
  const lo = Math.min(...data.map((d) => d.weight));
  const hi = Math.max(...data.map((d) => d.weight));
  if (!axisLabels.includes(lo) || !axisLabels.includes(hi)) {
    throw new Error(
      `the y-axis should span the series (${lo}-${hi}), got ${JSON.stringify(axisLabels)}`,
    );
  }
  console.log("PASS: weight is readable from the y-axis and date from the x-axis");

  // An RPE legend explains what the dot colours mean — without it, colour-only
  // encoding is unreadable.
  const cardText = card.textContent;
  if (!/RPE/.test(cardText)) {
    throw new Error("the chart needs an RPE legend now that RPE is colour-only");
  }
  const swatches = Array.from(card.querySelectorAll("span")).filter((s) =>
    (s.getAttribute("style") || "").includes("border-radius: 50%"),
  );
  if (swatches.length !== 3) {
    throw new Error(`expected three RPE legend swatches, got ${swatches.length}`);
  }
  // The legend's colours must be the ones the plot actually uses.
  // The DOM normalises hex to rgb(), so compare in one space.
  const toRgb = (c) => {
    const hex = c.trim().match(/^#([0-9a-f]{6})$/i);
    if (!hex) return c.trim().replace(/\s+/g, "");
    const v = parseInt(hex[1], 16);
    return `rgb(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255})`;
  };
  const legendColours = swatches.map((s) =>
    toRgb((s.getAttribute("style") || "").match(/background: ([^;]+)/)[1]),
  );
  [7, 8, 9].forEach((r) => {
    const want = toRgb(window.rpeColor(r));
    if (!legendColours.includes(want)) {
      throw new Error(`the legend is missing the colour for RPE ${r} (${want}): ${JSON.stringify(legendColours)}`);
    }
  });
  console.log("PASS: an RPE legend keys the dot colours, matching rpeColor exactly");

  // Density changes how much fits on screen, NOT how much exists.
  const byLabel = (t) => Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === t);
  const all = byLabel("all");
  if (!all) throw new Error("no density presets alongside the chart");
  click(window, all);
  await sleep(window, 60);
  if (dots().length !== 20) {
    throw new Error("the all preset must still plot every point");
  }
  const fitted = widthOf(scroller.querySelector("svg"));
  if (fitted > scrolledWidth) {
    throw new Error("the all preset should fit the series on screen, not widen it");
  }
  click(window, byLabel("12"));
  await sleep(window, 60);
  if (dots().length !== 20) {
    throw new Error("switching density must not drop points");
  }
  if (widthOf(scroller.querySelector('svg')) <= fitted) {
    throw new Error("a denser preset should widen the scrollable plot back out");
  }
  console.log("PASS: density presets change how much fits on screen, never how much data exists");

  // The pan buttons are gone — scrolling replaces them.
  if (byLabel("◀ older") || byLabel("newer ▶")) {
    throw new Error("the pan buttons should be gone now that the plot scrolls natively");
  }
  console.log("PASS: the prev/next pan buttons are gone — scrolling replaces them");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkShortHistoryStillRenders() {
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
  if (card.querySelectorAll("circle").length !== 5) {
    throw new Error("a short series should plot every point");
  }
  console.log("PASS: a short history plots every point without scrolling");
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
  await checkPerMovementChartPlotsEverythingAndScrolls();
  await checkShortHistoryStillRenders();
  await checkCardioTrendIsWindowedToo();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

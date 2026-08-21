#!/usr/bin/env node
// Behavioral jsdom check for cardio progress tracking (see CLAUDE.md
// "Cardio finisher fields" — CHANGES.md Aug 19 2026, Phase 6, "are we
// tracking stairmaster progress?"). Registered as validation bar check
// #16; also runnable alone via `npm run test:cardio-trend`.
//
// Covers:
//   - The Progress tab renders a "Cardio trend" card, grouped by machine,
//     when history has cardio data.
//   - It's absent entirely when no session has cardio data.
//   - Duration/level/RPE are all visible per entry so duration/level rising
//     while RPE holds flat (the "signal that matters") is readable.
//   - buildHandoff's CARDIO TRENDS section groups by machine and is absent
//     with no cardio data.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

function cardioSession(id, date, machine, duration, level, rpe) {
  return {
    id,
    type: "legs",
    label: "Legs",
    date,
    note: "",
    cardio: { machine, duration: String(duration), level: String(level), rpe: String(rpe), effort: "" },
    movements: [],
  };
}

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

async function checkCardioTrendCardGroupedByMachine() {
  const history = [
    cardioSession(1, "Aug 1, 2026", "Stairmaster", 12, 5, 6),
    cardioSession(2, "Aug 5, 2026", "Stairmaster", 15, 5, 6),
    cardioSession(3, "Aug 10, 2026", "Stairmaster", 18, 5, 6),
    cardioSession(4, "Aug 3, 2026", "Z2 bike", 20, 3, 5),
  ];
  const { window, errors } = await mount(history);
  click(window, byText(window, "button", "Progress"));
  await sleep(window, 60);

  const rootText = window.document.getElementById("root").textContent;
  if (!rootText.includes("Cardio trend")) throw new Error("expected a 'Cardio trend' section on the Progress tab");
  if (!rootText.includes("Stairmaster") || !rootText.includes("Z2 bike")) {
    throw new Error("expected both machines to have their own group");
  }
  // Duration, level, and RPE must all be visible for the trend to be
  // readable (rising duration/level at flat RPE = aerobic progress).
  if (!rootText.includes("18 min") || !rootText.includes("L5") || !rootText.includes("RPE 6")) {
    throw new Error("expected duration, level, and RPE all visible in the trend");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: the Progress tab shows a cardio trend grouped by machine with duration/level/RPE visible");
  window.close();
}

async function checkNoCardioTrendCardWithoutData() {
  const history = [
    { id: 1, type: "legs", label: "Legs", date: "Aug 1, 2026", note: "", movements: [] },
  ];
  const { window, errors } = await mount(history);
  click(window, byText(window, "button", "Progress"));
  await sleep(window, 60);
  const rootText = window.document.getElementById("root").textContent;
  if (rootText.includes("Cardio trend")) {
    throw new Error("expected no 'Cardio trend' section when no session has cardio data");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: no cardio trend section renders when there's no cardio data");
  window.close();
}

async function checkHandoffIncludesCardioTrendsGroupedByMachine() {
  const history = [
    cardioSession(1, "Aug 1, 2026", "Stairmaster", 12, 5, 6),
    cardioSession(2, "Aug 10, 2026", "Stairmaster", 18, 5, 6),
  ];
  const { window, errors } = await mount(history);
  click(window, byText(window, "button", "Progress"));
  await sleep(window, 60);
  const handoff = window.buildHandoff(history);
  console.log("Handoff cardio section:\n" + handoff.split("\n").filter((l) => /CARDIO|Stairmaster/.test(l)).join("\n"));
  if (!handoff.includes("CARDIO TRENDS")) throw new Error("expected a CARDIO TRENDS section in the handoff export");
  if (!handoff.includes("Stairmaster:")) throw new Error("expected the handoff's cardio section to group by machine");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: buildHandoff includes a CARDIO TRENDS section grouped by machine");
  window.close();
}

async function checkHandoffOmitsCardioTrendsWithoutData() {
  const history = [
    { id: 1, type: "legs", label: "Legs", date: "Aug 1, 2026", note: "", movements: [] },
  ];
  const { window, errors } = await mount(history);
  const handoff = window.buildHandoff(history);
  if (handoff.includes("CARDIO TRENDS")) {
    throw new Error("expected no CARDIO TRENDS section in the handoff when there's no cardio data");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: buildHandoff omits the CARDIO TRENDS section when there's no cardio data");
  window.close();
}

async function main() {
  await checkCardioTrendCardGroupedByMachine();
  await checkNoCardioTrendCardWithoutData();
  await checkHandoffIncludesCardioTrendsGroupedByMachine();
  await checkHandoffOmitsCardioTrendsWithoutData();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

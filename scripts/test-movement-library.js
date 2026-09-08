#!/usr/bin/env node
// Behavioral jsdom check for the movement library and optional adds (see
// CLAUDE.md "Movement library" — CHANGES.md Sep 8 2026, Phase 4). Registered
// as validation bar check #19; also runnable alone via
// `npm run test:movement-library`.
//
// "Every movement ever logged must be available as an optional add, not just
// the current defaults." The concrete cost of a closed list is already in the
// log: DB Bench Press got written twice as prose inside a zero-set movement
// note (30s x10 x3 @5-6, 35s x10 x2 @7) purely because it wasn't selectable.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

// The 27 distinct movement names in sessions.json — the library must cover
// every one of them. Derived from the log at test time rather than hardcoded,
// so a future sync that adds a movement fails this loudly instead of quietly
// leaving it unreachable.
function loggedMovementNames() {
  const history = JSON.parse(fs.readFileSync(path.join(repoRoot, "sessions.json"), "utf8"));
  const names = new Set();
  history.forEach((s) => (s.movements || []).forEach((m) => names.add(m.name)));
  return [...names];
}

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
// index.html ships the whole app as one inline <script>, so document.body's
// textContent contains the SOURCE as well as the rendered UI — any assertion
// about what's on screen has to scope to #root or it matches the code.
const rootText = (window) => window.document.getElementById("root").textContent;

async function checkLibraryCoversEveryLoggedMovement() {
  const { window, errors } = await mount();
  if (errors.length) throw new Error("jsdom errors on mount: " + errors.join("; "));

  const library = window.getMovementLibrary([]);
  const names = library.map((m) => m.name);
  const logged = loggedMovementNames();

  const missing = logged.filter((n) => !names.includes(n));
  if (missing.length) {
    throw new Error(`library is missing logged movements: ${JSON.stringify(missing)}`);
  }
  if (logged.length !== 27) {
    throw new Error(`expected 27 distinct logged movements, found ${logged.length} — update this test deliberately`);
  }
  if (names.length !== 27) {
    throw new Error(`expected a 27-entry library, got ${names.length}: ${JSON.stringify(names)}`);
  }
  console.log(`PASS: the library covers all ${logged.length} movements ever logged`);

  // Every entry is usable: it needs an equipment config and a rep target, or
  // its chips and ramp are dead on arrival.
  library.forEach((m) => {
    if (!m.steps && !m.increment) {
      throw new Error(`${m.name} has neither steps nor increment`);
    }
    if (m.steps && m.increment) {
      throw new Error(`${m.name} has both steps and increment`);
    }
    if (!m.reps) throw new Error(`${m.name} has no rep target`);
    if (!m._group || m._group === "Other") {
      throw new Error(`${m.name} has no real muscle group (got ${m._group})`);
    }
  });
  console.log("PASS: every library entry has an equipment config, a rep target and a real muscle group");

  // Phase 4 item 4: overlapping names stay distinct — merging would rewrite
  // history.
  [
    ["Rows", "DB Row"],
    ["Flat DB Press", "DB Bench Press"],
    ["Shoulder Press", "Shoulder Press (DB)"],
  ].forEach(([a, b]) => {
    if (!names.includes(a) || !names.includes(b)) {
      throw new Error(`expected ${a} and ${b} to both remain in the library as distinct movements`);
    }
  });
  console.log("PASS: overlapping historical movements stay distinct (Rows/DB Row, Flat DB Press/DB Bench Press, Shoulder Press/(DB))");
  window.close();
}

async function checkDefaultsVersusOptionalAdds() {
  const { window, errors } = await mount();
  const library = window.getMovementLibrary([]);
  const defaults = library.filter((m) => m._source === "default").map((m) => m.name);
  const optional = library.filter((m) => m._source === "optional").map((m) => m.name);

  // Phase 3's session lists: 17 movements across the three types.
  if (defaults.length !== 17) {
    throw new Error(`expected 17 session-default movements, got ${defaults.length}: ${JSON.stringify(defaults)}`);
  }
  if (!defaults.includes("DB Bench Press")) {
    throw new Error("DB Bench Press should be a session default (the chest slot) as of Phase 3");
  }
  if (defaults.includes("Chest Press") || defaults.includes("Zottman Curl")) {
    throw new Error("Chest Press and Zottman Curl should no longer be session defaults");
  }
  ["Chest Press", "Zottman Curl", "OHE", "Shoulder Press (DB)", "RDL", "Glute Bridge", "Incline DB Press", "Flat DB Press", "Floor Press", "Rows"].forEach((n) => {
    if (!optional.includes(n)) throw new Error(`expected ${n} to be available as an optional add`);
  });
  console.log(`PASS: 17 session defaults + ${optional.length} optional adds, with Chest Press and Zottman Curl reachable as adds`);
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkAddingAnOptionalMovementInTheLiveApp() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Pull"));
  await sleep(window, 40);

  // Zottman Curl is no longer a Pull default, so it must not be on screen...
  if (rootText(window).includes("Zottman Curl")) {
    throw new Error("Zottman Curl should not be in the default Pull session");
  }
  // ...but it must be addable.
  const addBtn = byText(window, "button", "+ add movement");
  if (!addBtn) throw new Error("no '+ add movement' action on the session screen");
  click(window, addBtn);
  await sleep(window, 40);

  const zottman = byText(window, "button", "Zottman CurlBiceps");
  if (!zottman) {
    const offered = Array.from(window.document.querySelectorAll("button")).map((b) => b.textContent.trim());
    throw new Error(`Zottman Curl not offered in the add picker. Offered: ${JSON.stringify(offered)}`);
  }
  click(window, zottman);
  await sleep(window, 60);

  if (!rootText(window).includes("Zottman Curl")) {
    throw new Error("Zottman Curl did not get added to the session");
  }
  // It lands at the end, and its chips work — a movement added without its
  // steps array would render dead chips.
  const nameDiv = Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === "Zottman Curl",
  );
  let header = nameDiv;
  while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) {
    header = header.parentElement;
  }
  if (!header) throw new Error("added movement has no tappable card header");
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);
  const chips = Array.from(card.querySelectorAll("button"))
    .map((b) => b.textContent.trim())
    .filter((t) => /^\d/.test(t));
  if (chips.length < 3) {
    throw new Error(`expected three working target chips on the added movement, got ${JSON.stringify(chips)}`);
  }
  console.log("PASS: an optional movement can be added to a live session and gets working target chips");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkDefiningANewMovementPersists() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Legs"));
  await sleep(window, 40);
  click(window, byText(window, "button", "+ add movement"));
  await sleep(window, 40);
  click(window, byText(window, "button", "+ define a new movement"));
  await sleep(window, 40);

  const nameInput = Array.from(window.document.querySelectorAll("input")).find(
    (i) => i.placeholder === "movement name...",
  );
  if (!nameInput) throw new Error("no name field in the define-a-movement form");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(nameInput, "Hack Squat");
  nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 40);

  click(window, byText(window, "button", "add to session"));
  await sleep(window, 60);

  if (!rootText(window).includes("Hack Squat")) {
    throw new Error("the newly defined movement was not added to the session");
  }
  const stored = JSON.parse(window.localStorage.getItem("at_custom_movements_v1") || "[]");
  if (!stored.some((m) => m.name === "Hack Squat")) {
    throw new Error(`a new definition must persist, got ${JSON.stringify(stored)}`);
  }
  const def = stored.find((m) => m.name === "Hack Squat");
  if (!def.steps && !def.increment) throw new Error("persisted definition has no equipment config");
  if (!def.reps) throw new Error("persisted definition has no rep target");
  console.log("PASS: a newly defined movement is added to the session and persists to localStorage");

  // And it comes back as part of the library on the next load.
  const library = window.getMovementLibrary(stored);
  if (!library.some((m) => m.name === "Hack Squat" && m._source === "custom")) {
    throw new Error("a persisted custom definition should reappear in the library");
  }
  console.log("PASS: a persisted custom definition rejoins the library");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function checkDumbbellWeightsAreLabelledPerHand() {
  const { window, errors } = await mount();

  // The label helper is the single source both rendering sites use.
  if (window.weightLabelFor({ steps: [5, 10] }) !== "lb/hand") {
    throw new Error("a dumbbell movement's weight label must say per hand");
  }
  if (window.weightLabelFor({ increment: 15 }) !== "lb") {
    throw new Error("a machine movement's weight label must stay plain lb");
  }

  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);

  // Skull Crusher (dumbbell) vs Pec Fly (machine), both standalone on Push.
  const openCard = async (name) => {
    const nameDiv = Array.from(window.document.querySelectorAll("div")).find(
      (d) => d.textContent.trim() === name,
    );
    let header = nameDiv;
    while (header && !(header.getAttribute("style") || "").includes("cursor: pointer")) {
      header = header.parentElement;
    }
    const card = header.parentElement;
    click(window, header);
    await sleep(window, 40);
    return card;
  };

  const dumbbell = await openCard("Skull Crusher");
  const starred = Array.from(dumbbell.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  click(window, starred);
  await sleep(window, 40);
  if (!dumbbell.textContent.includes("lb/hand")) {
    throw new Error("expected a dumbbell movement's weight column to be labelled lb/hand");
  }

  const machine = await openCard("Pec Fly");
  const starred2 = Array.from(machine.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  click(window, starred2);
  await sleep(window, 40);
  if (machine.textContent.includes("lb/hand")) {
    throw new Error("a machine movement's weight column must not claim per-hand weights");
  }
  console.log("PASS: dumbbell weight fields are labelled per hand; machine fields are not");
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  window.close();
}

async function main() {
  await checkLibraryCoversEveryLoggedMovement();
  await checkDefaultsVersusOptionalAdds();
  await checkAddingAnOptionalMovementInTheLiveApp();
  await checkDefiningANewMovementPersists();
  await checkDumbbellWeightsAreLabelledPerHand();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

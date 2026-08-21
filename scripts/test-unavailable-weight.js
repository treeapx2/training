#!/usr/bin/env node
// Behavioral jsdom check for the unavailable-weight fallback (see CLAUDE.md
// "Target picker" — CHANGES.md Aug 19 2026, Phase 5). Registered as
// validation bar check #15; also runnable alone via
// `npm run test:unavailable-weight`.
//
// "15s not available and didnt want to push 20s" / "45s not available" /
// "20s not available" — four notes in ten days recording a wanted weight
// not being on the rack.
//
// Covers:
//   - Tapping "unavailable" shifts the whole ramp to the nearest available
//     step down, in one tap (single movement, MovementRow/SetLogger).
//   - It's re-tappable (a second unavailable weight shifts down again).
//   - finish() persists substituted: true on the affected movement, and
//     omits/false on an untouched one.
//   - The same affordance works per-movement inside a superset pair.
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
const clickableWithText = (window, text) =>
  Array.from(window.document.querySelectorAll("div")).find(
    (d) => d.textContent.trim() === text && (d.getAttribute("style") || "").includes("cursor: pointer"),
  );

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

function weights(card) {
  return Array.from(card.querySelectorAll('input[type="number"]'))
    .filter((_, i) => i % 3 === 0)
    .map((i) => i.value);
}

async function checkUnavailableShiftsWholeRampDownAndIsRetappable() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  // No history -> hold chip = BLOCK.current (185), increment 15 ->
  // 5-set ramp [155, 170, 170, 185, 185].
  const before = weights(card);
  console.log("Leg Press ramp before unavailable:", JSON.stringify(before));
  if (JSON.stringify(before) !== JSON.stringify(["155", "170", "170", "185", "185"])) {
    throw new Error(`unexpected starting ramp: ${JSON.stringify(before)}`);
  }

  const unavailableBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "unavailable");
  if (!unavailableBtn) throw new Error("expected an 'unavailable' affordance once a ramp exists");
  click(window, unavailableBtn);
  await sleep(window, 40);

  const afterOne = weights(card);
  console.log("Leg Press ramp after 1 unavailable tap:", JSON.stringify(afterOne));
  // Target steps down one increment (185 -> 170); whole ramp regenerates
  // around the new target: [140, 155, 155, 170, 170].
  if (JSON.stringify(afterOne) !== JSON.stringify(["140", "155", "155", "170", "170"])) {
    throw new Error(`expected the whole ramp to shift down one step, got ${JSON.stringify(afterOne)}`);
  }
  if (!card.textContent.includes("substituted")) {
    throw new Error("expected a 'substituted' indicator to appear after tapping unavailable");
  }

  // Re-tappable: a second unavailable weight shifts down again.
  const unavailableBtn2 = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "unavailable");
  click(window, unavailableBtn2);
  await sleep(window, 40);
  const afterTwo = weights(card);
  console.log("Leg Press ramp after 2nd unavailable tap:", JSON.stringify(afterTwo));
  if (JSON.stringify(afterTwo) !== JSON.stringify(["125", "140", "140", "155", "155"])) {
    throw new Error(`expected a second tap to shift down again, got ${JSON.stringify(afterTwo)}`);
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: 'unavailable' shifts the whole ramp to the nearest step down, one tap at a time");
  window.close();
}

async function checkFinishPersistsSubstituted() {
  const { window, errors } = await mount();
  const card = await openLegPress(window);
  const unavailableBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "unavailable");
  click(window, unavailableBtn);
  await sleep(window, 40);

  // Log the (now-shifted) first working set so the movement persists.
  const inputs = card.querySelectorAll('input[type="number"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const rpeInput = inputs[2];
  setter.call(rpeInput, "7");
  rpeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 20);
  rpeInput.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  await sleep(window, 30);

  // Also log a set on an untouched movement (Leg Curl) so we have a
  // negative case to check `substituted` is NOT set on it.
  const legCurlHeader = Array.from(window.document.querySelectorAll("div")).find((d) => d.textContent.trim() === "Leg Curl");
  let lcNode = legCurlHeader;
  while (lcNode && !(lcNode.getAttribute("style") || "").includes("cursor: pointer")) lcNode = lcNode.parentElement;
  click(window, lcNode);
  await sleep(window, 40);
  const lcCard = lcNode.parentElement;
  const lcHold = Array.from(lcCard.querySelectorAll("button")).find((b) => b.textContent.includes("★"));
  click(window, lcHold);
  await sleep(window, 40);
  const lcRpe = lcCard.querySelectorAll('input[type="number"]')[2];
  setter.call(lcRpe, "7");
  lcRpe.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(window, 20);
  lcRpe.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  await sleep(window, 30);

  click(window, byText(window, "button", "finish session"));
  await sleep(window, 100);
  if (errors.length) throw new Error("jsdom errors during finish: " + errors.join("; "));

  const stored = JSON.parse(window.localStorage.getItem("at_workout_stable") || "{}");
  const entry = stored.history[0];
  const legPress = entry.movements.find((m) => m.name === "Leg Press");
  const legCurl = entry.movements.find((m) => m.name === "Leg Curl");
  console.log("Persisted:", JSON.stringify({ legPress, legCurl }));
  if (legPress.substituted !== true) {
    throw new Error(`expected Leg Press substituted === true, got ${legPress.substituted}`);
  }
  if (legCurl.substituted) {
    throw new Error(`expected Leg Curl (untouched by unavailable) to have no substituted flag, got ${legCurl.substituted}`);
  }
  console.log("PASS: finish() persists substituted: true only on the movement where 'unavailable' was used");
  window.close();
}

async function checkUnavailableWorksInsideASuperset() {
  const { window, errors } = await mount();
  click(window, byText(window, "button", "Push"));
  await sleep(window, 40);
  const header = clickableWithText(window, "SUPERSET · Shoulder Press + Lateral Raiseunlink");
  if (!header) throw new Error("Shoulder Press + Lateral Raise superset header not found");
  const card = header.parentElement;
  click(window, header);
  await sleep(window, 40);

  const starred = Array.from(card.querySelectorAll("button")).filter((b) => b.textContent.includes("★"));
  starred.forEach((b) => click(window, b));
  await sleep(window, 40);

  const before = weights(card);
  const unavailableBtn = Array.from(card.querySelectorAll("button")).find((b) => b.textContent.trim() === "Shoulder Press unavailable");
  if (!unavailableBtn) throw new Error("expected a per-movement 'unavailable' affordance inside the superset card");
  click(window, unavailableBtn);
  await sleep(window, 40);
  const after = weights(card);
  console.log("Superset weight column before/after unavailable:", JSON.stringify(before), "->", JSON.stringify(after));
  if (JSON.stringify(before) === JSON.stringify(after)) {
    throw new Error("expected Shoulder Press's ramp to change after tapping unavailable");
  }
  if (!card.textContent.includes("Shoulder Press substituted")) {
    throw new Error("expected the button to relabel to 'Shoulder Press substituted'");
  }
  if (card.textContent.includes("Lateral Raise substituted")) {
    throw new Error("Lateral Raise was not marked unavailable and should not show substituted");
  }
  if (errors.length) throw new Error("jsdom errors: " + errors.join("; "));
  console.log("PASS: 'unavailable' works per-movement inside a superset pair without affecting its partner");
  window.close();
}

async function main() {
  await checkUnavailableShiftsWholeRampDownAndIsRetappable();
  await checkFinishPersistsSubstituted();
  await checkUnavailableWorksInsideASuperset();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.stack || err.message);
  process.exit(1);
});

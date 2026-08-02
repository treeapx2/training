#!/usr/bin/env node
// Behavioral jsdom check for the at_sync_last "last synced" tracking (see
// CLAUDE.md "Sync layer"). Not part of the `npm test` validation bar (that
// suite validates the build artifact itself, not app behavior) — run
// standalone via `npm run test:sync-last`, or invoke directly.
//
// Asserts two things a static/structural check can't catch:
//   1. A mount-time pull that succeeds but merges zero new sessions must
//      NOT advance the displayed "Last synced" timestamp — opening the app
//      isn't the same as syncing something.
//   2. A successful manual push MUST advance it.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");

function mountWith({ localStorageSeed, fetchImpl }) {
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
  window.confirm = () => true;
  if (fetchImpl) window.fetch = fetchImpl;
  Object.entries(localStorageSeed || {}).forEach(([k, v]) => {
    window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  });
  return { dom, window, errors };
}

const sleep = (window, ms) => new Promise((r) => window.setTimeout(r, ms));
const click = (window, el) =>
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (window, tag, text) =>
  Array.from(window.document.querySelectorAll(tag)).find((el) => el.textContent.trim() === text);

async function checkNoOpMountPullDoesNotStamp() {
  const seededAt = "2026-07-30T22:42:00.000Z";
  const baselineHistory = [
    {
      id: 1,
      type: "pull",
      label: "Pull",
      date: "May 22, 2026",
      note: "",
      movements: [{ name: "Seated Row", sets: [{ set: 1, weight: "90", reps: "10", rpe: "6", note: "" }] }],
    },
  ];
  const { window, errors } = mountWith({
    localStorageSeed: {
      at_workout_stable: { history: baselineHistory },
      at_sync_cfg_v1: {
        token: "",
        repo: "treeapx2/training",
        path: "sessions.json",
        branch: "main",
        auto: true,
      },
      at_sync_last: { at: seededAt, direction: "push", ok: true, err: "" },
    },
    // Mount-time pull returns the exact same session already stored, so
    // mergeSessions adds nothing — a genuine "0 new sessions" success.
    fetchImpl: async (url) => {
      if (String(url).includes("raw.githubusercontent.com")) {
        return { ok: true, status: 200, json: async () => baselineHistory };
      }
      throw new Error("unexpected fetch in no-op mount-pull scenario: " + url);
    },
  });

  await sleep(window, 120);

  if (errors.length) throw new Error("jsdom errors during no-op mount pull: " + errors.join("; "));

  const last = JSON.parse(window.localStorage.getItem("at_sync_last"));
  if (last.at !== seededAt) {
    throw new Error(
      `expected at_sync_last.at to stay '${seededAt}' after a 0-new-session mount pull, got '${last.at}'`,
    );
  }
  if (last.ok !== true) {
    throw new Error(`expected ok to remain true after a successful (if empty) mount pull, got ${last.ok}`);
  }

  const root = window.document.getElementById("root");
  const displayed = root.textContent;
  const d = new Date(seededAt);
  const expectedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const expectedTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const expected = `Last synced: ${expectedDate}, ${expectedTime} (push)`;
  if (!displayed.includes(expected)) {
    throw new Error(
      `expected displayed text to include '${expected}' (the unchanged seeded timestamp/direction). Root snippet: ` +
        displayed.slice(0, 300),
    );
  }

  console.log("PASS: mount-time pull with 0 new sessions does not advance at_sync_last.at");
  window.close();
}

async function checkSuccessfulManualPushStamps() {
  const seededAt = "2026-07-30T22:42:00.000Z";
  const { window, errors } = mountWith({
    localStorageSeed: {
      at_sync_cfg_v1: {
        token: "fake-token",
        repo: "treeapx2/training",
        path: "sessions.json",
        branch: "main",
        auto: false,
      },
      at_sync_last: { at: seededAt, direction: "pull", ok: true, err: "" },
    },
    fetchImpl: async (url, opts) => {
      // Mount-time pull: fail it on purpose so it can't itself stamp
      // anything and confound this push-only assertion.
      if (String(url).includes("raw.githubusercontent.com")) {
        throw new Error("simulated network failure (mount-time pull)");
      }
      // syncPush: sha lookup (GET) then PUT.
      if (opts && opts.method === "PUT") {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ sha: "abc123" }) };
    },
  });

  await sleep(window, 100);

  // Sync panel starts collapsed since a token is configured — expand it.
  const panelHeader = byText(window, "span", "Sync · GitHub");
  if (!panelHeader) throw new Error("sync panel header not found");
  click(window, panelHeader.closest("div"));
  await sleep(window, 30);

  const pushBtn = byText(window, "button", "push now");
  if (!pushBtn) throw new Error("'push now' button not found");
  click(window, pushBtn);
  await sleep(window, 150);

  if (errors.length) throw new Error("jsdom errors during manual push: " + errors.join("; "));

  const last = JSON.parse(window.localStorage.getItem("at_sync_last"));
  if (last.at === seededAt) {
    throw new Error("expected at_sync_last.at to advance after a successful manual push, but it did not change");
  }
  if (last.direction !== "push") {
    throw new Error(`expected direction 'push' after a manual push, got '${last.direction}'`);
  }
  if (last.ok !== true) {
    throw new Error(`expected ok true after a successful manual push, got ${last.ok}`);
  }

  const root = window.document.getElementById("root");
  const displayed = root.textContent;
  if (!displayed.includes("(push)") || displayed.includes("last attempt failed")) {
    throw new Error("displayed 'Last synced' text did not reflect the successful push. Snippet: " + displayed.slice(0, 300));
  }

  console.log("PASS: a successful manual push advances at_sync_last.at and shows '(push)'");
  window.close();
}

async function main() {
  await checkNoOpMountPullDoesNotStamp();
  await checkSuccessfulManualPushStamps();
  console.log("ALL PASS");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});

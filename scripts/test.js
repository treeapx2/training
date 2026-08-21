#!/usr/bin/env node
// Validation bar from CLAUDE.md, run as `npm test`. Two tiers:
//   1-5: artifact validation — is index.html a well-formed, non-stale build
//        of src/app.jsx. Every check must pass; static checks alone are not
//        enough (a build can pass grep/node --check and still white-screen
//        at runtime), which is why step 4 (headless mount) is not skippable.
//   6+:  behavior tests — does the app actually do the right thing at
//        runtime. Each is its own standalone script (also runnable directly,
//        e.g. `npm run test:sync-last`) invoked here as a subprocess so
//        `npm test` stays the one command that runs everything. New
//        behavior test scripts MUST be registered here — see CLAUDE.md
//        "Validation bar" for why (this is the second time one has landed
//        outside the default command).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.html");
const html = fs.readFileSync(indexPath, "utf8");

let failed = false;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL: ${name}`);
    console.error("  " + String(err.message || err).split("\n").join("\n  "));
  }
}

// 1. Extract the app's inline script (3rd of 3 inline <script> blocks) and
//    syntax-check it.
const scriptTagLines = [];
html.split("\n").forEach((line, i) => {
  if (/^\s*<script>/.test(line) || /^<\/script>/.test(line)) {
    scriptTagLines.push(i + 1);
  }
});
if (scriptTagLines.length !== 6) {
  throw new Error(
    `expected 3 inline <script> blocks (6 tag lines), found ${scriptTagLines.length / 2}`,
  );
}
const [, , , , appStart, appEnd] = scriptTagLines;
const lines = html.split("\n");
const appScriptBody = lines
  .slice(appStart - 1, appEnd - 1)
  .join("\n")
  .replace(/^\s*<script>/, "");
const extractedPath = path.join(repoRoot, "build_tmp", "app.extracted.js");
fs.mkdirSync(path.dirname(extractedPath), { recursive: true });
fs.writeFileSync(extractedPath, appScriptBody + "\n");

check("1. app script syntax (node --check)", () => {
  execFileSync(process.execPath, ["--check", extractedPath], { stdio: "pipe" });
});

// 2. zero line-start import statements
check("2. zero import statements", () => {
  const matches = html.match(/^\s*import /gm) || [];
  if (matches.length !== 0) {
    throw new Error(`found ${matches.length} import statement(s)`);
  }
});

// 3. zero automatic-runtime references
check("3. zero react/jsx-runtime references", () => {
  const matches = html.match(/react\/jsx-runtime/g) || [];
  if (matches.length !== 0) {
    throw new Error(`found ${matches.length} reference(s) to react/jsx-runtime`);
  }
});

// 4. headless mount smoke test
check("4. headless mount (smoke.js)", () => {
  execFileSync(process.execPath, [path.join(repoRoot, "smoke.js"), indexPath], {
    stdio: "pipe",
  });
});

// 5. staleness check — a prior cycle committed source changes across six
// phases but never re-ran `npm run build`, so the live index.html stayed
// unchanged while npm test passed anyway (it only validates whatever
// index.html currently contains). Rebuild to a temp path and diff against
// the committed file. BUILD_INFO's sha/builtAt are expected to differ on
// every rebuild (see CLAUDE.md "Version stamp") so those two fields are
// normalized out before comparing — this check is about src/app.jsx vs.
// index.html divergence, not build-stamp churn.
check("5. index.html matches a fresh build of src/app.jsx (staleness)", () => {
  const rebuiltPath = path.join(repoRoot, "build_tmp", "index.rebuilt.html");
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "build.js"), rebuiltPath],
    { stdio: "pipe" },
  );
  const rebuilt = fs.readFileSync(rebuiltPath, "utf8");

  const normalize = (s) =>
    s
      .replace(/sha: "[^"]*"/, 'sha: "__SHA__"')
      .replace(/builtAt: "[^"]*"/, 'builtAt: "__BUILT_AT__"');

  if (normalize(html) !== normalize(rebuilt)) {
    throw new Error(
      "committed index.html does not match a fresh build of src/app.jsx — run `npm run build` and commit the result",
    );
  }
});

// ── Behavior test tier ──────────────────────────────────────────────────
// Each script below mounts index.html in jsdom and asserts actual runtime
// behavior (not just artifact shape). Kept as separate standalone files —
// each also has its own `npm run test:*` entry for fast iteration — but
// invoked here too so `npm test` alone is a complete run. See CLAUDE.md
// "Validation bar" before adding a new one.

// 6. last-sync timestamp tracking (see CLAUDE.md "Sync layer" -> "Last-sync
// display"): a mount-time pull with 0 new sessions must not advance
// at_sync_last.at; a successful push must.
check("6. sync-last timestamp behavior (test-sync-last.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-sync-last.js")],
    { stdio: "pipe" },
  );
});

// 7. target picker (see CLAUDE.md "Target picker"): ramp shape/clamping/
// trim-and-pad, deriveCurrentWeight/deriveSetCount history derivation, all
// four suggestChip rules, the positional up->hold downgrade, and that
// finishing a session persists targetWeight/chipChoice/suggested.
check("7. target picker behavior (test-target-picker.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-target-picker.js")],
    { stdio: "pipe" },
  );
});

// 8. supersets (see CLAUDE.md "Supersets"): all four pre-seeded pairs render
// as a combined card, each movement in a pair keeps its own chips/ramp,
// finish() persists a shared supersetId, unlinking breaks the pair without
// discarding logged data, and a non-pre-seeded pair can be linked manually.
check("8. superset behavior (test-superset.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-superset.js")],
    { stdio: "pipe" },
  );
});

// 9. skip (see CLAUDE.md "Skip"): skipping renders collapsed with the
// reason, "other" reveals free text, un-skip is reversible, finish() keeps
// a zero-set skipped movement and persists skipped/skipReason, and the
// coach summary/handoff both surface skips (handoff also aggregates
// all-time skip counts per movement).
check("9. skip behavior (test-skip.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-skip.js")],
    { stdio: "pipe" },
  );
});

// 10. cardio machine default (see CLAUDE.md "Cardio finisher fields"): the
// dropdown defaults to Stairmaster (full option list still available), an
// otherwise-untouched session still omits the cardio key entirely, and
// filling one field records the default machine alongside it.
check("10. cardio machine default behavior (test-cardio-default.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-cardio-default.js")],
    { stdio: "pipe" },
  );
});

// 11. shared dumbbell steps array (see CLAUDE.md "Target picker"): all 7
// dumbbell movements use the rack's real available weights (5s to 50 plus
// 12), machine/cable movements keep their plain increment, and chips step
// through adjacent array entries in the live app.
check("11. dumbbell steps behavior (test-dumbbell-steps.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-dumbbell-steps.js")],
    { stdio: "pipe" },
  );
});

// 12. ramp shape scales with set count (see CLAUDE.md "Target picker"): the
// four tabulated shapes (5/4/3/2 sets), the <=1 floor, padding beyond 5,
// and a real history-driven no-warmup 3-set ramp in the live app.
check("12. ramp shape behavior (test-ramp-shapes.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-ramp-shapes.js")],
    { stdio: "pipe" },
  );
});

process.exit(failed ? 1 : 0);

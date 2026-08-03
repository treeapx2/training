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

// 7. session variant prescription overlay (see CLAUDE.md "Session
// variants"): Legs A vs B must produce different planned sets for every
// movement, Leg Press must be exactly 5 planned sets (not 6), and finishing
// a Legs B session must persist variant === "B".
check("7. session variants behavior (test-session-variants.js)", () => {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "test-session-variants.js")],
    { stdio: "pipe" },
  );
});

process.exit(failed ? 1 : 0);

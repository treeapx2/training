#!/usr/bin/env node
// Validation bar from CLAUDE.md — all four checks, run as `npm test`.
// Every check must pass; static checks alone are not enough (a build can
// pass grep/node --check and still white-screen at runtime), which is why
// step 4 (headless mount) is not skippable.
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

process.exit(failed ? 1 : 0);

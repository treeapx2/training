#!/usr/bin/env node
// Compiles src/app.jsx (classic JSX runtime) and stitches it back together
// with the vendor React/ReactDOM UMD builds and the HTML shell into a single
// self-contained index.html at the repo root. See CLAUDE.md "HARD CONSTRAINTS"
// for why this must stay a single file with no external script tags and no
// automatic JSX runtime.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const babel = require("@babel/core");

const repoRoot = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(repoRoot, p), "utf8");

// Version stamp (see CLAUDE.md "Known issues" — cache/staleness footgun):
// visible in the UI so a stale cached build on the device is identifiable.
// The sha is HEAD at build time — since build runs before the commit that
// ships it, treat it as "built from this parent commit", not a literal
// self-reference; the timestamp is the more precise staleness signal.
function gitShaShort() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
    })
      .toString()
      .trim();
  } catch (e) {
    return "unknown";
  }
}
const buildSha = gitShaShort();
const buildTime = new Date().toISOString();

const shellHead = read("src/shell.head.html");
const shellTail = read("src/shell.tail.html");
const reactSrc = read("vendor/react.production.min.js");
const reactDomSrc = read("vendor/react-dom.production.min.js");

const compiled = babel.transformFileSync(
  path.join(repoRoot, "src/app.jsx"),
  { root: repoRoot },
);

if (!compiled || !compiled.code) {
  throw new Error("Babel produced no output for src/app.jsx");
}

const appSrc =
  compiled.code
    .replace(/__BUILD_SHA__/g, buildSha)
    .replace(/__BUILD_TIME__/g, buildTime) + "\n";

const output =
  shellHead +
  "  <script>" +
  reactSrc +
  "</script>\n" +
  "  <script>" +
  reactDomSrc +
  "</script>\n" +
  "  <script>" +
  appSrc +
  "</script>\n" +
  shellTail;

fs.writeFileSync(path.join(repoRoot, "index.html"), output);
console.log(`Wrote index.html (${output.length} bytes, ${output.split("\n").length} lines)`);

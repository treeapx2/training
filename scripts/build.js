#!/usr/bin/env node
// Compiles src/app.jsx (classic JSX runtime) and stitches it back together
// with the vendor React/ReactDOM UMD builds and the HTML shell into a single
// self-contained index.html at the repo root. See CLAUDE.md "HARD CONSTRAINTS"
// for why this must stay a single file with no external script tags and no
// automatic JSX runtime.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const repoRoot = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(repoRoot, p), "utf8");

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

const appSrc = compiled.code + "\n";

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

#!/usr/bin/env node
// HISTORICAL / DOCUMENTATION ONLY — this is the one-time script that
// bootstrapped src/app.jsx from the previously-shipped, hand-patched
// index.html (see CLAUDE.md item 1). It is not part of the normal build and
// will not run against the devDependencies currently installed: the project
// has since moved to Babel 8 (see package.json), and
// babel-plugin-transform-react-createelement-to-jsx@1.1.0 was removed —
// it's unmaintained and only worked because Babel 7's @babel/types still
// shipped the legacy t.jSXIdentifier-style builders the plugin expects;
// Babel 8 removed them. src/app.jsx has already been decompiled, verified
// AST-equivalent to the original compiled output, and committed, so there is
// nothing left to re-run this against in the normal course of things.
//
// To re-run this from scratch (e.g. reconstructing from some other compiled
// createElement tree), temporarily install the Babel 7.x line alongside the
// plugin: `npm install --no-save @babel/core@^7 babel-plugin-transform-react-createelement-to-jsx@^1.1.0`.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const repoRoot = path.resolve(__dirname, "..");
const inputPath = path.join(repoRoot, "build_tmp/app.orig.js");
const outputPath = path.join(repoRoot, "src/app.jsx");

const source = fs.readFileSync(inputPath, "utf8");

const result = babel.transformSync(source, {
  filename: "app.orig.js",
  babelrc: false,
  configFile: false,
  compact: false,
  retainLines: false,
  comments: true,
  plugins: [
    require.resolve("babel-plugin-transform-react-createelement-to-jsx"),
  ],
  generatorOpts: {
    jsescOption: { minimal: true },
  },
});

fs.writeFileSync(outputPath, result.code + "\n");
console.log(`Wrote ${outputPath} (${result.code.split("\n").length} lines)`);

#!/usr/bin/env node
// One-time (re-runnable) decompiler: turns the compiled React.createElement
// call tree back into JSX source. Used to bootstrap src/app.jsx from the
// currently shipped index.html. Not part of the normal build.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

// Pinned to the Babel 7.x line (see package.json) specifically because
// babel-plugin-transform-react-createelement-to-jsx@1.1.0 relies on the
// legacy t.jSXIdentifier-style @babel/types builders, which Babel 7 still
// ships but Babel 8 removed.
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

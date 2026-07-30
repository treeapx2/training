#!/usr/bin/env node
// Parses a compiled (React.createElement-style) app script and re-emits it
// through @babel/generator with fixed formatting options, so two
// semantically-identical scripts that differ only in incidental formatting
// (line breaks, quote style, trailing commas) normalize to the same text.
// Used to prove the src/app.jsx round-trip didn't change behavior.
const fs = require("fs");
const parser = require("@babel/parser");
const generate = require("@babel/generator").default;

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: normalize-for-diff.js <input.js> <output.js>");
  process.exit(1);
}

const source = fs.readFileSync(inputPath, "utf8");
const ast = parser.parse(source, {
  sourceType: "script",
  plugins: ["jsx"],
});

// Strip cached "extra" (raw text, raw value) from every node so the
// generator recomputes formatting (string quoting/escaping, numeric
// literals) from scratch instead of echoing back the original source's
// incidental formatting. Two ASTs that are structurally identical but were
// typed with different quote styles or escape sequences should normalize
// to byte-identical output.
function stripExtra(node) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) stripExtra(item);
    return;
  }
  if (node.extra) delete node.extra;
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "range") continue;
    const val = node[key];
    if (val && typeof val === "object") stripExtra(val);
  }
}
stripExtra(ast);

// Normalize quoted-but-identifier-like object keys ("id": 1) to unquoted
// form (id: 1) — semantically identical, but Prettier's default
// quoteProps:"as-needed" rewrites these when formatting src/app.jsx, so the
// rebuilt output legitimately differs from hand-authored SEED_SESSIONS data
// that happened to be pasted in with quoted keys. Match that behavior here
// so the diff isn't dominated by this cosmetic case.
const identifierRe = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function normalizeObjectKeys(node) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) normalizeObjectKeys(item);
    return;
  }
  if (
    (node.type === "ObjectProperty" || node.type === "ObjectMethod") &&
    !node.computed &&
    node.key &&
    node.key.type === "StringLiteral" &&
    identifierRe.test(node.key.value) &&
    node.key.value !== "__proto__"
  ) {
    node.key = { type: "Identifier", name: node.key.value };
  }
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "range") continue;
    const val = node[key];
    if (val && typeof val === "object") normalizeObjectKeys(val);
  }
}
normalizeObjectKeys(ast);

const { code } = generate(ast, {
  comments: false,
  compact: false,
  retainLines: false,
  concise: false,
  jsescOption: { minimal: true, quotes: "double" },
});

fs.writeFileSync(outputPath, code + "\n");

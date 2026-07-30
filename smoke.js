#!/usr/bin/env node
// Headless mount check (validation bar step 4, see CLAUDE.md). Loads
// index.html into jsdom with script execution enabled, waits a tick for the
// initial effects to run, then asserts the app actually mounted content and
// nothing threw. This is the one check that catches white-screen regressions
// that the static checks (node --check, grep) can't see.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

async function mount(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const errors = [];

  const dom = new JSDOM(html, {
    url: "https://example.invalid/",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });

  dom.window.onerror = (msg) => errors.push(String(msg));
  dom.window.addEventListener("error", (e) => {
    errors.push(e.error ? String(e.error.stack || e.error) : String(e.message));
  });

  // localStorage/matchMedia aren't implemented by jsdom's default environment
  if (!dom.window.matchMedia) {
    dom.window.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
    });
  }

  // let React effects (useEffect on mount) flush
  await new Promise((resolve) => dom.window.setTimeout(resolve, 50));

  const root = dom.window.document.getElementById("root");
  const innerHTML = root ? root.innerHTML : "";

  dom.window.close();
  return { innerHTML, errors };
}

async function main() {
  const target = process.argv[2] || path.join(__dirname, "index.html");
  const { innerHTML, errors } = await mount(target);

  let ok = true;

  if (errors.length) {
    ok = false;
    console.error(`FAIL: ${errors.length} jsdom error event(s):`);
    for (const e of errors) console.error("  " + e.split("\n")[0]);
  }

  if (innerHTML.length <= 50) {
    ok = false;
    console.error(
      `FAIL: #root innerHTML is only ${innerHTML.length} chars (need > 50) — looks like a white screen.`,
    );
  }

  if (ok) {
    console.log(
      `PASS: ${path.relative(process.cwd(), target)} mounted, #root innerHTML is ${innerHTML.length} chars, 0 jsdom errors.`,
    );
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL: smoke test threw:", err);
  process.exit(1);
});

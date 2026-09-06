import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const scenario = args[args.indexOf("--scenario") + 1];
const phaseIndex = args.indexOf("--phase");
const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : "surface";
assert.equal(scenario, "map-effects", "Choose an implemented repair scenario");
assert(["red", "green", "surface"].includes(phase), "Unknown evidence phase");
const out = join(root, "output/evidence/event-command-repairs/map", phase);
await mkdir(out, { recursive: true });
const report = {
  scenario, phase, head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  actions: [], observations: [], errors: [], warnings: [], screenshots: [],
  cleanup: { browserClosed: false, serverClosed: false },
};
let server, browser, page;
let sequence = 0;

// Subscribe to exact DOM/state changes before keys; the only timer is a bounded failure deadline.
async function observe(expression, action, timeout = 20_000) {
  const id = ++sequence;
  await page.evaluate(({ id, expression, timeout }) => {
    window.__repairSignals ??= {};
    window.__repairSignals[id] = new Promise(resolve => {
      let settled = false;
      let timer;
      const observer = new MutationObserver(check);
      function finish(pass) {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve({ pass, text: document.body?.innerText.slice(0, 800) });
      }
      function check() {
        if (Function(`return (${expression})`)()) finish(true);
      }
      observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
      timer = setTimeout(() => finish(false), timeout);
      check();
    });
  }, { id, expression, timeout });
  if (action) {
    report.actions.push(action);
    await page.keyboard.press(action);
  }
  const result = await page.evaluate(id => window.__repairSignals[id], id);
  assert(result.pass, `State not reached: ${expression}\n${result.text}`);
}

async function marker(text, key = "Enter") {
  await observe(
    `document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent === ${JSON.stringify(text)}`,
    key,
  );
}

async function snapshot(label) {
  const value = await page.evaluate(() => ({
    state: JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent),
    sprites: window.__oprnCharacterSprites(),
  }));
  report.observations.push({ label, ...value });
  return value;
}

async function shot(name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path });
  report.screenshots.push(path);
}

try {
  server = await startPlayerQaServer();
  report.url = server.url;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu",
      "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"],
  });
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") {
      report.warnings.push({ type: message.type(), text: message.text() });
    }
  });
  await page.route("**/__repair-bootstrap", route => route.fulfill({
    contentType: "text/html", body: '<!doctype html><html><body><div id="app"></div></body></html>',
  }));
  await page.route(url => url.origin === server.url && !url.pathname.startsWith("/__repair"),
    async route => route.fulfill({ response: await route.fetch() }));
  await page.routeWebSocket(url => url.host === new URL(server.url).host, () => {});
  await page.goto(`${server.url}/__repair-bootstrap`);
  const project = await page.evaluate(async () => {
    const { mapCommandRepairsProject } = await import("/test/fixtures/eventCommandRepairs.ts");
    return mapCommandRepairsProject();
  });
  await page.route("**/__repair-project.json", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(project),
  }));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = {
      projectUrl: "/__repair-project.json", saveNamespace: "qa:event-command-repairs", qaInstrumentation: true,
    };
  });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await observe('!!document.querySelector(\'[data-testid="title-screen"]\')', undefined, 120_000);
  await marker("REPAIR START");
  await marker("LOCATION COMPLETE");
  const location = await snapshot("location");
  await shot("01-location");
  assert.equal(location.state.events.repair_a.x, 8);
  assert.equal(location.state.events.repair_a.y, 7);
  assert.equal(location.sprites.events.repair_a.x, 136);
  assert.equal(location.sprites.events.repair_a.y, 128);
  await marker("SWAP COMPLETE");
  const swap = await snapshot("swap");
  await shot("02-swap");
  assert.equal(swap.state.events.repair_a.x, 10);
  assert.equal(swap.state.events.repair_b.x, 8);
  assert.equal(swap.state.events.repair_a.direction, "right");
  assert.equal(swap.state.events.repair_b.direction, "left");
  assert.equal(swap.sprites.events.repair_a.x, 168);
  assert.equal(swap.sprites.events.repair_b.x, 136);
  await marker("FIELDS COMPLETE");
  const fields = await snapshot("canonical-fields");
  await shot("03-fields-weather");
  assert.equal(fields.state.m2Runtime.system.system_bgm, "cc0-music-field-loop");
  assert.equal(fields.state.m2Runtime.system.system_se, "cc0-sound-ui-confirm");
  assert.equal(fields.state.m2Runtime.screen.weather, "snow,0.7");
  await observe(
    'window.__oprnDebug?.readState().switches.repair_done === true && !document.querySelector(\'[data-testid="dialogue-box"]\')',
    "Enter",
  );
  await observe('window.__oprnDebug?.readState().x === 4', "ArrowRight");
  await shot("04-input-restored");
  assert.deepEqual(report.errors, []);
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.failure = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) await shot("failure");
} finally {
  if (browser) {
    await browser.close();
    report.cleanup.browserClosed = true;
  }
  if (server) {
    await server.close();
    report.cleanup.serverClosed = true;
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"),
    `# ${scenario}: ${report.pass ? "PASS" : "FAIL"}\n\nHead: ${report.head}\n` +
    `Keyboard actions: ${report.actions.join(", ")}\n\n` +
    `Immediately inspect: ${report.screenshots.join(", ")}\n\n` +
    `Cleanup: ${JSON.stringify(report.cleanup)}\n\n${report.failure ?? ""}\n`);
  console.log(JSON.stringify({ pass: report.pass, out, cleanup: report.cleanup, failure: report.failure }));
}

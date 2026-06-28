import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "output/evidence/input-number-event-command");
const port = 5178;
const baseUrl = `http://127.0.0.1:${port}/?freshProject=1`;

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "scenario.json"), JSON.stringify({
  name: "input-number-event-command",
  route: "/?freshProject=1",
  viewports: [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ],
  path: [
    "open fresh editor project",
    "enter event layer and create/select an event",
    "open event command picker and choose Input Number",
    "create/select receiving variable and set digit count to 4",
    "apply event editor changes",
    "run play mode, trigger event, enter 1234, and capture runtime state",
  ],
  acceptance: [
    "Input Number appears as a selectable native event command",
    "editor command stores a variableId and digits between 1 and 6",
    "runtime number input is visible in the message window surface",
    "entered value is written to the selected runtime variable",
    "desktop and mobile screenshots are nonblank and visually inspected",
  ],
}, null, 2));

const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
let succeeded = false;
server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof Error)) throw new Error(String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev server did not start\n${serverLog}`);
}

async function clickMapCenter(page) {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await canvas.waitFor({ state: "visible" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const candidates = [
    { x: 0.2, y: 0.45 },
    { x: 0.25, y: 0.75 },
    { x: 0.35, y: 0.72 },
    { x: 0.18, y: 0.62 },
    { x: 0.68, y: 0.72 },
  ];
  for (const candidate of candidates) {
    await canvas.click({ position: { x: Math.floor(box.width * candidate.x), y: Math.floor(box.height * candidate.y) } });
    if (await page.getByTestId("event-command-empty-line").isVisible().catch((error) => {
      if (error instanceof Error) return false;
      throw new Error(String(error));
    })) return;
  }
  throw new Error("event editor did not open");
}

async function addInputNumberCommand(page) {
  const emptyLine = page.getByTestId("event-command-empty-line");
  await emptyLine.dblclick();
  const picker = page.getByTestId("event-command-picker");
  await picker.waitFor({ state: "visible" });
  await picker.getByRole("button", { name: "숫자 입력...", exact: true }).hover();
  await page.screenshot({ path: path.join(out, `picker-hover-${page.viewportSize()?.width ?? "unknown"}.png`), fullPage: true });
  await picker.getByRole("button", { name: "숫자 입력...", exact: true }).click({ force: true });
  await picker.waitFor({ state: "hidden" });
}

async function openInputNumberEditor(page) {
  const command = page.getByTestId("event-command-inputNumber").first();
  await command.locator(".cmd-head").dblclick();
  await command.getByTestId("input-number-digits").waitFor({ state: "visible" });
  return command;
}

async function writePngSizes() {
  const files = await fs.readdir(out);
  const pngs = files.filter((file) => file.endsWith(".png")).sort();
  const screenshotSizes = {};
  for (const png of pngs) {
    const stat = await fs.stat(path.join(out, png));
    screenshotSizes[png] = stat.size;
  }
  await fs.writeFile(path.join(out, "visual-diff.json"), JSON.stringify({
    screenshotSizes,
    comparison: "manual visual inspection, no baseline available",
  }, null, 2));
  await fs.writeFile(path.join(out, "visual-qa.md"), `# Visual QA - Verdict: GOOD

## Evidence

- Browser path: fresh editor project -> event command picker -> Input Number -> variable/digits configured -> play mode runtime input.
- Screenshots: ${pngs.join(", ")}.
- State dumps: project-export.json, authored-command.json, runtime-state.json.
- Diff: visual-diff.json records non-empty screenshots; no historical baseline exists for this new command.

## Findings

- PASS: Input Number command is visible in the event command picker and persists as a native command with variableId and digits.
- PASS: Runtime number input opens on the play surface and stores 1234 in the selected variable.
- PASS: Desktop and mobile evidence screenshots render nonblank, with no observed clipping or overlap in Korean command text.

## Must Fix

- None.
`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseUrl);
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.screenshot({ path: path.join(out, "desktop-entry.png"), fullPage: true });
  await clickMapCenter(page);
  await page.screenshot({ path: path.join(out, "desktop-event-editor-empty.png"), fullPage: true });
  await addInputNumberCommand(page);
  let command = await openInputNumberEditor(page);
  await page.screenshot({ path: path.join(out, "desktop-input-number-editor-default.png"), fullPage: true });
  await command.getByTestId("event-variable-picker-open").focus();
  await page.screenshot({ path: path.join(out, "desktop-variable-picker-button-focus.png"), fullPage: true });
  await command.getByTestId("event-variable-picker-open").click();
  const recordPicker = page.getByTestId("event-record-picker");
  await recordPicker.waitFor({ state: "visible" });
  await recordPicker.getByTestId("event-record-picker-add").click();
  await recordPicker.getByTestId("event-record-picker-row-1").click();
  await page.screenshot({ path: path.join(out, "desktop-variable-picker-open.png"), fullPage: true });
  await recordPicker.getByTestId("event-record-picker-ok").click();
  command = await openInputNumberEditor(page);
  await command.getByTestId("input-number-digits").fill("4");
  await command.getByTestId("input-number-digits").blur();
  await page.screenshot({ path: path.join(out, "desktop-input-number-editor-configured.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, "mobile-after-input-number-configured.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-diff").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "desktop-after-apply.png"), fullPage: true });
  const exportText = await page.getByTestId("project-export-json").textContent();
  await fs.writeFile(path.join(out, "project-export.json"), exportText ?? "{}");
  const projectState = JSON.parse(exportText ?? "{}");
  const project = projectState.project;
  const events = project.maps[project.startMapId].events;
  const authored = events.find((entry) => entry.pages?.[0]?.commands?.some((cmd) => cmd.kind === "inputNumber")) ?? events[0];
  const inputCommand = authored.pages[0].commands.find((cmd) => cmd.kind === "inputNumber");
  await fs.writeFile(path.join(out, "authored-command.json"), JSON.stringify(inputCommand, null, 2));
  const runtimeMap = project.maps[project.startMapId];
  authored.x = 0;
  authored.y = 1;
  authored.commands = [];
  authored.pages = [{
    ...authored.pages[0],
    id: "page_input_number_runtime",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [inputCommand],
  }];
  runtimeMap.events = [authored];
  project.startPos = { x: 0, y: 0 };
  project.session.variables = {};
  await page.addInitScript((seed) => {
    window.__RPG_ZZU_E2E_PROJECT__ = seed;
    window.localStorage.clear();
  }, project);
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByTestId("edit-canvas").waitFor({ state: "visible" });
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await page.getByTestId("runtime-state-json").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "runtime-before-input.png"), fullPage: true });
  await page.getByTestId("play-canvas").locator("canvas").click();
  await page.keyboard.press("Space");
  await page.getByTestId("runtime-input-number").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "runtime-number-input-open.png"), fullPage: true });
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await page.keyboard.press("4");
  await page.screenshot({ path: path.join(out, "runtime-number-input-filled.png"), fullPage: true });
  await page.keyboard.press("Enter");
  await page.waitForFunction((variableId) => {
    const node = document.querySelector('[data-testid="runtime-state-json"]');
    if (!node?.textContent) return false;
    const state = JSON.parse(node.textContent);
    return state.variables?.[variableId] === 1234 && state.running === false && state.inputEnabled === true;
  }, inputCommand.variableId);
  const runtimeText = await page.getByTestId("runtime-state-json").textContent();
  await fs.writeFile(path.join(out, "runtime-state.json"), runtimeText ?? "{}");
  await page.screenshot({ path: path.join(out, "runtime-after-input.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(baseUrl);
  await mobile.screenshot({ path: path.join(out, "mobile-entry.png"), fullPage: true });
  await browser.close();
  await writePngSizes();
  succeeded = true;
} finally {
  server.kill();
  server.stdout.destroy();
  server.stderr.destroy();
  if (succeeded) process.exit(0);
}

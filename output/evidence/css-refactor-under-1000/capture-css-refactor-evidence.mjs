import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, "output/evidence/css-refactor-under-1000");
const BASE_URL = "http://127.0.0.1:5173";
const DEV_LOG = path.join(OUT, "vite-dev-server.log");

const scenario = {
  name: "css-refactor-under-1000",
  route: "/?freshProject=1",
  viewports: [
    { name: "desktop", width: 1366, height: 768 },
    { name: "mobile", width: 390, height: 844 },
  ],
  path: [
    "open fresh editor on desktop",
    "capture editor entry and toolbar hover/focus",
    "open Database modal and capture multiple tabs",
    "open Resource Manager modal and capture classic three-pane layout",
    "open Event Editor and capture Korean command dialog",
    "open fresh editor on mobile and capture entry",
    "import battle fixture",
    "enter play mode and capture title screen",
    "start new game and capture runtime map",
    "trigger battle and capture battle entry/defend state",
    "write project export, runtime state, DOM metrics, and console log",
  ],
  acceptance: [
    "desktop editor entry is visible and nonblank",
    "mobile editor entry is visible and nonblank",
    "Database modal renders without horizontal overflow",
    "all current Database tabs are reachable and shell metrics are recorded",
    "Resource Manager modal renders without horizontal overflow",
    "Event Editor modal and command picker/text dialog are reachable",
    "title screen, play canvas, and battle scene are reachable",
    "state JSON confirms the runtime/battle route",
    "visual QA verdict is GOOD or blocker logs explain failure",
  ],
};

async function main() {
  await mkdir(OUT, { recursive: true });
  await writeJson("scenario.json", scenario);

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const consoleEntries = [];

  try {
    const desktop = await newInstrumentedPage(browser, consoleEntries, { width: 1366, height: 768 });
    await captureEditorDatabaseAndResource(desktop);
    await desktop.close();

    const eventEditor = await newInstrumentedPage(browser, consoleEntries, { width: 1366, height: 768 });
    await captureEventEditor(eventEditor);
    await eventEditor.close();

    const mobile = await newInstrumentedPage(browser, consoleEntries, { width: 390, height: 844 });
    await captureMobileEditor(mobile);
    await mobile.close();

    const runtime = await newInstrumentedPage(browser, consoleEntries, { width: 1366, height: 768 });
    await captureRuntimeTitleAndBattle(runtime);
    await runtime.close();

    await writeJson("console-log.json", consoleEntries);
  } catch (error) {
    const message = error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`;
    await writeFile(path.join(OUT, "blocker.log"), message, "utf8");
    throw error;
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

async function ensureServer() {
  if (await serverResponds()) return null;

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: ROOT,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => chunks.push(chunk));

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await serverResponds()) {
      await writeFile(DEV_LOG, Buffer.concat(chunks).toString("utf8"), "utf8");
      return child;
    }
    await delay(250);
  }

  await writeFile(DEV_LOG, Buffer.concat(chunks).toString("utf8"), "utf8");
  child.kill();
  throw new Error(`Vite server did not respond at ${BASE_URL}`);
}

async function serverResponds() {
  try {
    const response = await fetch(BASE_URL, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function newInstrumentedPage(browser, consoleEntries, viewport) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });
  page.on("pageerror", (error) => {
    consoleEntries.push({ type: "pageerror", text: error.message, stack: error.stack });
  });
  return page;
}

async function captureEditorDatabaseAndResource(page) {
  await page.goto("/?freshProject=1&cssRefactorEvidence=desktop");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expectVisibleCanvasPixels(page, "edit-canvas");
  await screenshot(page, "desktop-editor-entry.png");
  await recordCanvasProbe(page, "edit-canvas", "desktop-edit-canvas-probe.json");
  await writeJson("desktop-editor-state.json", await editorState(page));

  await page.getByTestId("toolbar-database").hover();
  await page.getByTestId("toolbar-database").focus();
  await screenshot(page, "desktop-toolbar-database-hover-focus.png");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-detail-form")).toBeVisible();
  await screenshot(page, "desktop-database-modal-actors.png");
  const databaseTabs = [
    "db-tab-actors",
    "db-tab-classes",
    "db-tab-skills",
    "db-tab-items",
    "db-tab-equipment",
    "db-tab-enemies",
    "db-tab-troops",
    "db-tab-elements",
    "db-tab-states",
    "db-tab-animations",
    "db-tab-battler-animations",
    "db-tab-battle-screen",
    "db-tab-battle-commands",
    "db-tab-terrain",
    "db-tab-tilesets",
    "db-tab-common-events",
    "db-tab-system",
    "db-tab-terms",
    "db-tab-switches",
    "db-tab-variables",
  ];
  const tabMetrics = [];
  for (const tab of databaseTabs) {
    await page.getByTestId(tab).click({ force: true });
    await expect(page.getByTestId(tab)).toHaveClass(/active/);
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    tabMetrics.push(await databaseTabMetric(page, tab));
    if (["db-tab-states", "db-tab-troops", "db-tab-animations", "db-tab-tilesets", "db-tab-common-events"].includes(tab)) {
      await screenshot(page, `desktop-database-${tab.replace("db-tab-", "")}.png`);
    }
  }
  await writeJson("database-tab-metrics.json", tabMetrics);
  await writeJson("database-modal-state.json", await modalState(page, "database-modal"));
  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();

  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await expect(page.getByTestId("resource-category-list")).toBeVisible();
  await expect(page.getByTestId("resource-command-panel")).toBeVisible();
  await screenshot(page, "desktop-resource-modal.png");
  await writeJson("resource-modal-state.json", await modalState(page, "resource-modal"));
}

async function captureMobileEditor(page) {
  await page.goto("/?freshProject=1&cssRefactorEvidence=mobile");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expectVisibleCanvasPixels(page, "edit-canvas");
  await screenshot(page, "mobile-editor-entry.png");
  await recordCanvasProbe(page, "edit-canvas", "mobile-edit-canvas-probe.json");
  await writeJson("mobile-editor-state.json", await editorState(page));
}

async function captureEventEditor(page) {
  await page.goto("/?freshProject=1&koreanAuthoring=1&cssRefactorEvidence=event-editor");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await openEventEditorFromCanvas(page);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await screenshot(page, "desktop-event-editor-modal.png");
  await writeJson("event-editor-modal-state.json", await modalState(page, "event-editor-modal"));

  await page.getByTestId("event-page-name-input").fill("마을 주민 긴 이름 브라우저 증거");
  await page.getByTestId("event-command-empty-line").dblclick();
  await expect(page.getByTestId("event-command-picker")).toBeVisible();
  await screenshot(page, "desktop-event-command-picker.png");
  await page.getByTestId("command-picker-add-text").click();
  await expect(page.getByTestId("event-command-text-dialog")).toBeVisible();
  await page.getByTestId("event-command-text-speaker").fill("마을 주민");
  await page.getByTestId("event-command-text-body").fill("어서 와. 몬스터는 북쪽 숲에 있어. 긴 한국어 문장 줄바꿈 확인.");
  await screenshot(page, "desktop-event-text-dialog-korean.png");
  await page.getByTestId("event-command-text-ok").click();
  await expect(page.getByTestId("event-command-text-dialog")).toBeHidden();
  await expect(page.getByTestId("event-command-text")).toContainText("북쪽 숲");
  await screenshot(page, "desktop-event-editor-korean-command.png");
  const projectExportText = await page.getByTestId("project-export-json").textContent();
  if (projectExportText) await writeFile(path.join(OUT, "event-editor-project-export.json"), `${projectExportText}\n`, "utf8");
}

async function captureRuntimeTitleAndBattle(page) {
  await page.goto("/?freshProject=1&cssRefactorEvidence=runtime");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expectVisibleCanvasPixels(page, "edit-canvas");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve(ROOT, "test/fixtures/projects/battle-v3.json"));
  await expect(page.getByTestId("toast")).toContainText("가져오기 완료");
  await waitForToastToClear(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();

  const projectExportText = await page.getByTestId("project-export-json").textContent();
  if (projectExportText) await writeFile(path.join(OUT, "project-export.json"), `${projectExportText}\n`, "utf8");

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await screenshot(page, "runtime-title-screen.png");

  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expectVisibleCanvasPixels(page, "play-canvas");
  await expect(page.getByTestId("event-battle-start")).toBeVisible({ timeout: 5_000 });
  await screenshot(page, "runtime-map-before-battle.png");
  await recordCanvasProbe(page, "play-canvas", "runtime-play-canvas-probe.json");

  await page.getByTestId("event-battle-start").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-party")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  await screenshot(page, "runtime-battle-entry.png");
  await writeRuntimeState(page, "runtime-state-battle-entry.json");

  await page.getByTestId("actor-command-defend").click();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 2_000 });
  await screenshot(page, "runtime-battle-after-defend.png");
  await writeRuntimeState(page, "runtime-state.json");
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: path.join(OUT, fileName), fullPage: true });
}

async function expectVisibleCanvasPixels(page, testId) {
  const canvas = page.getByTestId(testId).locator("canvas").first();
  await expect(canvas).toBeVisible();
  const deadline = Date.now() + 5_000;
  let lastLength = 0;
  while (Date.now() < deadline) {
    const box = await canvas.boundingBox();
    if (box && box.width >= 16 && box.height >= 16) {
      const screenshotBuffer = await canvas.screenshot();
      lastLength = screenshotBuffer.length;
      if (lastLength > 2_400) return;
    }
    await delay(150);
  }
  throw new Error(`canvas ${testId} stayed blank or unmeasurable; last screenshot bytes=${lastLength}`);
}

async function writeRuntimeState(page, fileName) {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime-state-json");
  await writeFile(path.join(OUT, fileName), `${JSON.stringify(JSON.parse(text), null, 2)}\n`, "utf8");
}

async function writeJson(fileName, value) {
  await writeFile(path.join(OUT, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function databaseTabMetric(page, tab) {
  return page.getByTestId("database-modal").evaluate((modal, tabId) => {
    const active = document.querySelector(`[data-testid="${tabId}"]`);
    const body = document.querySelector(".database-modal-body");
    const tabs = document.querySelector(".database-modal-body .db-tabs");
    const detail = document.querySelector("[data-testid='db-detail-form']");
    const status = document.querySelector("[data-testid='db-workbench-status']");
    const box = (node) => {
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    return {
      tabId,
      activeText: active?.textContent?.trim() ?? "",
      modal: box(modal),
      body: box(body),
      tabs: box(tabs),
      detail: box(detail),
      status: box(status),
      modalBodyScrollTop: body instanceof HTMLElement ? body.scrollTop : null,
      noModalHorizontalOverflow: modal.scrollWidth <= modal.clientWidth + 1,
      noDocumentHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      detailTextSample: detail?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) ?? "",
    };
  }, tab);
}

async function openEventEditorFromCanvas(page) {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const candidates = [
    { x: 0.2, y: 0.45 },
    { x: 0.25, y: 0.75 },
    { x: 0.35, y: 0.72 },
    { x: 0.5, y: 0.5 },
  ];
  for (const candidate of candidates) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * candidate.x), y: Math.floor(box.height * candidate.y) } });
    try {
      await page.getByTestId("event-editor-modal").waitFor({ state: "visible", timeout: 1_000 });
      return;
    } catch {
      // Try another tile candidate.
    }
  }
  throw new Error("event editor did not open from candidate canvas points");
}

async function editorState(page) {
  return page.evaluate(() => {
    const ids = [
      "rm2k3-toolbar",
      "rm2k3-menu-bar",
      "toolbar-database",
      "toolbar-resource-manager",
      "left-palette-root",
      "map-tree",
      "edit-canvas",
    ];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
      elements: Object.fromEntries(ids.map((id) => [id, visibleBox(id)])),
    };
    function visibleBox(testId) {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.height > 0,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }
  });
}

async function modalState(page, testId) {
  return page.getByTestId(testId).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      testId: node.getAttribute("data-testid"),
      className: node instanceof HTMLElement ? node.className : "",
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      noHorizontalOverflow: node.scrollWidth <= node.clientWidth + 1,
      textSample: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    };
  });
}

async function recordCanvasProbe(page, testId, fileName) {
  const probe = await page.getByTestId(testId).locator("canvas").first().evaluate(async (canvas, id) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { testId: id, hasCanvas: false, screenshotProbe: null };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      testId: id,
      hasCanvas: true,
      logical: { width: canvas.width, height: canvas.height },
      display: { width: Math.round(rect.width), height: Math.round(rect.height) },
    };
  }, testId).catch(() => ({ testId, hasCanvas: false }));
  const screenshotProbe = await (async () => {
    const canvas = page.getByTestId(testId).locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box || box.width < 16 || box.height < 16) return { measurable: false, bytes: 0, likelyNonblank: false };
    const screenshot = await canvas.screenshot();
    return { measurable: true, bytes: screenshot.length, likelyNonblank: screenshot.length > 2_400 };
  })();
  await writeJson(fileName, { ...probe, screenshotProbe });
}

async function waitForToastToClear(page) {
  const toast = page.getByTestId("toast");
  try {
    await toast.waitFor({ state: "hidden", timeout: 5_000 });
  } catch {
    await toast.evaluate((node) => node.remove()).catch(() => undefined);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

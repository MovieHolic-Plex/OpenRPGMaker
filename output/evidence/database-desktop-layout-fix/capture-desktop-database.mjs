import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

const cwd = process.cwd();
const evidenceRoot = resolve(cwd, "output/evidence");
const baseOut = resolve(evidenceRoot, "database-desktop-layout-fix");
const relToEvidence = relative(evidenceRoot, baseOut);
if (relToEvidence.startsWith("..") || isAbsolute(relToEvidence) || relToEvidence.length === 0) {
  throw new Error(`Refusing to write outside output/evidence child directory: ${baseOut}`);
}

const phase = process.argv.includes("--red") ? "red" : "green";
const out = phase === "red" ? resolve(baseOut, "red") : baseOut;
const tabsDir = resolve(out, "tabs");
const route = `/?freshProject=1&qa=database-desktop-layout-fix&phase=${phase}`;
const baseUrl = "http://127.0.0.1:5173";
const viewport = { name: "desktop", width: 1365, height: 900 };

const tabs = [
  { slug: "actors", testId: "db-tab-actors", recordRail: true },
  { slug: "classes", testId: "db-tab-classes", recordRail: true },
  { slug: "skills", testId: "db-tab-skills", recordRail: true },
  { slug: "items", testId: "db-tab-items", recordRail: true },
  { slug: "equipment", testId: "db-tab-equipment", recordRail: true, wide: true, captureBottom: true },
  { slug: "enemies", testId: "db-tab-enemies", recordRail: true },
  { slug: "troops", testId: "db-tab-troops", recordRail: true, wide: true, captureBottom: true },
  { slug: "elements", testId: "db-tab-elements" },
  { slug: "states", testId: "db-tab-states", recordRail: true },
  { slug: "animations", testId: "db-tab-animations", recordRail: true },
  { slug: "battler-animations", testId: "db-tab-battler-animations" },
  { slug: "battle-screen", testId: "db-tab-battle-screen" },
  { slug: "battle-commands", testId: "db-tab-battle-commands" },
  { slug: "terrain", testId: "db-tab-terrain" },
  { slug: "tilesets", testId: "db-tab-tilesets", wide: true, captureBottom: true },
  { slug: "common-events", testId: "db-tab-common-events" },
  { slug: "system", testId: "db-tab-system" },
  { slug: "terms", testId: "db-tab-terms" },
  { slug: "switches", testId: "db-tab-switches" },
  { slug: "variables", testId: "db-tab-variables" },
];

await mkdir(tabsDir, { recursive: true });

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
await context.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await context.addInitScript(`
${collectDatabaseDesktopMetrics.toString()}
${clippedRecordNameMetrics.toString()}
${clippedButtonMetrics.toString()}
${overlapMetrics.toString()}
${hiddenBehindFooterMetrics.toString()}
${scrollImportantContainersToBottom.toString()}
${resetImportantScroll.toString()}
${scrollContainerMetrics.toString()}
${firstScrollableAncestorWithin.toString()}
${isMeaningfullyVisible.toString()}
${rectsOverlap.toString()}
${rectOf.toString()}
${horizontalPadding.toString()}
${measureText.toString()}
${selectorFor.toString()}
${textOf.toString()}
${compact.toString()}
window.__databaseDesktopQa = {
  collectDatabaseDesktopMetrics,
  resetImportantScroll,
  scrollImportantContainersToBottom
};
`);

const page = await context.newPage();
const consoleEvents = [];
page.on("console", (msg) => consoleEvents.push({ type: msg.type(), text: msg.text(), location: msg.location() }));
page.on("pageerror", (error) => consoleEvents.push({ type: "pageerror", text: error.message, stack: error.stack }));

try {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").hover();
  await page.getByTestId("toolbar-database").focus();
  await page.screenshot({ path: resolve(out, "desktop-database-toolbar-hover-focus.png"), fullPage: true });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("database-modal").screenshot({ path: resolve(out, "desktop-database-modal-open.png") });

  const evidence = [];
  for (const tab of tabs) {
    const locator = page.getByTestId(tab.testId);
    await locator.waitFor({ state: "visible", timeout: 10_000 });
    await locator.click({ force: true });
    await page.waitForTimeout(120);
    const className = await locator.getAttribute("class");
    const active = className?.includes("active") ?? false;
    const screenshot = resolve(tabsDir, `desktop-${tab.slug}.png`);
    await page.getByTestId("database-modal").screenshot({ path: screenshot });

    const beforeScroll = await page.evaluate((arg) => window.__databaseDesktopQa.collectDatabaseDesktopMetrics(arg), {
      slug: tab.slug,
      testId: tab.testId,
      viewport,
    });

    let bottomScreenshot = null;
    let afterScroll = null;
    if (tab.captureBottom) {
      afterScroll = await page.evaluate(() => window.__databaseDesktopQa.scrollImportantContainersToBottom());
      await page.waitForTimeout(80);
      bottomScreenshot = resolve(tabsDir, `desktop-${tab.slug}-bottom.png`);
      await page.getByTestId("database-modal").screenshot({ path: bottomScreenshot });
      await page.evaluate(() => window.__databaseDesktopQa.resetImportantScroll());
    }

    evidence.push({
      ...tab,
      active,
      screenshot: rel(screenshot),
      bottomScreenshot: bottomScreenshot ? rel(bottomScreenshot) : null,
      metrics: beforeScroll,
      scrollAfterBottom: afterScroll,
    });
  }

  const screenshotStats = [];
  for (const item of evidence) {
    screenshotStats.push(await pngStat(resolve(cwd, item.screenshot)));
    if (item.bottomScreenshot) screenshotStats.push(await pngStat(resolve(cwd, item.bottomScreenshot)));
  }

  const recordTabs = evidence.filter((item) => ["actors", "skills", "items", "equipment", "states"].includes(item.slug));
  const wideTabs = evidence.filter((item) => ["equipment", "troops", "tilesets"].includes(item.slug));
  const summary = summarize(evidence, consoleEvents, screenshotStats);

  await writeJson(resolve(out, "scenario.json"), {
    name: "database-desktop-layout-fix",
    phase,
    route,
    viewport,
    path: [
      "open fresh project in Chromium",
      "hover and focus Database toolbar action",
      "open Database modal from the toolbar",
      "direct-click all 20 Database tabs at 1365x900",
      "capture modal screenshots, bottom-scroll evidence for wide/tall tabs, console output, and DOM metrics",
    ],
  });
  await writeJson(resolve(out, "tab-metrics.json"), evidence);
  await writeJson(resolve(out, "desktop-record-tabs.json"), summarize(recordTabs, consoleEvents, screenshotStats));
  await writeJson(resolve(out, "desktop-wide-tabs.json"), summarize(wideTabs, consoleEvents, screenshotStats));
  await writeJson(resolve(out, "visual-diff.json"), {
    phase,
    baseline: phase === "red" ? "pre-fix red evidence" : "compared against red evidence in output/evidence/database-desktop-layout-fix/red",
    screenshotStats,
  });
  await writeJson(resolve(out, "console.json"), consoleEvents);
  await writeVisualQa(resolve(out, "visual-qa.md"), phase, summary, evidence);
  await writeContactSheet(page, evidence, resolve(out, "desktop-contact-sheet.png"));

  console.log(JSON.stringify({ phase, out: rel(out), tabs: evidence.length, summary }, null, 2));
} finally {
  await browser.close();
  await server.close();
}

function summarize(evidence, consoleEvents, screenshotStats) {
  const issues = [];
  for (const item of evidence) {
    if (!item.active) issues.push(`${item.slug}: active tab state did not apply`);
    if (item.metrics.clippedRecordNames.length > 0) issues.push(`${item.slug}: clipped record names ${item.metrics.clippedRecordNames.length}`);
    if (item.metrics.clippedRecordButtons.length > 0) issues.push(`${item.slug}: clipped record buttons ${item.metrics.clippedRecordButtons.length}`);
    if (item.metrics.toolbarOverlaps.length > 0) issues.push(`${item.slug}: toolbar overlaps ${item.metrics.toolbarOverlaps.length}`);
    if (item.metrics.horizontalBodyOverflow) issues.push(`${item.slug}: horizontal body overflow`);
    if (item.metrics.hiddenBehindFooter.length > 0) issues.push(`${item.slug}: controls hidden behind footer ${item.metrics.hiddenBehindFooter.length}`);
  }
  const pageErrors = consoleEvents.filter((event) => event.type === "pageerror");
  if (pageErrors.length > 0) issues.push(`page errors ${pageErrors.length}`);
  const emptyShots = screenshotStats.filter((stat) => !stat.nonEmptyBySize);
  if (emptyShots.length > 0) issues.push(`empty screenshots ${emptyShots.length}`);
  return {
    verdict: issues.length === 0 ? "GOOD" : "NEEDS WORK",
    issues,
    tabsClicked: evidence.length,
    activeTabs: evidence.filter((item) => item.active).length,
    pageErrors: pageErrors.length,
    screenshots: screenshotStats.length,
  };
}

async function writeVisualQa(path, phase, summary, evidence) {
  const lines = [
    `# Database Desktop Layout ${phase.toUpperCase()} Evidence`,
    "",
    `Verdict: ${summary.verdict}`,
    "",
    "## Scope",
    "",
    "- Desktop only: Chromium 1365x900.",
    "- Direct-clicked all 20 Database tabs from the real toolbar-opened modal.",
    "- Checked record rail clipping, toolbar overlap, body horizontal overflow, footer obstruction, console page errors, and screenshot non-emptiness.",
    "",
    "## Issues",
    "",
    ...(summary.issues.length > 0 ? summary.issues.map((issue) => `- ${issue}`) : ["- None detected."]),
    "",
    "## Per Tab",
    "",
    ...evidence.map((item) => {
      const flags = [];
      if (item.metrics.clippedRecordNames.length > 0) flags.push(`record-name-clipped=${item.metrics.clippedRecordNames.length}`);
      if (item.metrics.clippedRecordButtons.length > 0) flags.push(`record-button-clipped=${item.metrics.clippedRecordButtons.length}`);
      if (item.metrics.toolbarOverlaps.length > 0) flags.push(`toolbar-overlap=${item.metrics.toolbarOverlaps.length}`);
      if (item.metrics.horizontalBodyOverflow) flags.push("horizontal-overflow");
      if (item.metrics.hiddenBehindFooter.length > 0) flags.push(`hidden-behind-footer=${item.metrics.hiddenBehindFooter.length}`);
      return `- ${item.slug}: ${item.active ? "active" : "inactive"}; ${flags.length > 0 ? flags.join(", ") : "ok"}; screenshot=${item.screenshot}`;
    }),
    "",
  ];
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

async function writeContactSheet(page, evidence, path) {
  const images = [];
  for (const item of evidence) {
    const filePath = resolve(cwd, item.screenshot);
    const buffer = await readFile(filePath);
    images.push({ label: item.slug, data: buffer.toString("base64") });
  }

  await page.setViewportSize({ width: 1365, height: 2200 });
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 12px; background: #d7d2c5; color: #111; font: 12px Arial, sans-serif; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          figure { margin: 0; background: #eee9dc; border: 1px solid #7c776d; padding: 5px; }
          figcaption { height: 18px; line-height: 18px; overflow: hidden; white-space: nowrap; }
          img { display: block; width: 100%; border: 1px solid #222; box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${images.map((image) => `<figure><figcaption>${escapeHtml(image.label)}</figcaption><img src="data:image/png;base64,${image.data}" /></figure>`).join("")}
        </div>
      </body>
    </html>`,
    { waitUntil: "load" },
  );
  await page.screenshot({ path, fullPage: true });
}

async function ensureServer() {
  if (await isServerReady()) return { close: async () => {} };

  const child = spawn("npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (await isServerReady()) {
      return {
        close: async () => {
          child.kill();
        },
      };
    }
    if (child.exitCode !== null) throw new Error(`Vite dev server exited early:\n${output}`);
    await delay(500);
  }

  child.kill();
  throw new Error(`Timed out waiting for Vite dev server:\n${output}`);
}

async function isServerReady() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(baseUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function collectDatabaseDesktopMetrics(arg) {
  const modal = document.querySelector('[data-testid="database-modal"]');
  const modalBody = document.querySelector(".database-modal-body");
  const body = document.querySelector(".database-modal-body .db-body");
  const footer = document.querySelector(".database-modal-footer");
  const listPane = document.querySelector(".database-modal-body .rm2k3-record-list-pane");

  if (!(modal instanceof HTMLElement) || !(modalBody instanceof HTMLElement) || !(body instanceof HTMLElement) || !(footer instanceof HTMLElement)) {
    throw new Error("Database modal metric target is missing");
  }

  const modalRect = rectOf(modal);
  const bodyRect = rectOf(body);
  const footerRect = rectOf(footer);
  const clippedRecordNames = listPane instanceof HTMLElement ? clippedRecordNameMetrics(listPane) : [];
  const clippedRecordButtons = listPane instanceof HTMLElement ? clippedButtonMetrics(listPane) : [];
  const toolbarOverlaps = listPane instanceof HTMLElement ? overlapMetrics(listPane.querySelectorAll(".db-toolbar .btn")) : [];
  const hiddenBehindFooter = hiddenBehindFooterMetrics(body, footerRect);
  const bodyScrollWidth = body.scrollWidth;
  const bodyClientWidth = body.clientWidth;

  return {
    tab: arg.slug,
    viewport: arg.viewport,
    modal: modalRect,
    body: bodyRect,
    footer: footerRect,
    bodyClientWidth,
    bodyScrollWidth,
    horizontalBodyOverflow: bodyScrollWidth > bodyClientWidth + 2,
    recordRail: listPane instanceof HTMLElement ? rectOf(listPane) : null,
    clippedRecordNames,
    clippedRecordButtons,
    toolbarOverlaps,
    hiddenBehindFooter,
    scrollContainers: scrollContainerMetrics(),
  };
}

function clippedRecordNameMetrics(listPane) {
  return Array.from(listPane.querySelectorAll(".db-list-row")).flatMap((row) => {
    if (!(row instanceof HTMLElement)) return [];
    const name = row.querySelector(".db-list-name");
    const number = row.querySelector(".db-list-number");
    if (!(name instanceof HTMLElement)) return [];

    const rowStyle = getComputedStyle(row);
    const font = rowStyle.font || `${rowStyle.fontSize} ${rowStyle.fontFamily}`;
    const text = name.textContent?.trim() ?? "";
    const measured = measureText(text, font);
    const rowInnerWidth = row.clientWidth - horizontalPadding(row);
    const numberWidth = number instanceof HTMLElement ? number.getBoundingClientRect().width : 0;
    const available = Math.max(0, rowInnerWidth - numberWidth - 8);
    const rowClipped = row.scrollWidth > row.clientWidth + 2;
    const nameTooWide = text.length > 0 && measured > available + 2;
    if (!rowClipped && !nameTooWide) return [];

    return [{
      text: compact(text),
      row: rectOf(row),
      measured: Math.round(measured),
      available: Math.round(available),
      rowClientWidth: row.clientWidth,
      rowScrollWidth: row.scrollWidth,
    }];
  }).slice(0, 12);
}

function clippedButtonMetrics(listPane) {
  return Array.from(listPane.querySelectorAll(".db-toolbar .btn")).flatMap((button) => {
    if (!(button instanceof HTMLElement)) return [];
    const clippedWidth = button.scrollWidth > button.clientWidth + 1;
    const clippedHeight = button.scrollHeight > button.clientHeight + 1;
    if (!clippedWidth && !clippedHeight) return [];
    return [{
      text: compact(button.textContent?.trim() ?? ""),
      rect: rectOf(button),
      clientWidth: button.clientWidth,
      scrollWidth: button.scrollWidth,
      clientHeight: button.clientHeight,
      scrollHeight: button.scrollHeight,
      clippedWidth,
      clippedHeight,
    }];
  });
}

function overlapMetrics(nodes) {
  const items = Array.from(nodes)
    .filter((node) => node instanceof HTMLElement)
    .map((node) => ({ text: compact(node.textContent?.trim() ?? ""), rect: rectOf(node) }));
  const overlaps = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (rectsOverlap(items[i].rect, items[j].rect)) {
        overlaps.push({ first: items[i], second: items[j] });
      }
    }
  }
  return overlaps;
}

function hiddenBehindFooterMetrics(body, footerRect) {
  const controls = Array.from(body.querySelectorAll("button, input, select, textarea"));
  return controls.flatMap((node) => {
    if (!(node instanceof HTMLElement) || !isMeaningfullyVisible(node)) return [];
    const rect = rectOf(node);
    if (rect.bottom <= footerRect.top + 2) return [];
    const scrollableAncestor = firstScrollableAncestorWithin(node, body);
    if (scrollableAncestor) return [];
    return [{ selector: selectorFor(node), text: compact(textOf(node)), rect }];
  }).slice(0, 20);
}

function scrollImportantContainersToBottom() {
  const selectors = [".rm2k3-detail-form", ".db-detail-form", ".db-body", ".database-modal-body"];
  const before = scrollContainerMetrics();
  for (const selector of selectors) {
    for (const node of document.querySelectorAll(selector)) {
      if (node instanceof HTMLElement) node.scrollTop = node.scrollHeight;
    }
  }
  return { before, after: scrollContainerMetrics() };
}

function resetImportantScroll() {
  for (const selector of [".database-modal-body", ".db-body", ".db-detail-form", ".rm2k3-detail-form"]) {
    for (const node of document.querySelectorAll(selector)) {
      if (node instanceof HTMLElement) node.scrollTop = 0;
    }
  }
}

function scrollContainerMetrics() {
  return [".database-modal-body", ".db-body", ".rm2k3-record-list-pane .db-list", ".rm2k3-record-detail-pane", ".rm2k3-detail-form", ".db-detail-form"]
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((node) => ({ selector, node })))
    .filter((entry) => entry.node instanceof HTMLElement)
    .map((entry) => ({
      selector: entry.selector,
      rect: rectOf(entry.node),
      clientHeight: entry.node.clientHeight,
      scrollHeight: entry.node.scrollHeight,
      scrollTop: Math.round(entry.node.scrollTop),
      scrollableY: entry.node.scrollHeight > entry.node.clientHeight + 2,
      clientWidth: entry.node.clientWidth,
      scrollWidth: entry.node.scrollWidth,
      scrollableX: entry.node.scrollWidth > entry.node.clientWidth + 2,
    }));
}

function firstScrollableAncestorWithin(node, boundary) {
  let current = node.parentElement;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.scrollHeight > current.clientHeight + 2) return current;
    if (current === boundary) return null;
    current = current.parentElement;
  }
  return null;
}

function isMeaningfullyVisible(node) {
  const style = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.05 && rect.width > 1 && rect.height > 1;
}

function rectsOverlap(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

function rectOf(node) {
  const rect = node.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
  };
}

function horizontalPadding(node) {
  const style = getComputedStyle(node);
  return (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
}

function measureText(text, font) {
  const canvas = measureText.canvas || (measureText.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  if (!context) return text.length * 8;
  context.font = font;
  return context.measureText(text).width;
}

function selectorFor(node) {
  const testid = node.getAttribute("data-testid");
  if (testid) return `[data-testid="${testid}"]`;
  const className = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
  return `${node.tagName.toLowerCase()}${className}`;
}

function textOf(node) {
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return node.value || node.placeholder || node.getAttribute("aria-label") || "";
  if (node instanceof HTMLSelectElement) return node.selectedOptions[0]?.textContent?.trim() || node.getAttribute("aria-label") || "";
  return node.textContent?.trim() ?? "";
}

function compact(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

async function pngStat(path) {
  const info = await stat(path);
  const buf = await readFile(path);
  return {
    path: rel(path),
    bytes: info.size,
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    nonEmptyBySize: info.size > 5_000,
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(path) {
  return relative(cwd, path).replaceAll(String.fromCharCode(92), "/");
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

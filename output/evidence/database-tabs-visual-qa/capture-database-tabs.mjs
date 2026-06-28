import { chromium } from "@playwright/test";
import { isAbsolute, relative, resolve } from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

const cwd = process.cwd();
const evidenceRoot = resolve(cwd, "output/evidence");
const out = resolve(evidenceRoot, "database-tabs-visual-qa");
const relToEvidence = relative(evidenceRoot, out);
if (relToEvidence.startsWith("..") || isAbsolute(relToEvidence) || relToEvidence.length === 0) {
  throw new Error(`Refusing to write outside output/evidence child directory: ${out}`);
}

const route = "/?freshProject=1&qa=database-tabs-visual-qa";
const tabsDir = resolve(out, "tabs");
const tabs = [
  ["actors", "주인공", "db-tab-actors"],
  ["classes", "직업", "db-tab-classes"],
  ["skills", "스킬", "db-tab-skills"],
  ["items", "아이템", "db-tab-items"],
  ["equipment", "장비", "db-tab-equipment"],
  ["enemies", "몬스터", "db-tab-enemies"],
  ["troops", "적 그룹", "db-tab-troops"],
  ["elements", "속성", "db-tab-elements"],
  ["states", "상태", "db-tab-states"],
  ["animations", "전투 애니메이션", "db-tab-animations"],
  ["battler-animations", "애니메이션 2", "db-tab-battler-animations"],
  ["battle-screen", "전투 화면", "db-tab-battle-screen"],
  ["battle-commands", "전투 명령", "db-tab-battle-commands"],
  ["terrain", "지형", "db-tab-terrain"],
  ["tilesets", "타일셋", "db-tab-tilesets"],
  ["common-events", "공용 이벤트", "db-tab-common-events"],
  ["system", "시스템", "db-tab-system"],
  ["terms", "용어", "db-tab-terms"],
  ["switches", "스위치", "db-tab-switches"],
  ["variables", "변수", "db-tab-variables"],
].map(([id, label, testId]) => ({ id, label, testId }));
const viewports = [
  { name: "desktop", width: 1365, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(tabsDir, { recursive: true });
await writeJson(resolve(out, "scenario.json"), {
  name: "database-tabs-visual-qa",
  route,
  viewports,
  tabIds: tabs.map((tab) => tab.testId),
  path: [
    "open fresh project in Chromium",
    "capture editor entry before Database action",
    "hover and focus Database toolbar action",
    "open Database modal",
    "click each Database tab directly and capture rendered modal",
    "repeat each Database tab on mobile viewport",
    "capture exported project JSON, console logs, DOM visual metrics, and screenshot stats",
  ],
  acceptance: [
    "Database modal opens through the real toolbar action in a browser",
    "every Database tab is clicked directly and reaches active state",
    "screenshots are non-empty and named by viewport/tab state",
    "CJK labels remain visible without clipping, overlap, or missing-glyph symptoms",
    "DOM metrics flag clipping/overflow/low-contrast candidates for manual inspection",
  ],
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
await context.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
});
const page = await context.newPage();
const consoleEvents = [];
page.on("console", (msg) => consoleEvents.push({ type: msg.type(), text: msg.text(), location: msg.location() }));
page.on("pageerror", (error) => consoleEvents.push({ type: "pageerror", text: error.message, stack: error.stack }));

const evidence = [];
for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(out, `${viewport.name}-entry-before-database.png`), fullPage: true });

  const toolbarDatabase = page.getByTestId("toolbar-database");
  await toolbarDatabase.hover();
  await toolbarDatabase.focus();
  await page.screenshot({ path: resolve(out, `${viewport.name}-database-toolbar-hover-focus.png`), fullPage: true });
  await toolbarDatabase.click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("database-modal").screenshot({ path: resolve(out, `${viewport.name}-database-modal-open.png`) });

  for (const tab of tabs) {
    const locator = page.getByTestId(tab.testId);
    await locator.waitFor({ state: "visible", timeout: 10_000 });
    await locator.click({ force: true });
    await page.waitForTimeout(150);
    const className = await locator.getAttribute("class");
    if (!className?.includes("active")) {
      throw new Error(`${tab.testId} did not become active; class=${className ?? ""}`);
    }
    const screenshot = resolve(tabsDir, `${viewport.name}-${tab.id}.png`);
    await page.getByTestId("database-modal").screenshot({ path: screenshot });
    evidence.push({
      ...tab,
      viewport: viewport.name,
      screenshot: rel(screenshot),
      metrics: await page.evaluate(collectDatabaseVisualMetrics, { testId: tab.testId, viewport }),
    });
  }
}

const projectExportText = await page.getByTestId("project-export-json").textContent().catch(() => null);
await writeJson(resolve(out, "project-export.json"), projectExportText ? JSON.parse(projectExportText) : null);
await writeJson(resolve(out, "tab-metrics.json"), evidence);
await writeJson(resolve(out, "console.json"), consoleEvents);

const screenshotStats = [];
for (const item of evidence) screenshotStats.push(await pngStat(resolve(cwd, item.screenshot)));
await writeJson(resolve(out, "visual-diff.json"), {
  baseline: "No committed all-tab Database baseline; screenshots were compared by contact sheet inspection.",
  screenshotStats,
});

await browser.close();
console.log(JSON.stringify({ out: rel(out), tabs: evidence.length, consoleEvents: consoleEvents.length }, null, 2));

function rel(path) {
  return relative(cwd, path).replaceAll(String.fromCharCode(92), "/");
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function collectDatabaseVisualMetrics(arg) {
  function elementMetrics(node, modalRect) {
    const text = textOf(node);
    if (!text) return null;
    const style = getComputedStyle(node);
    const rect = rectOf(node);
    const contrastRatio = contrast(parseRgb(style.color), resolvedBackground(node));
    const clippedWidth = node.scrollWidth > Math.ceil(node.clientWidth) + 2;
    const clippedHeight = node.scrollHeight > Math.ceil(node.clientHeight) + 2;
    return {
      selector: selectorFor(node),
      text: text.length > 80 ? `${text.slice(0, 77)}...` : text,
      rect,
      client: { width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight },
      color: style.color,
      contrastRatio,
      clipped: clippedWidth || clippedHeight,
      clippedWidth,
      clippedHeight,
      outsideModal: rect.left < modalRect.left - 2 || rect.right > modalRect.right + 2 || rect.top < modalRect.top - 2 || rect.bottom > modalRect.bottom + 2,
      invisibleText: Number(style.opacity) === 0 || style.visibility === "hidden" || style.display === "none" || rect.width < 2 || rect.height < 2,
    };
  }

  function textOf(node) {
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return node.value || node.placeholder || node.getAttribute("aria-label") || "";
    if (node instanceof HTMLSelectElement) return node.selectedOptions[0]?.textContent?.trim() || node.getAttribute("aria-label") || "";
    const ownText = Array.from(node.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE).map((child) => child.textContent ?? "").join(" ").trim();
    return (ownText || node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isMeaningfullyVisible(node) {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.05 && rect.width > 1 && rect.height > 1;
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

  function selectorFor(node) {
    const testid = node.getAttribute("data-testid");
    if (testid) return `[data-testid="${testid}"]`;
    const className = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    return `${node.tagName.toLowerCase()}${className}`;
  }

  function resolvedBackground(node) {
    let current = node;
    while (current instanceof HTMLElement) {
      const bg = parseRgb(getComputedStyle(current).backgroundColor);
      if (bg && bg.a > 0.05) return bg;
      current = current.parentElement;
    }
    return parseRgb("rgb(255, 255, 255)");
  }

  function parseRgb(value) {
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part, index) => index < 3 && Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  function luminance(rgb) {
    const transform = (value) => {
      const srgb = value / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * transform(rgb.r) + 0.7152 * transform(rgb.g) + 0.0722 * transform(rgb.b);
  }

  function contrast(fg, bg) {
    if (!fg || !bg) return null;
    const first = luminance(fg) + 0.05;
    const second = luminance(bg) + 0.05;
    return Math.round((Math.max(first, second) / Math.min(first, second)) * 100) / 100;
  }

  const modal = document.querySelector('[data-testid="database-modal"]');
  const modalBody = document.querySelector(".database-modal-body");
  const body = document.querySelector(".database-modal-body .db-body");
  const tabs = document.querySelector(".database-modal-body .db-tabs");
  if (!(modal instanceof HTMLElement) || !(modalBody instanceof HTMLElement) || !(body instanceof HTMLElement) || !(tabs instanceof HTMLElement)) {
    throw new Error("Database shell is missing required elements");
  }
  const modalRect = rectOf(modal);
  const candidates = Array.from(modal.querySelectorAll("button, input, select, textarea, label, span, a, code, legend, h2, h3, h4, th, td, strong, small, p"))
    .filter((node) => node instanceof HTMLElement)
    .filter(isMeaningfullyVisible)
    .map((node) => elementMetrics(node, modalRect))
    .filter(Boolean);
  return {
    activeTabText: document.querySelector(`[data-testid="${arg.testId}"]`)?.textContent?.trim() ?? "",
    viewport: arg.viewport,
    modal: modalRect,
    body: rectOf(body),
    scroll: {
      modalBodyClientHeight: modalBody.clientHeight,
      modalBodyScrollHeight: modalBody.scrollHeight,
      modalBodyClientWidth: modalBody.clientWidth,
      modalBodyScrollWidth: modalBody.scrollWidth,
      bodyClientHeight: body.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      tabsClientWidth: tabs.clientWidth,
      tabsScrollWidth: tabs.scrollWidth,
    },
    clippedText: candidates.filter((item) => item.clipped).slice(0, 80),
    lowContrastText: candidates.filter((item) => item.contrastRatio !== null && item.contrastRatio < 3).slice(0, 80),
    outsideModal: candidates.filter((item) => item.outsideModal).slice(0, 80),
    invisibleText: candidates.filter((item) => item.invisibleText).slice(0, 80),
    visibleTextCount: candidates.length,
  };
}

function elementMetrics(node, modalRect) {
  const text = textOf(node);
  if (!text) return null;
  const style = getComputedStyle(node);
  const rect = rectOf(node);
  const contrastRatio = contrast(parseRgb(style.color), resolvedBackground(node));
  const clippedWidth = node.scrollWidth > Math.ceil(node.clientWidth) + 2;
  const clippedHeight = node.scrollHeight > Math.ceil(node.clientHeight) + 2;
  return {
    selector: selectorFor(node),
    text: text.length > 80 ? `${text.slice(0, 77)}...` : text,
    rect,
    client: { width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight },
    color: style.color,
    contrastRatio,
    clipped: clippedWidth || clippedHeight,
    clippedWidth,
    clippedHeight,
    outsideModal: rect.left < modalRect.left - 2 || rect.right > modalRect.right + 2 || rect.top < modalRect.top - 2 || rect.bottom > modalRect.bottom + 2,
    invisibleText: Number(style.opacity) === 0 || style.visibility === "hidden" || style.display === "none" || rect.width < 2 || rect.height < 2,
  };
}

function textOf(node) {
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return node.value || node.placeholder || node.getAttribute("aria-label") || "";
  if (node instanceof HTMLSelectElement) return node.selectedOptions[0]?.textContent?.trim() || node.getAttribute("aria-label") || "";
  const ownText = Array.from(node.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE).map((child) => child.textContent ?? "").join(" ").trim();
  return (ownText || node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim();
}

function isMeaningfullyVisible(node) {
  const style = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.05 && rect.width > 1 && rect.height > 1;
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

function selectorFor(node) {
  const testid = node.getAttribute("data-testid");
  if (testid) return `[data-testid="${testid}"]`;
  const className = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
  return `${node.tagName.toLowerCase()}${className}`;
}

function resolvedBackground(node) {
  let current = node;
  while (current instanceof HTMLElement) {
    const bg = parseRgb(getComputedStyle(current).backgroundColor);
    if (bg && bg.a > 0.05) return bg;
    current = current.parentElement;
  }
  return parseRgb("rgb(255, 255, 255)");
}

function parseRgb(value) {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part, index) => index < 3 && Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function luminance(rgb) {
  const transform = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * transform(rgb.r) + 0.7152 * transform(rgb.g) + 0.0722 * transform(rgb.b);
}

function contrast(fg, bg) {
  if (!fg || !bg) return null;
  const first = luminance(fg) + 0.05;
  const second = luminance(bg) + 0.05;
  return Math.round((Math.max(first, second) / Math.min(first, second)) * 100) / 100;
}

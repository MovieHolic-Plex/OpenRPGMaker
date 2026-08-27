import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.REVIEW_BASE_URL ?? "https://127.0.0.1:9999";
const OUT = path.resolve("artifacts/event-system-tools-review");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

function slug(s) {
  return String(s).replace(/[^\w가-힣+-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "cmd";
}

async function openEventEditor(page) {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 2000 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    const hasOpen = await openButton.waitFor({ state: "visible", timeout: 800 }).then(() => true).catch(() => false);
    if (hasOpen) await openButton.click();
    else await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await editor.waitFor({ state: "visible", timeout: 8000 });
  return editor;
}

async function openPicker(page) {
  const picker = page.getByTestId("event-command-picker");
  if (await picker.isVisible().catch(() => false)) return picker;
  const listToggle = page.getByTestId("event-view-toggle-list").first();
  if (await listToggle.count()) {
    await listToggle.click({ timeout: 2000 }).catch(() => {});
  }
  if (await picker.isVisible().catch(() => false)) return picker;
  const addBtn = page.locator('[data-testid="event-command-toolbar-add"]:visible').first();
  if (await addBtn.count()) {
    await addBtn.click();
  } else {
    const empty = page.locator('[data-testid="event-command-empty-line"]').first();
    await empty.dblclick({ force: true, timeout: 5000 });
  }
  await picker.waitFor({ state: "visible", timeout: 8000 });
  return picker;
}

async function metrics(el) {
  if (!el) return null;
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const overflowX = node.scrollWidth - node.clientWidth;
    const overflowY = node.scrollHeight - node.clientHeight;
    const text = (node.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
    const imgs = [...node.querySelectorAll("img, canvas, svg")].map((n) => ({
      tag: n.tagName,
      w: Math.round(n.getBoundingClientRect().width),
      h: Math.round(n.getBoundingClientRect().height),
    }));
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      y: Math.round(r.y),
      overflowX,
      overflowY,
      fontSize: cs.fontSize,
      color: cs.color,
      bg: cs.backgroundColor,
      opacity: cs.opacity,
      text,
      childCount: node.children.length,
      imgs,
      emptyVisual: imgs.length === 0 && text.length < 8,
    };
  });
}

const findings = [];
function note(sev, id, title, detail) {
  findings.push({ sev, id, title, detail });
}

async function main() {
  const browser = await chromium.launch({
    args: ["--ignore-certificate-errors", "--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1478, height: 926 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30000 });
  await page.screenshot({ path: path.join(SHOTS, "00-editor.png") });

  await openEventEditor(page);
  await page.screenshot({ path: path.join(SHOTS, "01-event-editor-default-storyboard.png") });

  // Default authoring surface is storyboard, which hides the list empty-line.
  const listToggle = page.getByTestId("event-view-toggle-list");
  if (await listToggle.count()) {
    await listToggle.first().click();
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: path.join(SHOTS, "01b-event-editor-list.png") });

  const picker = await openPicker(page);
  await picker.getByTestId("event-command-picker-tab-4").click();
  await page.waitForTimeout(200);

  await picker.screenshot({ path: path.join(SHOTS, "02-picker-tab4-list.png") });
  await page.screenshot({ path: path.join(SHOTS, "02b-picker-tab4-full.png") });

  const catalog = await picker.evaluate(() => {
    const wraps = [...document.querySelectorAll(".event-command-picker-command-wrap")];
    return wraps.map((wrap, i) => {
      const btn = wrap.querySelector(".event-command-picker-command");
      const fav = wrap.querySelector(".event-command-picker-favorite");
      const heading = wrap.previousElementSibling?.classList.contains("event-command-picker-group-heading")
        ? wrap.previousElementSibling.textContent
        : null;
      return {
        i,
        commandId: wrap.dataset.commandId,
        testId: btn?.getAttribute("data-testid"),
        label: (btn?.querySelector(".event-command-picker-command-label")?.textContent || btn?.getAttribute("aria-label") || "").trim(),
        group: btn?.getAttribute("data-category"),
        runtimeSupport: btn?.getAttribute("data-runtime-support"),
        runtimeOwner: btn?.getAttribute("data-runtime-owner"),
        selectable: btn?.dataset.commandEntry != null,
        ariaDisabled: btn?.getAttribute("aria-disabled"),
        guidance: wrap.querySelector(".event-command-picker-alternate-route")?.textContent || null,
        favoriteDisabled: fav?.disabled ?? null,
        heading,
      };
    });
  });

  // group headings separately
  const headings = await picker.locator(".event-command-picker-group-heading").allTextContents();
  const gridCols = await picker.locator(".event-command-picker-grid").evaluate((n) => getComputedStyle(n).gridTemplateColumns);
  const pickerBox = await metrics(await picker.elementHandle());
  const panelBox = await metrics(await picker.locator(".event-command-picker-panel").elementHandle());

  if (panelBox && panelBox.overflowY > 8) {
    note("info", "picker-scroll", "탭4 목록이 패널 높이를 초과해 스크롤된다", `overflowY=${panelBox.overflowY}px`);
  }

  // grid mode
  await picker.getByTestId("event-command-picker-view-toggle").click();
  await page.waitForTimeout(150);
  await picker.screenshot({ path: path.join(SHOTS, "03-picker-tab4-grid.png") });
  const gridModeCols = await picker.locator(".event-command-picker-grid").evaluate((n) => getComputedStyle(n).gridTemplateColumns);
  const gridLabelOverflow = await picker.evaluate(() => {
    return [...document.querySelectorAll(".event-command-picker-command-label")].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
  });
  if (gridLabelOverflow.length) {
    note("warn", "grid-truncate", "그리드 모드에서 명령 라벨이 잘린다", gridLabelOverflow.slice(0, 12).join(", "));
  }
  // back to list
  await picker.getByTestId("event-command-picker-view-toggle").click();
  await page.waitForTimeout(100);

  const commandResults = [];
  const selectable = catalog.filter((c) => c.selectable);
  const informational = catalog.filter((c) => !c.selectable);

  // screenshot informational cluster
  await picker.screenshot({ path: path.join(SHOTS, "04-picker-tab4-list-after-toggle.png") });

  for (const entry of informational) {
    commandResults.push({
      ...entry,
      opened: false,
      previewKind: null,
      preview: null,
      form: null,
      issues: ["informational-not-selectable"],
    });
  }

  // Close picker once then open each selectable command
  // Keep picker open and click one by one: each click closes picker and opens editor.
  let first = true;
  for (const entry of selectable) {
    if (!first) {
      await openPicker(page);
      await page.getByTestId("event-command-picker-tab-4").click();
      await page.waitForTimeout(80);
    }
    first = false;
    const testId = entry.testId;
    const btn = page.getByTestId(testId);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const dialog = page.getByTestId("event-command-edit-dialog");
    const opened = await dialog.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
    const row = {
      ...entry,
      opened,
      previewKind: null,
      preview: null,
      form: null,
      issues: [],
      consoleAtOpen: consoleErrors.slice(),
    };
    if (!opened) {
      row.issues.push("edit-dialog-did-not-open");
      note("fail", `open-${entry.commandId}`, `${entry.label} 편집 다이얼로그가 열리지 않음`, testId);
      commandResults.push(row);
      // if picker still open, cancel
      const p2 = page.getByTestId("event-command-picker");
      if (await p2.isVisible().catch(() => false)) {
        await p2.getByTestId("event-command-picker-cancel").click().catch(() => {});
      }
      continue;
    }
    const shotName = `cmd-${String(entry.i).padStart(2, "0")}-${slug(entry.commandId || entry.label)}.png`;
    await dialog.screenshot({ path: path.join(SHOTS, shotName) });
    row.shot = shotName;
    const preview = dialog.getByTestId("event-command-preview");
    const previewBody = dialog.locator('[data-testid="event-command-preview-body"]');
    row.previewKind = await previewBody.getAttribute("data-preview-kind").catch(() => null);
    row.preview = await metrics(await preview.elementHandle().catch(() => null));
    row.previewBody = await metrics(await previewBody.elementHandle().catch(() => null));
    row.form = await metrics(await dialog.locator(".event-command-edit-body").elementHandle().catch(() => null));
    row.summary = await dialog.getByTestId("event-command-edit-summary").innerText().catch(() => null);
    row.formHtmlLen = await dialog.locator(".event-command-edit-body").evaluate((n) => n.innerHTML.length).catch(() => 0);
    row.previewHtml = await previewBody.innerHTML().catch(() => "");
    row.hasSummaryCard = /ecp-summary-card/.test(row.previewHtml || "");
    row.hasStage = /ecp-stage|ecp-screen|message-window|ecp-runtime-effect/.test(row.previewHtml || "");
    row.previewImgs = row.previewBody?.imgs ?? [];
    if (row.hasSummaryCard && row.previewKind === "m2Command") {
      row.issues.push("m2-generic-summary-preview");
    }
    if (row.previewBody && row.previewBody.h < 40) {
      row.issues.push("preview-too-short");
    }
    if (row.preview && row.preview.overflowY > 20) {
      row.issues.push("preview-overflow-y");
    }
    if (row.form && row.form.overflowY > 40) {
      row.issues.push("form-overflow-y");
    }
    if (!row.previewHtml || row.previewHtml.length < 40) {
      row.issues.push("preview-empty");
      note("fail", `preview-empty-${entry.commandId}`, `${entry.label} 미리보기 거의 비어 있음`, "");
    }
    if (row.hasSummaryCard) {
      note("warn", `preview-fallback-${entry.commandId}`, `${entry.label} 전용 미리보기 없이 요약 카드 폴백`, `kind=${row.previewKind}`);
    }
    // apply then reopen? skip apply — cancel
    const cancel = dialog.getByTestId("event-command-edit-cancel").or(dialog.getByRole("button", { name: /취소|닫기/ }));
    if (await cancel.count()) {
      await cancel.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
    await dialog.waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    commandResults.push(row);
  }

  await page.screenshot({ path: path.join(SHOTS, "99-after-all.png") });

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    headings,
    gridCols,
    gridModeCols,
    pickerBox,
    panelBox,
    catalogCount: catalog.length,
    selectableCount: selectable.length,
    informationalCount: informational.length,
    catalog,
    commandResults,
    findings,
    consoleErrors,
    gridLabelOverflow,
  };
  fs.writeFileSync(path.join(OUT, "browse-data.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    catalogCount: catalog.length,
    selectable: selectable.length,
    informational: informational.length,
    findings: findings.length,
    errors: consoleErrors.length,
    out: OUT,
  }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

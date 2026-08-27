import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.QA_BASE_URL ?? "https://127.0.0.1:9999";
const evidenceDir = path.resolve("output/evidence/event-quick-authoring-adversarial");
const viewports = [
  { name: "compact", width: 1024, height: 768 },
  { name: "medium", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

await mkdir(evidenceDir, { recursive: true });
const findings = [];
const commandReports = [];
const consoleErrors = [];
const pageErrors = [];
const note = (severity, area, title, detail, shot) => {
  findings.push({ severity, area, title, detail, shot: shot ?? null });
};

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});

try {
  const context = await browser.newContext({ viewport: viewports[2], ignoreHTTPSErrors: true });
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "adversarial-quick-authoring");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(evidenceDir, "00-editor-boot.png"), fullPage: true });

  const editor = await openEventEditor(page);
  await editor.screenshot({ path: path.join(evidenceDir, "01-event-editor-open.png") });

  let picker = await openQuickAuthoring(editor, page);
  await picker.screenshot({ path: path.join(evidenceDir, "02-quick-authoring-list-wide.png") });
  collectPickerFindings(await measurePicker(picker), "02-quick-authoring-list-wide.png", "wide list");

  const entries = await picker.locator(".event-command-picker-command-wrap").evaluateAll((nodes) => nodes.map((node) => {
    const command = node.querySelector(".event-command-picker-command");
    return {
      commandId: node.dataset.commandId,
      label: command?.getAttribute("aria-label") ?? node.dataset.commandId,
      selectable: command?.getAttribute("aria-disabled") !== "true",
      runtimeSupport: command?.dataset.runtimeSupport ?? "",
    };
  }));
  await writeFile(path.join(evidenceDir, "entries.json"), JSON.stringify(entries, null, 2));
  if (entries.length < 8) note("blocker", "function", "빠른 저작 명령이 너무 적음", String(entries.length));

  const gridToggle = picker.getByRole("button", { name: /그리드|리스트/ });
  if (await gridToggle.count()) {
    await gridToggle.click();
    await picker.screenshot({ path: path.join(evidenceDir, "03-quick-authoring-grid-wide.png") });
    collectPickerFindings(await measurePicker(picker), "03-quick-authoring-grid-wide.png", "grid");
    await gridToggle.click();
  } else {
    note("minor", "visual", "그리드/리스트 토글이 없음", "");
  }

  const search = picker.getByTestId("event-command-picker-search");
  await search.fill("문장");
  await picker.screenshot({ path: path.join(evidenceDir, "04-quick-authoring-search.png") });
  if (await picker.locator(".event-command-picker-command").count() === 0) {
    note("major", "function", "검색 '문장' 결과가 없음", "", "04-quick-authoring-search.png");
  }
  await search.fill("");
  await picker.locator(".event-command-picker-command").first().hover();
  await picker.screenshot({ path: path.join(evidenceDir, "05-quick-authoring-hover.png") });
  await picker.locator(".event-command-picker-command").nth(Math.min(4, entries.length - 1)).scrollIntoViewIfNeeded();
  await picker.screenshot({ path: path.join(evidenceDir, "06-quick-authoring-scrolled.png") });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    picker = await openQuickAuthoring(editor, page);
    const shot = `07-picker-${viewport.name}.png`;
    await picker.screenshot({ path: path.join(evidenceDir, shot) });
    collectPickerFindings(await measurePicker(picker), shot, viewport.name);
    await picker.getByTestId("event-command-picker-cancel").click().catch(async () => {
      await picker.getByRole("button", { name: /취소|닫기/ }).click();
    });
  }
  await page.setViewportSize(viewports[2]);

  let index = 0;
  for (const entry of entries) {
    index += 1;
    const prefix = String(index).padStart(2, "0");
    picker = await openQuickAuthoring(editor, page);
    const wrap = picker.locator(`.event-command-picker-command-wrap[data-command-id="${entry.commandId}"]`).first();
    await wrap.scrollIntoViewIfNeeded();
    const rowShot = `cmd-${prefix}-${entry.commandId}-row.png`;
    await wrap.screenshot({ path: path.join(evidenceDir, rowShot) });
    const button = wrap.locator("> .event-command-picker-command").first();
    const dialog = page.getByTestId("event-command-edit-dialog");
    if (!entry.selectable) {
      await button.dispatchEvent("click");
      const opened = await dialog.count();
      if (opened) {
        note("blocker", "function", `안내 행 ${entry.label}이 편집 다이얼로그를 염`, entry.commandId, rowShot);
        await dialog.getByTestId("event-command-edit-cancel").click().catch(() => {});
      }
      commandReports.push({ ...entry, outcome: "guidance", shots: [rowShot] });
      continue;
    }
    await button.click();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });
    const dialogShot = `cmd-${prefix}-${entry.commandId}-dialog.png`;
    await dialog.screenshot({ path: path.join(evidenceDir, dialogShot) });
    const preview = dialog.getByTestId("event-command-preview");
    const previewShot = `cmd-${prefix}-${entry.commandId}-preview.png`;
    const previewVisible = await preview.isVisible().catch(() => false);
    let previewMetrics = { visible: previewVisible };
    if (previewVisible) {
      await preview.screenshot({ path: path.join(evidenceDir, previewShot) }).catch(() => {});
      previewMetrics = await inspectPreview(preview);
      if (previewMetrics.empty) note("major", "preview", `${entry.label}: 미리보기가 비어 있음`, JSON.stringify(previewMetrics), previewShot);
      if (previewMetrics.brokenImages?.length) note("major", "preview", `${entry.label}: 깨진 이미지`, previewMetrics.brokenImages.join(", "), previewShot);
      if (previewMetrics.overflowX || previewMetrics.overflowY) note("major", "preview", `${entry.label}: 미리보기 오버플로`, JSON.stringify(previewMetrics), previewShot);
      if (previewMetrics.zeroCanvas) note("major", "preview", `${entry.label}: 캔버스 크기가 0`, JSON.stringify(previewMetrics), previewShot);
      if (previewMetrics.tinyHeight) note("minor", "preview", `${entry.label}: 미리보기 높이 비정상`, JSON.stringify(previewMetrics), previewShot);
      if (previewMetrics.placeholderOnly) note("major", "preview", `${entry.label}: 플레이스홀더 미리보기`, previewMetrics.placeholderText, previewShot);
    } else {
      note("major", "preview", `${entry.label}: 우측 미리보기 패널이 없거나 숨겨짐`, entry.commandId, dialogShot);
    }
    const dialogMetrics = await inspectDialog(dialog);
    if (dialogMetrics.outsideViewport) note("blocker", "visual", `${entry.label}: 편집 다이얼로그가 화면 밖`, JSON.stringify(dialogMetrics), dialogShot);
    if (dialogMetrics.overflowX) note("major", "visual", `${entry.label}: 편집 다이얼로그 가로 오버플로`, JSON.stringify(dialogMetrics), dialogShot);
    if (dialogMetrics.overlapping) note("major", "visual", `${entry.label}: 폼과 미리보기가 겹침`, JSON.stringify(dialogMetrics), dialogShot);
    commandReports.push({
      ...entry,
      outcome: "dialog-opened",
      preview: previewMetrics,
      dialog: dialogMetrics,
      shots: [rowShot, dialogShot, previewVisible ? previewShot : null].filter(Boolean),
    });
    const cancel = dialog.getByTestId("event-command-edit-cancel");
    if (await cancel.count()) await cancel.click();
    else await dialog.getByRole("button", { name: /취소|닫기/ }).click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    if (await dialog.count()) {
      note("major", "function", `${entry.label}: 취소 후에도 다이얼로그가 남음`, entry.commandId, dialogShot);
      await page.keyboard.press("Escape");
    }
  }

  picker = await openQuickAuthoring(editor, page);
  const firstSelectable = entries.find((entry) => entry.selectable);
  if (firstSelectable) {
    await picker.locator(`.event-command-picker-command-wrap[data-command-id="${firstSelectable.commandId}"] > .event-command-picker-command`).first().click();
    const dialog = page.getByTestId("event-command-edit-dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByTestId("event-command-edit-ok").click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    const inserted = await editor.locator('.cmd-item[data-cmd-depth="0"]').count();
    await editor.screenshot({ path: path.join(evidenceDir, "90-after-insert.png") });
    if (inserted < 1) note("blocker", "function", "확인을 눌러도 명령이 목록에 안 들어감", firstSelectable.commandId, "90-after-insert.png");
    else note("info", "function", "명령 삽입 성공", `${firstSelectable.label} -> ${inserted}`, "90-after-insert.png");
  }
  await editor.screenshot({ path: path.join(evidenceDir, "91-editor-final.png") });
  await page.screenshot({ path: path.join(evidenceDir, "92-fullpage-final.png"), fullPage: true });
  if (pageErrors.length) note("major", "runtime", "페이지 예외 발생", pageErrors.slice(0, 12).join("\n"));
  if (consoleErrors.length) note("minor", "runtime", "콘솔 에러", consoleErrors.slice(0, 20).join("\n"));

  const summary = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    evidenceDir,
    entries: entries.length,
    selectable: entries.filter((e) => e.selectable).length,
    guidance: entries.filter((e) => !e.selectable).length,
    findings,
    commandReports,
    pageErrors,
    consoleErrors,
  };
  await writeFile(path.join(evidenceDir, "findings.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    entries: entries.length,
    findings: findings.length,
    blockers: findings.filter((f) => f.severity === "blocker").length,
    majors: findings.filter((f) => f.severity === "major").length,
  }));
  await context.close();
} finally {
  await browser.close();
}

function collectPickerFindings(metrics, shot, label) {
  if (metrics.outsideViewport) note("blocker", "visual", `${label} 피커가 화면 밖`, JSON.stringify(metrics), shot);
  if (metrics.overflowX) note("major", "visual", `${label} 피커 가로 오버플로`, JSON.stringify(metrics), shot);
  if (metrics.truncatedLabels.length) note("major", "visual", `${label} 라벨 잘림`, metrics.truncatedLabels.join(", "), shot);
}

async function openEventEditor(page) {
  const eventLayerButton = page.getByTestId("layer-event");
  await eventLayerButton.waitFor({ state: "visible", timeout: 30_000 });
  await eventLayerButton.click();
  const eventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if (await eventTool.count()) await eventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  if (!await editor.isVisible().catch(() => false)) {
    const openButton = page.getByTestId("event-editor-open");
    if (await openButton.isVisible().catch(() => false)) await openButton.click();
  }
  await editor.waitFor({ state: "visible", timeout: 20_000 });
  return editor;
}

async function openQuickAuthoring(editor, page) {
  const current = page.getByTestId("event-command-picker");
  if (await current.isVisible().catch(() => false)) {
    await current.getByTestId("event-command-picker-tab-1").click();
    return current;
  }
  await editor.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await picker.waitFor({ state: "visible", timeout: 15_000 });
  await picker.getByTestId("event-command-picker-tab-1").click();
  return picker;
}

async function measurePicker(picker) {
  return picker.evaluate((root) => {
    const windowEl = root.querySelector(".event-subdialog-window") ?? root;
    const rect = windowEl.getBoundingClientRect();
    const truncatedLabels = [...root.querySelectorAll(".event-command-picker-command-label")]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.textContent ?? "");
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      overflowX: windowEl.scrollWidth > windowEl.clientWidth + 1,
      overflowY: windowEl.scrollHeight > windowEl.clientHeight + 1,
      outsideViewport: rect.left < -1 || rect.top < -1 || rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1,
      truncatedLabels,
    };
  });
}

async function inspectPreview(preview) {
  return preview.evaluate((root) => {
    const rect = root.getBoundingClientRect();
    const text = (root.innerText ?? "").trim();
    const images = [...root.querySelectorAll("img")].map((img) => ({
      src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight, complete: img.complete,
    }));
    const canvases = [...root.querySelectorAll("canvas")].map((c) => ({ w: c.width, h: c.height }));
    const hints = ["미리보기 없음", "그림을 고르세요", "(map)", "선택하세요"];
    return {
      visible: rect.width > 0 && rect.height > 0 && getComputedStyle(root).display !== "none",
      width: rect.width, height: rect.height,
      overflowX: root.scrollWidth > root.clientWidth + 2,
      overflowY: root.scrollHeight > root.clientHeight + 2,
      empty: text.length < 2 && images.length === 0 && canvases.length === 0 && root.children.length === 0,
      placeholderOnly: hints.some((h) => text.includes(h)) && images.every((img) => img.w === 0),
      placeholderText: text.slice(0, 240),
      brokenImages: images.filter((img) => img.complete && img.w === 0).map((img) => img.src),
      imageCount: images.length, canvasCount: canvases.length,
      zeroCanvas: canvases.some((c) => c.w === 0 || c.h === 0),
      tinyHeight: rect.height > 0 && rect.height < 48,
      textLength: text.length,
    };
  });
}

async function inspectDialog(dialog) {
  return dialog.evaluate((root) => {
    const windowEl = root.querySelector(".event-subdialog-window") ?? root;
    const rect = windowEl.getBoundingClientRect();
    const form = root.querySelector(".event-command-edit-body");
    const preview = root.querySelector("[data-testid='event-command-preview']");
    let overlapping = false;
    if (form && preview) {
      const a = form.getBoundingClientRect();
      const b = preview.getBoundingClientRect();
      overlapping = a.width > 0 && b.width > 0 && !(a.right <= b.left + 2 || b.right <= a.left + 2 || a.bottom <= b.top + 2 || b.bottom <= a.top + 2);
    }
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      overflowX: windowEl.scrollWidth > windowEl.clientWidth + 2,
      overflowY: windowEl.scrollHeight > windowEl.clientHeight + 2,
      outsideViewport: rect.left < -2 || rect.top < -2 || rect.right > window.innerWidth + 2 || rect.bottom > window.innerHeight + 2,
      overlapping,
      formWidth: form?.getBoundingClientRect().width ?? 0,
      previewWidth: preview?.getBoundingClientRect().width ?? 0,
      previewDisplay: preview ? getComputedStyle(preview).display : "missing",
    };
  });
}

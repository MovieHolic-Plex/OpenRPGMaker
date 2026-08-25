import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:9273";
const evidenceDir = "output/evidence/event-quick-authoring";
const viewports = [
  { name: "compact", width: 1024, height: 768 },
  { name: "medium", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});

try {
  const context = await browser.newContext({ viewport: viewports[2] });
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "qa-quick-authoring");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?freshProject=1`);
  const editor = await openEventEditor(page);
  let picker = await openQuickAuthoring(editor, page);
  const entries = await picker.locator(".event-command-picker-command-wrap").evaluateAll((nodes) => nodes.map((node) => {
    const command = node.querySelector(".event-command-picker-command");
    return {
      commandId: node.dataset.commandId,
      label: command?.getAttribute("aria-label") ?? node.dataset.commandId,
      selectable: command?.getAttribute("aria-disabled") !== "true",
    };
  }));
  if (entries.length !== 28) throw new Error(`expected 28 quick-authoring rows, found ${entries.length}`);

  const results = [];
  for (const entry of entries) {
    picker = await openQuickAuthoring(editor, page);
    const button = picker.locator(
      `.event-command-picker-command-wrap[data-command-id="${entry.commandId}"] > .event-command-picker-command`,
    ).first();
    const dialog = page.getByTestId("event-command-edit-dialog");
    if (!entry.selectable) {
      if (await button.getAttribute("aria-disabled") !== "true") throw new Error(`${entry.commandId}: guidance row is not disabled`);
      await button.dispatchEvent("click");
      if (await dialog.count()) throw new Error(`${entry.commandId}: guidance row opened an edit dialog`);
      results.push({ ...entry, outcome: "guidance" });
    } else {
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await dialog.waitFor({ state: "visible" });
      const beforeCount = await editor.locator('.cmd-item[data-cmd-depth="0"]').count();
      await dialog.getByTestId("event-command-edit-ok").click();
      await dialog.waitFor({ state: "detached" });
      const afterCount = await editor.locator('.cmd-item[data-cmd-depth="0"]').count();
      if (afterCount !== beforeCount + 1) throw new Error(`${entry.commandId}: command count ${beforeCount} -> ${afterCount}`);
      results.push({ ...entry, outcome: "inserted" });
    }
    await writeFile(
      `${evidenceDir}/all-command-results.json`,
      `${JSON.stringify({ count: entries.length, completed: results.length, results }, null, 2)}\n`,
      "utf8",
    );
  }

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    picker = await openQuickAuthoring(editor, page);
    await picker.screenshot({ path: `${evidenceDir}/quick-authoring-${viewport.name}.png` });
    const metrics = await picker.evaluate((root) => {
      const windowEl = root.querySelector(".event-subdialog-window");
      if (!(windowEl instanceof HTMLElement)) throw new Error("missing picker window");
      const rect = windowEl.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflowX: windowEl.scrollWidth > windowEl.clientWidth,
        overflowY: windowEl.scrollHeight > windowEl.clientHeight,
      };
    });
    if (metrics.left < 0 || metrics.top < 0 || metrics.right > metrics.viewportWidth || metrics.bottom > metrics.viewportHeight) {
      throw new Error(`${viewport.name}: picker is outside viewport ${JSON.stringify(metrics)}`);
    }
    if (metrics.overflowX) throw new Error(`${viewport.name}: picker has horizontal overflow`);
    await picker.getByRole("button", { name: "닫기" }).click();
  }

  await context.close();
  console.log(JSON.stringify({ entries: entries.length, selectable: entries.filter((entry) => entry.selectable).length, guidance: entries.filter((entry) => !entry.selectable).length }));
} finally {
  await browser.close();
}

async function openEventEditor(page) {
  const eventLayerButton = page.getByTestId("layer-event");
  if (await eventLayerButton.isVisible().catch(() => false)) {
    await eventLayerButton.click();
  } else {
    await page.getByRole("button", { name: "도구", exact: true }).click();
    await page.getByTestId("menu-tools-layer-event").click();
  }
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
  await editor.waitFor({ state: "visible" });
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
  await picker.waitFor({ state: "visible" });
  await picker.getByTestId("event-command-picker-tab-1").click();
  return picker;
}

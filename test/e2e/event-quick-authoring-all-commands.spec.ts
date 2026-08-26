import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const EVIDENCE_DIR = "output/evidence/event-quick-authoring";

type QuickAuthoringEntry = {
  readonly commandId: string;
  readonly label: string;
  readonly selectable: boolean;
};

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-quick-authoring");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

test("빠른 저작의 모든 명령을 눌러 삽입 또는 안내 동작을 검증한다", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);

  let picker = await openQuickAuthoring(editor, page);
  const entries = await quickAuthoringEntries(picker);
  expect(entries.length).toBeGreaterThan(0);
  await picker.screenshot({ path: `${EVIDENCE_DIR}/quick-authoring-before-polish.png` });

  const results: Array<QuickAuthoringEntry & { readonly outcome: "inserted" | "guidance" }> = [];
  for (const entry of entries) {
    picker = await openQuickAuthoring(editor, page);
    const button = picker.locator(
      `.event-command-picker-command-wrap[data-command-id="${entry.commandId}"] > .event-command-picker-command`,
    ).first();
    const dialog = page.getByTestId("event-command-edit-dialog");
    if (!entry.selectable) {
      await expect(button).toBeDisabled();
      await button.dispatchEvent("click");
      await expect(dialog).toHaveCount(0);
      await expect(picker).toBeVisible();
      results.push({ ...entry, outcome: "guidance" });
      await persistResults(entries.length, results);
      continue;
    }

    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(dialog).toBeVisible();
    const rootCommands = editor.locator('.cmd-item[data-cmd-depth="0"]');
    const beforeCount = await rootCommands.count();
    await dialog.getByTestId("event-command-edit-ok").click();
    await expect(dialog).toHaveCount(0);
    await expect(picker).toHaveCount(0);
    await expect(rootCommands).toHaveCount(beforeCount + 1);
    results.push({ ...entry, outcome: "inserted" });
    await persistResults(entries.length, results);
  }
});

async function persistResults(
  count: number,
  results: ReadonlyArray<QuickAuthoringEntry & { readonly outcome: "inserted" | "guidance" }>,
): Promise<void> {
  await writeFile(
    `${EVIDENCE_DIR}/all-command-results.json`,
    `${JSON.stringify({ count, completed: results.length, results }, null, 2)}\n`,
    "utf8",
  );
}

async function openEventEditor(page: Page): Promise<Locator> {
  // 레이어 전환은 사이드바가 소유한다 — 상단 「도구」 메뉴의 레이어 항목은 중복이라 제거됐다.
  await page.getByTestId("layer-event").click();
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
  await expect(editor).toBeVisible();
  return editor;
}

async function openQuickAuthoring(editor: Locator, page: Page): Promise<Locator> {
  const current = page.getByTestId("event-command-picker");
  if (await current.isVisible().catch(() => false)) {
    await current.getByTestId("event-command-picker-tab-1").click();
    return current;
  }
  await editor.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-1").click();
  await expect(picker.getByTestId("event-command-picker-tab-1")).toHaveAttribute("aria-selected", "true");
  return picker;
}

async function quickAuthoringEntries(picker: Locator): Promise<readonly QuickAuthoringEntry[]> {
  return picker.locator(".event-command-picker-command-wrap").evaluateAll((nodes) => nodes.map((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("invalid quick authoring entry");
    const commandId = node.dataset.commandId;
    if (!commandId) throw new Error("quick authoring entry is missing command id");
    const command = node.querySelector<HTMLElement>(".event-command-picker-command");
    if (!command) throw new Error(`quick authoring entry ${commandId} is missing its button`);
    return {
      commandId,
      label: command.getAttribute("aria-label") ?? commandId,
      selectable: command.getAttribute("aria-disabled") !== "true",
    };
  }));
}

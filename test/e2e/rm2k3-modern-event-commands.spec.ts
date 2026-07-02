import { expect, test, type Locator, type Page } from "@playwright/test";

async function dblclickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await dblclickMapCenter(page);

  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1000 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    if (await openButton.isVisible()) await openButton.click();
    else await dblclickMapCenter(page);
  }
  await expect(editor).toBeVisible();
  return editor;
}

test("modern event commands are discoverable and edited with guided controls", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  await editor.getByTestId("event-command-empty-line").dblclick();

  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-4").click();

  const commandGrid = picker.locator(".event-command-picker-grid");
  await expect(commandGrid.getByRole("button")).toHaveCount(24);
  await expect(picker.getByRole("button", { name: "카메라 제어..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "고급 대화..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "UI 명령..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "데이터 조회..." })).toBeVisible();
  await page.screenshot({ path: "output/evidence/modern-event-commands/browser-picker-page4.png", fullPage: true });

  await picker.getByTestId("command-picker-add-m2-201-camera-control").click();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("카메라 제어");
  await expect(commandDialog.locator("select").first()).toHaveValue("m2Command");
  await expect(commandDialog.locator("select").first().locator("option:checked")).toHaveText("M2/현대 명령");
  await expect(commandDialog.getByTestId("m2-command-mode-option-select")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-target-option-select")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-x-input")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-note-input")).toHaveCount(0);

  await commandDialog.getByTestId("m2-command-x-input").fill("12");
  await commandDialog.getByTestId("m2-command-y-input").fill("8");
  await page.screenshot({ path: "output/evidence/modern-event-commands/browser-camera-command-dialog.png", fullPage: true });
  await commandDialog.getByTestId("event-command-edit-ok").click();

  await expect(picker).toBeHidden();
  await expect(editor).toContainText("카메라 제어");
});

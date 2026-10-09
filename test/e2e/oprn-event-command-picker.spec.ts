import { expect, test, type Page } from "@playwright/test";

/**
 * 명령 피커 회귀 — RM2003 창 복제는 계약이 아니다.
 * 탭 2에 한국어 「전투」「파티 멤버 변경」이 있고, 명령을 고르면 피커는 닫힌다.
 */
test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-command-picker");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("tab 2 lists 전투 and 파티 멤버 변경 in Korean and closes before the edit dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1_500 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    if (await openButton.isVisible().catch(() => false)) await openButton.click();
    else await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await expect(editor).toBeVisible();

  const picker = page.getByTestId("event-command-picker").first();
  if (!(await picker.isVisible().catch(() => false))) {
    const searchTemplate = page.getByTestId("event-template-empty-search").first();
    if (await searchTemplate.isVisible().catch(() => false)) {
      await searchTemplate.click();
    } else {
      const emptyLine = page.getByTestId("event-command-empty-line").first();
      await emptyLine.evaluate((node) => {
        node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      });
    }
  }
  await expect(picker).toBeVisible({ timeout: 8_000 });

  await picker.getByTestId("event-command-picker-tab-2").click();
  const battle = picker.getByTestId("command-picker-add-battleProcessing");
  const party = picker.getByTestId("command-picker-add-changeParty");
  await expect(battle).toBeVisible();
  await expect(party).toBeVisible();
  await expect(battle).toHaveText(/전투/);
  await expect(party).toHaveText(/파티 멤버 변경/);

  await battle.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await expect(picker).toBeHidden();
  expect(await page.getByTestId("event-command-picker").count()).toBe(0);
});

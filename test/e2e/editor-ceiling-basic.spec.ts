import { expect, test } from "@playwright/test";

test("basic editor exposes keyboard test play and pending event CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "basic"));
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  const testPlay = page.getByTestId("topbar-test-play");
  await expect(testPlay).toBeVisible();
  await testPlay.focus();
  await expect(testPlay).toBeFocused();
  await testPlay.press("Enter");
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toBeHidden();

  await page.getByTestId("layer-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  const cta = page.getByTestId("basic-create-selected-event");
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-editor-cancel").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
});

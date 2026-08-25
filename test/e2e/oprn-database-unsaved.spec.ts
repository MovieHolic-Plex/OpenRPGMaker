import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test("RM2K3 database modal prompts before closing dirty DB edits", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-field-name").fill("Prompt Actor");
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
  await expect(page.getByTestId("database-dirty-save")).toBeVisible();
  await expect(page.getByTestId("database-dirty-discard")).toBeVisible();
  await expect(page.getByTestId("database-dirty-keep-editing")).toBeVisible();

  await page.getByTestId("database-dirty-keep-editing").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("database-dirty-prompt")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
  await page.getByTestId("database-dirty-keep-editing").click();
  await page.mouse.click(4, 4);
  await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
  await page.getByTestId("database-dirty-keep-editing").click();

  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
  await page.getByTestId("database-dirty-discard").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  expect((await exportedProject(page)).database.actors.some((record) => record.name === "Prompt Actor")).toBe(false);

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-field-name").fill("Saved Prompt Actor");
  await page.getByTestId("database-footer-ok").click();
  await page.getByTestId("database-dirty-save").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  expect((await exportedProject(page)).database.actors.some((record) => record.name === "Saved Prompt Actor")).toBe(true);

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-field-name").fill("Applied Prompt Actor");
  await page.getByTestId("database-footer-apply").click();
  await expect(page.getByTestId("db-footer-status")).toContainText("적용했습니다");
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  expect((await exportedProject(page)).database.actors.some((record) => record.name === "Applied Prompt Actor")).toBe(true);
});

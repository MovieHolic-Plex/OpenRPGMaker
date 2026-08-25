import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("title live preview stays beside the first settings instead of stretching to the end of the form", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 45_000 });
  await openDatabase(page);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();

  const preview = page.getByTestId("db-title-workbench-preview");
  const stage = page.getByTestId("db-title-workbench-stage");
  await expect(preview).toBeVisible();
  await expect(stage).toBeVisible();

  const metrics = await preview.evaluate((node) => {
    const label = node.querySelector(".db-title-workbench-preview-label");
    const stageNode = node.querySelector(".db-title-workbench-stage");
    if (!(label instanceof HTMLElement) || !(stageNode instanceof HTMLElement)) {
      throw new Error("title preview label or stage is missing");
    }
    const labelRect = label.getBoundingClientRect();
    const stageRect = stageNode.getBoundingClientRect();
    return {
      labelTop: labelRect.top,
      previewHeight: node.getBoundingClientRect().height,
      stageHeight: stageRect.height,
      stageTop: stageRect.top,
    };
  });

  expect(metrics.stageTop - metrics.labelTop).toBeLessThanOrEqual(32);
  expect(metrics.previewHeight).toBeLessThanOrEqual(metrics.stageHeight + 120);
});

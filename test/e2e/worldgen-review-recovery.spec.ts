import { expect, test } from "@playwright/test";
import { exportedProject, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

test("world generation rules retain sparse edits and expose named keyword toggles", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  const worldGen = { label: "World generation", slug: "world-gen", testId: "db-tab-world-gen" };
  await switchDatabaseTab(page, worldGen);
  await page.getByTestId("db-worldgen-section-water").click();
  await page.getByTestId("db-worldgen-river-min-stepper").fill("7");
  await page.getByTestId("database-modal").screenshot({ path: "verify-shots/worldgen-review-recovery/water.png" });
  await page.getByTestId("db-worldgen-section-keywords").click();
  const toggle = page.getByTestId("db-worldgen-keyword-toggle-builtin-lake");
  await expect(toggle).toHaveAccessibleName(/규칙 쓰기/);
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await page.getByTestId("database-modal").screenshot({ path: "verify-shots/worldgen-review-recovery/keywords.png" });
  const project = await exportedProject(page);
  expect(project).toMatchObject({ system: { worldGen: {
    water: { riverBandMin: 7 },
    keywords: [expect.objectContaining({ id: "builtin-lake", enabled: false })],
  } } });
  await switchDatabaseTab(page, { label: "Items", slug: "items", testId: "db-tab-items" });
  await switchDatabaseTab(page, worldGen);
  await expect(page.getByTestId("db-worldgen-preset-preset-wide-lake")).toBeVisible();
  await page.getByTestId("db-worldgen-section-water").click();
  await expect(page.getByTestId("db-worldgen-river-min-stepper")).toHaveValue("7");
});

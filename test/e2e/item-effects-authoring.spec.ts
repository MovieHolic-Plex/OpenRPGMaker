import { expect, test } from "@playwright/test";
import { exportedProject, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

// Temporary freshProject data exercises editor controls only; this test never saves authored content remotely.
test("item state, animation and care controls persist across tab changes and export", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  const items = { label: "Items", slug: "items", testId: "db-tab-items" };
  await switchDatabaseTab(page, items);
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("QA 상태와 돌봄");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-item-state-effect-add").click();
  const stateId = await page.getByTestId("db-field-item-state-effect-state-0").inputValue();
  await page.getByTestId("db-field-item-state-effect-chance-0").fill("75");
  const animation = page.getByTestId("db-picker-item-animation");
  const animationId = await animation.locator('option[value]:not([value=""])').first().getAttribute("value");
  expect(animationId).toBeTruthy();
  await animation.selectOption(animationId!);
  await page.getByTestId("db-item-card-state-effects").scrollIntoViewIfNeeded();
  await page.getByTestId("database-modal").screenshot({ path: "verify-shots/item-editor-modern/recovered-state-effects.png" });
  await page.getByTestId("db-field-item-care-kind").selectOption("feed");
  await page.getByTestId("db-field-item-care-friendship").fill("8");
  await page.getByTestId("db-field-item-care-exp").fill("20");
  await page.getByTestId("db-item-card-care").scrollIntoViewIfNeeded();
  await page.getByTestId("database-modal").screenshot({ path: "verify-shots/item-editor-modern/recovered-care.png" });

  await switchDatabaseTab(page, { label: "Crops", slug: "crops", testId: "db-tab-crops" });
  await switchDatabaseTab(page, items);
  await expect(page.getByTestId("db-field-name")).toHaveValue("QA 상태와 돌봄");
  await expect(page.getByTestId("db-field-item-state-effect-chance-0")).toHaveValue("75");
  await expect(page.getByTestId("db-picker-item-animation")).toHaveValue(animationId!);
  await expect(page.getByTestId("db-field-item-care-kind")).toHaveValue("feed");
  await expect(page.getByTestId("db-field-item-care-friendship")).toHaveValue("8");
  await expect(page.getByTestId("db-field-item-care-exp")).toHaveValue("20");
  const project = await exportedProject(page);
  expect(project.database.items.find((item) => item.name === "QA 상태와 돌봄")).toMatchObject({
    stateEffects: [{ stateId, chance: 75, operation: "add" }],
    animationId,
    careProfile: { kind: "feed", friendshipDelta: 8, expDelta: 20 },
  });
});

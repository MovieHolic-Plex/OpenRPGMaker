import { expect, test } from "@playwright/test";
import { applyDatabaseChanges, closeAndReopenDatabase, exportedProject, openAnimationsSubview, openDatabase } from "./oprn-database-helpers";

test.setTimeout(90_000);

test("RM2K3 animation tab exposes sheet frames cells timings", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.getByTestId("toolbar-database").click();
  await openAnimationsSubview(page);

  await expect(page.getByTestId("db-animation-setup")).toBeVisible();
  await expect(page.getByTestId("db-animation-rm2003-editor")).toBeVisible();
  await expect(page.getByTestId("db-animation-frame-list")).toContainText("< 1>");
  await expect(page.getByTestId("db-animation-stage-target")).toBeVisible();
  await expect(page.getByTestId("db-animation-timing-table")).toContainText("SE 및 플래시 타이밍");
  await expect(page.getByTestId("db-animation-pattern-strip")).toContainText("001");
  await expect(page.getByTestId("db-field-animation-resource-set")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-scope")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-position")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-large")).toBeVisible();
  await expect(page.getByTestId("db-animation-sheet-preview-surface")).toBeVisible();
  await expect(page.getByTestId("db-animation-cell-table")).toContainText("패턴");
  await expect(page.getByTestId("db-animation-timing-table")).toContainText("플래시");

  const project = await exportedProject(page);
  expect(project.database.battleAnimations[0]).toMatchObject({
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    scope: "singleTarget",
    position: "center",
  });
  await page.screenshot({ path: testInfo.outputPath("database-animation-tab.png"), fullPage: true });
});

test("RM2K3 resource animation and tileset tabs persist canonical project edits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await openDatabase(page);

  await openAnimationsSubview(page);
  await page.getByTestId("db-field-name").fill("Impact Burst");
  await page.getByTestId("db-field-animation-resource").fill("scarloxy-battle-anim-scratch");
  await page.getByTestId("db-field-animation-frame-width").fill("80");
  await page.getByTestId("db-field-animation-frame-height").fill("88");
  await page.getByTestId("db-field-animation-columns").fill("4");
  await page.getByTestId("db-field-animation-scope").selectOption("screen");
  await page.getByTestId("db-field-animation-position").selectOption("screen");
  await page.getByTestId("db-field-animation-large").check();

  await page.getByTestId("db-tab-tilesets").click();
  await page.getByTestId("tileset-oprn-name").locator("input").fill("Town Proof Tileset");
  await page.getByTestId("tileset-field-terrain-tag").fill("7");
  await page.getByTestId("tileset-section-tab-knowledge").click();
  await page.getByTestId("tileset-field-ai-label").fill("Proof grass edge");
  await page.getByTestId("tileset-tile-meaning-details").locator("summary").click();
  await page.getByTestId("tileset-field-ai-description").fill("Persisted from the Database tilesets tab");

  const edited = await exportedProject(page);
  expect(edited.database.battleAnimations[0]).toMatchObject({
    large: true,
    name: "Impact Burst",
    position: "screen",
    resourceId: "scarloxy-battle-anim-scratch",
    scope: "screen",
    sheet: { columns: 4, frameHeight: 88, frameWidth: 80 },
  });
  const tileset = edited.tilesets.easyrpg_chipset_combined_town;
  expect(tileset).toMatchObject({
    name: "Town Proof Tileset",
  });
  expect(tileset?.terrain[0]).toBe(7);
  expect(tileset?.tileMeta?.[0]).toMatchObject({
    description: "Persisted from the Database tilesets tab",
    label: "Proof grass edge",
    source: "user",
  });

  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);

  await openAnimationsSubview(page);
  await expect(page.getByTestId("db-field-name")).toHaveValue("Impact Burst");
  await page.getByTestId("db-tab-tilesets").click();
  await expect(page.getByTestId("tileset-oprn-name").locator("input")).toHaveValue("Town Proof Tileset");
  await expect(page.getByTestId("tileset-field-ai-label")).toHaveValue("Proof grass edge");
});

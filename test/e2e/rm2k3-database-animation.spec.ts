import { expect, test } from "@playwright/test";
import { applyDatabaseChanges, closeAndReopenDatabase, exportedProject, openDatabase } from "./rm2k3-database-helpers";

test.setTimeout(90_000);

test("RM2K3 animation tab exposes sheet frames cells timings and battler separation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-animations").click();

  await expect(page.getByTestId("db-animation-setup")).toBeVisible();
  await expect(page.getByTestId("db-animation-rm2003-editor")).toBeVisible();
  await expect(page.getByTestId("db-animation-frame-list")).toContainText("< 1>");
  await expect(page.getByTestId("db-animation-stage-target")).toBeVisible();
  await expect(page.getByTestId("db-animation-timing-table")).toContainText("SE 및 플래시 타이밍");
  await expect(page.getByTestId("db-animation-pattern-strip")).toContainText("001");
  await expect(page.getByTestId("db-field-animation-resource")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-scope")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-position")).toBeVisible();
  await expect(page.getByTestId("db-field-animation-large")).toBeVisible();
  await expect(page.getByTestId("db-animation-sheet-preview-surface")).toBeVisible();
  await expect(page.getByTestId("db-animation-cell-table")).toContainText("패턴");
  await expect(page.getByTestId("db-animation-timing-table")).toContainText("플래시");
  await expect(page.getByTestId("db-animation-battler-note")).toContainText("분리");

  const project = await exportedProject(page);
  expect(project.database.battleAnimations[0]).toMatchObject({
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    scope: "singleTarget",
    position: "center",
  });
  expect(project.database.battlerAnimations?.length).toBeGreaterThan(0);
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

  await page.getByTestId("db-tab-animations").click();
  await page.getByTestId("db-field-name").fill("Impact Burst");
  await page.getByTestId("db-field-animation-resource").fill("easyrpg-battle-blow");
  await page.getByTestId("db-field-animation-frame-width").fill("80");
  await page.getByTestId("db-field-animation-frame-height").fill("88");
  await page.getByTestId("db-field-animation-columns").fill("4");
  await page.getByTestId("db-field-animation-scope").selectOption("screen");
  await page.getByTestId("db-field-animation-position").selectOption("screen");
  await page.getByTestId("db-field-animation-large").check();

  await page.getByTestId("db-tab-battler-animations").click();
  await page.getByTestId("db-field-battler-animation-name-0").fill("Hero Sideview Proof");
  await page.getByTestId("db-field-battler-animation-resource-0").fill("generated-actor-hero-02-battle");
  await page.getByTestId("db-field-battler-animation-idle-duration-0").fill("240");

  await page.getByTestId("db-tab-tilesets").click();
  await page.getByTestId("tileset-rm2k3-name").locator("input").fill("Town Proof Tileset");
  await page.getByTestId("tileset-rm2k3-mode-terrain").click();
  await page.getByTestId("tileset-field-terrain-tag").fill("7");
  await page.getByTestId("tileset-rm2k3-mode-ai").click();
  await page.getByTestId("tileset-field-ai-label").fill("Proof grass edge");
  await page.getByTestId("tileset-field-ai-description").fill("Persisted from the Database tilesets tab");

  const edited = await exportedProject(page);
  expect(edited.database.battleAnimations[0]).toMatchObject({
    large: true,
    name: "Impact Burst",
    position: "screen",
    resourceId: "easyrpg-battle-blow",
    scope: "screen",
    sheet: { columns: 4, frameHeight: 88, frameWidth: 80 },
  });
  expect(edited.database.battlerAnimations?.[0]).toMatchObject({
    name: "Hero Sideview Proof",
    resourceId: "generated-actor-hero-02-battle",
  });
  expect(edited.database.battlerAnimations?.[0]?.poses[0]?.frames[0]).toMatchObject({ durationMs: 240 });
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

  await page.getByTestId("db-tab-animations").click();
  await expect(page.getByTestId("db-field-name")).toHaveValue("Impact Burst");
  await page.getByTestId("db-tab-battler-animations").click();
  await expect(page.getByTestId("db-field-battler-animation-name-0")).toHaveValue("Hero Sideview Proof");
  await page.getByTestId("db-tab-tilesets").click();
  await expect(page.getByTestId("tileset-rm2k3-name").locator("input")).toHaveValue("Town Proof Tileset");
  await page.getByTestId("tileset-rm2k3-mode-ai").click();
  await expect(page.getByTestId("tileset-field-ai-label")).toHaveValue("Proof grass edge");
});

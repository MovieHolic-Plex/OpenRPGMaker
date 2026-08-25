import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDatabase, type DatabaseTabSpec } from "./oprn-database-helpers";

test.setTimeout(420_000);
test.use({ serviceWorkers: "block" });

const SHOT_ROOT = "C:/Users/USER/Downloads/rpg-zzu/.omo/evidence/db-modern-overhaul/shots";

const ALL_TABS: readonly DatabaseTabSpec[] = [
  { label: "Overview", slug: "overview", testId: "db-tab-overview" },
  { label: "Actors", slug: "actors", testId: "db-tab-actors" },
  { label: "Classes", slug: "classes", testId: "db-tab-classes" },
  { label: "Skills", slug: "skills", testId: "db-tab-skills" },
  { label: "Items", slug: "items", testId: "db-tab-items" },
  { label: "Equipment", slug: "equipment", testId: "db-tab-equipment" },
  { label: "Enemies", slug: "enemies", testId: "db-tab-enemies" },
  { label: "Monster Species", slug: "monster-species", testId: "db-tab-monster-species" },
  { label: "Troops", slug: "troops", testId: "db-tab-troops" },
  { label: "Elements", slug: "elements", testId: "db-tab-elements" },
  { label: "States", slug: "states", testId: "db-tab-states" },
  { label: "Animations", slug: "animations", testId: "db-tab-animations" },
  { label: "Battle Screen", slug: "battle-screen", testId: "db-tab-battle-screen" },
  { label: "Battle Commands", slug: "battle-commands", testId: "db-tab-battle-commands" },
  { label: "Terrain", slug: "terrain", testId: "db-tab-terrain" },
  { label: "Crops", slug: "crops", testId: "db-tab-crops" },
  { label: "Characters", slug: "characters", testId: "db-tab-characters" },
  { label: "Life Crafting", slug: "life-crafting", testId: "db-tab-life-crafting" },
  { label: "Daily Weather", slug: "daily-weather", testId: "db-tab-daily-weather" },
  { label: "Farm Animals", slug: "farm-animals", testId: "db-tab-farm-animals" },
  { label: "Farm Spatial", slug: "farm-spatial", testId: "db-tab-farm-spatial" },
  { label: "Life Collections", slug: "life-collections", testId: "db-tab-life-collections" },
  { label: "Tilesets", slug: "tilesets", testId: "db-tab-tilesets" },
  { label: "Structure Kits", slug: "structure-kits", testId: "db-tab-structure-kits" },
  { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" },
  { label: "System", slug: "system", testId: "db-tab-system" },
  { label: "Terms", slug: "terms", testId: "db-tab-terms" },
  { label: "Switches", slug: "switches", testId: "db-tab-switches" },
  { label: "Variables", slug: "variables", testId: "db-tab-variables" },
];

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
] as const;

async function switchTab(page: Page, tab: DatabaseTabSpec): Promise<void> {
  const button = page.getByTestId(tab.testId);
  await expect(button, `missing ${tab.testId}`).toBeVisible({ timeout: 15_000 });
  await button.click({ force: true });
  await expect(button).toHaveClass(/active/);
}

async function selectFirstRecord(page: Page): Promise<boolean> {
  const card = page.locator("[data-testid^='db-record-card-']").first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    return true;
  }
  const row = page.locator("[data-testid^='db-record-row-']").first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    return true;
  }
  return false;
}

test("capture every Database tab for the modern overhaul harvest", async ({ page }) => {
  const manifest: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?freshProject=1");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    const welcome = page.getByRole("button", { name: /건너뛰기|Skip|닫기/ });
    if (await welcome.isVisible().catch(() => false)) {
      await welcome.click();
    }
    await openDatabase(page);
    await expect(page.getByTestId("database-modal")).toBeVisible();

    const dir = path.join(SHOT_ROOT, viewport.name);
    mkdirSync(dir, { recursive: true });

    for (const tab of ALL_TABS) {
      await switchTab(page, tab);
      await page.waitForTimeout(250);
      const modalPath = path.join(dir, `tab-${tab.slug}.png`);
      await page.getByTestId("database-modal").screenshot({ path: modalPath });
      const selected = await selectFirstRecord(page);
      let detailPath: string | null = null;
      if (selected) {
        await page.waitForTimeout(200);
        detailPath = path.join(dir, `tab-${tab.slug}-detail.png`);
        await page.getByTestId("database-modal").screenshot({ path: detailPath });
      }
      manifest.push({
        slug: tab.slug,
        testId: tab.testId,
        viewport: viewport.name,
        modal: modalPath,
        detail: detailPath,
        selected,
      });
    }

    if (viewport.name === "1440x900") {
      await switchTab(page, { label: "System", slug: "system", testId: "db-tab-system" });
      for (const section of ["party", "title", "typechart", "time"] as const) {
        const nav = page.getByTestId(`db-system-nav-${section}`);
        if (await nav.isVisible().catch(() => false)) {
          await nav.click();
          await page.waitForTimeout(200);
          const sectionPath = path.join(dir, `tab-system-${section}.png`);
          await page.getByTestId("database-modal").screenshot({ path: sectionPath });
          manifest.push({
            slug: `system-${section}`,
            testId: `db-system-nav-${section}`,
            viewport: viewport.name,
            modal: sectionPath,
            detail: null,
            selected: false,
          });
        }
      }
    }
  }

  mkdirSync(SHOT_ROOT, { recursive: true });
  writeFileSync(path.join(SHOT_ROOT, "manifest.json"), JSON.stringify({ tabs: ALL_TABS, shots: manifest }, null, 2));
  expect(manifest.filter((row) => String(row.viewport) === "1440x900").length).toBeGreaterThanOrEqual(ALL_TABS.length);
});

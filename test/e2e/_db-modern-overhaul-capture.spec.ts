import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATABASE_TAB_SPECS, openDatabase, type DatabaseTabSpec } from "./oprn-database-helpers";

test.setTimeout(420_000);
test.use({ serviceWorkers: "block" });

const SHOT_ROOT = process.env.DB_OVERHAUL_SHOT_ROOT
  ?? path.resolve(".omo/evidence/database-editor-overhaul/database-tabs");

const ALL_TABS: readonly DatabaseTabSpec[] = DATABASE_TAB_SPECS;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
] as const;

async function switchTab(page: Page, tab: DatabaseTabSpec): Promise<void> {
  const button = page.getByTestId(tab.testId);
  await expect(button, `missing ${tab.testId}`).toBeVisible({ timeout: 15_000 });
  await button.click({ force: true });
  await expect(button).toHaveClass(/active/);
  await expect(page.getByTestId("db-shared-workspace")).toBeVisible();
}

async function selectFirstRecord(page: Page): Promise<boolean> {
  const card = page.locator("[data-testid^='db-record-card-']").first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await expect(page.getByTestId("database-modal")).toBeVisible();
    return true;
  }
  const row = page.locator("[data-testid^='db-record-row-']").first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await expect(page.getByTestId("database-modal")).toBeVisible();
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
      const modalPath = path.join(dir, `tab-${tab.slug}.png`);
      await page.getByTestId("database-modal").screenshot({ path: modalPath });
      const selected = await selectFirstRecord(page);
      let detailPath: string | null = null;
      if (selected) {
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
          await expect(nav).toHaveClass(/active/);
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

      await switchTab(page, DATABASE_TAB_SPECS[0]);
      await page.getByTestId("database-ai-toggle").click();
      await expect(page.getByTestId("database-ai-bar")).toBeVisible();
      const assistantPath = path.join(dir, "overview-ai-assistant.png");
      await page.getByTestId("database-modal").screenshot({ path: assistantPath });
      manifest.push({
        slug: "overview-ai-assistant",
        testId: "database-ai-bar",
        viewport: viewport.name,
        modal: assistantPath,
        detail: null,
        selected: false,
      });
      await page.getByTestId("database-ai-close").click();
      await expect(page.getByTestId("database-ai-bar")).toBeHidden();

      await page.getByTestId("database-modal-close").click();
      await expect(page.getByTestId("database-modal")).toBeHidden();

      await page.goto(`/?devProject=1&logCabinShowcase=1&titleQa=${Date.now()}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("mode-play").click();
      await expect(page.getByTestId("test-play-window")).toBeVisible();
      await expect(page.getByTestId("title-screen")).toHaveClass(/rm-title-screen-editorial/);
      await expect(page.getByTestId("title-kicker")).toHaveText("A NEW ADVENTURE");
      await expect(page.getByTestId("title-subtitle")).toHaveText("이야기가 시작되는 곳");
      const titlePath = path.join(dir, "title-start-windowed.png");
      await page.getByTestId("test-play-window").screenshot({ path: titlePath });
      manifest.push({
        slug: "title-start-windowed",
        testId: "title-screen",
        viewport: viewport.name,
        modal: titlePath,
        detail: null,
        selected: false,
      });
      await page.getByTestId("test-play-window-close").click();
      await expect(page.getByTestId("test-play-window")).toHaveCount(0);
    }
  }

  mkdirSync(SHOT_ROOT, { recursive: true });
  writeFileSync(path.join(SHOT_ROOT, "manifest.json"), JSON.stringify({ tabs: ALL_TABS, shots: manifest }, null, 2));
  expect(manifest.filter((row) => String(row.viewport) === "1440x900").length).toBeGreaterThanOrEqual(ALL_TABS.length);
});

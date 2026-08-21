import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, captureDatabaseShellMetrics, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

test("database top tabs keep the modal shell stable when switching sections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await openDatabase(page);

  const reference = await captureDatabaseShellMetrics(page);

  for (const tab of DATABASE_TAB_SPECS) {
    await switchDatabaseTab(page, tab);

    const current = await captureDatabaseShellMetrics(page);
    expect(current.modalBodyScrollTop, `${tab.testId} must not scroll the modal chrome`).toBe(0);
    expectStableTop(current.tabsTop, reference.tabsTop, `${tab.testId} tabs top`);
    expectStableTop(current.bodyTop, reference.bodyTop, `${tab.testId} body top`);
  }
});

function expectStableTop(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
}

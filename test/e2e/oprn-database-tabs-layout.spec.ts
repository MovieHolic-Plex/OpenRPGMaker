import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, captureDatabaseShellMetrics, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

test("database top tabs keep the modal shell stable when switching sections", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await installExpertEditorState(page);
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  await openDatabase(page);

  const reference = await captureDatabaseShellMetrics(page);

  for (const tab of DATABASE_TAB_SPECS) {
    await switchDatabaseTab(page, tab);

    const current = await captureDatabaseShellMetrics(page);
    expect(current.modalBodyScrollTop, `${tab.testId} must not scroll the modal chrome`).toBe(0);
    expectStableTop(current.tabsTop, reference.tabsTop, `${tab.testId} tabs top`);
    expectStableTop(current.bodyTop, reference.bodyTop, `${tab.testId} body top`);
    expectStableTop(current.tabsWidth, reference.tabsWidth, `${tab.testId} sidebar width`);
  }
});

test("all database tabs share one stable content frame without page overflow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await installExpertEditorState(page);
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await openDatabase(page);

  await switchDatabaseTab(page, DATABASE_TAB_SPECS[0]);
  const reference = await readContentFrame(page);
  for (const tab of DATABASE_TAB_SPECS) {
    await switchDatabaseTab(page, tab);
    const current = await readContentFrame(page);
    expect(current.workspaceClass, `${tab.testId} shared workspace`).toContain("db-shared-workspace");
    expect(Math.abs(current.bodyWidth - reference.bodyWidth), `${tab.testId} body width`).toBeLessThanOrEqual(1);
    expect(Math.abs(current.bodyHeight - reference.bodyHeight), `${tab.testId} body height`).toBeLessThanOrEqual(1);
    expect(current.documentOverflowX, `${tab.testId} document overflow`).toBe(false);
    expect(current.bodyOverflowX, `${tab.testId} body overflow`).toBe(false);
  }
});

async function readContentFrame(page: import("@playwright/test").Page): Promise<{
  readonly bodyHeight: number;
  readonly bodyOverflowX: boolean;
  readonly bodyWidth: number;
  readonly documentOverflowX: boolean;
  readonly workspaceClass: string;
}> {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".database-modal-body .db-body");
    const workspace = body?.matches(".db-shared-workspace") ? body : body?.firstElementChild;
    if (!body || !(workspace instanceof HTMLElement)) throw new Error("missing database content frame");
    const rect = body.getBoundingClientRect();
    return {
      bodyHeight: Math.round(rect.height),
      bodyOverflowX: body.scrollWidth > body.clientWidth + 1,
      bodyWidth: Math.round(rect.width),
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      workspaceClass: workspace.className,
    };
  });
}

function expectStableTop(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
}

async function installExpertEditorState(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
}

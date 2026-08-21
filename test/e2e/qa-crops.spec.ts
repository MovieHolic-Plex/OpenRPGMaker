import { expect, test, type Page } from "@playwright/test";
import { exportedProject, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

const CROPS_TAB = { label: "Crops", slug: "crops", testId: "db-tab-crops" } as const;
const ITEMS_TAB = { label: "Items", slug: "items", testId: "db-tab-items" } as const;

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
}

test.describe("QA sweep: crops tab", () => {
  test("CRUD round trip: add crop, fill every field, tab away/back, export reflects it", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, CROPS_TAB);

    await page.getByTestId("db-crop-add").click();
    await page.getByTestId("db-crop-name").fill("QA작물경계값");
    await page.getByTestId("db-crop-seed-item").selectOption({ index: 1 });
    await page.getByTestId("db-crop-harvest-item").selectOption({ index: 1 });
    await page.getByTestId("db-crop-harvest-count").fill("9");
    await page.getByTestId("db-crop-stages").fill("1\n2\n3");
    await page.getByTestId("db-crop-stages").dispatchEvent("change");
    await page.getByTestId("db-crop-season-summer").check();
    await page.getByTestId("db-crop-regrow-days").fill("4");
    await page.getByTestId("db-crop-graphic-stages").fill("res1 | 0 | stage1");
    await page.getByTestId("db-crop-graphic-stages").dispatchEvent("change");

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/crops-filled.png" });

    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, CROPS_TAB);
    await expect(page.getByTestId("db-crop-name")).toHaveValue("QA작물경계값");
    await expect(page.getByTestId("db-crop-harvest-count")).toHaveValue("9");

    const project = await exportedProject(page);
    const crops = (project.database as unknown as {
      crops?: {
        id: string;
        name: string;
        harvestCount: number;
        seasons: string[];
        stages: { days: number }[];
        regrow?: { days: number };
        graphicStages?: { resourceId?: string; frame?: string; label?: string }[];
      }[];
    }).crops ?? [];
    const created = crops.find((crop) => crop.name === "QA작물경계값");
    expect(created, "created crop should exist in exported project").toBeTruthy();
    expect(created).toMatchObject({
      harvestCount: 9,
      seasons: ["spring", "summer"],
      stages: [{ days: 1 }, { days: 2 }, { days: 3 }],
      regrow: { days: 4 },
    });
    expect(created?.graphicStages?.[0]).toMatchObject({ resourceId: "res1", frame: "0", label: "stage1" });
  });

  test("Boundary values: 0 harvestCount, negative regrow days, empty stages do not crash", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, CROPS_TAB);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // 127.0.0.1:17831 is a known dev-tool ping endpoint (confirmed via requestfailed URL); Chrome's
      // console.error text for it doesn't include the host, so filter by the generic message pattern.
      if (msg.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED") return;
      consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.getByTestId("db-crop-add").click();
    await page.getByTestId("db-crop-harvest-count").fill("0");
    await page.getByTestId("db-crop-harvest-count").blur();
    await page.getByTestId("db-crop-harvest-count").fill("-5");
    await page.getByTestId("db-crop-harvest-count").blur();
    await page.getByTestId("db-crop-regrow-days").fill("-10");
    await page.getByTestId("db-crop-regrow-days").blur();
    await page.getByTestId("db-crop-stages").fill("");
    await page.getByTestId("db-crop-stages").dispatchEvent("change");
    await page.getByTestId("db-crop-name").fill("A".repeat(40));
    await page.getByTestId("db-crop-name").blur();

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/crops-boundary.png" });

    const project = await exportedProject(page);
    const crops = (project.database as unknown as { crops?: { harvestCount: number; regrow?: { days: number }; stages: { days: number }[]; name: string }[] }).crops ?? [];
    const last = crops.at(-1);
    // No crash/NaN on 0, negative, or empty boundary inputs — normalizeCropRecord always yields finite,
    // non-negative numbers and a non-empty stages array (see report for the harvestCount=0 semantics gap).
    expect(Number.isFinite(last?.harvestCount)).toBe(true);
    expect(last?.harvestCount ?? -1).toBeGreaterThanOrEqual(0);
    expect(last?.stages.length ?? 0).toBeGreaterThan(0);
    expect(last?.name.length).toBe(40);

    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("Season checkbox toggle persists a single season selection", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, CROPS_TAB);
    await page.getByTestId("db-crop-add").click();

    await expect(page.getByTestId("db-crop-season-spring")).toBeChecked();
    await page.getByTestId("db-crop-season-winter").check();
    await expect(page.getByTestId("db-crop-season-winter")).toBeChecked();

    const project = await exportedProject(page);
    const crops = (project.database as unknown as { crops?: { seasons: string[] }[] }).crops ?? [];
    expect(crops.at(-1)?.seasons.sort()).toEqual(["spring", "winter"]);
  });
});

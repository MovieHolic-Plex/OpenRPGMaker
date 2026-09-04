import { expect, test, type Page } from "@playwright/test";
import {
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const TERRAIN_TAB = { label: "Terrain", slug: "terrain", testId: "db-tab-terrain" } as const;
const TILESETS_TAB = { label: "Tilesets", slug: "tilesets", testId: "db-tab-tilesets" } as const;

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
}

test.describe("QA sweep: terrain tab", () => {
  test("field edit round trip persists across tab switch and export, with boundary clamps", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.location().url.includes("17831") && !msg.text().includes("17831")) {
        consoleErrors.push(msg.text());
      }
    });

    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, TERRAIN_TAB);

    const longName = "QA지형경계값이름아주길게길게길게삼십자이상테스트하기용";
    await page.getByTestId("db-field-terrain-name-0").fill(longName);
    await page.getByTestId("db-field-terrain-damage-0").fill("-50"); // boundary: negative -> store clamps to 0
    await page.getByTestId("db-field-terrain-encounter-0").fill("9999"); // boundary: over max -> store clamps to 500
    await page.getByTestId("db-field-terrain-backdrop-0").fill("qa-backdrop-custom");
    await page.getByTestId("db-field-terrain-footstep-0").fill("qa-footstep-custom");
    await page.getByTestId("db-field-terrain-display-0").selectOption("transparent");
    await page.getByTestId("db-field-terrain-boat-0").check();
    await page.getByTestId("db-field-terrain-ship-0").check();
    await page.getByTestId("db-field-terrain-airship-0").uncheck();

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/terrain-filled.png" });

    // NOTE (see report, Major): right after typing, the damage/encounter fields still show the
    // raw unclamped text ("-50"/"9999") even though the store already clamped the value — the
    // clamp is only reflected in the DOM after a re-render (e.g. the tab switch below). This is
    // a display-only lag, not a data-integrity bug (export always reflects the clamped value).

    // tab away and back — values must persist
    await switchDatabaseTab(page, TILESETS_TAB);
    await switchDatabaseTab(page, TERRAIN_TAB);
    await expect(page.getByTestId("db-field-terrain-name-0")).toHaveValue(longName);
    await expect(page.getByTestId("db-field-terrain-damage-0")).toHaveValue("0");
    await expect(page.getByTestId("db-field-terrain-encounter-0")).toHaveValue("500");
    await expect(page.getByTestId("db-field-terrain-backdrop-0")).toHaveValue("qa-backdrop-custom");
    await expect(page.getByTestId("db-field-terrain-footstep-0")).toHaveValue("qa-footstep-custom");
    await expect(page.getByTestId("db-field-terrain-display-0")).toHaveValue("transparent");
    await expect(page.getByTestId("db-field-terrain-boat-0")).toBeChecked();
    await expect(page.getByTestId("db-field-terrain-ship-0")).toBeChecked();
    await expect(page.getByTestId("db-field-terrain-airship-0")).not.toBeChecked();

    const project = await exportedProject(page);
    const terrain = project.database.terrains?.[0];
    expect(terrain?.name).toBe(longName);
    expect(terrain?.damage).toBe(0);
    expect(terrain?.encounterRatePercent).toBe(500);
    expect(terrain?.battleBackgroundResourceId).toBe("qa-backdrop-custom");
    expect(terrain?.footstepSoundResourceId).toBe("qa-footstep-custom");
    expect(terrain?.characterDisplay).toBe("transparent");
    expect(terrain?.vehiclePassage).toEqual({ boat: true, ship: true, airshipLand: false });

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("undo reverts a terrain field edit", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, TERRAIN_TAB);

    const nameField = page.getByTestId("db-field-terrain-name-1");
    const original = await nameField.inputValue();
    await nameField.fill("QA_UNDO_TERRAIN_NAME");
    await expect(nameField).toHaveValue("QA_UNDO_TERRAIN_NAME");

    // blur so Ctrl+Z hits the app-level history instead of native text-undo
    await page.getByRole("heading", { name: "지형 효과" }).click();
    await page.keyboard.press("Control+z");
    await expect(nameField).toHaveValue(original);
  });
});

test.describe("QA sweep: tilesets tab", () => {
  const TOWN_TILESET_ROW = "tileset-db-row-easyrpg_chipset_combined_town";

  test("passage grid toggle round trip: full-sheet modal <-> inline grid, persists across tab switch and export", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.location().url.includes("17831") && !msg.text().includes("17831")) {
        consoleErrors.push(msg.text());
      }
    });

    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, TILESETS_TAB);
    await page.getByTestId(TOWN_TILESET_ROW).click();

    // tile 0 starts blocked (mark-x) per default chipset data
    await expect(page.getByTestId("tileset-db-cell-0")).toHaveClass(/mark-x/);

    // open full-sheet modal and cycle the same tile: x -> star -> o
    await page.getByTestId("tileset-settings-open").click();
    await expect(page.getByTestId("tileset-settings-modal")).toBeVisible();
    await expect(page.getByTestId("tileset-passage-cell-0")).toHaveClass(/mark-x/);
    await page.getByTestId("tileset-passage-cell-0").click();
    await expect(page.getByTestId("tileset-passage-cell-0")).toHaveClass(/mark-star/);
    await page.getByTestId("tileset-passage-cell-0").click();
    await expect(page.getByTestId("tileset-passage-cell-0")).toHaveClass(/mark-o/);

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/tilesets-modal-toggled.png" });
    await page.getByTestId("tileset-settings-close").click();
    await expect(page.getByTestId("tileset-settings-modal")).toBeHidden();

    // inline main grid must reflect the same change made inside the modal
    await expect(page.getByTestId("tileset-db-cell-0")).toHaveClass(/mark-o/);

    // tab away and back — passage change must persist
    await switchDatabaseTab(page, TERRAIN_TAB);
    await switchDatabaseTab(page, TILESETS_TAB);
    await expect(page.getByTestId("tileset-db-cell-0")).toHaveClass(/mark-o/);

    const project = await exportedProject(page);
    const tileset = project.tilesets["easyrpg_chipset_combined_town"] as unknown as {
      passability: { up: boolean; down: boolean; left: boolean; right: boolean }[];
      priority: string[];
    };
    expect(tileset.passability[0]).toEqual({ up: true, down: true, left: true, right: true });

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("terrain tag mode cycles the selected tile's terrain tag and persists", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, TILESETS_TAB);
    await page.getByTestId(TOWN_TILESET_ROW).click();

    await page.getByTestId("tileset-edit-mode-terrain").click();
    await expect(page.getByTestId("tileset-db-cell-3")).toHaveText("0");
    await page.getByTestId("tileset-db-cell-3").click();
    await expect(page.getByTestId("tileset-db-cell-3")).toHaveText("1");

    // side panel's terrain-tag number field mirrors the click
    await expect(page.getByTestId("tileset-field-terrain-tag")).toHaveValue("1");

    await switchDatabaseTab(page, TERRAIN_TAB);
    await switchDatabaseTab(page, TILESETS_TAB);
    await expect(page.getByTestId("tileset-db-cell-3")).toHaveText("1");

    const project = await exportedProject(page);
    expect(project.tilesets["easyrpg_chipset_combined_town"]?.terrain[3]).toBe(1);
  });

  test("tileset name edit and tile group save round trip", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, TILESETS_TAB);
    await page.getByTestId(TOWN_TILESET_ROW).click();

    const nameInput = page.locator('[data-testid="tileset-oprn-name"] input');
    await nameInput.fill("QA타일셋이름변경됨");
    await switchDatabaseTab(page, TERRAIN_TAB);
    await switchDatabaseTab(page, TILESETS_TAB);
    await expect(page.locator('[data-testid="tileset-oprn-name"] input')).toHaveValue("QA타일셋이름변경됨");

    const project = await exportedProject(page);
    expect(project.tilesets["easyrpg_chipset_combined_town"]?.name).toBe("QA타일셋이름변경됨");

    // tile group save round trip (knowledge tab -> group mode). The tileset ships with
    // harness-seeded groups already, so scope the assertion to the freshly saved one.
    await page.getByTestId("tileset-section-tab-knowledge").click();
    await page.getByTestId("tileset-edit-mode-group").click();
    const groupCountBefore = await page.locator(".tileset-db-group-row").count();
    await page.getByTestId("tileset-db-cell-10").click();
    await page.getByTestId("tileset-group-save").click();
    await expect(page.locator(".tileset-db-group-row")).toHaveCount(groupCountBefore + 1);
    await expect(page.locator(".tileset-db-group-row", { hasText: "타일 세트 10" })).toBeVisible();
  });
});

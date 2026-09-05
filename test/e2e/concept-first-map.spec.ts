import { expect, test } from "@playwright/test";
import { openRecoveredDatabase, recoveredDatabaseExport } from "./recovered-database-harness";

// The shipping modal imports the complete database module graph. Allow bounded
// cold loading on the shared host without retries or fixed delays.
test.setTimeout(120_000);

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("The database harness requires a base URL");
  await page.setViewportSize({ width: 1280, height: 900 });
  await openRecoveredDatabase(page, baseURL);
  await page.getByTestId("db-tab-group-world").click();
  await page.getByTestId("db-tab-scratch-concepts").click();
  await page.getByTestId("scratch-concept-tileset-select").selectOption("easyrpg_chipset_interior");
});

test("concept selection survives child navigation", async ({ page }) => {
  // Given a selected corridor object in the production database modal.
  await page.getByTestId("scratch-concept-place-corridor").click();
  await page.getByTestId("scratch-concept-thing-stairs").click();

  // When the author edits through the auxiliary library and returns.
  await page.getByTestId("db-context-structureKits").click();
  await expect(page.getByTestId("db-tab-scratch-concepts")).toHaveClass(/active/);
  await page.getByTestId("db-context-back").click();

  // Then the object and its owning place remain selected.
  await expect(page.getByTestId("scratch-concept-place-corridor")).toHaveClass(/active/);
  await expect(page.getByTestId("scratch-concept-thing-stairs")).toHaveClass(/active/);
  await expect(page.locator(".db-tabs .db-tab:visible")).toHaveCount(3);
});

test("graphic edits preserve the selected object and serialize its referenced copy", async ({ page }) => {
  // Given the parts library has seeded catalog graphics in this new project.
  await page.getByTestId("db-context-structureKits").click();
  await page.getByTestId("db-context-back").click();
  const before = await recoveredDatabaseExport(page);
  const seed = before.tilesets["easyrpg_chipset_interior"]?.structureKits?.find((kit) => kit.id === "bed_h");
  expect(seed?.learnedFrom).toBe("interior-catalog");
  await page.getByTestId("scratch-concept-thing-bed_h").click();
  await page.getByTestId("scratch-concept-thing-name").fill("검증용 침대");
  await page.getByTestId("scratch-concept-thing-name").press("Tab");
  await page.getByTestId("scratch-concept-thing-paint").click();

  // When the author edits the copied graphic and closes the nested editor.
  await page.getByTestId("structure-kit-editor-width").fill("3");
  await page.getByTestId("structure-kit-editor-width").press("Tab");
  await expect(page.getByTestId("structure-kit-editor-width")).toHaveValue("3");
  await page.getByTestId("structure-kit-editor-close").click();

  // Then the real serializer retains the object, copy and unmodified catalog seed.
  await expect(page.getByTestId("scratch-concept-thing-name")).toHaveValue("검증용 침대");
  await expect(page.getByTestId("scratch-concept-place-bedroom")).toHaveClass(/active/);
  const project = await recoveredDatabaseExport(page);
  const tileset = project.tilesets["easyrpg_chipset_interior"];
  const bed = tileset?.scratchConceptBundles?.find((bundle) => bundle.id === "inn")
    ?.things.find((thing) => thing.id === "bed_h");
  expect(bed?.label).toBe("검증용 침대");
  expect(bed?.objectId).not.toBe("bed_h");
  expect(tileset?.structureKits?.find((kit) => kit.id === bed?.objectId)).toHaveProperty("width", 3);
  expect(tileset?.structureKits?.find((kit) => kit.id === "bed_h")).toEqual(seed);
});

test("retired entry search routes to the correct tileset mode and retains it on return", async ({ page }) => {
  // Given the old autotile entry is only available through search.
  await expect(page.locator(".db-tabs [data-testid='db-tab-tileset-autotile']")).toHaveCount(0);
  await page.getByTestId("db-tab-search").fill("오토타일");

  // When the author follows the result, changes mode and visits terrain effects.
  await page.getByTestId("db-tab-tileset-autotile").click();
  await expect(page.getByTestId("tileset-section-tab-compose")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("tileset-section-tab-rules").click();
  await page.getByTestId("tileset-edit-mode-terrain").click();
  await page.getByTestId("db-context-terrain").click();
  await page.getByTestId("db-context-back").click();

  // Then the primary entry and mode match, with no revived legacy rail rows.
  await expect(page.getByTestId("db-tab-tilesets")).toHaveClass(/active/);
  await expect(page.getByTestId("tileset-edit-mode-terrain")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("db-tab-search")).toHaveValue("");
  await expect(page.locator(".db-tabs [data-search-secondary]")).toHaveCount(0);
});

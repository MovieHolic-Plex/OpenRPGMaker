import { expect, test, type Page } from "@playwright/test";
import {
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS } from "./oprn-database-helpers";

test.setTimeout(90_000);
test.use({ serviceWorkers: "block" });

const TILESETS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "tilesets")!;
const TERRAIN_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "terrain")!;

const TOWN_ROW = "tileset-db-row-easyrpg_chipset_combined_town";
const DUNGEON_ROW = "tileset-db-row-easyrpg_chipset_dungeon";
const DUNGEON_NAME = "EasyRPG RTP Dungeon ChipSet";

type TabProbe = {
  detailTextLen: number;
  enabledButtons: number;
  disabledButtons: number;
  stubTexts: string[];
  empty: boolean;
};

async function probeOpenTab(page: Page): Promise<TabProbe> {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="database-modal"]');
    if (!modal) throw new Error("database modal missing");
    const body = modal.querySelector(".db-body") ?? modal;
    const buttons = Array.from(body.querySelectorAll("button"));
    const stubTexts = Array.from(body.querySelectorAll("*"))
      .filter((node) => node.children.length === 0)
      .map((node) => node.textContent ?? "")
      .filter((text) => /준비 중|준비중|not implemented|coming soon/i.test(text));
    const detailTextLen = (body.textContent ?? "").trim().length;
    return {
      detailTextLen,
      enabledButtons: buttons.filter((button) => !button.disabled).length,
      disabledButtons: buttons.filter((button) => button.disabled).length,
      stubTexts: [...new Set(stubTexts)],
      empty: detailTextLen < 20,
    };
  });
}

test.describe("QA sweep: tilesets tab", () => {
  test("tab renders a live list, selecting a tileset paints detail, switch-away re-renders", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, TILESETS_TAB);

    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    const probe = await probeOpenTab(page);
    expect(probe.stubTexts, `stub texts: ${probe.stubTexts.join(", ")}`).toEqual([]);
    expect(probe.empty, `empty body (len=${probe.detailTextLen})`).toBe(false);
    expect(probe.detailTextLen).toBeGreaterThan(40);
    expect(probe.enabledButtons).toBeGreaterThan(0);
    expect(probe.disabledButtons).toBeGreaterThan(0);

    await expect(page.getByTestId(TOWN_ROW)).toBeVisible();
    await expect(page.getByTestId(DUNGEON_ROW)).toBeEnabled();
    await expect(page.getByTestId("tileset-oprn-name-input")).toBeEnabled();
    await expect(page.getByTestId("tileset-oprn-maximum-count")).toBeDisabled();
    await expect(page.getByTestId("tileset-oprn-graphic-browse")).toBeEnabled();
    await expect(page.getByTestId("tileset-section-tab-rules")).toBeEnabled();
    await expect(page.getByTestId("tileset-settings-open")).toBeEnabled();
    await expect(page.getByTestId("tileset-db-preview")).toBeVisible();
    await expect(page.getByTestId("tileset-ai-workspace-open")).toBeVisible();

    await page.getByTestId(DUNGEON_ROW).click();
    await expect(page.getByTestId(DUNGEON_ROW)).toHaveClass(/active/);
    await expect(page.getByTestId("tileset-oprn-name-input")).toHaveValue(DUNGEON_NAME);
    await expect(page.getByTestId("tileset-db-preview")).toBeVisible();
    await expect(page.getByTestId("tileset-sheet-info")).toBeVisible();

    await switchTabAnyMode(page, TERRAIN_TAB);
    await switchTabAnyMode(page, TILESETS_TAB);
    await expect(page.getByTestId(DUNGEON_ROW)).toHaveClass(/active/);
    await expect(page.getByTestId("tileset-oprn-name-input")).toHaveValue(DUNGEON_NAME);
    await expect(page.getByTestId("tileset-db-preview")).toBeVisible();

    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
  });

  test("Escape from a clean tilesets tab closes the modal without a dirty prompt", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, TILESETS_TAB);
    await expect(page.getByTestId("db-detail-form")).toBeVisible();

    const close = await dirtyGuardOracle(page, "escape");
    expect(close.promptShown).toBe(false);
    expect(close.buttons).toEqual([]);
    await expect(page.getByTestId("database-modal")).toBeHidden();
    await expect(page.getByTestId("database-dirty-prompt")).toHaveCount(0);

    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
  });
});

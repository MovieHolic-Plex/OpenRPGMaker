import { expect, test, type Page } from "@playwright/test";
import {
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  mutatedProject,
  SEEDING_PROVEN,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS } from "./oprn-database-helpers";

test.setTimeout(90_000);
test.use({ serviceWorkers: "block" });

const TILESETS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "tilesets")!;
const STRUCTURE_KITS_TAB = {
  label: "Structure Kits",
  slug: "structure-kits",
  testId: "db-tab-structure-kits",
} as const;

const TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const SMOKE_KIT_ID = "qa_smoke_kit_01";
const SMOKE_KIT_NAME = "QA 스모크 스탬프";
const KIT_CARD = `structure-kit-db-${SMOKE_KIT_ID}`;
const KIT_NAME = `structure-kit-db-name-${SMOKE_KIT_ID}`;
const KIT_UNIT = `structure-kit-db-unit-${SMOKE_KIT_ID}`;
const KIT_USE = `structure-kit-db-use-${SMOKE_KIT_ID}`;
const KIT_DELETE = `structure-kit-db-delete-${SMOKE_KIT_ID}`;

type TabProbe = {
  detailTextLen: number;
  enabledButtons: number;
  disabledButtons: number;
  stubTexts: string[];
  empty: boolean;
};

type SmokeKitPayload = {
  tilesetId: string;
  kit: {
    id: string;
    kind: "section";
    name: string;
    width: number;
    height: number;
    rows: { tiles: number[] }[];
    learnedFrom: "user-paint";
  };
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

async function seedSmokeKit(page: Page): Promise<void> {
  expect(SEEDING_PROVEN, "mutatedProject seeding must be proven before kit inject").toBe(true);
  const payload: SmokeKitPayload = {
    tilesetId: TOWN_TILESET_ID,
    kit: {
      id: SMOKE_KIT_ID,
      kind: "section",
      name: SMOKE_KIT_NAME,
      width: 2,
      height: 1,
      rows: [{ tiles: [1, 2] }],
      learnedFrom: "user-paint",
    },
  };
  await mutatedProject(page, (project, data) => {
    const tilesets = project.tilesets;
    if (!tilesets || typeof tilesets !== "object") {
      throw new Error("freshProject has no tilesets map");
    }
    const record = (tilesets as Record<string, { structureKits?: unknown[] }>)[data.tilesetId];
    if (!record) {
      throw new Error("freshProject is missing the town tileset");
    }
    record.structureKits = [data.kit];
  }, payload);
}

test.describe("QA sweep: structure kits tab", () => {
  test("tab renders a non-stub empty body and Escape from clean state closes without a prompt", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, STRUCTURE_KITS_TAB);

    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    await expect(page.getByTestId("structure-kit-db-empty")).toBeVisible();
    const probe = await probeOpenTab(page);
    expect(probe.stubTexts, `stub texts: ${probe.stubTexts.join(", ")}`).toEqual([]);
    expect(probe.empty, `empty body (len=${probe.detailTextLen})`).toBe(false);
    expect(probe.detailTextLen).toBeGreaterThan(40);

    const close = await dirtyGuardOracle(page, "escape");
    expect(close.promptShown).toBe(false);
    expect(close.buttons).toEqual([]);
    await expect(page.getByTestId("database-modal")).toBeHidden();
    await expect(page.getByTestId("database-dirty-prompt")).toHaveCount(0);

    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
  });

  test("selecting a seeded kit paints its card detail and survives a tab switch", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await seedSmokeKit(page);
    await switchTabAnyMode(page, STRUCTURE_KITS_TAB);

    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    await expect(page.getByTestId("structure-kit-db-empty")).toHaveCount(0);
    await expect(page.getByTestId(KIT_CARD)).toBeVisible();
    await page.getByTestId(KIT_CARD).click();
    await expect(page.getByTestId(KIT_NAME)).toHaveValue(SMOKE_KIT_NAME);
    await expect(page.getByTestId(KIT_UNIT)).toBeVisible();
    await expect(page.getByTestId(KIT_USE)).toBeEnabled();
    await expect(page.getByTestId(KIT_DELETE)).toBeEnabled();

    const probe = await probeOpenTab(page);
    expect(probe.stubTexts, `stub texts: ${probe.stubTexts.join(", ")}`).toEqual([]);
    expect(probe.empty).toBe(false);
    expect(probe.enabledButtons).toBeGreaterThan(0);

    await switchTabAnyMode(page, TILESETS_TAB);
    await switchTabAnyMode(page, STRUCTURE_KITS_TAB);
    await expect(page.getByTestId(KIT_CARD)).toBeVisible();
    await expect(page.getByTestId(KIT_NAME)).toHaveValue(SMOKE_KIT_NAME);
    await expect(page.getByTestId(KIT_UNIT)).toBeVisible();

    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
  });
});

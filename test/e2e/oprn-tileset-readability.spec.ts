import { expect, test, type Locator } from "@playwright/test";
import { expectReadableControl } from "./oprn-database-helpers";

// 3탭 재편(2026-07-05): 타일 규칙 / 타일 지식(단어장) / 구성.
test("tileset section tabs keep Korean controls readable and split features", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-tilesets").click();

  await expect(page.getByTestId("tileset-oprn-name")).toBeVisible();
  await expect(page.getByTestId("tileset-oprn-graphic")).toBeVisible();
  await expect(page.getByTestId("tileset-section-tabs")).toContainText("타일 규칙");
  await expect(page.getByTestId("tileset-section-tabs")).toContainText("타일 지식(단어장)");
  await expect(page.getByTestId("tileset-section-tabs")).toContainText("구성");

  await expectDisabledReadable(page.getByTestId("tileset-oprn-maximum-count"), "tileset maximum count");
  await expectReadableControl(page.getByTestId("tileset-oprn-graphic-browse"), "tileset graphic browse");
  await expect(page.getByTestId("tileset-oprn-graphic-browse")).toBeEnabled();

  // ── 타일 규칙 탭(기본): 레이어/통행/지형만 보인다 ───────────────
  await expect(page.getByTestId("tileset-section-tab-rules")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tileset-rule-layer")).toBeVisible();
  await expect(page.getByTestId("tileset-rule-passage")).toBeVisible();
  await expect(page.getByTestId("tileset-edit-mode-ai")).toHaveCount(0);
  await expectReadableControl(page.getByTestId("tileset-layer-auto"), "tileset layer auto");
  await expectReadableControl(page.getByTestId("tileset-layer-lower"), "tileset layer lower");
  await expectReadableControl(page.getByTestId("tileset-layer-upper"), "tileset layer upper");
  await expectReadableControl(page.getByTestId("tileset-passage-open"), "tileset passage open");
  await expectReadableControl(page.getByTestId("tileset-passage-blocked"), "tileset passage blocked");
  await expectReadableControl(page.getByTestId("tileset-settings-open"), "tileset detailed passage button");

  await expect(page.getByTestId("tileset-edit-mode-passage")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tileset-db-cell-0")).toHaveText(/^(O|X|★)$/);
  await page.getByTestId("tileset-edit-mode-terrain").click();
  await expect(page.getByTestId("tileset-edit-mode-terrain")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tileset-db-cell-0")).toHaveText(/^\d+$/);
  await page.getByTestId("tileset-edit-mode-passage").click();

  await page.getByTestId("tileset-settings-open").click();
  await expect(page.getByTestId("tileset-settings-modal")).toBeVisible();
  await page.getByTestId("tileset-settings-close").click();

  // ── 타일 지식(단어장) 탭: AI 메타/그룹 + 검사 요약 ───────────────
  await page.getByTestId("tileset-section-tab-knowledge").click();
  await expect(page.getByTestId("tileset-edit-mode-ai")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tileset-ai-question-panel")).toBeVisible();
  await expect(page.getByTestId("tileset-generation-checker")).toContainText("Ready");
  await expect(page.getByTestId("tileset-rule-layer")).toHaveCount(0);
  await page.getByTestId("tileset-db-cell-360").click();
  await expect(page.getByTestId("tileset-selected-tags")).toContainText("terrain");
  await expect(page.getByTestId("tileset-selected-rules")).not.toContainText("No placement rule");

  // ── 구성 탭: 오토타일 ──────────────────────
  await page.getByTestId("tileset-section-tab-compose").click();
  await expect(page.getByTestId("tileset-autotile-editor")).toBeVisible();
  await expect(page.getByTestId("terrain-template-section")).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("database-tileset-readable.png"), fullPage: true });
});

async function expectDisabledReadable(locator: Locator, label: string): Promise<void> {
  await expectReadableControl(locator, label);
  await expect(locator, label).toBeDisabled();
}

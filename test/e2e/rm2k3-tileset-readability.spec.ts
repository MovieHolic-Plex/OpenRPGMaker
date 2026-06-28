import { expect, test, type Locator } from "@playwright/test";
import { expectReadableControl } from "./rm2k3-database-helpers";

test("RM2K3 tileset tab keeps Korean controls readable and mode buttons synced", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-tilesets").click();

  await expect(page.getByTestId("tileset-rm2k3-name")).toBeVisible();
  await expect(page.getByTestId("tileset-rm2k3-graphic")).toBeVisible();
  await expect(page.getByTestId("tileset-rm2k3-layer-tabs")).toContainText("하위 레이어");
  await expect(page.getByTestId("tileset-rm2k3-edit-mode")).toContainText("AI 메타");
  await expect(page.getByTestId("tileset-rm2k3-edit-mode")).toContainText("4방향 통행");

  await expectDisabledReadable(page.getByTestId("tileset-rm2k3-maximum-count"), "tileset maximum count");
  await expectDisabledReadable(page.getByTestId("tileset-rm2k3-graphic-browse"), "tileset graphic browse");
  await expectDisabledReadable(page.getByTestId("tileset-rm2k3-layer-lower"), "tileset lower layer tab");
  await expectDisabledReadable(page.getByTestId("tileset-rm2k3-layer-upper"), "tileset upper layer tab");
  await expectReadableControl(page.getByTestId("tileset-rm2k3-mode-terrain"), "tileset terrain mode");
  await expectReadableControl(page.getByTestId("tileset-rm2k3-mode-passage"), "tileset passage mode");
  await expectReadableControl(page.getByTestId("tileset-rm2k3-mode-ai"), "tileset AI mode");
  await expectReadableControl(page.getByTestId("tileset-rm2k3-mode-group"), "tileset group mode");
  await expectReadableControl(page.getByTestId("tileset-rm2k3-mode-four-way"), "tileset four-way passage mode");
  await expectDisabledReadable(page.getByTestId("tileset-rm2k3-mode-global-terrain"), "tileset global terrain mode");
  await expectReadableControl(page.getByTestId("tileset-settings-open"), "tileset detailed passage button");
  await expectReadableControl(page.getByTestId("tileset-ai-meta-open"), "tileset AI meta button");

  await expect(page.getByTestId("tileset-rm2k3-mode-passage")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("tileset-rm2k3-mode-terrain").click();
  await expect(page.getByTestId("tileset-rm2k3-mode-terrain")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tileset-db-cell-0")).toHaveText(/^\d+$/);
  await page.getByTestId("tileset-rm2k3-mode-passage").click();
  await expect(page.getByTestId("tileset-rm2k3-mode-passage")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tileset-db-cell-0")).toHaveText(/^(O|X|★)$/);

  await page.getByTestId("tileset-rm2k3-mode-four-way").click();
  await expect(page.getByTestId("tileset-settings-modal")).toBeVisible();
  await page.getByTestId("tileset-settings-close").click();

  await expect(page.getByTestId("tileset-rm2k3-terrain-list")).toContainText("0001:");
  await expect(page.getByTestId("tileset-db-cell-0")).toBeVisible();
  await page.getByTestId("tileset-ai-meta-open").click();
  await expect(page.getByTestId("tileset-rm2k3-mode-ai")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tileset-ai-question-panel")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("database-tileset-readable.png"), fullPage: true });
});

async function expectDisabledReadable(locator: Locator, label: string): Promise<void> {
  await expectReadableControl(locator, label);
  await expect(locator, label).toBeDisabled();
}

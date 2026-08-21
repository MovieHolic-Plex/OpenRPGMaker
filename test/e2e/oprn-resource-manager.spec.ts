import { expect, test } from "@playwright/test";

test("resource manager uses Korean classic three-pane RM2K3 layout", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1&resourceManagerClassicLayout=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();

  await expect(page.locator(".database-modal-header h2")).toHaveText("리소스 관리자");
  const categories = page.getByTestId("resource-category-list");
  await expect(categories).toBeVisible();
  await expect(categories.getByRole("option", { name: "전투 배경" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("resource-entry-list")).toContainText("EasyRPG RTP Cosmos1 Panorama");
  await expect(page.getByTestId("resource-command-panel")).toContainText("가져오기...");
  await expect(page.getByTestId("resource-command-panel")).toContainText("내보내기...");
  await expect(page.getByTestId("resource-command-panel")).toContainText("삭제");
  await expect(page.getByTestId("resource-import-format")).toContainText("가져오기 형식");
  await expect(page.getByLabel("PNG (표준)")).toBeChecked();
  const modal = page.getByTestId("resource-modal");
  await expect(modal.getByRole("button", { name: "닫기", exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "도움말", exact: true })).toBeVisible();
  await expect.poll(async () => modal.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("resource-manager-classic-layout.png"), fullPage: true });
});

test("resource manager imports and protects RM2K3-shaped image profiles", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1&resourceManagerWave=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await expect(page.getByText("사용 중인 리소스는 삭제할 수 없습니다.")).toBeVisible();

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-valid-480x256.png");
  await expect(page.getByTestId("resource-profile-chipset").last()).toContainText("480x256");
  await expect(page.getByTestId("resource-tile-0").last()).toBeVisible();
  await page.locator("[data-testid^='resource-add-tileset-']").last().click();
  await expect(page.getByTestId("toast")).toContainText("타일셋 추가됨");
  await page.locator("[data-testid^='resource-apply-tileset-']").last().click();
  await expect(page.getByTestId("toast")).toContainText("현재 맵 칩셋 적용");
  await page.locator("[data-testid^='resource-delete-']").last().click();
  await expect(page.getByTestId("toast")).toContainText("현재 맵 또는 다른 맵이 이 타일셋 리소스를 사용 중입니다.");

  await page.getByTestId("resource-kind-select").selectOption("charset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/charset-valid-288x256.png");
  await expect(page.getByTestId("resource-profile-charset").last()).toContainText("288x256");
  await expect(page.locator(".rm-asset-kind").last()).toContainText("캐릭터셋");
  await page.getByTestId("resource-upload-list").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.getByTestId("resource-modal").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("resource-manager-uploads.png"), fullPage: true });
});

test("resource manager reports invalid image imports in Korean", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1&resourceManagerErrors=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").evaluate((node) => {
    const input = node as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="480" height="256"></svg>'], "renamed-svg.png", {
      type: "image/svg+xml",
    }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("toast")).toContainText("PNG/JPEG 이미지 MIME만 사용할 수 있습니다.");

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-invalid-320x240.png");
  await expect(page.getByTestId("toast")).toContainText("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
  await page.screenshot({ path: testInfo.outputPath("resource-manager.png"), fullPage: true });
});

import { expect, test } from "@playwright/test";

test("resource manager uses Korean classic three-pane RM2K3 layout", async ({ page }, testInfo) => {
  // 클래식 3분할 툴바(`toolbar-resource-manager`)는 expert 전용 크롬이다.
  // 자동화 기본 부팅은 standard 이므로 명시적으로 켠다 (editorUiMode.ts DEFAULT/isLikelyAutomationBoot).
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&resourceManagerClassicLayout=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();

  await expect(page.locator(".database-modal-header h2")).toHaveText("리소스 관리자");
  const categories = page.getByTestId("resource-category-list");
  await expect(categories).toBeVisible();
  await expect(categories.getByRole("option", { name: "전투 배경" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("resource-entry-list")).toContainText("Cosmos1 · 배경 그림 · EasyRPG");
  await expect(page.getByTestId("resource-command-panel")).toContainText("가져오기...");
  await expect(page.getByTestId("resource-command-panel")).toContainText("내보내기...");
  await expect(page.getByTestId("resource-command-panel")).toContainText("삭제");
  await expect(page.getByTestId("resource-import-format")).toContainText("WebP·GIF (PNG 첫 프레임으로 자동 변환)");
  const modal = page.getByTestId("resource-modal");
  await expect(modal.getByRole("button", { name: "닫기", exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "도움말", exact: true })).toBeVisible();
  await expect.poll(async () => modal.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("resource-manager-classic-layout.png"), fullPage: true });
});

test("resource manager faceset category hides the generated hero face series", async ({ page }, testInfo) => {
  // generated-actor-hero-XX-face-NN 낱장 32장은 저장본 호환 등록만 남기고 저작 목록에서 내렸다.
  // 얼굴 그래픽 카테고리에는 EasyRPG 낱장 80장만 보여야 한다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&resourceManagerFaceset=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();

  await page.getByTestId("resource-category-list").getByRole("option", { name: "얼굴 그래픽" }).click();
  const entries = page.getByTestId("resource-entry-list");
  await expect(entries.getByTestId("resource-profile-faceset")).toHaveCount(80);
  await expect(entries).toContainText("Actor1 얼굴 1");
  await expect(entries).not.toContainText("hero-01-face");
  await expect(entries).not.toContainText("hero-02-face");

  // 목록 보기는 행 텍스트에 assetId 를 싣는다 — id 수준으로도 생성 시리즈가 없음을 확인한다.
  await page.getByRole("button", { name: "리스트 뷰" }).click();
  await expect(entries).toContainText("easyrpg-faceset-actor1-00");
  await expect(entries).not.toContainText("generated-actor-hero");
  await page.screenshot({ path: testInfo.outputPath("resource-manager-faceset-no-generated.png"), fullPage: true });
});

test("resource manager imports and protects RM2K3-shaped image profiles", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&resourceManagerWave=1");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await expect(page.getByText("사용 중인 리소스는 삭제할 수 없습니다.")).toBeVisible();

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-valid-480x256.png");
  await expect(page.getByTestId("resource-profile-chipset").last()).toContainText("480x256");
  await expect(page.getByTestId("resource-tile-0").last()).toBeVisible();
  // 칩셋 가져오기가 타일셋을 자동 추가한다. 수동 클릭은 이미-추가 경로가 된다.
  await expect(page.getByTestId("toast")).toContainText("타일셋 추가됨");
  await page.locator("[data-testid^='resource-add-tileset-']").last().click();
  await expect(page.getByTestId("toast")).toContainText("이미 추가된 타일셋");
  await page.locator("[data-testid^='resource-apply-tileset-']").last().click();
  await expect(page.getByTestId("toast")).toContainText("현재 맵 타일 그림판 적용");
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
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
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
  await expect(page.getByTestId("toast")).toContainText("image/svg+xml");

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-invalid-320x240.png");
  await expect(page.getByTestId("toast")).toContainText("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
  await page.screenshot({ path: testInfo.outputPath("resource-manager.png"), fullPage: true });
});

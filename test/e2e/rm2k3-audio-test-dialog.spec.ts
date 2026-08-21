import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // 클래식 툴바(음악 버튼 포함)는 전문가 모드에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("audio test dialog follows Korean RM2003 BGM test layout", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1&audioTestDialog=1");
  await page.getByTestId("toolbar-sound-test").click();

  const dialog = page.getByTestId("audio-test-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "음악/효과음 테스트" })).toBeVisible();
  await expect(page.getByTestId("audio-test-list")).toBeVisible();
  await expect(page.getByTestId("audio-test-option-off")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("audio-test-fade")).toContainText("페이드인 시간");
  await expect(page.getByTestId("audio-test-volume")).toContainText("음량");
  await expect(page.getByTestId("audio-test-tempo")).toContainText("템포");
  await expect(page.getByTestId("audio-test-balance")).toContainText("밸런스");
  await expect(page.getByRole("button", { name: "재생" })).toBeVisible();
  await expect(page.getByRole("button", { name: "정지" })).toBeVisible();
  await expect(page.getByTestId("audio-test-close")).toBeVisible();

  await page.getByTestId("audio-test-option-1").click();
  await expect(page.getByTestId("audio-test-option-1")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "재생" }).click();
  await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  await page.getByRole("button", { name: "정지" }).click();
  await expect(page.getByTestId("audio-test-status")).toContainText("정지됨");
  await page.screenshot({ path: testInfo.outputPath("audio-test-dialog.png"), fullPage: true });
  await page.getByTestId("audio-test-close").click();
  await expect(dialog).toBeHidden();
});

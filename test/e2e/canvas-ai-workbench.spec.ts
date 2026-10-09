import { expect, test, type Page } from "@playwright/test";

async function dismissChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:canvas-toolbar-expanded", "1");
    localStorage.setItem("oprn:onboarding-complete", "1");
  });
  await page.goto("/?blankProject=1");
  await dismissChrome(page);
  await expect(page.getByTestId("canvas-ai-workbench")).toBeVisible({ timeout: 30_000 });
}

test("canvas AI workbench exposes and executes its real quick actions", async ({ page }) => {
  await boot(page);

  const workbench = page.getByTestId("canvas-ai-workbench");
  await expect(workbench.getByText("만들기", { exact: true })).toBeVisible();
  await expect(workbench.getByText("다듬기", { exact: true })).toBeVisible();
  await expect(workbench.getByText("검사", { exact: true })).toBeVisible();
  await expect(workbench.getByText("AI 요청", { exact: true })).toBeVisible();

  await page.getByTestId("canvas-ai-create").click();
  await expect(page.getByTestId("toast")).toContainText("만들 영역을 드래그해 선택하세요");

  await page.getByTestId("canvas-ai-polish").click();
  await expect(page.getByTestId("toast")).toContainText("다듬을 영역을 드래그해 선택하세요");

  await page.getByTestId("canvas-ai-inspect").click();
  await expect(page.getByTestId("canvas-inspection-panel")).toBeVisible();
  await expect(page.getByTestId("canvas-inspection-summary")).toContainText("문제");
  await page.screenshot({
    fullPage: true,
    path: ".omo/evidence/canvas-ai-workbench-inspection.png",
  });
  await page.getByRole("button", { name: "검사 결과 닫기" }).click();

  await page.getByTestId("canvas-ai-ask").click();
  await expect(page.getByTestId("region-task-modal")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "영역 작업" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /이 영역에 무엇을 할까요/ })).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: ".omo/evidence/canvas-ai-workbench-request.png",
  });
});

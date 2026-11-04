import { expect, test, type Page } from "@playwright/test";
import { runPaletteCommand } from "./topbarNavigation";

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
    localStorage.setItem("oprn:onboarding-complete", "1");
  });
  await page.goto("/?blankProject=1");
  await dismissChrome(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
}

// 2026-11 캔버스 알약 개편: AI 빠른 작업 넷은 캔버스 위 단추가 아니라 ⌘K 명령이다(같은 executeCanvasAiAction).
test("canvas AI quick actions run from the command palette", async ({ page }) => {
  await boot(page);

  await expect(page.getByTestId("canvas-ai-workbench")).toHaveCount(0);

  await runPaletteCommand(page, "집·길·NPC 만들기", "canvas-ai-create");
  await expect(page.getByTestId("toast")).toContainText("만들 영역을 드래그해 선택하세요");

  await runPaletteCommand(page, "선택 영역 다듬기", "canvas-ai-polish");
  await expect(page.getByTestId("toast")).toContainText("다듬을 영역을 드래그해 선택하세요");

  await runPaletteCommand(page, "맵 통행·참조·이벤트", "canvas-ai-inspect");
  await expect(page.getByTestId("canvas-inspection-panel")).toBeVisible();
  await expect(page.getByTestId("canvas-inspection-summary")).toContainText("문제");
  await page.screenshot({
    fullPage: true,
    path: ".omo/evidence/canvas-ai-workbench-inspection.png",
  });
  await page.getByRole("button", { name: "검사 결과 닫기" }).click();

  await runPaletteCommand(page, "현재 맵에 요청", "canvas-ai-ask");
  await expect(page.getByTestId("region-task-modal")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "영역 작업" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /이 영역에 무엇을 할까요/ })).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: ".omo/evidence/canvas-ai-workbench-request.png",
  });
});

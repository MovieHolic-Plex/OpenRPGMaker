import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/editor-ai-phase2");
const PANEL_COLLAPSED_KEY = "oprn:ai-panel-collapsed";

mkdirSync(EVIDENCE, { recursive: true });

async function dismissBootOverlays(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) await welcome.click();
  await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
}

test("접힌 조수에서 제공자와 여섯 저작 예제를 확인하고 입력을 시작한다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((collapsedKey) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({
      authMode: "chatgpt",
      providerId: "openai-codex",
      model: "cpen/gpt-5-6-luna",
    }));
    localStorage.setItem(collapsedKey, "1");
    localStorage.removeItem("oprn:editor-layout:v4");
  }, PANEL_COLLAPSED_KEY);

  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissBootOverlays(page);

  // 제공자 표시는 퇴역한 하단 상태 칩이 아니라 현재 연결 설정 표면에서 확인한다.
  await page.getByTestId("topbar-ai-settings").click();
  await expect(page.getByTestId("ai-settings-modal")).toBeVisible();
  await expect(page.getByTestId("ai-auth-provider-help")).toContainText("ChatGPT 계정으로 로그인");
  await page.getByTestId("ai-settings-close").click();
  await expect(page.getByTestId("ai-settings-modal")).toHaveCount(0);

  const panel = page.getByTestId("ai-panel");
  // 저장된 "1" 은 패널 접힘(is-collapsed) 하나로 간다 — 구 유리 카드의 본문 접힘
  // (is-glass-folded)은 도크 축과 함께 2026-08-31 에 삭제됐다.
  await expect(panel).toHaveClass(/is-collapsed/);
  await expect(panel).not.toHaveClass(/is-glass-folded/);
  // 현재 저작 진입점은 접힌 카드에 남는 입력줄과 disclosure 셰브론이다.
  await expect(page.getByTestId("ai-input")).toBeVisible();
  const disclosure = page.getByTestId("ai-collapse");
  await expect(disclosure).toHaveAttribute("aria-label", "조수 대화 펼치기");
  await disclosure.click();

  await expect(panel).not.toHaveClass(/is-collapsed/);
  await page.getByTestId("ai-input").click();
  await expect(page.getByTestId("ai-input")).toBeFocused();
  // 저작 예제 6개는 컴포저 추천 팝오버 안에 있다 — 입력창이 비어 있고 포커스를 받으면
  // 저절로 열린다(구 유리 카드 본문의 `ai-next-steps` 가 여기로 이사했다).
  await expect(page.getByTestId("ai-suggest-popover")).toBeVisible();
  await expect(page.getByTestId("ai-authoring-examples")).toBeVisible();
  const examples = page.locator("[data-testid^='ai-authoring-example-']");
  await expect(examples).toHaveCount(6);
  await expect(examples).toHaveText(["길", "NPC", "상점", "상자", "집", "퀘스트"]);
  const examplesBox = await page.getByTestId("ai-authoring-examples").boundingBox();
  const composerBox = await page.getByTestId("ai-command-bar").boundingBox();
  expect(examplesBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  // 팝오버는 캡슐 위로 뜬다 — 예제가 입력줄을 덮지 않아야 클릭 없이 바로 타이핑할 수 있다.
  expect(examplesBox!.y + examplesBox!.height).toBeLessThanOrEqual(composerBox!.y + composerBox!.height);
  await page.screenshot({
    path: path.join(EVIDENCE, "authoring-entry-and-provider.png"),
    animations: "disabled",
  });

  await page.getByTestId("ai-authoring-example-shop").click();
  await expect(page.getByTestId("ai-input")).toHaveValue(/상점 NPC/);
  await expect(page.getByTestId("ai-input")).toBeFocused();
  await page.screenshot({
    path: path.join(EVIDENCE, "shop-example-prefill.png"),
    animations: "disabled",
  });
});

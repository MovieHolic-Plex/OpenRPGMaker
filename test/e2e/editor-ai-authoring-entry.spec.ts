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

test("접힌 조수에서 제공자와 네 저작 예제를 확인하고 입력을 시작한다", async ({ page }) => {
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
  await expect(page.getByTestId("ai-auth-provider-help")).toContainText("OpenAI Codex");
  await page.getByTestId("ai-settings-close").click();
  await expect(page.getByTestId("ai-settings-modal")).toHaveCount(0);

  const panel = page.getByTestId("ai-panel");
  // glass 도크는 칩 접힘(is-collapsed) 대신 본문 접힘(fold)을 쓴다 — 저장된 "1" 도
  // fold 로 라우팅된다(openwiki/editor-ai-panel.md 2026-08-30).
  await expect(panel).toHaveClass(/is-glass-folded/);
  await expect(panel).not.toHaveClass(/is-collapsed/);
  // 현재 저작 진입점은 접힌 카드에 남는 입력줄과 disclosure 셰브론이다.
  await expect(page.getByTestId("ai-input")).toBeVisible();
  const disclosure = page.getByTestId("ai-collapse");
  await expect(disclosure).toHaveAttribute("aria-label", "조수 대화 펼치기");
  await disclosure.click();

  await expect(panel).not.toHaveClass(/is-glass-folded/);
  await page.getByTestId("ai-input").click();
  await expect(page.getByTestId("ai-input")).toBeFocused();
  await expect(page.getByTestId("ai-authoring-examples")).toBeVisible();
  const examples = page.locator("[data-testid^='ai-authoring-example-']");
  await expect(examples).toHaveCount(4);
  await expect(examples).toHaveText(["길", "NPC", "상점", "상자"]);
  const examplesBox = await page.getByTestId("ai-authoring-examples").boundingBox();
  const composerBox = await page.getByTestId("ai-command-bar").boundingBox();
  expect(examplesBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  // glass 는 입력줄이 카드 **맨 위**다(order: -1) — 대화·예제가 그 아래로 열린다.
  // 접힌 한 줄이 그 자리에 남아 있어야 클릭 없이 바로 타이핑할 수 있다.
  expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(examplesBox!.y);
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

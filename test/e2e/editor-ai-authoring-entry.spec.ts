import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/editor-ai-phase2");

mkdirSync(EVIDENCE, { recursive: true });

async function dismissBootOverlays(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) await welcome.click();
  await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
}

test("AI로 만들기에서 제공자와 여섯 저작 예제를 확인하고 입력을 시작한다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.removeItem("oprn:editor-layout:v4");
  });

  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissBootOverlays(page);

  const provider = page.getByTestId("ai-connection-status");
  const entry = page.getByTestId("ai-authoring-entry");
  await expect(provider).toContainText("OpenAI Codex");
  await expect(entry).toHaveText(/AI로 만들기/);
  // 접힘(`is-collapsed`)을 씨딩해 두고 진입 버튼이 펼치는지 재던 자리. 띠는 유휴 56px 로
  // 상주하므로(스펙 §2) 접힘 대신 **유휴 → 자람**을 잰다. 진입 버튼의 계약은 그대로다:
  // 조수를 쓸 수 있는 상태로 만들고 입력에 포커스를 준다.
  await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-risen/);

  await entry.click();

  await expect(page.getByTestId("ai-panel")).toHaveClass(/is-risen/);
  await expect(page.getByTestId("ai-input")).toBeFocused();
  await expect(page.getByTestId("ai-authoring-examples")).toBeVisible();
  await expect(page.locator("[data-testid^='ai-authoring-example-']")).toHaveCount(6);
  const examplesBox = await page.getByTestId("ai-authoring-examples").boundingBox();
  const composerBox = await page.getByTestId("ai-command-bar").boundingBox();
  expect(examplesBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(examplesBox!.y + examplesBox!.height).toBeLessThanOrEqual(composerBox!.y);
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

import { test, expect } from "@playwright/test";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const SHOT_DIR = "verify-shots/world-lore-v6";
test.setTimeout(180_000);

test.beforeAll(() => {
  mkdirSync(SHOT_DIR, { recursive: true });
  for (const file of readdirSync(SHOT_DIR)) unlinkSync(join(SHOT_DIR, file));
});

test("world canon AI help evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    const button = page.getByTestId(id);
    if (await button.isVisible()) await button.click();
  }
  await page.getByTestId("toolbar-database").click();
  const tabButton = page.getByTestId("db-tab-world-canon");
  if (!await tabButton.isVisible()) await page.getByTestId("db-tab-group-lore").click();
  await tabButton.click();
  await expect(page.getByTestId("db-world-canon-workspace")).toBeVisible();

  // 본문 탭 = 도화지 + AI 도움 버튼
  await expect(page.getByTestId("db-ws-section-tab-body")).toHaveClass(/active/);
  await expect(page.getByTestId("world-canon-body-ai")).toBeVisible();
  await expect(page.getByTestId("world-canon-body-ai-draft")).toBeVisible();
  await expect(page.getByTestId("world-canon-body-ai-continue")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/01-body-ai-controls.png" });

  // AI 미연결 상태에서 초안 요청 -> 정직한 안내
  await page.getByTestId("world-canon-body-ai-draft").click();
  await expect(page.getByTestId("world-canon-body-ai-status")).not.toHaveText("", { timeout: 30_000 });
  await page.screenshot({ path: SHOT_DIR + "/02-body-ai-unavailable.png" });

  // 세계 설정 탭 = 인터뷰
  await page.getByTestId("db-ws-section-tab-settings").click();
  await expect(page.getByTestId("world-canon-interview")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/03-interview.png" });

  // 조수 전달 탭
  await page.getByTestId("db-ws-section-tab-ai").click();
  await expect(page.getByTestId("world-canon-ai-panel")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/04-ai-delivery.png" });
});


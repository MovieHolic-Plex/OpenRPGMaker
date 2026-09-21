import { test, expect } from "@playwright/test";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const SHOT_DIR = "verify-shots/world-lore-v4";
test.setTimeout(180_000);

test.beforeAll(() => {
  mkdirSync(SHOT_DIR, { recursive: true });
  for (const file of readdirSync(SHOT_DIR)) unlinkSync(join(SHOT_DIR, file));
});

test("world canon compact head + plain form evidence", async ({ page }) => {
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
  // 첫 화면: 본문 도화지 + 압축 헤드 + ? 도움말
  await expect(page.getByTestId("db-ws-section-tab-body")).toHaveClass(/active/);
  await expect(page.getByTestId("db-world-canon-help")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/01-body-canvas.png" });

  await page.getByTestId("db-world-canon-body").fill("천 년 전, 왕도 아르가론은 바다에 가라앉았다. 사람들은 그것을 재앙이라 부르지 않는다.");
  // 세계 설정: 평문 폼
  await page.getByTestId("db-ws-section-tab-settings").click();
  await expect(page.getByTestId("db-world-canon-name")).toBeVisible();
  await page.getByTestId("db-world-canon-name").fill("비늘의 바다, 아르그란트");
  await page.getByTestId("db-world-canon-premise").fill("바다는 잊지 않는다 — 모든 이름을 물 밑에 보관하는 세계");
  await page.getByTestId("db-world-canon-tone-mythic").click();
  await page.getByTestId("db-world-canon-tone-hopeful").click();
  await page.getByTestId("db-world-canon-absence-input").fill("총기");
  await page.getByTestId("db-world-canon-absence-add").click();
  await page.getByTestId("db-world-canon-law-gods").click();
  await page.getByTestId("db-world-canon-law-gods-option-no").click();
  await page.getByTestId("db-world-canon-law-gods-save").click();
  await page.screenshot({ path: SHOT_DIR + "/02-settings-plain-form.png" });
  // 법칙 대화상자
  await page.getByTestId("db-world-canon-law-death").click();
  await expect(page.getByTestId("db-world-canon-law-dialog")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/03-law-dialog.png" });
  await page.getByTestId("db-world-canon-law-death-option-yes").click();
  await page.getByTestId("db-world-canon-law-death-note").fill("죽음은 영원한 항해다");
  await page.getByTestId("db-world-canon-law-death-save").click();
  // 조수 전달
  await page.getByTestId("db-ws-section-tab-ai").click();
  await expect(page.getByTestId("world-canon-ai-panel")).toBeVisible();
  await expect(page.getByTestId("world-canon-ai-panel-preview")).toContainText("죽음은 영원한 항해다");
  await page.screenshot({ path: SHOT_DIR + "/04-ai-delivery.png" });
});


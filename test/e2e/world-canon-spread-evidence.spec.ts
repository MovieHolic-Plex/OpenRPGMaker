import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOT_DIR = "verify-shots/world-lore-v3";
test.setTimeout(180_000);

test("world canon spread view evidence", async ({ page }) => {
  mkdirSync(SHOT_DIR, { recursive: true });
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
  await expect(page.locator(".world-canon-spread-head")).toBeVisible();
  // 두 탭이 보인다
  await expect(page.getByTestId("db-ws-section-tab-document")).toBeVisible();
  await expect(page.getByTestId("db-ws-section-tab-ai")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/01-empty-document-tab.png" });

  // 이름·전제 입력 -> 헤드 미러 확인
  await page.getByTestId("db-world-canon-name").fill("비늘의 바다, 아르그란트");
  await page.getByTestId("db-world-canon-premise").fill("바다는 잊지 않는다 — 모든 이름을 물 밑에 보관하는 세계");
  await expect(page.locator(".world-canon-head-title")).toHaveText("비늘의 바다, 아르그란트");
  // 톤 칩 2개 + 없는 것 1개
  await page.getByTestId("db-world-canon-tone-mythic").click();
  await page.getByTestId("db-world-canon-tone-hopeful").click();
  await page.getByTestId("db-world-canon-absence-input").fill("총기");
  await page.getByTestId("db-world-canon-absence-add").click();
  // 법칙: 신=없음, 돈=있음+비고, 죽음은 미정(배지 확인용)
  await page.getByTestId("db-world-canon-law-gods").click();
  await page.getByTestId("db-world-canon-law-gods-option-no").click();
  await page.getByTestId("db-world-canon-law-gods-save").click();
  await page.getByTestId("db-world-canon-law-money").click();
  await page.getByTestId("db-world-canon-law-money-option-yes").click();
  await page.getByTestId("db-world-canon-law-money-note").fill("진주가 아니라 이름이 화폐다");
  await page.getByTestId("db-world-canon-law-money-save").click();
  await page.getByTestId("db-world-canon-body").fill("천 년 전, 왕도 아르가론은 바다에 가라앉았다. 사람들은 그것을 재앙이라 부르지 않는다.");
  await page.screenshot({ path: SHOT_DIR + "/02-filled-document-tab.png" });

  // 법칙 대화상자 증거
  await page.getByTestId("db-world-canon-law-death").click();
  await expect(page.getByTestId("db-world-canon-law-dialog")).toBeVisible();
  await page.screenshot({ path: SHOT_DIR + "/03-law-dialog.png" });
  await page.getByTestId("db-world-canon-law-death-option-yes").click();
  await page.getByTestId("db-world-canon-law-death-note").fill("죽음은 영원한 항해다");
  await page.getByTestId("db-world-canon-law-death-save").click();
  await expect(page.getByTestId("db-world-canon-law-death")).toContainText("죽음은 영원한 항해다");

  // 조수 전달 탭 — 프롬프트 투영 + 상태 타일
  await page.getByTestId("db-ws-section-tab-ai").click();
  await expect(page.getByTestId("world-canon-ai-panel")).toBeVisible();
  await expect(page.getByTestId("world-canon-ai-panel-preview")).toContainText("## 이 세계(세계관 고정)");
  await expect(page.getByTestId("world-canon-ai-panel-preview")).toContainText("죽음은 영원한 항해다");
  await page.screenshot({ path: SHOT_DIR + "/04-ai-delivery-tab.png" });
});


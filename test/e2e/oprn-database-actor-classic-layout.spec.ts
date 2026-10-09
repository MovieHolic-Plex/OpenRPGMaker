import { expect, test } from "@playwright/test";

test("actor database uses Korean classic RPG Maker actor sheet layout", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-actors").click();

  const modal = page.getByTestId("database-modal");
  await expect(modal).toBeVisible();
  // 핸들러 없는 장식용 그룹탭("용어"/"시스템"/"시스템 2"/"공용 이벤트")은 fix(db)에서
  // 제거됐다 — 클릭해도 아무 일도 일어나지 않는 가짜 컨트롤이었다.
  await expect(page.getByTestId("db-classic-group-tabs")).toHaveCount(0);

  const sheet = page.getByTestId("actor-classic-sheet");
  await expect(sheet).toBeVisible();
  for (const label of [
    "이름",
    "칭호",
    "그래픽",
    "직업",
    "능력치 곡선",
    "경험치 곡선",
    "초기 장비",
    "맨손 애니메이션",
    "옵션",
    "상태 저항",
    "속성 방어",
    "스킬",
  ]) {
    await expect(sheet).toContainText(label);
  }
});

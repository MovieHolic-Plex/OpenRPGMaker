import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { chooseDetailRow, openTestPlayWindow, seedDefaultProject, selectCommand } from "./oprnPlayerStatusMenuHelpers";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "evidence/browser-screenshots/item-menu-target-match";

test("item menu uses the Korean detail-and-target structure", async ({ page }) => {
  // 키보드 이동 + 편집기 부팅까지 합치면 기본 30초로는 빡빡하다.
  test.setTimeout(60_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1932, height: 1448 });
  await seedDefaultProject(page);
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });

  await page.keyboard.press("X");
  // 런타임 메뉴는 키보드 전용이다(player.css 가 플레이 표면을 히트테스트에서 뺀다) —
  // 레일 선택도 상세 진입도 방향키/확인키로 한다.
  await selectCommand(page, "items", "아이템");
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText("아이템");
  await expect(page.getByTestId("status-menu-detail")).toContainText("회복약");
  await expect(page.getByTestId("status-menu-detail")).toContainText("2개");
  await expect(page.getByTestId("status-menu-detail").locator("[data-testid^='status-menu-item-']")).toHaveCount(6);
  await expectClassicStatusMenuGone(page);

  await chooseDetailRow(page, "status-menu-item-item_potion");
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("대상 선택: 회복약");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toContainText("주인공");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toContainText(/HP \d+\/\d+/);
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toContainText(/MP \d+\/\d+/);
  await expect(page.getByTestId("status-menu-detail").locator("[data-testid^='status-menu-item-target-']")).toHaveCount(4);
  expect(await importantTextFits(page)).toEqual([]);

  await page.getByTestId("main-menu").screenshot({ path: `${EVIDENCE_DIR}/item-menu-target-match.png` });
});

async function importantTextFits(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!root) return ["missing status menu detail"];
    return Array.from(root.querySelectorAll<HTMLElement>([
      ".status-menu-detail-label",
      ".status-menu-detail-value",
      ".status-menu-detail-description",
    ].join(",")))
      .filter((node) => node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

async function expectClassicStatusMenuGone(page: Page): Promise<void> {
  await expect(page.locator("[data-testid^='status-menu-classic-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='status-menu-fullscreen-']")).toHaveCount(0);
}

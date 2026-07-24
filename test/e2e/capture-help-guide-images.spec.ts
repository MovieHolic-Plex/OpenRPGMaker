import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test.setTimeout(90_000);

async function settle(page: Page, ms = 700): Promise<void> {
  await page.waitForTimeout(ms);
}

async function waitForCanvasReady(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    return !!c && c.width > 0 && c.height > 0;
  });
  await settle(page, 1200);
}

test("capture help guide images", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await waitForCanvasReady(page);

  // 1) 개요 / 화면 구성 — 전체 에디터
  await page.screenshot({ path: "public/assets/help/overview.png" });

  // 2) 지도 편집 — 줌 인 + 타일 팔레트
  await page.getByTestId("toolbar-zoom-2").click();
  await settle(page, 700);
  await page.screenshot({ path: "public/assets/help/map.png" });
  await page.getByTestId("toolbar-zoom-1").click();
  await settle(page, 400);

  // 3) 이벤트 — 이벤트 편집기 모달
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  let eventOpened = false;
  if (box) {
    const candidates = [
      { x: 0.2, y: 0.45 },
      { x: 0.25, y: 0.75 },
      { x: 0.35, y: 0.72 },
      { x: 0.18, y: 0.62 },
      { x: 0.5, y: 0.5 },
    ];
    for (const c of candidates) {
      await canvas.dblclick({ position: { x: Math.floor(box.width * c.x), y: Math.floor(box.height * c.y) } });
      try {
        await page.getByTestId("event-page-tabs").waitFor({ state: "visible", timeout: 1200 });
        eventOpened = true;
        break;
      } catch {
        /* try next */
      }
    }
  }
  if (eventOpened) {
    await settle(page, 600);
    await page.screenshot({ path: "public/assets/help/event.png" });
    await page.keyboard.press("Escape");
    await page.getByTestId("event-editor-modal").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
    await settle(page, 400);
  }

  // 4) 데이터베이스
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await settle(page, 800);
  await page.screenshot({ path: "public/assets/help/database.png" });
  await page.getByTestId("database-modal").getByTestId("database-modal-close").first().click().catch(() => {});
  await page.getByTestId("database-modal").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  await settle(page, 400);

  // 5) 소재 관리자
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await settle(page, 800);
  await page.screenshot({ path: "public/assets/help/resource.png" });
  await page.getByTestId("resource-modal").getByTestId("resource-modal-close").first().click().catch(() => {});
  await page.getByTestId("resource-modal").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  await settle(page, 400);
});

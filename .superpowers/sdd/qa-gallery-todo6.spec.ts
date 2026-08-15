// Todo 6 manual QA: virtualized gallery card grid in the real browser.
// 1280×800: DB modal → items tab (default gallery) → windowed card count (<133),
// click card → detail matches, screenshot. Resize 1024×768 → 3 columns.
import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:9183";

test("gallery items: windowed cards, click detail, 3 columns @1024", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-items").click({ force: true });
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);

  // 갤러리 기본값: 카드 렌더, 리스트 행 없음.
  const cards = page.locator(".db-gallery-card");
  await expect(cards.first()).toBeVisible();
  const cardCount = await cards.count();
  const rowCount = await page.locator(".db-list-row").count();
  console.log(`[qa] 1280x800 gallery cards=${cardCount} rows=${rowCount}`);

  // 133개 풀 프로젝트에서 카드 수는 윈도잉으로 전체보다 적어야 한다.
  const total = await page.evaluate(() => store?.getCurrent?.().database.items.length ?? 0).catch(() => 0);
  console.log(`[qa] items total=${total}`);
  expect(cardCount).toBeGreaterThan(0);
  expect(cardCount).toBeLessThan(133);

  // 카드 클릭 → 디테일 교체 + active 마킹.
  const firstCard = cards.first();
  const firstId = await firstCard.getAttribute("data-record-id");
  await firstCard.click();
  await expect(firstCard).toHaveClass(/active/);
  const detailText = await page.locator(".db-detail-pane").textContent();
  console.log(`[qa] clicked card id=${firstId} detailHasId=${detailText?.includes(firstId ?? "")}`);
  expect(detailText).toContain(firstId ?? "MISSING");

  // 갤러리 열 수 (모달 창 폭 기준).
  const columns = await page
    .locator(".db-list.db-gallery")
    .evaluate((el) => el.style.getPropertyValue("--db-gallery-columns"));
  console.log(`[qa] columns @1280 = ${columns}`);

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/gallery-items-1280.png" });

  // 1024×768 → 3열.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  const columns1024 = await page
    .locator(".db-list.db-gallery")
    .evaluate((el) => el.style.getPropertyValue("--db-gallery-columns"));
  console.log(`[qa] columns @1024 = ${columns1024}`);
  expect(columns1024).toBe("3");

  const allowedBridgeRefusal = "127.0.0.1:17831";
  const realErrors = consoleErrors.filter((e) => !e.includes(allowedBridgeRefusal));
  console.log(`[qa] console errors=${realErrors.length}`);
  expect(realErrors).toEqual([]);
});

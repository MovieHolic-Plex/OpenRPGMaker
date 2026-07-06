import { expect, test } from "@playwright/test";

// 지형 템플릿(교과서)은 DB → 타일셋 → 구성 탭으로 이사했다(2026-07-05).
// 툴바 "템플릿" 버튼은 이제 그 탭을 바로 연다.
test("terrain template section opens inside the tileset compose tab", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&terrainTemplateScroll=1");

  await page.getByTestId("toolbar-title-screen").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-tab-tilesets")).toHaveClass(/active/);
  await expect(page.getByTestId("tileset-section-tab-compose")).toHaveClass(/active/);
  await expect(page.getByTestId("terrain-template-section")).toBeVisible();
  await expect(page.getByTestId("terrain-template-agent-notice")).toContainText("AI 에이전트용 참고 자료");

  // 상세는 자체 스크롤 컨테이너 안에서 스크롤된다(모달 본문이 옆으로 새지 않게).
  const detailScrolls = await page.getByTestId("terrain-template-section").evaluate((node) => {
    const detail = node.querySelector(".terrain-template-section-detail");
    if (!(detail instanceof HTMLElement)) return null;
    return {
      overflowY: getComputedStyle(detail).overflowY,
      scrollable: detail.scrollHeight >= detail.clientHeight,
    };
  });
  expect(detailScrolls).not.toBeNull();
  expect(detailScrolls?.overflowY).toBe("auto");
  expect(detailScrolls?.scrollable).toBe(true);
});

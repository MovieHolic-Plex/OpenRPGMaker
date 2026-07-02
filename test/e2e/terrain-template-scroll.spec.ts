import { expect, test } from "@playwright/test";

test("terrain template modal body scrolls inside the window", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&terrainTemplateScroll=1");

  await page.getByTestId("toolbar-terrain-template").click();
  await expect(page.getByTestId("terrain-template-modal")).toBeVisible();
  await expect(page.getByTestId("terrain-template-agent-notice")).toContainText("AI 에이전트용 참고 자료");
  await expect(page.getByTestId("terrain-template-agent-notice")).toContainText("AI가 타일 구조를 해석");

  const scrollMetrics = await page.getByTestId("terrain-template-modal").evaluate(async (node) => {
    const body = node.querySelector(".terrain-template-modal-body");
    const rail = node.querySelector(".terrain-template-scrollbar");
    const thumb = node.querySelector(".terrain-template-scrollbar-thumb");
    if (!(body instanceof HTMLElement) || !(rail instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return null;
    body.scrollTop = 180;
    body.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    const railBox = rail.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();
    return {
      bodyClientHeight: body.clientHeight,
      bodyClientWidth: body.clientWidth,
      bodyOverflowY: getComputedStyle(body).overflowY,
      bodyOffsetWidth: body.offsetWidth,
      bodyScrollHeight: body.scrollHeight,
      bodyScrollTop: body.scrollTop,
      thumbHidden: thumb.hidden,
      thumbHeight: thumbBox.height,
      thumbOffsetTop: thumbBox.top - railBox.top,
      thumbWidth: thumbBox.width,
    };
  });

  expect(scrollMetrics).not.toBeNull();
  expect(scrollMetrics?.bodyOverflowY).toBe("scroll");
  expect(scrollMetrics?.bodyOffsetWidth).toBeGreaterThan(scrollMetrics?.bodyClientWidth ?? 0);
  expect(scrollMetrics?.bodyScrollHeight).toBeGreaterThan(scrollMetrics?.bodyClientHeight ?? 0);
  expect(scrollMetrics?.bodyScrollTop).toBeGreaterThan(0);
  expect(scrollMetrics?.thumbHidden).toBe(false);
  expect(scrollMetrics?.thumbHeight).toBeGreaterThan(48);
  expect(scrollMetrics?.thumbOffsetTop).toBeGreaterThan(0);
  expect(scrollMetrics?.thumbWidth).toBeGreaterThan(8);
});

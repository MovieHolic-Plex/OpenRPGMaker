import { expect, test, type Page } from "@playwright/test";

async function dismissChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "beginner");
    localStorage.removeItem("oprn:workspace:v1");
  });
  await page.goto("/?freshProject=1&authoringJourney=1");
  await dismissChrome(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissChrome(page);
}

test("1024px launcher reaches real surfaces and journey stays a corner chip", async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);

  // 작업 칩은 2026-09-03 에 걷었다 — 자료집은 초보에서 도구 메뉴, ▶ 테스트는 톱바 오른쪽이 집이다.
  await expect(page.getByTestId("authoring-task-launcher")).toHaveCount(0);
  await expect(page.getByTestId("mode-play")).toBeVisible();

  const toggle = page.getByTestId("authoring-journey-toggle");
  await expect(toggle).toBeVisible();
  await expect(page.getByTestId("authoring-journey-strip")).toBeHidden();
  const closedBox = await page.getByTestId("authoring-journey").boundingBox();
  expect(closedBox).not.toBeNull();
  expect(closedBox!.width).toBeLessThanOrEqual(48);
  expect(closedBox!.height).toBeLessThanOrEqual(48);
  expect(closedBox!.x + closedBox!.width).toBeLessThanOrEqual(1024);

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("database-modal-close").click();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const strip = page.getByTestId("authoring-journey-strip");
  await expect(strip).toBeVisible();
  await expect(page.getByTestId("authoring-journey-stage-test")).toHaveAttribute("data-completion", "pending");

  const metrics = await strip.evaluate((root) => ({
    evidenceFontSizes: [...root.querySelectorAll<HTMLElement>(".authoring-journey-evidence")]
      .map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    targets: [...root.querySelectorAll<HTMLElement>(".authoring-journey-task, .authoring-journey-manual")].map((node) => {
      const rect = node.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      return {
        clipped: rect.left < rootRect.left || rect.right > rootRect.right || rect.top < rootRect.top || rect.bottom > rootRect.bottom,
        height: rect.height,
        testid: node.dataset.testid,
        width: rect.width,
      };
    }),
  }));
  expect(Math.min(...metrics.evidenceFontSizes)).toBeGreaterThanOrEqual(11);
  expect(metrics.targets).not.toEqual([]);
  for (const target of metrics.targets) {
    expect(target.clipped, target.testid).toBe(false);
    expect(target.width, target.testid).toBeGreaterThanOrEqual(24);
    expect(target.height, target.testid).toBeGreaterThanOrEqual(24);
  }
});

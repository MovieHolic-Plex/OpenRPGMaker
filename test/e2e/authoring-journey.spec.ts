import { expect, test, type Page } from "@playwright/test";

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "beginner");
    localStorage.removeItem("oprn:workspace:v1");
  });
  await page.goto("/?freshProject=1&authoringJourney=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
}

test("1024px launcher reaches real surfaces and journey needs player boot evidence", async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);

  for (const task of ["map", "event", "data", "test"]) {
    await expect(page.getByTestId(`authoring-task-${task}`)).toBeVisible();
  }
  const journey = page.getByTestId("authoring-journey");
  await expect(journey).toBeVisible();
  await expect(page.getByTestId("authoring-journey-stage-test")).toHaveAttribute("data-completion", "pending");

  await page.getByTestId("authoring-task-event").click();
  await expect(page.locator("body")).toHaveClass(/editor-ui-beginner/);
  await expect(page.getByTestId("editor-statusbar")).toContainText("이벤트 레이어");

  await page.getByTestId("authoring-task-map").click();
  await expect(page.locator("body")).toHaveClass(/editor-ui-beginner/);
  await expect(page.getByTestId("editor-statusbar")).toContainText("바닥 레이어");

  await page.getByTestId("authoring-task-data").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("database-modal-close").click();

  await expect(page.getByTestId("authoring-journey-stage-test")).toHaveAttribute("data-completion", "pending");
  await page.getByTestId("authoring-task-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("authoring-journey-stage-test")).toHaveAttribute("data-completion", "test-boot");

  const box = await journey.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
});

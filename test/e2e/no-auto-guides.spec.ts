import { expect, test } from "@playwright/test";

// 왼쪽 열의 그리기 도구·붓 옵션·선택 타일은 접힌 「붓 설정」 안에 있다(2026-11-03) — 이 스펙은 그걸 직접 누르므로 펴 두고 시작한다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:brush-settings-open", "1"));
});


test.use({ browserName: "firefox", launchOptions: {} });
test.setTimeout(180_000);

test("fresh editor stays usable without automatic guides", async ({ page }) => {
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tool-erase").click();
  await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "erase");

  await expect(page.locator(".coach-mark-card")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("oprn:standard-welcome-seen"))).toBeNull();

  await page.getByTestId("tool-paint").click();
  await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "paint");
  await expect(page.getByTestId("tool-paint")).toBeVisible();
});

/**
 * First-visit world previews before the first AI sentence.
 *
 * Run:
 *   npx playwright test test/e2e/director-first-briefing.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("verify-shots/first-visit-mockup");
const LAYOUT_KEYS = [
  "oprn:editor-layout",
  "oprn:editor-layout:v2",
  "oprn:editor-layout:v3",
  "oprn:editor-layout:v4",
] as const;

mkdirSync(EVIDENCE, { recursive: true });

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 8_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 12_000 });
}

async function bootBriefing(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((keys) => {
    localStorage.removeItem("oprn:editor-ui-mode");
    localStorage.removeItem("oprn:ai-panel-collapsed");
    localStorage.removeItem("oprn:coachmarks-basic-v1");
    localStorage.removeItem("oprn:standard-welcome-seen");
    localStorage.removeItem("oprn:editor-welcome-dismissed");
    for (const key of keys) localStorage.removeItem(key);
  }, LAYOUT_KEYS);
  await page.goto("/?forceWelcome=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("editor-welcome")).toBeVisible({ timeout: 15_000 });
}

test.describe("director first briefing", () => {
  test.describe.configure({ timeout: 60_000 });

  test("previews a world before opening the first sentence without connecting AI", async ({ page }) => {
    await bootBriefing(page);

    await expect(page.getByTestId("editor-welcome")).toContainText("먼저 들어가 보세요.");
    await expect(page.getByTestId("editor-welcome-prompt-input")).toBeHidden();
    await expect(page.getByTestId("editor-welcome-skip")).toHaveText("빈 맵으로 시작");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toContainText("몬스터 수집");
    await expect(page.getByTestId("editor-welcome-template-card-1")).toContainText("회상 스토리");
    await expect(page.getByTestId("editor-welcome-template-card-2")).toContainText("모험 JRPG");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-template-card-3")).toHaveCount(0);
    await expect(page.getByTestId("editor-welcome-more-toggle")).toHaveCount(0);

    const featuredPackIds = ["monster-collect", "story-cutscene", "adventure-jrpg"];
    const renderedPackIds = await page.locator("[data-pack-id]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.packId),
    );
    expect(renderedPackIds).toEqual(featuredPackIds);
    for (const packId of featuredPackIds) {
      await expect(page.locator(`[data-pack-id='${packId}']`)).toHaveCount(1);
    }
    for (const presetId of ["partner-raise", "school-horror", "horror-gallery", "farm-life", "action-rpg"]) {
      await expect(page.locator(`[data-preset-id='${presetId}']`)).toHaveCount(0);
    }

    await expect(page.getByTestId("ai-command-bar")).toBeHidden();
    await expect(page.getByTestId("ai-next-steps")).toBeHidden();
    await expect(page.locator(".coach-mark-card")).toHaveCount(0);

    await page.getByTestId("editor-welcome-template-card-0").click();
    await expect(page.getByTestId("editor-welcome-prompt-input")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toHaveText("이 이야기로 시작 ↗");
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toBeDisabled();
    await page.getByTestId("editor-welcome-prompt-input").fill("구름 위에서 작은 몬스터와 함께 떠나는 모험");
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toBeEnabled();
    await expect(page.getByTestId("ai-connect-gate")).toHaveCount(0);

    await page.screenshot({
      path: path.join(EVIDENCE, "C-featured-idle.png"),
      animations: "disabled",
    });
  });

  test("skip dismisses the briefing and restores the composer", async ({ page }) => {
    await bootBriefing(page);
    await page.getByTestId("editor-welcome-skip").click();
    await expect(page.getByTestId("editor-welcome")).toHaveCount(0);
    await expect(page.getByTestId("ai-command-bar")).toBeVisible();
  });
});

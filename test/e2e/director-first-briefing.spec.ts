/**
 * First-visit director briefing on the live map.
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

  test("opens on the live map as a poster gallery with one anchor per pack", async ({ page }) => {
    await bootBriefing(page);

    await expect(page.getByTestId("editor-welcome")).toContainText("어떤 게임을 만들까요?");
    await expect(page.getByTestId("editor-welcome-prompt-input")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toHaveText("만들기");
    await expect(page.getByTestId("editor-welcome-skip")).toHaveText("빈 맵으로 시작");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toContainText("몬스터 수집");
    await expect(page.getByTestId("editor-welcome-template-card-1")).toContainText("회상 스토리");
    await expect(page.getByTestId("editor-welcome-template-card-2")).toContainText("모험 JRPG");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-template-card-3")).toBeHidden();
    await expect(page.getByTestId("editor-welcome-template-card-4")).toBeHidden();
    await expect(page.getByTestId("editor-welcome-template-card-5")).toBeHidden();
    await expect(page.getByTestId("editor-welcome-template-card-6")).toBeHidden();

    // One anchor poster per official pack; variants of the same pack are peers without data-pack-id.
    const featuredPackIds = ["monster-collect", "story-cutscene", "adventure-jrpg"];
    const collapsedPackIds = ["horror-chase", "farm-life"];
    const renderedPackIds = await page.locator("[data-pack-id]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.packId),
    );
    expect(renderedPackIds).toEqual([...featuredPackIds, ...collapsedPackIds]);
    for (const packId of [...featuredPackIds, ...collapsedPackIds]) {
      await expect(page.locator(`[data-pack-id='${packId}']`)).toHaveCount(1);
    }
    for (const presetId of ["partner-raise", "school-horror"]) {
      await expect(page.locator(`[data-preset-id='${presetId}']:not([data-pack-id])`)).toHaveCount(1);
    }

    // Second tier is collapsed, and the assistant's own "빈 맵이에요" onboarding stays out of the way.
    await expect(page.getByTestId("editor-welcome-more-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#editor-welcome-more-grid")).toBeHidden();
    await expect(page.getByTestId("ai-command-bar")).toBeHidden();
    await expect(page.getByTestId("ai-next-steps")).toBeHidden();
    await expect(page.locator(".coach-mark-card")).toHaveCount(0);

    await page.screenshot({
      path: path.join(EVIDENCE, "C-featured-idle.png"),
      animations: "disabled",
    });

    await page.getByTestId("editor-welcome-more-toggle").click();
    await expect(page.locator("#editor-welcome-more-grid")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-template-card-3")).toContainText("갤러리 호러");
    await expect(page.getByTestId("editor-welcome-template-card-4")).toContainText("학교 호러");
    await expect(page.getByTestId("editor-welcome-template-card-5")).toContainText("농장 생활");
    await expect(page.getByTestId("editor-welcome-template-card-6")).toContainText("파트너 육성");
    await expect(page.getByTestId("editor-welcome-more-card-0")).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE, "C-proposed-idle.png"),
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

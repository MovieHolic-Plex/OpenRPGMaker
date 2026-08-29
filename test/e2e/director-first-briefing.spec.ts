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

  test("opens on the live map with each canonical pack exactly once", async ({ page }) => {
    await bootBriefing(page);

    await expect(page.getByTestId("editor-welcome")).toContainText("어떤 게임을 만들까요?");
    await expect(page.getByTestId("editor-welcome-prompt-input")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toHaveText("만들기");
    await expect(page.getByTestId("editor-welcome-skip")).toHaveText("빈 맵으로 시작");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toContainText("모험 마을");
    await expect(page.getByTestId("editor-welcome-template-card-1")).toContainText("몬스터 수집");
    await expect(page.getByTestId("editor-welcome-template-card-2")).toContainText("호러 추격");
    await expect(page.getByTestId("editor-welcome-template-card-3")).toContainText("스토리 컷신");
    await expect(page.getByTestId("editor-welcome-template-card-4")).toContainText("농장 하루");

    const canonicalPackIds = [
      "adventure-jrpg",
      "monster-collect",
      "horror-chase",
      "story-cutscene",
      "farm-life",
    ];
    const renderedPackIds = await page.locator("[data-pack-id]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.packId),
    );
    expect(renderedPackIds).toEqual(canonicalPackIds);
    for (const packId of canonicalPackIds) {
      await expect(page.locator(`[data-pack-id='${packId}']`)).toHaveCount(1);
    }
    await expect(page.locator("[data-pack-id='monster-collect'] [data-preset-id='partner-raise']")).toHaveCount(1);
    await expect(page.locator("[data-pack-id='horror-chase'] [data-preset-id='school-horror']")).toHaveCount(1);
    await expect(page.getByTestId("editor-welcome-inspiration")).toHaveCount(2);
    await expect(page.getByTestId("ai-command-bar")).toBeHidden();
    await expect(page.locator(".coach-mark-card")).toHaveCount(0);

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

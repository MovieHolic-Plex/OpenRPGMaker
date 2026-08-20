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
  "rpg-zzu:editor-layout",
  "rpg-zzu:editor-layout:v2",
  "rpg-zzu:editor-layout:v3",
  "rpg-zzu:editor-layout:v4",
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
    localStorage.removeItem("rpg-zzu:editor-ui-mode");
    localStorage.removeItem("rpg-zzu:ai-panel-collapsed");
    localStorage.removeItem("rpg-zzu:coachmarks-basic-v1");
    localStorage.removeItem("rpgzzu:standard-welcome-seen");
    localStorage.removeItem("rpg-zzu:editor-welcome-dismissed");
    for (const key of keys) localStorage.removeItem(key);
  }, LAYOUT_KEYS);
  await page.goto("/?forceWelcome=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("editor-welcome")).toBeVisible({ timeout: 15_000 });
}

test.describe("director first briefing", () => {
  test.describe.configure({ timeout: 60_000 });

  test("opens on the live map with one prompt and three result cards", async ({ page }) => {
    await bootBriefing(page);

    await expect(page.getByTestId("editor-welcome")).toContainText("어떤 게임을 만들까요?");
    await expect(page.getByTestId("editor-welcome-prompt-input")).toBeVisible();
    await expect(page.getByTestId("editor-welcome-prompt-submit")).toHaveText("만들기");
    await expect(page.getByTestId("editor-welcome-skip")).toHaveText("빈 맵으로 시작");
    await expect(page.getByTestId("editor-welcome-template-card-0")).toContainText("모험 마을");
    await expect(page.getByTestId("editor-welcome-template-card-1")).toContainText("농장 하루");
    await expect(page.getByTestId("editor-welcome-template-card-2")).toContainText("몬스터 수집");
    await expect(page.getByTestId("editor-welcome-inspiration")).toHaveCount(0);
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

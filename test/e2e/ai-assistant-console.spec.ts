/**
 * 감독 console contract. No live LLM. No Supabase.
 *
 * Run:
 *   DEV_SERVER_PORT=9183 npx playwright test test/e2e/ai-assistant-console.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/ai-assistant-ux-overhaul");
const PANEL_COLLAPSED_KEY = "rpg-zzu:ai-panel-collapsed";
const COACH_KEY = "rpg-zzu:coachmarks-basic-v1";
const UI_MODE_KEY = "rpg-zzu:editor-ui-mode";
const LAYOUT_KEYS = [
  "rpg-zzu:editor-layout",
  "rpg-zzu:editor-layout:v2",
  "rpg-zzu:editor-layout:v3",
  "rpg-zzu:editor-layout:v4",
] as const;
const VIEWPORTS = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const;

mkdirSync(EVIDENCE, { recursive: true });

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  const guestVisible = await guest.isVisible({ timeout: 5_000 }).catch(() => false);
  if (guestVisible) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function dismissStandardWelcome(page: Page): Promise<void> {
  const start = page.getByTestId("standard-welcome-start");
  const appeared = await start.isVisible({ timeout: 3_000 }).catch(() => false);
  if (appeared) await start.click();
  await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
}

async function bootFirstVisit(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ layoutKeys, collapsedKey, coachKey, uiModeKey }) => {
    localStorage.setItem(uiModeKey, "standard");
    localStorage.setItem(coachKey, "1");
    localStorage.removeItem(collapsedKey);
    for (const key of layoutKeys) localStorage.removeItem(key);
  }, {
    layoutKeys: LAYOUT_KEYS,
    collapsedKey: PANEL_COLLAPSED_KEY,
    coachKey: COACH_KEY,
    uiModeKey: UI_MODE_KEY,
  });
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissStandardWelcome(page);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(EVIDENCE, `task-14-${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

async function assertFloatComposerOnly(page: Page): Promise<void> {
  const floatHost = page.getByTestId("chat-float-host");
  await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
  expect(await floatHost.locator(".ai-chat-log").count()).toBe(0);
  expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);
  expect(await page.getByTestId("ai-start-visual-gallery").count()).toBe(0);
  expect(await page.getByTestId("ai-empty-cta").count()).toBe(0);
}

async function assertEmptyQueueHidden(page: Page): Promise<void> {
  const queue = page.getByTestId("ai-pending-queue");
  await expect(queue).toBeHidden();
  expect(await queue.evaluate((node) => getComputedStyle(node).display)).toBe("none");
}

test.describe("AI 감독 console contract", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of VIEWPORTS) {
    // Break: first-visit still collapsed, float still mounts start gallery / chat log,
    // slash stacks on start-screen, menu click needs force, empty queue is visible,
    // restore is 🤖, or plate title is still AI 어시스턴트.
    test(`first visit opens the 감독 console at ${viewport.name}`, async ({ page }) => {
      await bootFirstVisit(page, viewport.width, viewport.height);

      const panel = page.getByTestId("ai-panel");
      await expect(panel).not.toHaveClass(/is-collapsed/);
      await expect(page.getByTestId("ai-command-bar")).toBeVisible();
      expect(await page.evaluate((key) => localStorage.getItem(key), PANEL_COLLAPSED_KEY)).toBeNull();
      await assertFloatComposerOnly(page);
      await assertEmptyQueueHidden(page);
      await shot(page, `first-visit-${viewport.name}`);

      await page.getByTestId("ai-input").fill("/");
      await expect(page.getByTestId("ai-slash-list")).toBeVisible();
      expect(
        await page.locator("[data-testid='ai-rising-overlay'] [data-testid='ai-start-screen']").count(),
      ).toBe(0);
      expect(await page.getByTestId("ai-start-visual-gallery").count()).toBe(0);
      await shot(page, `slash-${viewport.name}`);
      await page.getByTestId("ai-input").fill("");

      await page.getByTestId("ai-command-menu-toggle").click();
      await page.getByTestId("ai-command-menu-dock").click();
      const sidePanel = page.getByTestId("chat-side-panel");
      await expect(sidePanel.getByTestId("ai-panel")).toBeVisible();
      await expect(sidePanel.getByTestId("ai-director-plate")).toBeVisible();
      await expect(sidePanel.getByTestId("ai-director-plate").locator("h2")).toHaveText("감독");
      await expect(sidePanel.getByTestId("ai-director-plate")).not.toContainText("🤖");
      await assertEmptyQueueHidden(page);
      await shot(page, `side-plate-${viewport.name}`);

      await page.getByTestId("ai-collapse").click();
      const restore = page.getByTestId("ai-collapsed-restore");
      await expect(restore).toBeVisible();
      await expect(restore).toHaveAttribute("aria-label", "AI 어시스턴트");
      await expect(restore).not.toContainText("🤖");
      const restoreBox = await restore.boundingBox();
      expect(restoreBox?.width ?? 0).toBeGreaterThanOrEqual(48);
      expect(restoreBox?.height ?? 0).toBeGreaterThanOrEqual(48);
      await shot(page, `restore-${viewport.name}`);
    });
  }
});

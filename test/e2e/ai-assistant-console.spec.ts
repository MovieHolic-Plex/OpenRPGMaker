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
const PANEL_COLLAPSED_KEY = "oprn:ai-panel-collapsed";
const COACH_KEY = "oprn:coachmarks-basic-v1";
const UI_MODE_KEY = "oprn:editor-ui-mode";
const LAYOUT_KEYS = [
  "oprn:editor-layout",
  "oprn:editor-layout:v2",
  "oprn:editor-layout:v3",
  "oprn:editor-layout:v4",
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
  // 로그 요소는 조수 덱 안에 **있다**(ai-deck > ai-chat-body > ai-glass-log > .ai-chat-log).
  // 계약은 「없다」가 아니라 「첫 방문에 보이지 않는다」다 — 비어 있는 덱이 접혀 있기 때문이다.
  // 예전 단언(count === 0)은 도크 축을 걷은 뒤(c67743607) 실측과 어긋난 채 남아 있었다.
  const log = floatHost.locator(".ai-chat-log");
  expect(await log.count()).toBe(1);
  await expect(log).not.toBeVisible();
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

      // 스킬 기능 제거 후 `/` 는 평범한 텍스트다 — 슬래시 팝오버가 다시 생기면 회귀다.
      await page.getByTestId("ai-input").fill("/");
      expect(await page.getByTestId("ai-slash-list").count()).toBe(0);
      expect(
        await page.locator("[data-testid='ai-rising-overlay'] [data-testid='ai-start-screen']").count(),
      ).toBe(0);
      expect(await page.getByTestId("ai-start-visual-gallery").count()).toBe(0);
      await shot(page, `slash-${viewport.name}`);
      await page.getByTestId("ai-input").fill("");

      // 도크 축은 2026-08-31(c67743607)에 걷혔다 — 조수가 붙을 자리는 플로팅 하나뿐이고
      // 전환 진입점 5개(chat-dock-toggle·ai-dock-mode-btn·ai-chat-detach·ai-more-dock·
      // ai-command-menu-dock)와 chatDock.ts 가 함께 지워졌다. 이 스펙은 그때 갱신되지 않아
      // 없는 버튼을 30초 기다리다 죽고 있었다. 부재를 계약으로 고정한다.
      await page.getByTestId("ai-command-menu-toggle").click();
      const commandMenu = page.getByTestId("ai-command-menu");
      await expect(commandMenu).toBeVisible();
      expect(await page.getByTestId("ai-command-menu-dock").count()).toBe(0);
      expect(await page.getByTestId("chat-dock-toggle").count()).toBe(0);
      expect(await page.getByTestId("ai-dock-mode-btn").count()).toBe(0);
      expect(await page.getByTestId("chat-side-panel").count()).toBe(0);
      // 헤더 명패(ai-director-plate)는 2026-08-28 에 폐기됐다 — 조수의 얼굴을 노출하지 않는다.
      // 부재를 계약으로 고정해 두어야 되살아나는 것을 잡는다.
      const panelHost = page.getByTestId("chat-float-host");
      expect(await panelHost.getByTestId("ai-director-plate").count()).toBe(0);
      expect(await panelHost.getByTestId("ai-director-face").count()).toBe(0);
      await expect(panelHost.getByTestId("ai-panel")).not.toContainText("🤖");
      await page.keyboard.press("Escape");
      await assertEmptyQueueHidden(page);
      await shot(page, `single-dock-${viewport.name}`);

      // 접기 버튼은 화면에 없다(숨은 훅 컨테이너로 옮겼다). 검사 대상은 버튼의 가시성이 아니라
      // **접기 상태 기계**이므로 DOM 으로 직접 눌러 같은 경로를 태운다.
      await page.getByTestId("ai-collapse").evaluate((n) => (n as HTMLButtonElement).click());
      const restore = page.getByTestId("ai-collapsed-restore");
      await expect(restore).toBeVisible();
      await expect(restore).toHaveAttribute("aria-label", "조수");
      await expect(restore).not.toContainText("🤖");
      const restoreBox = await restore.boundingBox();
      expect(restoreBox?.width ?? 0).toBeGreaterThanOrEqual(48);
      expect(restoreBox?.height ?? 0).toBeGreaterThanOrEqual(48);
      await shot(page, `restore-${viewport.name}`);
    });
  }
});

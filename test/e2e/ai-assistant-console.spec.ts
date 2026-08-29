/**
 * 감독 console contract. No live LLM. No Supabase.
 *
 * 조수 띠(스펙 §1)로 넘어오며 이 파일에서 두 축이 빠졌다.
 *   - **접힘**: `is-collapsed` / `ai-collapse` / `ai-collapsed-restore` / `oprn:ai-panel-collapsed`.
 *     띠는 유휴 56px 로 상주하므로 접을 것이 없다. 첫 방문 상태를 재던 자리는 "유휴 띠가
 *     컴포저를 보여 준다" 로 바뀌었다.
 *   - **배치**: `ai-command-menu-dock` 으로 `chat-side-panel` 로 옮겨 다시 재던 블록.
 *     표면이 하나라 옮길 곳이 없다 — 대신 조수가 `chat-float-host` 를 떠나지 않는다는 것을
 *     계약으로 남긴다(`chat-side-panel` 은 다른 패널들이 아직 쓰는 워크스페이스 도크다).
 *
 * 반대로 **부재 계약은 그대로 남긴다**: `ai-slash-list` · `ai-start-visual-gallery` ·
 * `ai-empty-cta` · `ai-start-screen` · `ai-director-plate` · `ai-director-face` 는 모두
 * 의도적으로 삭제된 것들이고, 되살아나면 회귀다.
 *
 * Run:
 *   DEV_SERVER_PORT=9183 npx playwright test test/e2e/ai-assistant-console.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/ai-assistant-ux-overhaul");
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
  await page.addInitScript(({ layoutKeys, coachKey, uiModeKey }) => {
    localStorage.setItem(uiModeKey, "standard");
    localStorage.setItem(coachKey, "1");
    for (const key of layoutKeys) localStorage.removeItem(key);
  }, {
    layoutKeys: LAYOUT_KEYS,
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

/**
 * 유휴 띠: `chat-float-host` 안에 컴포저만 **보인다**.
 *
 * 옛 `assertFloatComposerOnly` 는 로그·오버레이의 **개수**를 0 으로 재고 있었다. 그때는
 * float 도크가 컴포저만 마운트했기 때문인데, 띠는 둘을 항상 마운트하고 유휴에서 CSS 로
 * 문서에서 뺀다(`display: none` · `hidden`). 그래서 개수가 아니라 가시성을 재야 한다 —
 * 개수로 재면 지금 구현이 "회귀"로 잡히고, 정작 유휴에 빈 로그 껍데기가 펼쳐지는
 * 실제 결함(구 600px 공백)은 통과한다.
 */
async function assertIdleStrip(page: Page): Promise<void> {
  const floatHost = page.getByTestId("chat-float-host");
  const panel = floatHost.getByTestId("ai-panel");
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveClass(/is-risen/);
  await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
  await expect(floatHost.getByTestId("ai-input")).toBeVisible();
  await expect(floatHost.getByTestId("ai-send")).toBeVisible();
  await expect(floatHost.getByTestId("ai-rising-overlay")).toBeHidden();
  await expect(floatHost.locator(".ai-chat-log")).toBeHidden();
  // 삭제된 시작 화면 3종은 되살아나지 않는다.
  expect(await page.getByTestId("ai-start-visual-gallery").count()).toBe(0);
  expect(await page.getByTestId("ai-empty-cta").count()).toBe(0);
  expect(await page.getByTestId("ai-start-screen").count()).toBe(0);
}

async function assertEmptyQueueHidden(page: Page): Promise<void> {
  const queue = page.getByTestId("ai-pending-queue");
  await expect(queue).toBeHidden();
  expect(await queue.evaluate((node) => getComputedStyle(node).display)).toBe("none");
}

test.describe("AI 감독 console contract", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of VIEWPORTS) {
    // Break: 첫 방문에 띠가 안 보이거나, 유휴에 로그/오버레이가 펼쳐지거나,
    // 슬래시 팝오버가 되살아나거나, 빈 대기열이 보이거나, 조수의 얼굴이 돌아오거나,
    // 조수가 `chat-float-host` 를 떠나면 회귀.
    test(`first visit opens the 감독 console at ${viewport.name}`, async ({ page }) => {
      await bootFirstVisit(page, viewport.width, viewport.height);

      await assertIdleStrip(page);
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

      // 조수의 얼굴(명패 · 아바타 · 🤖)은 2026-08-28 에 폐기됐다. 부재를 계약으로 고정한다.
      const panel = page.getByTestId("ai-panel");
      expect(await panel.getByTestId("ai-director-plate").count()).toBe(0);
      expect(await panel.getByTestId("ai-director-face").count()).toBe(0);
      await expect(panel).not.toContainText("🤖");

      // 조수는 캔버스 안 부유 호스트에만 산다 — 워크스페이스 사이드 도크로 새지 않는다.
      expect(await page.locator("[data-testid='chat-side-panel'] [data-testid='ai-panel']").count()).toBe(0);
      await assertEmptyQueueHidden(page);
      await shot(page, `strip-${viewport.name}`);
    });
  }
});

import { expect, test, type Locator, type Page } from "@playwright/test";

const EDITOR_LAYOUT_KEY = "rpg-zzu:editor-layout:v4";
const PANEL_COLLAPSED_KEY = "rpg-zzu:ai-panel-collapsed";
const MAP_FIRST_KEY = "rpg-zzu:ai-map-first-collapse-v1";

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

// 로그인 모달은 앱 부팅 후 비동기로 뜨고, reload 후에도 다시 뜬다(게스트 세션 비유지).
// 모달이 떠 있으면 백드롭이 모든 클릭을 가로채므로 사라질 때까지 확실히 닫는다.
async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  try {
    await guest.waitFor({ state: "visible", timeout: 5_000 });
    await guest.click();
  } catch {
    // 모달이 안 떴으면 이미 로그인된 상태.
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function openEditor(page: Page): Promise<void> {
  // addInitScript는 모든 내비게이션(reload 포함)에서 실행되므로, 테스트 중간에 심은
  // localStorage 상태를 지워버리지 않도록 첫 로드에서만 초기화한다(sessionStorage 가드).
  await page.addInitScript(({ layoutKey }) => {
    if (sessionStorage.getItem("chat-dock-e2e-cleared")) return;
    sessionStorage.setItem("chat-dock-e2e-cleared", "1");
    localStorage.removeItem(layoutKey);
  }, { layoutKey: EDITOR_LAYOUT_KEY });
  await page.goto("/?chatDockSwitch=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  // First visit boots open; restore click is a no-op if already expanded.
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) {
    await restore.click();
  }
  await expect(page.getByTestId("ai-command-bar")).toBeVisible();
}

async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function expectInside(inner: Box, outer: Box, tolerance = 2): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + tolerance);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + tolerance);
}

async function layoutDock(page: Page): Promise<string | undefined> {
  return await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { chatDock?: string };
    return parsed.chatDock;
  }, EDITOR_LAYOUT_KEY);
}

async function assertInputUsable(page: Page, value: string): Promise<void> {
  const input = page.getByTestId("ai-input");
  await expect(input).toBeVisible();
  await input.fill(value);
  await expect(input).toHaveValue(value);
  await expect(input).toBeFocused();
}

test.describe("chat dock switch", () => {
  test("float default, side toggle, DOM preservation, focus, and resize bounds", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const commandBar = page.getByTestId("ai-command-bar");
    const sidePanel = page.getByTestId("chat-side-panel");
    const floatHost = page.getByTestId("chat-float-host");
    await expect(floatHost.getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-chat-dock-float"))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-panel-docked"))).toBe(false);
    await assertInputUsable(page, "float input ok");
    await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
    expect(await floatHost.locator(".ai-chat-log").count()).toBe(0);
    expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);

    // float 기본: 커맨드바는 캔버스 안에 떠 있다.
    const canvasFloat = await box(canvas);
    const commandFloat = await box(commandBar);
    expectInside(commandFloat, canvasFloat);

    await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="ai-panel"]');
      const marker = document.createElement("div");
      marker.dataset.testid = "dock-marker";
      marker.textContent = "dock marker";
      panel?.append(marker);
    });
    await expect(page.getByTestId("dock-marker")).toBeAttached();

    // float 모드: 커맨드바 ☰ 메뉴로 사이드 전환
    // After input/log interaction the rising overlay can cover the idle hamburger.
    await page.getByTestId("ai-command-menu-toggle").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("ai-command-menu-dock").click();
    await expect(sidePanel.getByTestId("ai-panel")).toBeVisible();
    await expect(page.getByTestId("dock-marker")).toBeAttached();
    await expect(sidePanel.getByTestId("ai-chat-log")).toBeAttached();
    await expect.poll(() => layoutDock(page)).toBe("side");
    await assertInputUsable(page, "side input ok");

    // 사이드 도크는 브리핑 폭(레이아웃의 약 1/4, 상한 360).
    const sideBox = await box(sidePanel);
    const layoutBox = await box(page.locator(".editor-layout"));
    expect(sideBox.width).toBeGreaterThan(260);
    expect(sideBox.width).toBeLessThan(layoutBox.width * 0.36);
    expect(sideBox.height).toBeGreaterThan(layoutBox.height * 0.7);
    const canvasSide = await box(canvas);
    expect(canvasSide.width).toBeLessThan(canvasFloat.width - 80);

    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => layoutDock(page)).toBe("side");

    // side 모드: 더보기 메뉴로 float 복귀
    await page.getByTestId("ai-more-menu-toggle").click();
    await page.getByTestId("ai-more-dock").click();
    await expect(page.getByTestId("chat-float-host").getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => layoutDock(page)).toBe("float");
    await assertInputUsable(page, "float after toggle ok");

    await page.setViewportSize({ width: 1100, height: 820 });
    const canvasNarrow = await box(canvas);
    const commandNarrow = await box(commandBar);
    expectInside(commandNarrow, canvasNarrow);
  });

  // Break: float still mounts .ai-chat-log / ai-rising-overlay under chat-float-host
  // (even if CSS display:none hides them).
  test("1440 float host is composer-only and side remounts the work log", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);

    const floatHost = page.getByTestId("chat-float-host");
    await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
    expect(await floatHost.locator(".ai-chat-log").count()).toBe(0);
    expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);
    await page.screenshot({ path: ".omo/evidence/ai-assistant-ux-overhaul/task-12-float.png" });

    await page.getByTestId("ai-command-menu-toggle").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("ai-command-menu-dock").click();

    const sidePanel = page.getByTestId("chat-side-panel");
    await expect(sidePanel.getByTestId("ai-panel")).toBeVisible();
    await expect(sidePanel.getByTestId("ai-chat-log")).toBeAttached();
    expect(await floatHost.locator(".ai-chat-log").count()).toBe(0);
  });

  // Break: omit .ai-command-menu:not([hidden]) { z-index: 2 } or
  // .ai-command-bar:has(.ai-command-menu:not([hidden])) { z-index: 42 }
  // → Playwright click times out (overlay / input-stack intercepts the dock item).
  test("hamburger dock item is clickable above composer and overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    await expect(page.getByTestId("chat-float-host").getByTestId("ai-panel")).toBeVisible();
    await page.getByTestId("ai-command-menu-toggle").click();
    await page.screenshot({ path: ".omo/evidence/ai-assistant-ux-overhaul/task-2-menu.png" });
    await page.getByTestId("ai-command-menu-dock").click();

    await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-chat-dock-side"))).toBe(true);
  });

  test("collapsed float and side combinations stay compact and restorable", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    await page.evaluate(({ layoutKey, collapsedKey }) => {
      localStorage.setItem(layoutKey, JSON.stringify({ chatDock: "float" }));
      localStorage.setItem(collapsedKey, "1");
    }, { layoutKey: EDITOR_LAYOUT_KEY, collapsedKey: PANEL_COLLAPSED_KEY });
    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

    const canvas = page.locator(".canvas-area");
    const panel = page.getByTestId("ai-panel");
    await expect(panel).toHaveClass(/is-collapsed/);
    await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();
    const collapsedFloat = await box(panel);
    const canvasBox = await box(canvas);
    expect(collapsedFloat.width * collapsedFloat.height).toBeLessThan(canvasBox.width * canvasBox.height * 0.2);
    await expect(page.getByTestId("ai-command-bar")).toBeHidden();

    await page.getByTestId("ai-collapsed-restore").click();
    await assertInputUsable(page, "restored float ok");
    // Idle overlay can cover the hamburger; keyboard activation still opens the menu.
    // Once open, z-index 42 puts the dock item above the overlay — click without force.
    await page.getByTestId("ai-command-menu-toggle").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("ai-command-menu-dock").click();
    await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();

    await page.getByTestId("ai-collapse").click();
    await expect(panel).toHaveClass(/is-collapsed/);
    const collapsedSide = await box(panel);
    expect(collapsedSide.width).toBeLessThan(90);
    await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();

    await page.getByTestId("ai-collapsed-restore").click();
    await expect(panel).not.toHaveClass(/is-collapsed/);
    await assertInputUsable(page, "restored side ok");
  });
});

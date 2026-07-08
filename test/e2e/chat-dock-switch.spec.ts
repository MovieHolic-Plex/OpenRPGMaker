import { expect, test, type Locator, type Page } from "@playwright/test";

const EDITOR_LAYOUT_KEY = "rpg-zzu:editor-layout";
const PANEL_COLLAPSED_KEY = "rpg-zzu:ai-panel-collapsed";

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
  await page.addInitScript(({ layoutKey, collapsedKey }) => {
    if (sessionStorage.getItem("chat-dock-e2e-cleared")) return;
    sessionStorage.setItem("chat-dock-e2e-cleared", "1");
    localStorage.removeItem(layoutKey);
    localStorage.removeItem(collapsedKey);
  }, { layoutKey: EDITOR_LAYOUT_KEY, collapsedKey: PANEL_COLLAPSED_KEY });
  await page.goto("/?chatDockSwitch=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
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
  test("float default, side persistence, DOM preservation, focus, and resize bounds", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const commandBar = page.getByTestId("ai-command-bar");
    const canvasBefore = await box(canvas);
    const commandBefore = await box(commandBar);
    expectInside(commandBefore, canvasBefore);
    expect(commandBefore.y).toBeGreaterThan(canvasBefore.y + canvasBefore.height * 0.55);

    await page.evaluate(() => {
      const log = document.querySelector('[data-testid="ai-chat-log"]');
      const marker = document.createElement("div");
      marker.dataset.testid = "dock-marker";
      marker.textContent = "dock marker";
      log?.append(marker);
    });
    await expect(page.getByTestId("dock-marker")).toBeAttached();

    await page.getByTestId("chat-dock-toggle-bar").click();
    await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();
    await expect(page.getByTestId("dock-marker")).toBeAttached();
    const canvasSide = await box(canvas);
    expect(canvasSide.width).toBeLessThan(canvasBefore.width - 120);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-chat-dock-side"))).toBe(true);
    await expect.poll(() => layoutDock(page)).toBe("side");
    await assertInputUsable(page, "side input ok");

    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => layoutDock(page)).toBe("side");

    await page.getByTestId("chat-dock-toggle-bar").click();
    await expect(page.getByTestId("chat-float-host").getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => layoutDock(page)).toBe("float");
    await assertInputUsable(page, "float input ok");

    await page.setViewportSize({ width: 1100, height: 820 });
    const canvasNarrow = await box(canvas);
    const commandNarrow = await box(commandBar);
    expectInside(commandNarrow, canvasNarrow);
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
    await page.getByTestId("chat-dock-toggle-bar").click();
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

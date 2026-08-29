import { expect, test, type Locator, type Page } from "@playwright/test";

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const PANEL_COLLAPSED_KEY = "oprn:ai-panel-collapsed";
const COACH_MARKS_KEY = "oprn:coachmarks-basic-v1";
const STANDARD_WELCOME_KEY = "oprn:standard-welcome-seen";

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
  await page.addInitScript(({ layoutKey, coachKey, welcomeKey }) => {
    localStorage.setItem(coachKey, "1");
    localStorage.setItem(welcomeKey, "1");
    if (sessionStorage.getItem("chat-dock-e2e-cleared")) return;
    sessionStorage.setItem("chat-dock-e2e-cleared", "1");
    localStorage.removeItem(layoutKey);
  }, { layoutKey: EDITOR_LAYOUT_KEY, coachKey: COACH_MARKS_KEY, welcomeKey: STANDARD_WELCOME_KEY });
  await page.goto("/?freshProject=1&chatDockSwitch=1");
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

/** 테스트 전용 순환 훅으로 dock을 바꾸되 실제 panel state 적용까지 기다린다. */
async function setDock(page: Page, target: "glass" | "side" | "float"): Promise<void> {
  await page.evaluate((dock) => {
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="chat-dock-toggle"]');
    for (let i = 0; i < 3; i += 1) {
      if (document.querySelector<HTMLElement>('[data-testid="ai-panel"]')?.dataset.chatDock === dock) return;
      toggle?.click();
    }
  }, target);
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", target);
}

test.describe("chat dock switch", () => {
  test("glass default, side then float toggle, DOM preservation, focus, and resize bounds", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const commandBar = page.getByTestId("ai-command-bar");
    const sidePanel = page.getByTestId("chat-side-panel");
    const floatHost = page.getByTestId("chat-float-host");
    await expect(floatHost.getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-chat-dock-glass"))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-panel-docked"))).toBe(false);
    await assertInputUsable(page, "glass input ok");
    await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
    // 헤더 명패는 폐기됐다(2026-08-28). 조수 이름은 접힘 복귀 알약에만 남는다.
    expect(await floatHost.getByTestId("ai-director-plate").count()).toBe(0);
    expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);

    // glass 기본: 카드는 캔버스 안에 떠 있다.
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

    // glass → side: 같은 panel DOM을 shell-owned side host로 옮긴다.
    await setDock(page, "side");
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

    // User commit owns preferred width; a transient narrow-viewport clamp must not replace it.
    const sideResizeHandle = page.getByTestId("ai-resize-handle");
    await sideResizeHandle.focus();
    await page.keyboard.press("Shift+ArrowLeft");
    const preferredSideWidth = Math.round((await box(sidePanel)).width);
    await page.setViewportSize({ width: 900, height: 920 });
    await expect.poll(async () => Math.round((await box(sidePanel)).width)).toBeLessThan(preferredSideWidth);
    await page.setViewportSize({ width: 1600, height: 920 });
    await expect.poll(async () => Math.round((await box(sidePanel)).width)).toBe(preferredSideWidth);

    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => layoutDock(page)).toBe("side");
    await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("ai-chat-dock-side"))).toBe(true);

    // side → float 복귀
    await setDock(page, "float");
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
  test("1440 glass host has the short log and no rising overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);

    const floatHost = page.getByTestId("chat-float-host");
    await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
    await expect(floatHost.getByTestId("ai-glass-log")).toBeAttached();
    expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);
    await page.screenshot({ path: ".omo/evidence/ai-assistant-ux-overhaul/task-12-float.png" });

    await setDock(page, "side");

    const sidePanel = page.getByTestId("chat-side-panel");
    await expect(sidePanel.getByTestId("ai-panel")).toBeVisible();
    await expect(sidePanel.getByTestId("ai-chat-log")).toBeAttached();
    expect(await floatHost.locator(".ai-chat-log").count()).toBe(0);
  });

  // 삭제됨 — "glass header menu stays clickable above the assistant card" (2026-08-28).
  // 검사 대상이던 헤더 ☰(`ai-more-menu-toggle` / `ai-more-menu`)와 그 안의 온도 전환·도크 항목이
  // 헤더 폐기와 함께 DOM 에서 사라졌다. 감독 판단으로 이 진입점들의 소실은 수용됐다.
  // 2026-08-30: 그 자리를 컴포저 ☰ 가 이어받았다. 유리·사이드에서 그 버튼을 감추던 규칙
  // (02-chat-dock.css)은 걷혔다 — 헤더 훅 컨테이너가 hidden + inert 라 두 도크에는 메타 메뉴로
  // 갈 표면이 하나도 없었기 때문이다. 지금 상태의 증거는 test/e2e/_ai-harness-basics-shots.spec.ts
  // (실제 클릭 + 캡처) 와 test/aiPanelDockChrome.test.ts(CSS 계약) 가 든다.

  test("idle-screen picker is icon-first, understandable, and escapable", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);

    await setDock(page, "float");
    await page.getByTestId("ai-command-menu-toggle").click();
    const choices = [
      ["quiet-gold", "✦", "추천 함께 보기"],
      ["ink-only", "◫", "조수만 보기"],
      ["map-first", "⌨", "입력창만 보기"],
    ] as const;
    for (const [id, icon, label] of choices) {
      const choice = page.getByTestId(`ai-command-temperature-${id}`);
      await expect(choice).toHaveText(`${icon} ${label}`);
      await expect(choice).toHaveAttribute("aria-label", label);
    }

    await page.getByTestId("ai-command-temperature-map-first").click();
    await expect(page.getByTestId("ai-command-menu")).toBeHidden();
    await setDock(page, "side");
    await expect(page.getByTestId("ai-panel")).toHaveClass(/is-map-first-idle/);

    await setDock(page, "float");
    await page.getByTestId("ai-command-menu-toggle").click();
    await expect(page.getByTestId("ai-command-temperature-quiet-gold")).toBeVisible();
    await page.getByTestId("ai-command-temperature-quiet-gold").click();
    await expect(page.getByTestId("ai-command-menu")).toBeHidden();
    await setDock(page, "side");
    await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-map-first-idle/);
  });

  test("collapsed float and side combinations stay compact and restorable", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const panel = page.getByTestId("ai-panel");
    const canvasBox = await box(canvas);

    for (const dock of ["float", "glass", "side"] as const) {
      await setDock(page, dock);
      await expect(page.getByTestId("ai-collapse")).toBeVisible();
      await page.getByTestId("ai-collapse").click();
      await expect(panel).toHaveClass(/is-collapsed/);
      await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();
      if (dock !== "side") {
        const collapsedBox = await box(panel);
        expect(collapsedBox.width * collapsedBox.height).toBeLessThan(canvasBox.width * canvasBox.height * 0.2);
      } else {
        const restoreBox = await box(page.getByTestId("ai-collapsed-restore"));
        expect(restoreBox.width).toBeLessThanOrEqual(48);
      }
      await expect(page.getByTestId("ai-command-bar")).toBeHidden();
      if (dock === "side") {
        await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), PANEL_COLLAPSED_KEY)).toBe("1");
        await page.reload();
        await dismissLogin(page);
        await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
        await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", "side");
        await expect(page.getByTestId("ai-panel")).toHaveClass(/is-collapsed/);
        await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();
      }
      await page.getByTestId("ai-collapsed-restore").click();
      await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-collapsed/);
      await assertInputUsable(page, `restored ${dock} ok`);
    }
  });
});

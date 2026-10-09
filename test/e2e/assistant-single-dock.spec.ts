// 조수는 도크가 하나다 — 캔버스 위에 떠 있는 입력줄 캡슐.
//
// 유래: 이 파일은 `chat-dock-switch.spec.ts` 였다. 검사 대상이 「glass → side → float 전환」
// 이었고, 도크마다 기하·접힘·저장 키가 달라 케이스가 도크 수만큼 늘어났다. 2026-08-31 에
// 도크 축을 삭제하면서 「전환」이라는 주제 자체가 없어졌으므로, 도크와 무관하게 남는 계약만
// 옮겨 왔다:
//   · 캡슐은 어떤 뷰포트에서도 캔버스 밖으로 나가지 않는다
//   · 입력은 보이고 포커스를 받고 값을 유지한다
//   · 로그는 유리 마운트 한 칸에만 붙고 사이드 전용 오버레이는 어디에도 없다
//   · 접기 → 복원이 왕복하고 `oprn:ai-panel-collapsed` 로 살아남는다
//   · 대기 화면 선택은 메뉴와 설정 모달 어디에도 없다
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
    if (sessionStorage.getItem("assistant-dock-e2e-cleared")) return;
    sessionStorage.setItem("assistant-dock-e2e-cleared", "1");
    localStorage.removeItem(layoutKey);
  }, { layoutKey: EDITOR_LAYOUT_KEY, coachKey: COACH_MARKS_KEY, welcomeKey: STANDARD_WELCOME_KEY });
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  // 첫 방문은 펼친 채 부팅한다 — 이미 펼쳐져 있으면 이 클릭은 무해하다.
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
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

async function assertInputUsable(page: Page, value: string): Promise<void> {
  const input = page.getByTestId("ai-input");
  await expect(input).toBeVisible();
  await input.fill(value);
  await expect(input).toHaveValue(value);
  await expect(input).toBeFocused();
}

test.describe("조수 단일 도크", () => {
  test("캡슐은 캔버스 안에 머물고, 넓은 화면·좁은 화면·재부팅을 견딘다", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const commandBar = page.getByTestId("ai-command-bar");
    const floatHost = page.getByTestId("chat-float-host");

    // 마운트는 float 호스트 하나. 사이드 패널은 DOM 에 존재조차 하지 않는다.
    await expect(floatHost.getByTestId("ai-panel")).toBeVisible();
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", "float");
    expect(await page.getByTestId("chat-side-panel").count()).toBe(0);
    // 도크 전환 진입점도 남아 있지 않다.
    for (const dead of ["chat-dock-toggle", "ai-dock-mode-btn", "ai-chat-detach"]) {
      expect(await page.getByTestId(dead).count(), dead).toBe(0);
    }
    // 헤더 명패는 폐기됐다(2026-08-28). 조수 이름은 접힘 복귀 알약에만 남는다.
    expect(await floatHost.getByTestId("ai-director-plate").count()).toBe(0);

    await assertInputUsable(page, "capsule input ok");

    const canvasWide = await box(canvas);
    expectInside(await box(commandBar), canvasWide);

    // 같은 panel DOM 이 유지되는지 — 마커를 심어 놓고 뷰포트를 흔든다.
    await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="ai-panel"]');
      const marker = document.createElement("div");
      marker.dataset.testid = "dock-marker";
      marker.textContent = "dock marker";
      panel?.append(marker);
    });
    await expect(page.getByTestId("dock-marker")).toBeAttached();

    await page.setViewportSize({ width: 1100, height: 820 });
    expectInside(await box(commandBar), await box(canvas));
    await expect(page.getByTestId("dock-marker")).toBeAttached();

    await page.setViewportSize({ width: 900, height: 820 });
    expectInside(await box(commandBar), await box(canvas));

    await page.setViewportSize({ width: 1600, height: 920 });
    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", "float");
    expect(await page.getByTestId("chat-side-panel").count()).toBe(0);
  });

  test("작업 로그는 유리 마운트 한 칸이고 사이드 전용 오버레이는 없다", async ({ page }) => {
    // Break: 도크가 되살아나 로그가 `.ai-rising-overlay` / 휘발 존으로 다시 옮겨간다.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);

    const floatHost = page.getByTestId("chat-float-host");
    await expect(floatHost.getByTestId("ai-command-bar")).toBeVisible();
    await expect(floatHost.getByTestId("ai-glass-log")).toBeAttached();
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-log-slot", "glass");
    expect(await floatHost.getByTestId("ai-rising-overlay").count()).toBe(0);
    expect(await floatHost.getByTestId("ai-rising-volatile-zone").count()).toBe(0);
    // 완료 스트립·0건 알림이 사는 고정 영역은 남는다.
    await expect(page.getByTestId("ai-rising-sticky-zone")).toBeAttached();
    // 유리 로그는 한 칸이다 — 두 개면 어느 쪽이 사는지 코드로 알 수 없다.
    expect(await page.locator(".ai-chat-log").count()).toBe(1);
  });

  test("대기 화면 선택은 메뉴와 설정 모달 어디에도 없다", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);

    await page.getByTestId("ai-command-menu-toggle").click();
    await expect(page.getByTestId("ai-command-menu")).toBeVisible();
    expect(await page.getByTestId("ai-command-temperature-map-first").count()).toBe(0);
    await page.getByTestId("ai-command-menu-settings").click();

    const modal = page.getByTestId("ai-settings-modal");
    await expect(modal).toBeVisible();
    expect(await modal.getByTestId("ai-settings-tab-extra-temperature").count()).toBe(0);
    expect(await modal.getByTestId("ai-settings-section-temperature").count()).toBe(0);
    expect(await page.getByTestId("ai-panel").getAttribute("data-temperature")).toBeNull();
    await page.getByTestId("ai-settings-close").click();
    await expect(modal).toBeHidden();
  });

  test("접기와 복원이 왕복하고 재부팅을 넘어 살아남는다", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 920 });
    await openEditor(page);

    const canvas = page.locator(".canvas-area");
    const panel = page.getByTestId("ai-panel");
    const canvasBox = await box(canvas);

    await expect(page.getByTestId("ai-collapse")).toBeVisible();
    await page.getByTestId("ai-collapse").click();

    // 셰브론이 여닫는 것은 하나다: 패널 전체. 유리 카드의 본문 접힘(fold)은 함께 삭제됐다.
    await expect(panel).toHaveClass(/is-collapsed/);
    await expect(panel).not.toHaveClass(/is-glass-folded/);
    await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();
    await expect(page.getByTestId("ai-command-bar")).toBeHidden();
    const collapsedBox = await box(panel);
    expect(collapsedBox.width * collapsedBox.height).toBeLessThan(canvasBox.width * canvasBox.height * 0.2);

    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), PANEL_COLLAPSED_KEY)).toBe("1");
    await page.reload();
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", "float");
    await expect(page.getByTestId("ai-panel")).toHaveClass(/is-collapsed/);
    await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();

    await page.getByTestId("ai-collapsed-restore").click();
    await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-collapsed/);
    await assertInputUsable(page, "restored ok");
  });
});

/**
 * 공용 첫 방문 데모 — 실제 Supabase 행 + 진짜 부트 경로 검증.
 *
 * Playwright 는 navigator.webdriver=true 라 isAutomationBootContext() 가 첫 방문
 * 게이트를 닫는다. 사람 방문을 재현하려고 webdriver 를 init script 로 끈다
 * (?forceWelcome=1 은 자동화 억제뿐 아니라 웰컴 강제라 데모 단독 부팅을 못 본다).
 *
 * Run:
 *   DEV_SERVER_PORT=9999 npx playwright test test/e2e/_shared-demo-first-visit.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";

const DEMO_ID = "rpg-zzu-first-visit-demo";

async function visitAsHuman(page: Page, url: string): Promise<{ readonly demoWrites: string[] }> {
  const demoWrites: string[] = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    localStorage.clear();
  });
  // 공용 데모 행에 가는 어떤 쓰기도 실패로 간주한다 — 관찰만 한다.
  page.on("request", (request) => {
    const urlText = request.url();
    if (
      (request.method() === "POST" || request.method() === "DELETE" || request.method() === "PATCH")
      && urlText.includes(DEMO_ID)
    ) {
      demoWrites.push(`${request.method()} ${urlText}`);
    }
  });
  await page.goto(url);
  // 로그인 모달은 finishEditorBoot 끝의 openLoginModalIfNeeded 가 비동기로 올린다 —
  // 8초만 기다렸다 닫으면 더 늦게 뜬 모달이 배너 클릭을 가로챈다(실측).
  const modal = page.getByTestId("login-modal");
  for (let attempt = 0; attempt < 3; attempt++) {
    const shown = await modal.waitFor({ state: "visible", timeout: attempt === 0 ? 12_000 : 2_000 })
      .then(() => true).catch(() => false);
    if (!shown) break;
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await modal.waitFor({ state: "hidden", timeout: 12_000 }).catch(() => {});
  }
  return { demoWrites };
}

function expectNoDemoWrite(demoWrites: readonly string[]): void {
  expect(demoWrites, "공용 데모 행에 쓰기 요청이 나갔다").toEqual([]);
}

test.describe("shared demo first visit", () => {
  test.describe.configure({ timeout: 90_000 });

  test("ordinary first visit opens the read-only demo, not the welcome briefing", async ({ page }) => {
    const { demoWrites } = await visitAsHuman(page, "/");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

    // 웰컴 브리핑은 뜨지 않고, 공용 예제 안내(배너+토스트)가 첫 인상을 맡는다.
    // (db-connection-status 칩은 조용한 autosave 상태에서 톱바에 그려지지 않는다 — 상시 표면은 배너다.)
    await expect(page.getByTestId("editor-welcome")).toHaveCount(0);
    await expect(page.getByTestId("shared-demo-banner")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("shared-demo-banner")).toContainText("원본은 바뀌지 않습니다");
    await expect(page.getByTestId("shared-demo-banner-fork")).toBeVisible();
    // 최신 토스트 하나만 toast testid 를 갖고 나머지는 toast-item — 스택 전체에서 찾는다.
    await expect(
      page.locator("[data-testid='toast'], [data-testid='toast-item']").filter({ hasText: "예제 마을" }),
    ).toHaveCount(1, { timeout: 15_000 });

    // 방문자가 편집해도 데모 행에는 쓰기가 나가지 않는다(자동저장 타이머 포함 관찰).
    await page.waitForTimeout(3_000);
    expectNoDemoWrite(demoWrites);
  });

  test("fork button creates an editable copy and leaves the demo behind", async ({ page }) => {
    const { demoWrites } = await visitAsHuman(page, "/");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("shared-demo-banner-fork")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("shared-demo-banner-fork").click();
    // 사본 저장+재로드 검증이 끝나면 배너가 사라지고 일반 온라인 저장 상태로 돌아온다.
    await expect(page.getByTestId("shared-demo-banner")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.locator("[data-testid='toast']").last()).toContainText("내 사본이 열렸습니다", { timeout: 15_000 });
    const url = new URL(page.url());
    const newId = url.searchParams.get("project");
    expect(newId, "사본 project id 가 URL 에 반영돼야 한다").toMatch(/^oprn-/);
    expect(newId).not.toBe(DEMO_ID);
    // 포크 전 과정에서 공용 데모 행에는 쓰기가 가지 않는다.
    expectNoDemoWrite(demoWrites);
  });

  test("?forceWelcome=1 keeps the welcome rehearsal contract on top of the demo", async ({ page }) => {
    await visitAsHuman(page, "/?forceWelcome=1");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("editor-welcome")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("editor-welcome")).toContainText("어떤 게임을 만들까요?");
  });

  test("deep link to a normal project stays an ordinary editable session", async ({ page }) => {
    // 참고: 기본 gallery 행은 이 코드 버전이 읽지 못하는 spatialAuthoring 필드를 담고
    // 있어 딥링크 검증 대상으로는 쓸 수 없다(기존 데이터 문제, 이 변경과 무관).
    await visitAsHuman(page, "/?project=oprn-f51b995ac9");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("editor-welcome")).toHaveCount(0);
    await expect(page.getByTestId("shared-demo-banner")).toHaveCount(0);
  });

  test("deep link to the demo itself also opens read-only", async ({ page }) => {
    const { demoWrites } = await visitAsHuman(page, `/?project=${DEMO_ID}`);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("shared-demo-banner")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
    expectNoDemoWrite(demoWrites);
  });
});

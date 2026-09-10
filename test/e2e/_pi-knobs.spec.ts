// Pi 슬래시 노브 표면 증거 — 실브라우저.
//  1) 실행 경로 셀렉트가 Pi 둘뿐인가(조수 경로가 사라졌는가)
//  2) 잘못된 노브가 사용법을 말하고 사용자가 쓴 문장을 지키는가
//  3) 평문 지시가 세션이 아니라 Pi 실행 카드로 가는가
//
// 모델·동반 서비스는 필요 없다: 1·2 는 LLM 호출 전에 끝나고, 3 은 카드가 실행보다 먼저 붙는다.
// `_` 접두사라 기본 e2e 스위트에서 제외된다(진단·증거용).

// 실행: DEV_SERVER_PORT=<내 포트> npx playwright test test/e2e/_pi-knobs.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// 콜드 dev 서버(첫 로드에서 vite 가 의존성을 최적화한다)는 기본 30초를 넘긴다 — 실측 두 번 모두
// 여기서 걸렸다. 준비 대기는 넉넉히 주고, 실패는 진짜 실패로 남긴다.
test.setTimeout(120_000);

const OUT = "verify-shots/pi-knobs";
mkdirSync(OUT, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible();
}

test("실행 경로는 Pi 둘뿐이다", async ({ page }) => {
  await boot(page);
  const select = page.getByTestId("ai-composer-route");
  await expect(select).toBeVisible();
  const options = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value),
  );
  expect(options).toEqual(["pi-agent", "pi-team"]);
  await expect(select).toHaveValue("pi-agent");
  await page.screenshot({ path: `${OUT}/01-route-select.png` });
});

test("잘못된 노브는 사용법을 말하고 입력을 지킨다", async ({ page }) => {
  await boot(page);
  const input = page.getByTestId("ai-input");
  await input.fill("/loop 99 집 한 채");
  await page.getByTestId("ai-send").click();

  const systemRow = page
    .locator('[data-testid="ai-command-row"][data-role="system"]')
    .filter({ hasText: "반복 횟수는 1~20" });
  await expect(systemRow).toHaveCount(1, { timeout: 10_000 });
  // 잘못된 노브로 지시문을 날려 버리면 사용자는 다시 타이핑해야 한다.
  await expect(input).toHaveValue("/loop 99 집 한 채");
  await page.screenshot({ path: `${OUT}/02-bad-knob-usage.png` });
});

// 자격이 있어야 도는 실호출 증거. 없으면 건너뛴다(스킵도 사실을 말한다 — 조용히 통과시키지 않는다).
// 실행: RPG_ZZU_OH_MY_PI_AUTH_PATH=$HOME/.rpg-zzu/oh-my-pi-auth.json DEV_SERVER_PORT=<포트> npx playwright test ...
test("실호출: /loop 2 는 회차를 돌고 검토 카드 한 장으로 끝난다", async ({ page }) => {
  test.skip(!process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH, "동반 서비스 자격이 필요하다");
  await boot(page);
  await page.getByTestId("ai-input").fill("/loop 2 /120s 빈 땅에 나무 세 그루를 심어라");
  await page.getByTestId("ai-send").click();

  const board = page.getByTestId("ai-team-board");
  await expect(board).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ai-team-review")).toBeVisible({ timeout: 240_000 });
  // 회차는 행 id 에 붙는다 — 2회를 다 돌면 행이 둘이다(조기 종료면 하나).
  await expect(page.getByTestId("ai-team-agent")).not.toHaveCount(0);
  await page.screenshot({ path: `${OUT}/04-loop-review.png`, fullPage: true });
});

test("평문 지시는 세션이 아니라 Pi 실행 카드로 간다", async ({ page }) => {
  await boot(page);
  await page.getByTestId("ai-input").fill("집 한 채와 길");
  await page.getByTestId("ai-send").click();

  // 카드는 실행보다 먼저 붙는다 — 모델·동반 서비스가 없어도 경로는 증명된다.
  const board = page.getByTestId("ai-team-board");
  await expect(board).toBeVisible({ timeout: 15_000 });
  await expect(board).toContainText("Pi 에이전트");
  await page.screenshot({ path: `${OUT}/03-plain-goes-to-pi.png` });
});

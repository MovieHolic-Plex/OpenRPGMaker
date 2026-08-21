// 컴포저(좌측 레일) 회귀 스펙 — 실브라우저 실측 + 증거 스샷.
// `_` 접두사라 기본 e2e 실행에서 제외된다(진단용).
//
// 실행: DEV_SERVER_PORT=9433 npx playwright test test/e2e/_ai-composer-rail.spec.ts --project=chromium
//
// 이 스펙이 지키는 계약 3개(모두 구 컴포저에서 실제로 깨져 있던 것):
//  H) **바 높이 = f(textarea 줄 수)뿐.** 포커스·타이핑 1글자·슬래시 목록·☰ 메뉴를 열어도
//     `ai-command-bar` 높이가 변하지 않는다. 구 구조는 칩/목록이 흐름 안에 쌓여 매번 커졌고,
//     그때마다 --ai-command-bar-clearance 재측정이 오버레이·맵 여백까지 흔들었다.
//  P) 팝오버가 열려 있어도 맵 위 빈 지점의 클릭을 삼키지 않는다(2026-08-19 P0 재발 방지).
//  C) 슬래시 목록이 닫혀 있으면 ↑/↓ 를 가로채지 않는다 — 값이 "/" 로 시작하기만 하면
//     항상 가로채 여러 줄 입력의 캐럿 이동이 죽던 결함.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

const OUT = "verify-shots/ai-composer-rail";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_probe-log.txt`;

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, `${line}\n`, "utf8");
}

async function shot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: `${OUT}/${name}.png` }).catch((e) => log(`SHOT-FAIL ${name}: ${e}`));
  log(`SHOT ${name}`);
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 300)}`));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
}

async function barHeight(page: Page): Promise<number> {
  const box = await page.getByTestId("ai-command-bar").boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box!.height);
}

/** 도크 전환은 숨은 테스트 훅(툴바)이 아니라 실제 사용자 경로(☰ → 전환 항목)로 한다. */
async function cycleDock(page: Page): Promise<string> {
  await page.getByTestId("chat-dock-toggle").evaluate((node) => (node as HTMLButtonElement).click());
  await page.waitForTimeout(500);
  return (await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?";
}

test("H) 단일 행 상태에서는 컴포저 바 높이가 상수다", async ({ page }) => {
  await boot(page);
  const input = page.getByTestId("ai-input");

  const idle = await barHeight(page);
  log(`H idle=${idle}`);
  await shot(page.getByTestId("ai-command-bar"), "h1-idle");

  // 포커스 → 추천 칩 팝오버가 열린다(흐름 밖이라 높이에 영향 없어야 한다).
  await input.click();
  await page.waitForTimeout(250);
  const focused = await barHeight(page);
  const suggestOpen = await page.getByTestId("ai-suggest-popover").isVisible();
  log(`H focused=${focused} suggestVisible=${suggestOpen}`);
  await shot(page.getByTestId("ai-command-bar"), "h2-focus-suggest");

  // 한 글자 → 구 구조에서는 감독 칩 행이 사라져 높이가 줄었다.
  await input.pressSequentially("마");
  await page.waitForTimeout(250);
  const typed = await barHeight(page);
  log(`H typed1=${typed}`);

  // 슬래시 목록(팝오버).
  await input.fill("/");
  await page.waitForTimeout(300);
  const slashVisible = await page.getByTestId("ai-slash-list").isVisible();
  const withSlash = await barHeight(page);
  log(`H slash=${withSlash} slashListVisible=${slashVisible}`);
  await shot(page, "h3-slash-popover");

  // ☰ 액션 메뉴(팝오버).
  await page.keyboard.press("Escape");
  await input.fill("");
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(250);
  const menuVisible = await page.getByTestId("ai-command-menu").isVisible();
  const withMenu = await barHeight(page);
  log(`H menu=${withMenu} menuVisible=${menuVisible}`);
  await shot(page, "h4-action-menu");

  expect(slashVisible).toBe(true);
  expect(menuVisible).toBe(true);
  // 계약: 위 네 상태 전부 같은 높이. (구 컴포저는 idle 144 → typed 116 처럼 튀었다.)
  expect(focused).toBe(idle);
  expect(typed).toBe(idle);
  expect(withSlash).toBe(idle);
  expect(withMenu).toBe(idle);

  // 여러 줄은 **의도된** 유일한 높이 변화 경로다.
  await page.keyboard.press("Escape");
  await input.click();
  await input.pressSequentially("한 줄");
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Shift");
    await input.pressSequentially(`줄 ${i}`);
  }
  await page.waitForTimeout(300);
  const multiline = await barHeight(page);
  log(`H multiline=${multiline}`);
  await shot(page.getByTestId("ai-command-bar"), "h5-multiline");
  expect(multiline).toBeGreaterThan(idle);
});

test("P) 팝오버가 열려 있어도 맵 클릭을 삼키지 않는다", async ({ page }) => {
  await boot(page);
  await page.getByTestId("ai-input").fill("/");
  await page.waitForTimeout(300);
  await expect(page.getByTestId("ai-slash-list")).toBeVisible();

  const canvas = await page.getByTestId("edit-canvas").boundingBox();
  expect(canvas).not.toBeNull();
  // 캔버스 중앙 + 팝오버가 뜬 바로 위쪽 밴드 두 지점을 실측한다.
  const probes = [
    { name: "canvas-center", x: canvas!.x + canvas!.width / 2, y: canvas!.y + canvas!.height / 2 },
    { name: "canvas-lower", x: canvas!.x + canvas!.width / 2, y: canvas!.y + canvas!.height * 0.82 },
  ];
  for (const probe of probes) {
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "none";
      const composer = el.closest(".ai-composer-popover, .ai-composer, .ai-command-bar");
      return `${el.tagName}.${(el.className || "").toString().slice(0, 48)}|swallowedBy=${composer ? (composer.className || "").toString().slice(0, 48) : "no"}`;
    }, probe);
    log(`P ${probe.name} -> ${hit}`);
    expect(hit).toContain("swallowedBy=no");
  }
  await shot(page, "p1-slash-open-hittest");
});

test("C) 슬래시 목록이 닫혀 있으면 방향키를 가로채지 않는다", async ({ page }) => {
  await boot(page);
  const input = page.getByTestId("ai-input");
  await input.click();
  // 값이 "/" 로 시작하지만 여러 줄 → 슬래시 모드가 아니어야 한다.
  await input.pressSequentially("/집 짓기");
  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await input.pressSequentially("두 번째 줄");
  await page.waitForTimeout(250);

  await expect(page.getByTestId("ai-slash-list")).toBeHidden();
  const before = await input.evaluate((node) => (node as HTMLTextAreaElement).selectionStart);
  await page.keyboard.press("ArrowUp");
  const after = await input.evaluate((node) => (node as HTMLTextAreaElement).selectionStart);
  log(`C caret ${before} -> ${after}`);
  expect(after).toBeLessThan(before ?? 0);

  // 반대로 단일 행 "/..." 에서는 목록이 열리고 ↑/↓ 가 항목을 옮긴다.
  await input.fill("/");
  await page.waitForTimeout(300);
  await expect(page.getByTestId("ai-slash-list")).toBeVisible();
  const firstActive = await page.locator(".ai-slash-item.is-active").getAttribute("data-testid");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  const nextActive = await page.locator(".ai-slash-item.is-active").getAttribute("data-testid");
  log(`C slash active ${firstActive} -> ${nextActive}`);
  expect(nextActive).not.toBe(firstActive);
  await shot(page, "c1-slash-keyboard");
});

test("도크 3종 컴포저 증거 스샷", async ({ page }) => {
  await boot(page);
  for (let i = 0; i < 3; i += 1) {
    const mode = await cycleDock(page);
    const bar = page.getByTestId("ai-command-bar");
    const height = await barHeight(page);
    const rail = await page.getByTestId("ai-composer-rail").boundingBox();
    log(`DOCK ${mode} barHeight=${height} railWidth=${rail ? Math.round(rail.width) : "?"}`);
    await shot(page, `dock-${mode}-full`);
    await shot(bar, `dock-${mode}-bar`);
    // 어떤 도크에서도 컴포저는 입력과 전송 버튼을 잃지 않는다.
    await expect(page.getByTestId("ai-input")).toBeVisible();
    await expect(page.getByTestId("ai-send")).toBeVisible();
  }
});

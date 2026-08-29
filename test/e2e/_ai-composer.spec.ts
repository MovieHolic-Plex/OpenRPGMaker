// 컴포저 회귀 스펙 — 실브라우저 실측 + 증거 스샷.
// `_` 접두사라 기본 e2e 실행에서 제외된다(진단용).
//
// 실행: DEV_SERVER_PORT=9443 npx playwright test test/e2e/_ai-composer.spec.ts --project=chromium
//
// 이 스펙이 지키는 계약 2개(둘 다 구 컴포저에서 실제로 깨져 있던 것):
//  H) **바 높이 = f(textarea 줄 수)뿐.** 포커스·타이핑 1글자·☰ 메뉴를 열어도
//     `ai-command-bar` 높이가 변하지 않는다. 구 구조는 칩/목록이 흐름 안에 쌓여 매번 커졌고,
//     그때마다 --ai-command-bar-clearance 재측정이 오버레이·맵 여백까지 흔들었다.
//  P) 팝오버가 열려 있어도 맵 위 빈 지점의 클릭을 삼키지 않는다(2026-08-19 P0 재발 방지).
//
// 삭제된 것:
//  - **도크 순환**(`cycleDock`/`setDock`, `chat-dock-toggle`). 조수 띠는 배치가 하나다(스펙 §1).
//    "도크 3종 컴포저 증거 스샷" 테스트는 짝이 사라져 통째로 나갔다.
//  - **C) 슬래시 목록 방향키 계약**. 스킬 기능이 제품에서 빠지면서 `ai-slash-list` 자체가
//     없어졌다 — `/` 는 평범한 텍스트다. 부재는 `ai-assistant-console.spec.ts` 가 지킨다.
//  - **헤더 + 두 ☰ 메뉴 공유 계약**. `.ai-chat-header` / `ai-more-menu-toggle` /
//     `ai-settings-toggle` 이 모두 사라졌고(띠에는 헤더가 없다), ☰ 는 컴포저 하나뿐이라
//     "두 메뉴가 같은 항목을 공유한다" 는 명제가 성립하지 않는다.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

const OUT = "verify-shots/ai-composer";
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
  await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
}

async function barHeight(page: Page): Promise<number> {
  const box = await page.getByTestId("ai-command-bar").boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box!.height);
}

/** 컴포저 박스 모델 실측 — 높이 상수의 근거를 로그에 남긴다. */
async function composerBoxes(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const pick = (selector: string): string => {
      const node = document.querySelector(selector);
      if (!node) return `${selector}=absent`;
      const rect = node.getBoundingClientRect();
      return `${selector}=${Math.round(rect.width)}x${Math.round(rect.height)}`;
    };
    return [
      pick(".ai-command-bar"),
      pick(".ai-composer"),
      pick(".ai-composer-menu-btn"),
      pick(".ai-assistant-input"),
      pick(".ai-composer-actions"),
    ].join(" ");
  });
}

test("H) 단일 행 상태에서는 컴포저 바 높이가 상수다", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const input = page.getByTestId("ai-input");

  const idle = await barHeight(page);
  log(`H idle=${idle} | ${await composerBoxes(page)}`);
  await shot(page.getByTestId("ai-command-bar"), "h1-idle");

  // 포커스 → 추천 칩 팝오버가 열린다(전용 토글 버튼 없음, 흐름 밖이라 높이 영향 0).
  await input.click();
  await page.waitForTimeout(250);
  const focused = await barHeight(page);
  const suggestOpen = await page.getByTestId("ai-suggest-popover").isVisible();
  log(`H focused=${focused} suggestVisible=${suggestOpen}`);
  await shot(page.getByTestId("ai-command-bar"), "h2-focus-suggest");
  expect(suggestOpen).toBe(true);

  // 한 글자 → 구 구조에서는 감독 칩 행이 사라져 높이가 줄었다.
  await input.pressSequentially("마");
  await page.waitForTimeout(250);
  const typed = await barHeight(page);
  log(`H typed1=${typed}`);

  // ☰ 액션 메뉴(팝오버). 예전에는 여기 사이에 슬래시 목록 단계가 하나 더 있었다 —
  // 스킬 삭제와 함께 나갔다.
  await page.keyboard.press("Escape");
  await input.fill("");
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(250);
  const menuVisible = await page.getByTestId("ai-command-menu").isVisible();
  const withMenu = await barHeight(page);
  log(`H menu=${withMenu} menuVisible=${menuVisible}`);
  await shot(page, "h4-action-menu");

  expect(menuVisible).toBe(true);
  // 계약: 위 세 상태 전부 같은 높이. (구 컴포저는 idle 144 → typed 116 처럼 튀었다.)
  expect(focused).toBe(idle);
  expect(typed).toBe(idle);
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
  test.setTimeout(120_000);
  await boot(page);
  // 팝오버를 여는 경로가 슬래시 목록에서 ☰ 메뉴로 바뀌었다 — 여는 수단이 달라졌을 뿐
  // 재는 것(팝오버가 캔버스 히트테스트를 가로채지 않는가)은 같다.
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("ai-command-menu")).toBeVisible();

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
  await shot(page, "p1-menu-open-hittest");
});

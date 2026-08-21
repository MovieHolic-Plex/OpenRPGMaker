// 컴포저 회귀 스펙 — 실브라우저 실측 + 증거 스샷.
// `_` 접두사라 기본 e2e 실행에서 제외된다(진단용).
//
// 실행: DEV_SERVER_PORT=9443 npx playwright test test/e2e/_ai-composer.spec.ts --project=chromium
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

/** 도크 순환(glass → side → float → glass). 토글은 숨은 훅이라 evaluate 로 누른다. */
async function cycleDock(page: Page): Promise<string> {
  await page.getByTestId("chat-dock-toggle").evaluate((node) => (node as HTMLButtonElement).click());
  await page.waitForTimeout(500);
  return (await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?";
}

/** 부팅 기본은 glass 다. 컴포저 ☰ 는 float 전용(유리·사이드는 헤더가 소유)이라 명시 전환. */
async function setDock(page: Page, target: string): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if ((await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) === target) return;
    await cycleDock(page);
  }
  throw new Error(`dock ${target} 로 전환하지 못했다`);
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
  // 부팅(freshProject 100×100 마을) + 도크 순환만으로 30초 기본값에 붙는다 — 진단 스펙 관례대로 넉넉히.
  test.setTimeout(120_000);
  await boot(page);
  // 컴포저 ☰ 가 살아 있는 도크에서 잰다(float — 헤더가 숨겨져 컴포저가 유일한 진입점).
  await setDock(page, "float");
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
  // 부팅(freshProject 100×100 마을) + 도크 순환만으로 30초 기본값에 붙는다 — 진단 스펙 관례대로 넉넉히.
  test.setTimeout(120_000);
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
  // 부팅(freshProject 100×100 마을) + 도크 순환만으로 30초 기본값에 붙는다 — 진단 스펙 관례대로 넉넉히.
  test.setTimeout(120_000);
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
  // 부팅(freshProject 100×100 마을) + 도크 순환만으로 30초 기본값에 붙는다 — 진단 스펙 관례대로 넉넉히.
  test.setTimeout(120_000);
  await boot(page);
  for (let i = 0; i < 3; i += 1) {
    const mode = await cycleDock(page);
    const bar = page.getByTestId("ai-command-bar");
    const height = await barHeight(page);
    log(`DOCK ${mode} barHeight=${height} | ${await composerBoxes(page)}`);
    await shot(page, `dock-${mode}-full`);
    await shot(bar, `dock-${mode}-bar`);
    // 어떤 도크에서도 컴포저는 입력과 전송 버튼을 잃지 않는다.
    await expect(page.getByTestId("ai-input")).toBeVisible();
    await expect(page.getByTestId("ai-send")).toBeVisible();
  }
});

test("헤더 축소 + 두 ☰ 메뉴가 같은 항목 구현을 공유한다", async ({ page }) => {
  // 부팅(freshProject 100×100 마을) + 도크 순환만으로 30초 기본값에 붙는다 — 진단 스펙 관례대로 넉넉히.
  test.setTimeout(120_000);
  await boot(page);
  await setDock(page, "side"); // 헤더가 보이는 도크(유리는 ＋ 도 숨긴다)

  // 헤더 상시 버튼은 ＋ 와 ☰ 뿐 — ⚙ 는 메뉴 항목으로 흡수했다.
  const headerButtons = await page.evaluate(() => {
    const header = document.querySelector(".ai-chat-header .ai-header-actions");
    if (!header) return ["absent"];
    return [...header.querySelectorAll(":scope > button, :scope > .ai-more-wrap > button")]
      .filter((node) => (node as HTMLElement).offsetParent !== null)
      .map((node) => node.getAttribute("data-testid") ?? (node.textContent || "").trim());
  });
  log(`HEADER 상시 버튼: ${headerButtons.join(", ")}`);
  await shot(page.locator(".ai-chat-header"), "hdr1-side-header");
  expect(headerButtons).toEqual(["ai-new-session", "ai-more-menu-toggle"]);
  // ⚙ 아이콘은 사라졌지만 훅(testid)은 메뉴 안에 살아 있어야 한다.
  await expect(page.getByTestId("ai-settings-toggle")).toHaveCount(1);

  await page.getByTestId("ai-more-menu-toggle").click();
  await page.waitForTimeout(250);
  await shot(page, "hdr2-side-header-menu");
  const headerLabels = await page.getByTestId("ai-more-menu").evaluate((node) =>
    [...node.querySelectorAll("button")].map((b) => (b.textContent || "").trim()));
  log(`HEADER 메뉴: ${headerLabels.join(" | ")}`);

  // 컴포저 ☰ 는 float 에서만 산다 — 같은 5개 공유 항목이 같은 순서로 있어야 한다.
  await page.keyboard.press("Escape");
  await setDock(page, "float");
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(250);
  const composerLabels = await page.getByTestId("ai-command-menu").evaluate((node) =>
    [...node.querySelectorAll("button")].map((b) => (b.textContent || "").trim()));
  log(`컴포저 메뉴: ${composerLabels.join(" | ")}`);

  // 공유 항목 = 되돌리기·내보내기·<도크 전환>·전체 기록·툴 브라우저. 도크 라벨은 현재 도크에 따라
  // 다르므로(사이드 vs float) 그 자리만 빼고 비교한다.
  const shared = (labels: string[]): string[] => labels.filter((l) => !l.startsWith("스킬") && l !== "설정");
  const headerShared = shared(headerLabels);
  const composerShared = shared(composerLabels);
  expect(headerShared.length).toBe(5);
  expect(composerShared.length).toBe(5);
  expect(headerShared.filter((_, i) => i !== 2)).toEqual(composerShared.filter((_, i) => i !== 2));
  // 도크 항목 라벨은 각 표면이 본 도크를 반영한다(단일 applyDockModeChrome 이 둘 다 갱신).
  log(`도크 항목: header="${headerShared[2]}" composer="${composerShared[2]}"`);
  expect(composerShared[2]).toBe("왼쪽 유리"); // float 다음은 유리
});

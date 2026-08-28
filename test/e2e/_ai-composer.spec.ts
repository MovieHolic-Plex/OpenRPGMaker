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
  await page.addInitScript(() => {
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 300)}`));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible();
}

async function barHeight(page: Page): Promise<number> {
  const box = await page.getByTestId("ai-command-bar").boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box!.height);
}

/** 도크 순환(glass → side → float → glass). 토글은 숨은 훅이라 evaluate 로 누른다. */
async function cycleDock(page: Page): Promise<string> {
  const before = await page.getByTestId("ai-panel").getAttribute("data-chat-dock");
  const expected = before === "glass" ? "side" : before === "side" ? "float" : "glass";
  await page.getByTestId("chat-dock-toggle").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", expected);
  return expected;
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
  // 부팅(freshProject 100×100 마을) + 도크 순환/resize를 포함하므로 진단 스펙 관례대로 넉넉히.
  test.setTimeout(180_000);
  await boot(page);
  // 컴포저 ☰ 가 살아 있는 도크에서 잰다(float — 헤더가 숨겨져 컴포저가 유일한 진입점).
  await setDock(page, "float");
  const input = page.getByTestId("ai-input");

  const idle = await barHeight(page);
  log(`H idle=${idle} | ${await composerBoxes(page)}`);
  await shot(page.getByTestId("ai-command-bar"), "h1-idle");

  // 포커스 → 추천 칩 팝오버가 열린다(전용 토글 버튼 없음, 흐름 밖이라 높이 영향 0).
  await input.click();
  await expect(page.getByTestId("ai-suggest-popover")).toBeVisible();
  const focused = await barHeight(page);
  const suggestOpen = true;
  log(`H focused=${focused} suggestVisible=${suggestOpen}`);
  await shot(page.getByTestId("ai-command-bar"), "h2-focus-suggest");
  expect(suggestOpen).toBe(true);

  // 한 글자와 ordinary slash text는 textarea 높이 동기화 뒤 같은 single-line geometry다.
  await input.fill("마");
  await expect(input).toHaveValue("마");
  const typed = await barHeight(page);
  log(`H typed1=${typed}`);

  await input.fill("/");
  await expect(input).toHaveValue("/");
  const withSlash = await barHeight(page);
  log(`H slash=${withSlash}`);
  await shot(page, "h3-slash-text");

  // ☰ 액션 메뉴(팝오버).
  await page.keyboard.press("Escape");
  await input.fill("");
  await page.getByTestId("ai-command-menu-toggle").click();
  await expect(page.getByTestId("ai-command-menu")).toBeVisible();
  const menuVisible = true;
  const withMenu = await barHeight(page);
  log(`H menu=${withMenu} menuVisible=${menuVisible}`);
  await shot(page, "h4-action-menu");

  expect(menuVisible).toBe(true);
  // 계약: 포커스·single-line text·메뉴는 전부 exact same height다.
  expect(focused).toBe(idle);
  expect(typed).toBe(idle);
  expect(withSlash).toBe(idle);
  expect(withMenu).toBe(idle);

  // float 폭 resize는 폭이 실제 변한 뒤에도 drag 전 bar 높이를 유지한다.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ai-command-menu")).toBeHidden();
  await expect(page.getByTestId("ai-collapse")).toBeVisible();
  const bar = page.getByTestId("ai-command-bar");
  const beforeResize = await bar.boundingBox();
  const handle = page.getByTestId("ai-resize-handle");
  const handleBox = await handle.boundingBox();
  expect(beforeResize).not.toBeNull();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x - 120, handleBox!.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await bar.boundingBox())?.width ?? 0)).toBeGreaterThan(Math.round(beforeResize!.width));
  const afterResize = await bar.boundingBox();
  expect(afterResize).not.toBeNull();
  expect(Math.round(afterResize!.height)).toBe(Math.round(beforeResize!.height));

  // 여러 줄은 **의도된** 유일한 높이 변화 경로다.
  await input.fill("한 줄\n줄 0\n줄 1\n줄 2");
  await expect(input).toHaveValue("한 줄\n줄 0\n줄 1\n줄 2");
  await expect.poll(() => barHeight(page)).toBeGreaterThan(idle);
});

test("P) 열린 action popover와 resize edge 밖은 맵 클릭을 삼키지 않는다", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await setDock(page, "float");
  await page.getByTestId("ai-command-menu-toggle").click();
  await expect(page.getByTestId("ai-command-menu")).toBeVisible();

  const canvas = await page.getByTestId("edit-canvas").boundingBox();
  const menu = await page.getByTestId("ai-command-menu").boundingBox();
  expect(canvas).not.toBeNull();
  expect(menu).not.toBeNull();
  // 실제 popover rect 바깥의 캔버스 두 지점을 검사한다. popover 자체 위는 당연히 interactive하다.
  const probes = [
    { name: "canvas-upper-left", x: canvas!.x + 24, y: canvas!.y + 24 },
    { name: "canvas-above-menu", x: Math.max(canvas!.x + 24, menu!.x - 24), y: Math.max(canvas!.y + 24, menu!.y - 24) },
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
  await shot(page, "p1-action-menu-hittest");
});

test("C) leading slash is ordinary text and arrow keys move the textarea caret", async ({ page }) => {
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
  await expect(input).toHaveValue("/집 짓기\n두 번째 줄");
  expect(await page.getByTestId("ai-slash-list").count()).toBe(0);
  const before = await input.evaluate((node) => (node as HTMLTextAreaElement).selectionStart);
  await page.keyboard.press("ArrowUp");
  const after = await input.evaluate((node) => (node as HTMLTextAreaElement).selectionStart);
  log(`C caret ${before} -> ${after}`);
  expect(after).toBeLessThan(before ?? 0);
  await shot(page, "c1-slash-caret");
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

test("header remains removed and composer action row owns collapse/menu", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await setDock(page, "float");

  await expect(page.locator(".ai-chat-header")).toHaveCount(0);
  const actions = page.getByTestId("ai-composer-actions");
  await expect(actions.getByTestId("ai-collapse")).toBeVisible();
  await expect(actions.getByTestId("ai-command-menu-toggle")).toBeVisible();
  await expect(page.getByTestId("ai-chat-toolbar")).toBeHidden();

  await page.getByTestId("ai-command-menu-toggle").click();
  await expect(page.getByTestId("ai-command-menu")).toBeVisible();
  await shot(page, "actions-float-menu");
  const composerLabels = await page.getByTestId("ai-command-menu").evaluate((node) =>
    [...node.querySelectorAll("button")].map((b) => (b.textContent || "").trim()));
  log(`컴포저 메뉴: ${composerLabels.join(" | ")}`);
  expect(composerLabels).toContain("카드");
});

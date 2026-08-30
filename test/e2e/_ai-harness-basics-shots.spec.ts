// 진단 스펙 — 조수 하네스 기본기 5개(맥락 게이지·수동 압축·이전 대화·감독 지침·턴 되감기)의
// 실제 화면 캡처. 보고서(reports/2026-08-30-ai-harness-basics.html)에 base64 로 심는 원본이다.
// 실행: DEV_SERVER_PORT=9186 npx playwright test test/e2e/_ai-harness-basics-shots.spec.ts --project=chromium
//
// 전송 경로를 통과시키려고 apiKey 모드 + 없는 호스트를 심는다. 사용자 버블과 되감기 버튼은
// 요청 결과를 기다리지 않고 즉시 붙으므로, 요청이 실패해도 찍을 것은 다 찍힌다.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-harness-basics";
mkdirSync(OUT, { recursive: true });

const FAKE_CONFIG = {
  version: 2,
  authMode: "apiKey",
  providerId: "custom",
  baseUrl: "http://127.0.0.1:9/v1",
  model: "gpt-5-codex",
  liteModel: "gpt-5-codex",
  apiKey: "sk-shot-only",
  maxToolCalls: 200,
  maxTokens: 4096,
  reasoningEffort: "low",
  agentMode: "auto",
};

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((config) => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-config", JSON.stringify(config));
  }, FAKE_CONFIG);
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(1200);
}

/** 여백을 준 클립 샷. 기하는 evaluate 로 직접 읽는다 — 이 화면은 캔버스가 계속 그려져서
 *  `locator.boundingBox()` 의 안정화 대기가 끝나지 않는다(실측: 30s 타임아웃). */
async function shot(page: Page, testid: string, name: string, pad = 0): Promise<void> {
  if (pad <= 0) {
    await page.getByTestId(testid).screenshot({ path: `${OUT}/${name}.png` });
    return;
  }
  const box = await page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-testid='${id}']`);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, testid);
  if (!box) throw new Error(`no box for ${testid}`);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(box.width + pad * 2, 1600 - Math.max(0, box.x - pad)),
      height: Math.min(box.height + pad * 2, 1000 - Math.max(0, box.y - pad)),
    },
  });
}

/** 여러 선택자의 **합집합** 사각을 찍는다. 팝오버는 absolute 라 부모 rect 에 안 들어와서,
 *  컴포저만 찍으면 메뉴가 잘리고 메뉴만 찍으면 무엇에 달린 메뉴인지 알 수 없다. */
async function shotUnion(page: Page, selectors: readonly string[], name: string, pad = 8): Promise<void> {
  const box = await page.evaluate((list) => {
    let left = Number.POSITIVE_INFINITY, top = Number.POSITIVE_INFINITY, right = -1, bottom = -1;
    for (const selector of list) {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      left = Math.min(left, r.x); top = Math.min(top, r.y);
      right = Math.max(right, r.x + r.width); bottom = Math.max(bottom, r.y + r.height);
    }
    return right < 0 ? null : { x: left, y: top, width: right - left, height: bottom - top };
  }, selectors);
  if (!box) throw new Error(`no union box for ${selectors.join(", ")}`);
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: {
      x, y,
      width: Math.min(box.width + pad * 2, 1600 - x),
      height: Math.min(box.height + pad * 2, 1000 - y),
    },
  });
}

async function send(page: Page, text: string): Promise<void> {
  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill(text);
  await page.getByTestId("ai-send").click();
  await page.waitForTimeout(900);
}

test("조수 하네스 기본기 5개 캡처", async ({ page }) => {
  test.setTimeout(600_000);
  const metrics: Record<string, unknown> = {};
  await boot(page);

  // 1) 컴포저 액션 행 — 게이지가 스크롤되는 칩들 앞에 있다.
  await shot(page, "ai-command-bar", "01-composer-row", 10);
  metrics.meterBeforeSend = await page.getByTestId("ai-context-meter").innerText();

  // 2) ☰ 메뉴 — 새 항목 3개(이전 대화 · 맥락 압축 · 감독 지침).
  //    기본 도크(유리)에서 컴포저 ☰ 가 유일한 메타 진입점이다(헤더 밴드는 2026-08-28 폐기).
  await page.getByTestId("ai-command-menu-toggle").click();
  await expect(page.getByTestId("ai-command-menu")).toBeVisible();
  await shotUnion(page, ["[data-testid='ai-command-menu']", "[data-testid='ai-composer']"], "02-action-menu", 10);
  metrics.menuItems = await page.getByTestId("ai-command-menu").locator("button").allInnerTexts();

  // 3) 감독 지침 모달 — 실제 규칙을 타이핑한 상태.
  await page.getByTestId("ai-command-menu-instructions").click();
  const instructions = page.getByTestId("ai-instructions-modal");
  await expect(instructions).toBeVisible();
  await page
    .getByTestId("ai-instructions-input")
    .fill(
      "이 게임은 4방향 이동만 쓴다. 대각선 통행을 만들지 마라.\n" +
        "마을 NPC 이름은 전부 한글 두 글자로 짓는다.\n" +
        "전투 밸런스를 만질 때는 먼저 나에게 물어라.",
    );
  await page.waitForTimeout(200);
  await shotUnion(page, [".ai-instructions-window"], "03-instructions-modal", 14);
  metrics.instructionsCounter = await page.getByTestId("ai-instructions-counter").innerText();
  await page.getByTestId("ai-instructions-save").click();
  await page.waitForTimeout(400);
  metrics.savedInstructions = await page.evaluate(() => {
    const project = (globalThis as Record<string, any>).__oprnEditorStore?.getCurrent?.();
    return typeof project?.aiInstructions === "string" ? project.aiInstructions.length : null;
  });

  // 4) 지시 전송 → 사용자 버블 + 되감기 버튼.
  await send(page, "마을 입구에 우물을 하나 놔줘");
  const bubble = page.getByTestId("ai-command-row-user").last();
  await bubble.hover();
  await page.waitForTimeout(150);
  await shot(page, "ai-command-row-user", "04-turn-rewind", 10);
  metrics.rewindLabel = await page.getByTestId("ai-turn-rewind").last().innerText();

  // 5) 게이지 팝오버 — 세션이 생긴 뒤라 숫자가 살아 있다.
  await page.getByTestId("ai-context-meter").click();
  await expect(page.getByTestId("ai-context-panel")).toBeVisible();
  await page.waitForTimeout(200);
  await shotUnion(page, ["[data-testid='ai-context-panel']", "[data-testid='ai-composer']"], "05-context-popover", 10);
  metrics.meterAfterSend = await page.getByTestId("ai-context-meter").innerText();
  metrics.meterTone = await page.getByTestId("ai-context-meter").getAttribute("data-tone");
  metrics.contextDetail = await page.getByTestId("ai-context-panel").innerText();
  await page.getByTestId("ai-context-meter").click();

  // 6) 이전 대화 목록 — 새 대화를 시작해 두 개가 되게 만든다.
  await page.getByTestId("ai-new-chat").click();
  await page.waitForTimeout(500);
  await send(page, "동굴 입구에 표지판을 세워줘");
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-conversations").click();
  const history = page.getByTestId("ai-history-modal");
  await expect(history).toBeVisible();
  await page.waitForTimeout(300);
  await shotUnion(page, [".ai-history-window"], "06-history-modal", 14);
  metrics.historyRows = await page.getByTestId("ai-history-row").count();
  metrics.historyText = await page.getByTestId("ai-history-list").innerText();

  writeFileSync(`${OUT}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify(metrics, null, 2));

  // 명시적으로 닫는다 — 실패한 요청의 재시도 백오프가 살아 있으면 픽스처 해체가
  // 테스트 타임아웃까지 매달린다(실측: 본문은 끝났는데 10분 뒤 timeout 으로 빨감).
  await page.close();
});

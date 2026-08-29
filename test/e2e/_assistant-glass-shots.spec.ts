// 진단 스펙 — 조수 띠 실측 캡처. 스펙 §6 게이트의 계측기.
//
// 실행: ASSIST_SHOT_TAG=after DEV_SERVER_PORT=9173 npx playwright test test/e2e/_assistant-glass-shots.spec.ts --project=chromium
// 판정: node scripts/analyze-glass-contrast.mjs verify-shots/assistant-glass/after
//
// 축이 바뀌었다. 예전에는 **도크 3종 × 대기화면**을 돌면서 유리면 대비를 봤다. 조수 띠는
// 배치가 하나이므로(스펙 §1) 도는 축이 **상태 3종**이 된다: 유휴 56px · 자람 · 전체 기록.
// 그리고 각 상태를 **맵 배경 2종**(마을=다채로움, 빈 프로젝트=단색) 위에서 잰다 — 반투명
// 표면의 대비는 뒤가 무엇이냐에 달렸고, 단색 배경만 재면 통과가 무의미하다(분석기의
// `backdropIsFlat` 이 그 경고를 낸다).
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const TAG = process.env.ASSIST_SHOT_TAG ?? "after";
const OUT = `verify-shots/assistant-glass/${TAG}`;
mkdirSync(OUT, { recursive: true });

/** 맵 배경 2종. `variety` 는 분석기가 재는 값의 기대치로, 여기서는 라벨일 뿐이다. */
const BACKDROPS = [
  { name: "village", query: "freshProject=1", note: "마을 — 타일이 다채롭다" },
  { name: "blank", query: "blankProject=1", note: "빈 프로젝트 — 거의 단색" },
] as const;

async function boot(page: Page, query: string): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    // 코치마크·웰컴 카드가 띠를 덮으면 대비 표본이 오염된다.
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  await page.goto(`/?${query}`);
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  await waitForMapPainted(page);
  await page.waitForTimeout(600);
}

/**
 * 맵이 실제로 그려질 때까지 기다린다.
 *
 * 캔버스 픽셀을 JS 로 직접 읽는 방법은 못 쓴다 — 편집기 캔버스는 **WebGL** 이라
 * `getContext("2d")` 가 null 을 돌려준다(2026-08-28 실측: distinct=-1).
 * 그래서 DOM 조건(Phaser 가 canvas 자식을 심었는가 + 크기가 잡혔는가)으로만 게이트하고,
 * 실제 "뒤가 비어 있지 않은가" 판정은 스크린샷 PNG 를 읽는
 * scripts/analyze-glass-contrast.mjs 가 맡는다.
 */
async function waitForMapPainted(page: Page, timeoutMs = 30_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const host = document.querySelector("[data-testid='edit-canvas']");
      const canvas = host?.querySelector("canvas");
      return Boolean(canvas && canvas.width > 200 && canvas.height > 200);
    }).catch(() => false);
    if (ready) {
      await page.waitForTimeout(1500); // 첫 프레임 + 타일셋 텍스처 업로드 여유.
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

/** 조수 띠의 실측 기하 + 표면 토큰. 분석기가 `rect` 와 `color` 를 그대로 쓴다. */
async function shellMetrics(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const box = (selector: string): unknown => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        selector,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        color: s.color,
        fontSize: Number.parseFloat(s.fontSize),
        fontWeight: s.fontWeight,
        // 비활성 여부. WCAG 1.4.3 은 비활성 컨트롤을 대비 기준에서 면제하는데(Incidental),
        // 분석기는 합성된 픽셀만 보므로 이 신호 없이는 `:disabled { opacity: .45 }` 로 흐려진
        // 전송 버튼을 실제 위반으로 잡는다. 실제로 유휴·기록 상태에서 2.37:1 로 6건이 잡혔다.
        disabled: node instanceof HTMLButtonElement ? node.disabled : null,
        ariaDisabled: node.getAttribute("aria-disabled"),
        background: s.backgroundColor,
        backgroundImage: s.backgroundImage.slice(0, 120),
        backdropFilter: s.backdropFilter,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow.slice(0, 160),
        padding: s.padding,
        display: s.display,
      };
    };
    const panel = document.querySelector<HTMLElement>("[data-testid='ai-panel']");
    const canvas = document.querySelector<HTMLElement>(".canvas-area");
    const panelRect = panel?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    return {
      // 배치를 읽던 `dataset.chatDock` 은 사라졌다 — 상태 5종은 클래스로만 표현된다(스펙 §1).
      panelClass: panel?.className ?? null,
      logSlot: panel?.dataset.logSlot ?? null,
      conversation: panel?.dataset.aiConversation ?? null,
      risen: panel?.classList.contains("is-risen") ?? null,
      historyOpen: panel?.classList.contains("is-history-open") ?? null,
      gapRight: panelRect && canvasRect ? Math.round(canvasRect.right - panelRect.right) : null,
      gapBottom: panelRect && canvasRect ? Math.round(canvasRect.bottom - panelRect.bottom) : null,
      panel: box("[data-testid='ai-panel']"),
      main: box(".ai-chat-main"),
      nextSteps: box("[data-testid='ai-next-steps']"),
      volatileZone: box("[data-testid='ai-rising-volatile-zone']"),
      stickyZone: box("[data-testid='ai-rising-sticky-zone']"),
      historyMount: box(".ai-history-log-mount"),
      // 빈 기록 안내. 기하 게이트가 "기록이 비었는데 안내문도 없다"(=말 없는 흰 판)를
      // 잡는 근거다 — 전체 높이 오버레이의 여백 자체는 결함이 아니지만 설명 없는 여백은 결함이다.
      historyEmpty: box(".ai-history-empty"),
      // 대비 판정 대상 — 실제 선언된 전경색을 같이 실어 보낸다(분석기가 추측하지 않도록).
      hint: box(".ai-next-steps-hint"),
      examplesTitle: box(".ai-authoring-examples-title"),
      exampleChip: box(".ai-authoring-example-chip"),
      inputField: box(".ai-assistant-input"),
      sendButton: box(".ai-chat-send"),
      commandBar: box(".ai-command-bar"),
      composer: box(".ai-composer"),
    };
  });
}

async function shootPanel(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}-full.png` });
  const panel = page.getByTestId("ai-panel");
  if (!(await panel.isVisible().catch(() => false))) return;
  // 요소 샷은 애니메이션 중이면 무한 대기한다 — 반드시 상한을 건다.
  await panel.screenshot({ path: `${OUT}/${name}-panel.png`, timeout: 8_000 }).catch(() => undefined);
}

test("조수 띠 실측 — 상태 3종 × 맵 배경 2종", async ({ page }) => {
  test.setTimeout(480_000); // 편집기 부팅만 60~90s × 2.
  const report: Record<string, unknown> = { tag: TAG };

  for (const backdrop of BACKDROPS) {
    await boot(page, backdrop.query);
    report[`${backdrop.name}_mapPainted`] = await waitForMapPainted(page, 5_000);

    // 1) 유휴 — 56px 한 줄. 여기서 뒤가 가장 많이 보이므로 대비가 가장 어렵다.
    report[`${backdrop.name}_idle`] = await shellMetrics(page);
    await shootPanel(page, `${backdrop.name}-01-idle`);

    // 2) 자람 — 내용만큼, 상한 480px.
    const input = page.getByTestId("ai-input");
    await input.click();
    await page.waitForTimeout(400);
    report[`${backdrop.name}_focus`] = await shellMetrics(page);
    await shootPanel(page, `${backdrop.name}-02-focus`);
    await input.fill("마을에 대장간을 하나 지어줘");
    await page.waitForTimeout(400);
    report[`${backdrop.name}_risen`] = await shellMetrics(page);
    await shootPanel(page, `${backdrop.name}-03-risen`);
    await input.fill("");
    await page.waitForTimeout(300);

    // 3) 전체 기록 — 우측 520px 전면 오버레이.
    await page.getByTestId("ai-chat-history").click();
    await page.waitForTimeout(700);
    report[`${backdrop.name}_history`] = await shellMetrics(page);
    await shootPanel(page, `${backdrop.name}-04-history`);
    await page.getByTestId("ai-chat-history").click();
    await page.waitForTimeout(500);
    report[`${backdrop.name}_afterHistory`] = await shellMetrics(page);
  }

  writeFileSync(`${OUT}/metrics.json`, JSON.stringify(report, null, 2), "utf8");
});

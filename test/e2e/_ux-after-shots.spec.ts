// 진단 스펙 — 조수 띠 실측. 1600x1000 전문가 모드.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-after-shots.spec.ts --project=chromium
//
// 원래 이 파일은 `_ux-baseline-shots.spec.ts` 의 "짝" 이었고, 재던 것 대부분이 조수 띠에서
// 사라졌다: 도크 순환(`chat-dock-toggle`) · 유리 카드 코너 드래그(`.ai-chat-resize-handle`) ·
// 도크별 크기 영속(`oprn:ai-panel-size:{glass,side,float}`) · 스킬 진입점
// (`ai-composer-skill-button`). 기준선 파일도 함께 삭제했다 — 재실행해도 없는 DOM 을 재서
// 전부 `absent` 만 남는 계기였다.
//
// 남긴 두 대는 띠에서 오히려 값이 커졌다:
//   - `bottomInventory` — 하단 밴드에 실제로 보이는 상호작용 요소. 구 구현의 "허상 단추 밴드"를
//     잡던 계기이고, 유휴 56px 계약이 지켜지는지 세는 데 그대로 쓴다.
//   - `bottomHitTest` — 띠 호스트가 `pointer-events: none` 이고 띠 자신이 되살린다는 계약
//     (shell.css `.ai-chat-float-host`). 띠 밖 하단 지점에서는 캔버스가 집혀야 한다.
import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-assistant-ux/probe-after";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_probe-log.txt`;

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, `${line}\n`, "utf8");
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 300)}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`CONSOLE-ERROR ${msg.text().slice(0, 240)}`);
  });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  await page.waitForTimeout(900);
}

/** 화면 하단 밴드(viewport 아래 260px)에 실제로 보이는 상호작용 요소 — 좌측 팔레트/맵트리 제외. */
async function bottomInventory(page: Page, tag: string): Promise<unknown> {
  return await page.evaluate((label) => {
    const vh = window.innerHeight;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], a, input, select, textarea"),
    );
    const rows: Record<string, unknown>[] = [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      if (rect.bottom < vh - 260 || rect.top > vh) continue;
      // 좌측 패널(타일 팔레트·맵 트리)은 조수 표면이 아니다 — 기준선 인벤토리의 노이즈였다.
      if (rect.x < 320) continue;
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.05) continue;
      rows.push({
        tag: node.tagName.toLowerCase(),
        testid: node.dataset.testid ?? null,
        cls: node.className?.toString().slice(0, 90) ?? "",
        text: (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
        rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      });
    }
    rows.sort((a, b) => (a.rect as number[])[1] - (b.rect as number[])[1]);
    return { label, viewport: [window.innerWidth, vh], count: rows.length, rows };
  }, tag);
}

async function panelGeometry(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const pick = (selector: string): unknown => {
      const node = document.querySelector(selector);
      if (!node) return `${selector}=absent`;
      const r = node.getBoundingClientRect();
      return `${selector}=${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}`;
    };
    const panel = document.querySelector<HTMLElement>("[data-testid='ai-panel']");
    const canvas = document.querySelector<HTMLElement>(".canvas-area");
    const panelRect = panel?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    return {
      // 배치를 읽던 `dataset.chatDock` 대신 상태 5종과 로그 슬롯을 싣는다(스펙 §1).
      panelClass: panel?.className ?? null,
      logSlot: panel?.dataset.logSlot ?? null,
      position: panel ? getComputedStyle(panel).position : null,
      // 우하단 앵커까지의 거리 — `inset: auto 16px 16px auto` 라 둘 다 16 이어야 한다.
      gapRight: panelRect && canvasRect ? Math.round(canvasRect.right - panelRect.right) : null,
      gapBottom: panelRect && canvasRect ? Math.round(canvasRect.bottom - panelRect.bottom) : null,
      boxes: [
        pick("[data-testid='ai-panel']"),
        pick(".ai-command-bar"),
        pick(".ai-composer"),
        pick(".ai-composer-actions"),
        pick("[data-testid='ai-rising-volatile-zone']"),
        pick("[data-testid='ai-rising-sticky-zone']"),
        pick("[data-testid='ai-send']"),
      ],
    };
  });
}

test("after: 조수 띠 유휴/자람/기록 실측", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);

  const report: Record<string, unknown> = {};
  report.idleGeometry = await panelGeometry(page);
  report.idleBottom = await bottomInventory(page, "idle");
  await page.screenshot({ path: `${OUT}/01-idle-full.png` });
  await page.screenshot({ path: `${OUT}/02-idle-bottom.png`, clip: { x: 0, y: 700, width: 1600, height: 300 } });

  // 전송 버튼의 준비 상태 — 빈 컴포저에서는 비활성이어야 한다.
  const input = page.getByTestId("ai-input");
  const send = page.getByTestId("ai-send");
  report.sendAriaEmpty = await send.getAttribute("aria-disabled");
  report.sendClassEmpty = await send.getAttribute("class");

  await input.click();
  await page.waitForTimeout(400);
  report.focusGeometry = await panelGeometry(page);
  report.actionsClassFocused = await page.locator(".ai-composer-actions").getAttribute("class");
  await page.screenshot({ path: `${OUT}/03-focus-empty.png` });

  await input.fill("마을에 대장간을 하나 지어줘");
  await page.waitForTimeout(400);
  report.sendAriaTyped = await send.getAttribute("aria-disabled");
  report.sendClassTyped = await send.getAttribute("class");
  report.risenGeometry = await panelGeometry(page);
  report.risenBottom = await bottomInventory(page, "risen");
  await page.screenshot({ path: `${OUT}/04-risen.png` });

  // 스킬 기능은 제품에서 사라졌다 — `/` 는 평범한 텍스트여야 한다.
  await input.fill("/");
  await page.waitForTimeout(500);
  report.slashListCount = await page.locator("[data-testid='ai-slash-list']").count();
  await page.screenshot({ path: `${OUT}/05-slash.png` });
  await input.fill("");
  await page.waitForTimeout(300);

  // 전체 기록 오버레이 — 띠에 남은 유일한 표면 전환.
  await page.getByTestId("ai-chat-history").click();
  await page.waitForTimeout(600);
  report.historyGeometry = await panelGeometry(page);
  report.historyBottom = await bottomInventory(page, "history");
  await page.screenshot({ path: `${OUT}/06-history.png` });
  await page.getByTestId("ai-chat-history").click();
  await page.waitForTimeout(600);
  report.afterHistoryGeometry = await panelGeometry(page);

  // 하단 밴드가 캔버스 클릭을 삼키지 않는지. 띠 호스트는 `pointer-events: none` 이고
  // 띠 본체만 되살리므로, 띠 밖의 하단 지점에서는 캔버스가 집혀야 한다.
  report.bottomHitTest = await page.evaluate(() => {
    const vh = window.innerHeight;
    const strip = document.querySelector<HTMLElement>("[data-testid='ai-panel']")?.getBoundingClientRect();
    const probes = [700, 900, 1100, 1300, 1500].map((x) => ({ x, y: vh - 40 }));
    return probes.map(({ x, y }) => {
      const node = document.elementFromPoint(x, y) as HTMLElement | null;
      const owner = node?.closest<HTMLElement>("[data-testid]");
      return {
        at: [x, y],
        insideStrip: Boolean(strip && x >= strip.x && x <= strip.right && y >= strip.y && y <= strip.bottom),
        tag: node?.tagName.toLowerCase() ?? null,
        testid: owner?.dataset.testid ?? null,
        canvasReached: Boolean(node?.closest("[data-testid='edit-canvas']")),
      };
    });
  });
  await page.screenshot({ path: `${OUT}/30-bottom-band.png`, clip: { x: 0, y: 700, width: 1600, height: 300 } });
  await page.locator(".ai-composer").screenshot({ path: `${OUT}/31-composer.png` });

  writeFileSync(`${OUT}/after-report.json`, JSON.stringify(report, null, 2), "utf8");
  log(`send empty=${String(report.sendAriaEmpty)} typed=${String(report.sendAriaTyped)}`);
  log(`hitTest=${JSON.stringify(report.bottomHitTest)}`);
});

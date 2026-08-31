// 진단 스펙 — 조수 UX 수리 후 "지금 화면" 실측. _ux-baseline-shots.spec.ts 의 짝이며
// 같은 뷰포트(1600x1000)·같은 부팅 경로를 쓴다. 비교 대상: verify-shots/ux-baseline/.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-after-shots.spec.ts --project=chromium
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
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
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
    const handle = document.querySelector<HTMLElement>(".ai-chat-resize-handle");
    return {
      dock: panel?.dataset.chatDock ?? null,
      panelInlineSize: panel ? [panel.style.width, panel.style.height] : null,
      handleVisible: handle ? getComputedStyle(handle).display !== "none" : null,
      handleClass: handle?.className ?? null,
      boxes: [
        pick("[data-testid='ai-panel']"),
        pick(".ai-command-bar"),
        pick(".ai-composer"),
        pick(".ai-composer-actions"),
        pick(".ai-rising-sticky-zone"),
        pick("[data-testid='ai-composer-skill-button']"),
        pick("[data-testid='ai-send']"),
      ],
    };
  });
}

test("after: 조수 하단/도크/컴포저/크기조절 실측", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);

  const report: Record<string, unknown> = {};
  report.bootGeometry = await panelGeometry(page);
  report.bootBottom = await bottomInventory(page, "boot-glass");
  await page.screenshot({ path: `${OUT}/01-boot-full.png` });
  await page.screenshot({ path: `${OUT}/02-boot-bottom.png`, clip: { x: 0, y: 700, width: 1600, height: 300 } });

  // C2 — 전송 버튼의 준비 상태와 스킬 진입점, 포커스 전용 힌트.
  const input = page.getByTestId("ai-input");
  const send = page.getByTestId("ai-send");
  report.sendAriaEmpty = await send.getAttribute("aria-disabled");
  report.sendClassEmpty = await send.getAttribute("class");
  report.skillButtonPresent = await page.getByTestId("ai-composer-skill-button").count();

  await input.click();
  await page.waitForTimeout(400);
  report.actionsClassFocused = await page.locator(".ai-composer-actions").getAttribute("class");
  await page.screenshot({ path: `${OUT}/03-focus-empty.png` });

  await input.fill("마을에 대장간을 하나 지어줘");
  await page.waitForTimeout(400);
  report.sendAriaTyped = await send.getAttribute("aria-disabled");
  report.sendClassTyped = await send.getAttribute("class");
  report.typedGeometry = await panelGeometry(page);
  await page.screenshot({ path: `${OUT}/04-typed.png` });

  // 스킬 진입점 클릭 → 슬래시 목록.
  await input.fill("");
  await page.getByTestId("ai-composer-skill-button").click();
  await page.waitForTimeout(600);
  report.inputAfterSkillButton = await input.inputValue();
  report.slashHostVisible = await page.locator(".ai-slash-host").isVisible().catch(() => null);
  await page.screenshot({ path: `${OUT}/05-skill-button.png` });
  await input.fill("");
  await page.waitForTimeout(300);

  // C4 — 유리 카드 코너 드래그.
  const before = await page.getByTestId("ai-panel").boundingBox();
  const handle = page.locator(".ai-chat-resize-handle");
  report.handleCount = await handle.count();
  const handleBox = await handle.boundingBox();
  if (handleBox && before) {
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 220, handleBox.y + 150, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const after = await page.getByTestId("ai-panel").boundingBox();
  report.resize = {
    before: before ? [Math.round(before.width), Math.round(before.height)] : null,
    after: after ? [Math.round(after.width), Math.round(after.height)] : null,
  };
  report.resizeGeometry = await panelGeometry(page);
  await page.screenshot({ path: `${OUT}/06-resized.png` });

  // 재부팅 후에도 커진 크기가 남는지(도크별 키 영속).
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(600);
  const reopened = await page.getByTestId("ai-panel").boundingBox();
  report.resizePersisted = reopened ? [Math.round(reopened.width), Math.round(reopened.height)] : null;
  // 크기 키도 하나로 합쳐졌다 — 구 `oprn:ai-panel-size:<dock>` 3종은 `oprn:ai-panel-size`
  // 하나가 되고, `:float` 만 이전용으로 읽힌다.
  report.storedSizes = await page.evaluate(() => ({
    current: localStorage.getItem("oprn:ai-panel-size"),
    legacyFloat: localStorage.getItem("oprn:ai-panel-size:float"),
  }));
  await page.screenshot({ path: `${OUT}/07-after-reload.png` });

  // C3 — 언급 썸네일 렌더러를 실제 프로젝트 데이터로 확인(턴 없이 직접 장식).
  report.mentionProbe = await page.evaluate(() => {
    const win = window as unknown as { __oprnMentionProbe?: unknown };
    return win.__oprnMentionProbe ?? "no-probe-hook";
  });

  // 붙는 곳은 하나다 — 구 「도크 순환」 루프와, C5 전에 한 번 더 돌리던 토글 클릭은
  // 2026-08-31 에 걷었다(`chat-dock-toggle` 삭제). 지금 표면 한 장만 인벤토리에 남긴다.
  const dock = (await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?";
  await page.screenshot({ path: `${OUT}/10-dock-${dock}.png` });
  report[`dock_${dock}_geometry`] = await panelGeometry(page);
  report[`dock_${dock}_bottom`] = await bottomInventory(page, `dock-${dock}`);
  report.docks = [dock];

  // C5 — 하단 밴드가 캔버스 클릭을 삼키지 않는지. 조수 캡슐이 차지한 폭 밖의 하단
  // 지점에서는 허상 단추 밴드가 아니라 실제 캔버스가 집혀야 한다.
  report.bottomHitTest = await page.evaluate(() => {
    const vh = window.innerHeight;
    const probes = [700, 900, 1100, 1300, 1500].map((x) => ({ x, y: vh - 40 }));
    return probes.map(({ x, y }) => {
      const node = document.elementFromPoint(x, y) as HTMLElement | null;
      const owner = node?.closest<HTMLElement>("[data-testid]");
      return {
        at: [x, y],
        tag: node?.tagName.toLowerCase() ?? null,
        testid: owner?.dataset.testid ?? null,
        canvasReached: Boolean(node?.closest("[data-testid='edit-canvas']")),
      };
    });
  });
  await page.screenshot({ path: `${OUT}/30-bottom-band.png`, clip: { x: 0, y: 700, width: 1600, height: 300 } });
  await page.locator(".ai-composer").screenshot({ path: `${OUT}/31-composer.png` });

  writeFileSync(`${OUT}/after-report.json`, JSON.stringify(report, null, 2), "utf8");
  log(`dock=${dock}`);
  log(`resize=${JSON.stringify(report.resize)} persisted=${JSON.stringify(report.resizePersisted)}`);
  log(`send empty=${String(report.sendAriaEmpty)} typed=${String(report.sendAriaTyped)}`);
});

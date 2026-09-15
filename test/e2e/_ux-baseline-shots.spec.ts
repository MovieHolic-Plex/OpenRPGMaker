// 진단 스펙 — 조수 UX 개편 착수 전 "지금 화면" 실측 + 하단 버튼 인벤토리.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-baseline-shots.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-assistant-ux/probe-baseline";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_probe-log.txt`;

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, `${line}\n`, "utf8");
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 300)}`));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
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

/** 화면 하단 밴드(viewport 아래 260px)에 실제로 보이는 상호작용 요소 전부. */
async function bottomInventory(page: Page, tag: string): Promise<unknown> {
  return await page.evaluate((label) => {
    const vh = window.innerHeight;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], a, input, select, textarea, [data-testid]"),
    );
    const rows: Record<string, unknown>[] = [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      if (rect.bottom < vh - 260 || rect.top > vh) continue;
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.05) continue;
      rows.push({
        tag: node.tagName.toLowerCase(),
        testid: node.dataset.testid ?? null,
        cls: node.className?.toString().slice(0, 120) ?? "",
        text: (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48),
        rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
        pos: style.position,
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
    return {
      dock: panel?.dataset.chatDock ?? null,
      logSlot: panel?.dataset.logSlot ?? null,
      boxes: [
        pick("[data-testid='ai-panel']"),
        pick(".ai-command-bar"),
        pick(".ai-composer"),
        pick(".ai-composer-actions"),
        pick(".ai-rising-sticky-zone"),
        pick("[data-testid='ai-next-steps']"),
        pick(".ai-glass-log"),
        pick("[data-testid='authoring-journey-toggle']"),
      ],
      resizers: Array.from(document.querySelectorAll("[class*='resiz'],[data-testid*='resiz']")).map((n) => ({
        cls: n.className?.toString().slice(0, 80),
        testid: (n as HTMLElement).dataset?.testid ?? null,
      })),
    };
  });
}

test("baseline: 조수 하단/도크/컴포저 실측", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  const report: Record<string, unknown> = {};
  report.bootGeometry = await panelGeometry(page);
  report.bootBottom = await bottomInventory(page, "boot-glass");
  await page.screenshot({ path: `${OUT}/01-boot-full.png` });
  await page.screenshot({ path: `${OUT}/02-boot-bottom.png`, clip: { x: 0, y: 700, width: 1600, height: 300 } });

  // 입력창 포커스 — 추천 팝오버가 뜨는 상태
  const input = page.getByTestId("ai-input");
  if (await input.isVisible().catch(() => false)) {
    await input.click();
    await page.waitForTimeout(600);
    report.focusGeometry = await panelGeometry(page);
    report.focusBottom = await bottomInventory(page, "focus-empty");
    await page.screenshot({ path: `${OUT}/03-focus-empty.png` });
    await input.fill("마을에 대장간을 하나 지어줘");
    await page.waitForTimeout(500);
    report.typedGeometry = await panelGeometry(page);
    await page.screenshot({ path: `${OUT}/04-typed.png` });
    await input.fill("/");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/05-slash.png` });
    report.slashGeometry = await panelGeometry(page);
    await input.fill("");
  }

  // 붙는 곳은 하나다 — 구 「도크 순환」 루프(`chat-dock-toggle` 3연타)는 2026-08-31 에 걷었다.
  // 순환할 대상이 없으니 지금 표면 한 장을 그대로 남긴다.
  const dock = (await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?";
  await page.screenshot({ path: `${OUT}/10-dock-${dock}.png` });
  report[`dock_${dock}_geometry`] = await panelGeometry(page);
  report[`dock_${dock}_bottom`] = await bottomInventory(page, `dock-${dock}`);
  report.docks = [dock];

  writeFileSync(`${OUT}/baseline-report.json`, JSON.stringify(report, null, 2), "utf8");
  log(`dock=${dock}`);
  log(JSON.stringify(report.bootGeometry));
});

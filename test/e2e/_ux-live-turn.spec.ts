// 진단 스펙 — **실제 LLM 턴**으로 C1(자동 적용 + 전/후 비교)과 C3(언급 썸네일)을 확인한다.
// 인증은 OAuth/서버측 게이트웨이 키(vite 의 /api/ai 프록시)라 클라이언트 키가 필요 없다.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-live-turn.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-assistant-ux/probe-live";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_live-log.txt`;

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, `${line}\n`, "utf8");
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 240)}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`CONSOLE-ERROR ${msg.text().slice(0, 200)}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/ai")) log(`API /api/ai -> ${res.status()}`);
  });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert"); // 키는 oprn: 다 — rpg-zzu: 는 낡아서 무시된다
    // 모델은 덮어쓰지 않는다. 예전에는 로컬 `/api/ai` 게이트웨이가 deepseek·mimo 만 받는다고
    // 보고 여기서 모델을 갈아 끼웠는데, 그 진단이 틀렸다(실측 2026-08-26): 에디터는 authMode
    // "chatgpt" 로 companion 전송을 타므로 저장된 baseUrl 을 버리고 `/v1` 로 간다 — 게이트웨이
    // 모델 목록은 이 경로와 무관하다. 그 우회가 남아 있는 동안 Antigravity 에 deepseek 모델명이
    // 실려 나가 400 이 났고, 제품 결함처럼 보였다. 강제 기본값 그대로 태우는 것이 이 스펙의 값이다.
  });
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
  await page.waitForTimeout(800);
}

/** 턴이 끝날 때까지 기다린다 — 전송이 다시 눌릴 수 있게 되면(중단 버튼이 사라지면) 종료로 본다. */
async function waitForTurnEnd(page: Page, budgetMs: number): Promise<string> {
  const started = Date.now();
  let lastStatus = "";
  while (Date.now() - started < budgetMs) {
    const status = (await page.getByTestId("ai-status").textContent().catch(() => null)) ?? "";
    if (status && status !== lastStatus) {
      lastStatus = status;
      log(`  status: ${status.slice(0, 90)}`);
    }
    const abortHidden = await page
      .locator(".ai-abort-button")
      .first()
      .isHidden()
      .catch(() => true);
    const busy = /진행|생각|작업|스트리밍|중단/.test(lastStatus);
    if (abortHidden && !busy && Date.now() - started > 6_000) return lastStatus;
    await page.waitForTimeout(1_500);
  }
  return `${lastStatus} (budget exhausted)`;
}

async function surfaceSnapshot(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const count = (sel: string): number => document.querySelectorAll(sel).length;
    const text = (sel: string): string | null =>
      document.querySelector(sel)?.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) ?? null;
    return {
      appliedCard: count("[data-testid='ai-change-card']"),
      appliedThumbs: count("[data-testid='ai-change-pair'] canvas"),
      appliedSummary: text("[data-testid='ai-change-card'] .ai-change-title"),
      autoApproveToggle: count("[data-testid='ai-proposal-auto-approve-input']"),
      proposalCard: count("[data-testid='ai-proposal-card'], .ai-proposal-card"),
      proposalThumbs: count(".ai-proposal-thumbs canvas"),
      completionStripButtons: count("[data-testid='ai-completion-strip'] button"),
      mentionStrips: count("[data-testid='ai-mention-strip']"),
      mentionChips: count("[data-testid='ai-mention-strip'] .ai-mention-chip"),
      mentionThumbs: count(
        "[data-testid='ai-mention-strip'] .ai-mention-chip canvas, [data-testid='ai-mention-strip'] .ai-mention-chip img",
      ),
      mentionNames: Array.from(document.querySelectorAll("[data-testid='ai-mention-strip'] .ai-mention-name")).map(
        (n) => n.textContent?.trim() ?? "",
      ),
      lastAssistant: text("[data-testid=ai-command-row-assistant]:last-of-type"),
      logText: text(".ai-chat-log, .ai-glass-log"),
    };
  });
}

async function sendTurn(page: Page, instruction: string, tag: string, budgetMs: number): Promise<unknown> {
  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill(instruction);
  await page.waitForTimeout(250);
  log(`--- sending [${tag}]: ${instruction}`);
  await page.getByTestId("ai-send").click();
  const status = await waitForTurnEnd(page, budgetMs);
  log(`--- turn [${tag}] ended: ${status.slice(0, 120)}`);
  await page.waitForTimeout(1_200);
  const snap = await surfaceSnapshot(page);
  log(`--- surfaces [${tag}]: ${JSON.stringify(snap)}`);
  await page.screenshot({ path: `${OUT}/${tag}-full.png` });
  return { instruction, status, snap };
}

test("live: 실제 턴에서 자동 적용 비교 카드와 언급 썸네일", async ({ page }) => {
  // 두 턴이 실제로 도구를 돌리면 각각 수 분이 걸린다(400 으로 즉사하던 시절의 600s 로는
  // 두 번째 턴이 잘렸다) — 턴 예산 300s 두 개에 부팅·채증 여유를 더한 천장이다.
  test.setTimeout(1_200_000);
  await boot(page);
  const report: Record<string, unknown> = {};
  await page.screenshot({ path: `${OUT}/00-boot.png` });

  // C1 — 낮은 위험 쓰기: 자동 승인 조건을 만족하면 클릭 없이 적용되고 전/후 카드가 남아야 한다.
  report.turnApply = await sendTurn(
    page,
    "지금 맵의 빈 풀밭 한 곳에 3x3 크기로 꽃밭을 깔아줘. 작게 딱 한 군데만.",
    "10-apply",
    300_000,
  );

  // C3 — 어시스턴트 문장이 DB 레코드를 언급하면 그 썸네일이 붙어야 한다.
  report.turnMention = await sendTurn(
    page,
    "이 프로젝트에 있는 몬스터 두 종류와 회복 아이템 하나를 이름 그대로 넣어서 한 문장으로 설명해줘. 맵은 바꾸지 마.",
    "20-mention",
    300_000,
  );

  writeFileSync(`${OUT}/live-report.json`, JSON.stringify(report, null, 2), "utf8");
});

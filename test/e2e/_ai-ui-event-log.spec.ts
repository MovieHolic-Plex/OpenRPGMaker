// 진단 스펙 — 프론트 액션이 실제로 남는지 «실제 화면에서» 확인한다.
// 실행: DEV_SERVER_PORT=9187 npx playwright test test/e2e/_ai-ui-event-log.spec.ts --project=chromium
//
// 왜 단위 테스트로 안 끝내는가: 이 기능의 실패 방식은 로직 오류가 아니라 «계측이 안 걸리는 것»
// 이다. 링버퍼도 병합도 단위로 잠갔지만, 위임 리스너가 실제 DOM 에서 AI 표면을 못 알아보면
// 전부 통과한 채로 로그는 0건이다 — 그게 이 작업 전의 상태였다(uiEvents 필드는 있었고 항상 비었다).
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-ui-event-log";
mkdirSync(OUT, { recursive: true });

const FAKE_CONFIG = {
  version: 2,
  authMode: "apiKey",
  providerId: "custom",
  baseUrl: "http://127.0.0.1:9/v1",
  model: "gpt-5-codex",
  liteModel: "gpt-5-codex",
  apiKey: "sk-probe-only",
  maxToolCalls: 200,
  maxTokens: 4096,
  reasoningEffort: "low",
  agentMode: "auto",
};

type UiEvent = { readonly action: string; readonly surface: string; readonly detail?: Record<string, unknown> };

/**
 * 원격 왕복 실측용(선택). 기본 실행은 로컬 전용이다 — 이 워크트리에는 `.env.local` 이 없어서
 * Supabase 가 미설정이고, 그 상태 자체가 검증 대상 중 하나다(하네스의 「기록 로컬 전용」 배지).
 *
 * DB 까지 확인할 때만 켠다:
 *   PROBE_SUPABASE_URL=… PROBE_SUPABASE_ANON_KEY=… PROBE_SUPABASE_PROJECT_ID=e2e-ui-event-log-probe
 * projectId 는 **일부러 새 값**을 쓴다. 공유 프로젝트를 지목하면 freshProject=1 이 그 프로젝트의
 * 맵을 덮어쓴다(vitest.live.config.ts 가 경고하는 그 사고).
 */
const REMOTE_PROBE = process.env.PROBE_SUPABASE_URL && process.env.PROBE_SUPABASE_ANON_KEY
  ? {
      url: process.env.PROBE_SUPABASE_URL,
      anonKey: process.env.PROBE_SUPABASE_ANON_KEY,
      projectId: process.env.PROBE_SUPABASE_PROJECT_ID ?? "e2e-ui-event-log-probe",
      source: "custom" as const,
    }
  : null;

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((config) => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-config", JSON.stringify(config));
  }, FAKE_CONFIG);
  if (REMOTE_PROBE) {
    await page.addInitScript((probe) => {
      localStorage.setItem("oprn:supabase-project-config", JSON.stringify(probe));
      localStorage.setItem("oprn:supabase-selected-project", probe.projectId);
    }, REMOTE_PROBE);
  }
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

const readEvents = (page: Page): Promise<readonly UiEvent[]> =>
  page.evaluate(() => (window as unknown as { __oprnListAiUiEvents?: () => readonly UiEvent[] }).__oprnListAiUiEvents?.() ?? []);

async function send(page: Page, text: string): Promise<void> {
  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill(text);
  await page.getByTestId("ai-send").click();
  await page.waitForTimeout(900);
}

test("AI 표면 프론트 액션이 링버퍼와 하네스 타임라인에 남는다", async ({ page }) => {
  test.setTimeout(600_000);
  const metrics: Record<string, unknown> = {};
  await boot(page);

  // 1) 감독 지침 저장 — 글자 수가 detail 에 실려야 한다.
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-instructions").click();
  await expect(page.getByTestId("ai-instructions-modal")).toBeVisible();
  await page.getByTestId("ai-instructions-input").fill("대각선 통행을 만들지 마라. NPC 이름은 한글 두 글자.");
  await page.getByTestId("ai-instructions-save").click();
  await page.waitForTimeout(400);

  // 2) 턴 1회 — 이 구간의 액션이 턴 행의 uiActions 에 잘려 실린다.
  await send(page, "마을 입구에 우물을 하나 놔줘");

  // 3) 턴 되감기 — 되돌린 스냅샷 수와 대화 절단 위치.
  const rewind = page.getByTestId("ai-turn-rewind").last();
  if (await rewind.isVisible().catch(() => false)) {
    await rewind.click();
    await page.waitForTimeout(500);
  }

  // 4) 도크 전환 — from→to.
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='chat-dock-toggle']")?.click());
  await page.waitForTimeout(400);

  // 5) 맥락 압축 — 실 LLM 이 없으므로 skipped/error 로 끝나도 «눌렀고 이렇게 끝났다» 가 남아야 한다.
  await page.getByTestId("ai-context-meter").click();
  await expect(page.getByTestId("ai-context-panel")).toBeVisible();
  await page.getByTestId("ai-context-compact").click();
  await page.waitForTimeout(1500);

  // 6) 접기·펼치기 — 턴 중에 접혔는지가 「답장이 안 보였다」류 신고의 갈림길이다.
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='ai-collapse']")?.click());
  await page.waitForTimeout(400);
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(400);

  // 7) 새 대화 → 대화 복원.
  await page.getByTestId("ai-new-chat").click();
  await page.waitForTimeout(500);
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-conversations").click();
  await expect(page.getByTestId("ai-history-modal")).toBeVisible();
  const firstOpen = page.getByTestId("ai-history-open").first();
  if (await firstOpen.isVisible().catch(() => false)) {
    await firstOpen.click();
    await page.waitForTimeout(600);
  } else {
    await page.getByTestId("ai-history-close").click();
  }

  const events = await readEvents(page);
  const actions = events.map((event) => event.action);
  metrics.total = events.length;
  metrics.actions = actions;
  metrics.semantic = events.filter((event) => !event.action.startsWith("click:") && !event.action.startsWith("change:"));

  // 의미 이벤트는 결과 수치를 갖고 있어야 한다 — 클릭 사실만으로는 이 기능이 아무 값이 없다.
  const semanticWithDetail = events.filter(
    (event) => !event.action.includes(":") && event.detail !== undefined && Object.keys(event.detail).length > 0,
  );
  metrics.semanticWithDetailCount = semanticWithDetail.length;

  // 누른 것마다 의미 이벤트가 하나씩 있어야 한다. 위임 수집의 `click:<testid>` 만 남는 상태는
  // «반쪽 기록» 이다 — 무엇이 바뀌었는지가 없다(되감기가 실제로 그랬다, 2026-08-30 첫 실측).
  for (const action of [
    "instructions-save",
    "dock-switch",
    "turn-rewind",
    "context-compact",
    "panel-collapse",
    "new-conversation",
    "conversation-restore",
  ]) {
    expect(actions, `의미 이벤트 누락: ${action}`).toContain(action);
  }
  // 위임 수집도 살아 있어야 한다 — 명시 호출이 없는 버튼들이 `click:<testid>` 로 들어온다.
  expect(actions.some((action) => action.startsWith("click:"))).toBe(true);
  expect(semanticWithDetail.length).toBeGreaterThan(0);

  // 8) 하네스 타임라인에 손 줄이 보이는지 — 기록이 남는 것과 님이 보는 것은 다른 문제다.
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='ai-harness']")?.click());
  const harness = page.getByTestId("ai-harness-modal");
  await expect(harness).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  const uiRows = await page.locator(".harness-row.is-ui").count();
  metrics.harnessUiRows = uiRows;
  metrics.harnessSummary = await page.getByTestId("ai-harness-summary").innerText();
  await page.screenshot({ path: `${OUT}/harness-timeline.png`, fullPage: false });
  expect(uiRows).toBeGreaterThan(0);

  // 9) 활동 로그 행 — 채팅 턴이 uiActions/index 를 싣고 있는지(DB 왕복의 로컬 대응물).
  metrics.activityRows = await page.evaluate(() => {
    const rows = (window as unknown as { __oprnListAiActivityLogs?: () => readonly Record<string, any>[] })
      .__oprnListAiActivityLogs?.() ?? [];
    return rows.slice(0, 8).map((row) => ({
      channel: row.channel,
      instruction: String(row.instruction).slice(0, 40),
      pending: row.result?.pending ?? false,
      uiActions: row.uiActions?.length ?? 0,
      indexUiActions: row.index?.uiActions ?? [],
      indexToolNames: row.index?.toolNames ?? [],
      persisted: row.persisted,
    }));
  });

  writeFileSync(`${OUT}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify(metrics, null, 2));
  await page.close();
});

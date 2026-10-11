/**
 * 실행 경로 정리(2026-09-11)의 실표면 증거 — 실제 편집기에서 팀 UI가 숨겨진 상태와 요청 본문을 본다.
 *
 * 무엇을 증명하나:
 *  - 경로 셀렉트에는 두 값만 있다(조수 / Pi 에이전트). `pi-team` 은 라우트가 아니다.
 *  - 팀 모드 선택 UI는 당분간 숨겨져 있지만, 저장된 `AiConfig.piTeam` 비트와 실행 본문 계약은 유지된다.
 *  - 팀 비트가 켜진 평문 지시는 `/v1/agent/run` 에 `mode: "team"` 으로, 꺼진 평문은 `mode: "single"` +
 *    현재 맵 범위로 나간다.
 *  - Pi 실행은 활동 로그(`channel: "pi"`)를 남긴다: 시작 pending 행 + 실패 종료 행.
 *
 * 실행:
 *   npx playwright test test/e2e/ai-route-team.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("output/evidence/ai-route-team");
mkdirSync(EVIDENCE, { recursive: true });

interface AgentRunBody {
  readonly mode?: string;
  readonly mapIds?: readonly string[];
  readonly task?: string;
}

interface ActivityRow {
  readonly channel?: string;
  readonly instruction?: string;
  readonly mapId?: string;
  readonly result?: { readonly pending?: boolean; readonly ok?: boolean; readonly error?: string; readonly applied?: boolean };
  readonly toolCalls?: readonly { readonly name: string }[];
}

async function boot(page: Page): Promise<void> {
  const events: string[] = [];
  page.on("pageerror", (error) => events.push(`pageerror:${String(error).slice(0, 300)}`));
  page.on("requestfailed", (request) => events.push(`reqfail:${request.url().slice(0, 100)}:${request.failure()?.errorText ?? ""}`));
  page.on("response", (response) => {
    if (response.status() >= 400) events.push(`http${response.status()}:${response.url().slice(0, 120)}`);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  const ready = page.locator("[data-testid='login-guest']:visible, [data-testid='ai-input']:visible, [data-testid='ai-collapsed-restore']:visible").first();
  // 콜드 스타트에서는 vite 가 의존성을 최적화하는 동안 첫 로드가 빈 화면으로 끝난다(실측). 그 사이의
  // 새로고침은 같은 504 를 다시 받으므로, 로드→판정→다시 로드를 몇 바퀴 돌려 최적화가 끝난 바퀴를 잡는다.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt === 0) await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    else await page.reload({ waitUntil: "domcontentloaded" });
    try {
      await ready.waitFor({ state: "visible", timeout: 20_000 });
      break;
    } catch {
      /* 다음 바퀴 */
    }
  }
  if (!(await ready.isVisible())) console.log("[boot-failed]", JSON.stringify(events.slice(-20)));
  await ready.waitFor({ state: "visible", timeout: 30_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

function readConfig(page: Page): Promise<{ executionRoute?: string; piTeam?: boolean }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}") as { executionRoute?: string; piTeam?: boolean });
}

test("팀 모드 UI를 숨겨도 저장된 비트가 실행 모드를 정한다", async ({ page }) => {
  // 앱 부팅이 무겁고(편집기 + Phaser) 이 스펙은 실제 전송까지 본다.
  test.setTimeout(180_000);
  const runs: AgentRunBody[] = [];
  const activity: ActivityRow[] = [];
  const log: Record<string, unknown> = {};

  // 모델은 부르지 않는다 — 요청 본문만 본다. 실패 이벤트로 끝내 실패 경로의 기록까지 확인한다.
  await page.route("**/v1/agent/run**", async (route) => {
    // 본문에는 프로젝트 전체가 실린다 — 근거에는 이 스펙이 보는 세 필드만 남긴다.
    const body = JSON.parse(route.request().postData() ?? "{}") as AgentRunBody;
    runs.push({ mode: body.mode, mapIds: body.mapIds, task: body.task });
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "error", message: "E2E 스텁 — 모델을 부르지 않는다" })}\n`,
    });
  });
  await page.route("**/__oprn/ai-activity", async (route) => {
    activity.push(route.request().postDataJSON() as ActivityRow);
    await route.fulfill({ json: { ok: true } });
  });

  await boot(page);


  // 1) 팀 모드 선택 UI는 당분간 숨긴다. 기존 저장값을 직접 읽는 실행 계약은 아래에서 확인한다.
  await expect(page.getByTestId("ai-composer-team")).toHaveCount(0);
  await expect(page.getByTestId("ai-team-menu")).toHaveCount(0);
  log.teamUiHidden = true;

  // 2) 저장된 팀 비트가 있으면 UI 없이도 팀 실행 본문은 유지된다.
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}") as Record<string, unknown>;
    localStorage.setItem("oprn:ai-config", JSON.stringify({ ...current, piTeam: true }));
  });
  await page.getByTestId("ai-input").fill("집 한 채와 길");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(1);
  log.runWithTeam = runs[0];
  expect(runs[0]?.mode).toBe("team");
  expect(runs[0]?.mapIds).toEqual([]);
  await expect(page.getByTestId("ai-chat-log")).toContainText("Pi 에이전트 실패");
  // 6) Pi 실행은 활동 로그에 남는다 — 시작 pending 행 + 실패 종료 행.
  // 종료 행을 기다린다: pending 행만 있는 순간에 at(-1) 을 읽으면 단언이 실행 순서에 따라 흔들린다.
  await expect.poll(() => activity.filter((row) => row.channel === "pi" && row.result?.pending !== true).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  const piRows = activity.filter((row) => row.channel === "pi");
  log.piActivityRows = piRows;
  // 실패해도 근거가 남게 여기서 한 번 쓴다(마지막에 덮어쓴다).
  writeFileSync(path.join(EVIDENCE, "SUMMARY.json"), `${JSON.stringify(log, null, 2)}\n`);
  expect(piRows.some((row) => row.result?.pending === true)).toBe(true);
  const settled = piRows.filter((row) => row.result?.pending !== true).at(-1);
  console.log("[settled]", JSON.stringify(settled?.result));
  expect(settled?.result?.ok).toBe(false);
  expect(settled?.result?.error).toContain("E2E 스텁");
  expect(settled?.instruction).toBe("집 한 채와 길");
  await page.screenshot({ path: path.join(EVIDENCE, "01-team-run-failed.png") });

  // 7) UI를 숨긴 뒤에도 저장된 값을 끄면 다음 실행은 현재 맵 범위의 단독 실행이다.
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}") as Record<string, unknown>;
    localStorage.setItem("oprn:ai-config", JSON.stringify({ ...current, piTeam: false }));
  });
  const configAfterStorage = await readConfig(page);
  log.configAfterStorage = configAfterStorage;
  expect(configAfterStorage.piTeam).toBe(false);
  await page.getByTestId("ai-input").fill("길 하나");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(2);
  log.runWithoutTeam = runs[1];
  expect(runs[1]?.mode).toBe("single");
  expect(runs[1]?.mapIds?.length).toBe(1);

  writeFileSync(path.join(EVIDENCE, "SUMMARY.json"), `${JSON.stringify(log, null, 2)}\n`);
});

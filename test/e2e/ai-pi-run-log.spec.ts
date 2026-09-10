/**
 * Pi 실행 감사 기록의 실표면 증거 — 실제 편집기에서 지시를 보내고 로그 행을 본다.
 *
 * 무엇을 증명하나:
 *  - Pi 실행이 활동 로그(`channel: "pi"`)에 남는다: 시작 pending 행 → 같은 id 의 종료 행.
 *  - 라우트 셀렉트가 그 실행의 모드를 정한다(Pi 팀 → mode=team, Pi 에이전트 → mode=single + 현재 맵).
 *  - `/loop N` 이 감사 서사에 남는다(패널이 회차를 돌리므로 요청 본문에는 안 실린다).
 *  - 설정에서 경로를 바꾸면 컴포저 셀렉트가 즉시 따라온다(두 표면이 같은 값을 쓴다).
 *
 * 모델은 부르지 않는다 — `/v1/agent/run` 을 스텁해 실패 이벤트로 끝내고, 실패 경로의 기록까지 본다.
 *
 * 실행:
 *   npx playwright test test/e2e/ai-pi-run-log.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("output/evidence/ai-pi-run-log");
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
  readonly audit?: readonly { readonly kind?: string; readonly text?: string }[];
}

async function boot(page: Page): Promise<void> {
  const events: string[] = [];
  page.on("pageerror", (error) => events.push(`pageerror:${String(error).slice(0, 300)}`));
  page.on("requestfailed", (request) => events.push(`reqfail:${request.url().slice(0, 100)}:${request.failure()?.errorText ?? ""}`));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const ready = page.locator("[data-testid='login-guest']:visible, [data-testid='edit-canvas']:visible").first();
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
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 30_000 });
}

/** 한 실행이 끝나기를 기다린다 — pending 이 아닌 행이 그 지시에 대해 하나 생기면 끝이다. */
async function waitSettled(rows: ActivityRow[], instruction: string): Promise<void> {
  await expect
    .poll(() => rows.filter((row) => row.channel === "pi" && row.instruction === instruction && row.result?.pending !== true).length, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);
}

test("Pi 실행은 감사 로그에 남고, 경로 셀렉트가 그 모드를 정한다", async ({ page }) => {
  test.setTimeout(180_000);
  const runs: AgentRunBody[] = [];
  const activity: ActivityRow[] = [];
  const log: Record<string, unknown> = {};

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

  // 1) 팀 경로 평문 → mode=team(범위는 프로젝트 전체) + 로그 행 pending→종료.
  const route_ = page.getByTestId("ai-composer-route");
  await expect(route_).toBeVisible({ timeout: 30_000 });
  await route_.selectOption("pi-team");
  await page.getByTestId("ai-input").fill("집 한 채와 길");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(1);
  log.runWithTeam = runs[0];
  expect(runs[0]?.mode).toBe("team");
  expect(runs[0]?.mapIds).toEqual([]);
  await expect(page.getByTestId("ai-chat-log")).toContainText("Pi 에이전트 실패");

  await waitSettled(activity, "집 한 채와 길");
  const teamRows = activity.filter((row) => row.channel === "pi" && row.instruction === "집 한 채와 길");
  log.teamRows = teamRows.map((row) => ({ pending: row.result?.pending, ok: row.result?.ok, error: row.result?.error, audit: row.audit?.map((entry) => entry.text) }));
  // 시작 행이 먼저 남는다 — 죽은 실행도 "무슨 지시였고 언제 시작했는지" 는 남아야 한다.
  expect(teamRows.some((row) => row.result?.pending === true)).toBe(true);
  const teamSettled = teamRows.filter((row) => row.result?.pending !== true).at(-1);
  expect(teamSettled?.result).toMatchObject({ ok: false, error: "E2E 스텁 — 모델을 부르지 않는다" });
  expect(teamSettled?.mapId).toBe("map_blank_start");
  // 감사 서사가 팀 실행이라고 말한다 — 로그만 보고 어느 모드였는지 안다.
  expect(teamSettled?.audit?.some((entry) => entry.text?.includes("Pi 팀"))).toBe(true);

  // 2) 설정에서 경로를 바꾸면 컴포저 셀렉트가 즉시 따라온다(두 표면이 같은 값).
  await page.getByTestId("topbar-ai-settings").click();
  const settingRoute = page.getByTestId("ai-config-route");
  await expect(settingRoute).toBeVisible();
  await expect(settingRoute).toHaveValue("pi-team");
  await settingRoute.selectOption("pi-agent");
  await page.keyboard.press("Escape");
  await expect(settingRoute).toBeHidden();
  await expect(route_).toHaveValue("pi-agent");
  log.composerRouteAfterSettings = await route_.inputValue();

  // 3) 에이전트 경로 평문 → mode=single + 현재 맵.
  await page.getByTestId("ai-input").fill("길 하나");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(2);
  log.runWithoutTeam = runs[1];
  expect(runs[1]?.mode).toBe("single");
  expect(runs[1]?.mapIds?.length).toBe(1);
  await expect(page.getByTestId("ai-chat-log")).toContainText("Pi 에이전트 실패");

  // 4) `/loop N` 은 패널이 회차를 돌리므로 요청 본문에 안 실린다 — 감사 서사에 남는지 본다.
  await page.getByTestId("ai-input").fill("/loop 2 담장 하나");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(3);
  log.loopRun = runs[2];
  expect(runs[2]?.task).toBe("담장 하나");
  await waitSettled(activity, "담장 하나");
  const loopRows = activity.filter((row) => row.channel === "pi" && row.instruction === "담장 하나");
  log.loopRows = loopRows.map((row) => ({ pending: row.result?.pending, audit: row.audit?.map((entry) => entry.text) }));
  expect(loopRows.some((row) => row.audit?.some((entry) => entry.text?.includes("×2회")))).toBe(true);

  await page.screenshot({ path: path.join(EVIDENCE, "01-pi-run-log.png") });
  writeFileSync(path.join(EVIDENCE, "SUMMARY.json"), `${JSON.stringify(log, null, 2)}\n`);
});

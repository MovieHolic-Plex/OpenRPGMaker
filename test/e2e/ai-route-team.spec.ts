/**
 * 실행 경로 정리(2026-09-11)의 실표면 증거 — 실제 편집기에서 토글을 만지고 요청 본문을 본다.
 *
 * 무엇을 증명하나:
 *  - 경로 셀렉트에는 두 값만 있다(조수 / Pi 에이전트). `pi-team` 은 라우트가 아니다.
 *  - 팀은 Pi 경로에서만 보이는 토글이고, 그 값은 `AiConfig.piTeam` 한 곳에 저장된다.
 *  - 팀이 켜진 평문 지시는 `/v1/agent/run` 에 `mode: "team"` 으로, 꺼진 평문은 `mode: "single"` +
 *    현재 맵 범위로 나간다 — 즉 비트가 실제 실행 모드를 정한다.
 *  - 설정 모달의 「Pi 팀 실행」은 같은 값을 읽고 쓰며, 저장하면 컴포저 토글이 즉시 따라온다.
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

test("팀은 경로가 아니라 Pi 의 토글이고, 그 비트가 실행 모드를 정한다", async ({ page }) => {
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

  // 1) 경로는 두 값뿐이다.
  const route = page.getByTestId("ai-composer-route");
  await expect(route).toBeVisible({ timeout: 30_000 });
  log.routeOptions = await route.locator("option").evaluateAll((options) => options.map((option) => option.getAttribute("value")));
  expect(log.routeOptions).toEqual(["session", "pi-agent"]);

  // 2) 기본은 Pi 경로 — 팀 토글이 보이고 기본은 꺼짐.
  const team = page.getByTestId("ai-composer-team");
  const teamMode = page.getByTestId("ai-team-menu").getByRole("button", { name: "팀으로", exact: true });
  await expect(team).toBeVisible();
  await expect(team).toHaveAttribute("data-team", "false");

  // 3) 세션 경로에는 «몇 명이 도는가» 축이 없다 — 토글이 숨는다.
  await route.selectOption("session");
  await expect(team).toBeHidden();
  log.teamToggleHiddenOnSession = true;
  await route.selectOption("pi-agent");
  await expect(team).toBeVisible();
  // 4) 토글이 곧 저장값이다.
  // 마우스를 먼저 올린 뒤 누른다(사람과 같은 순서). 그리고 첫 클릭이 삼켜질 수 있다: 패널이 idle 에서
  // 깨어나며 줄이 움직이면 pointerdown 과 mouseup 의 대상이 갈라지고, 브라우저는 그 클릭을 공통 조상에게
  // 보낸다(2026-09-11 실측 — 클릭 대상이 INPUT 이 아니라 DIV 로 갔다). 두 번째 클릭은 깨어 있는 패널에
  // 닿는다. 이건 이 스펙의 편의가 아니라 패널의 기존 idle 전환 동작이다.
  await team.click();
  await teamMode.click();
  await expect(teamMode).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const configAfterToggle = await readConfig(page);
  log.configAfterToggle = configAfterToggle;
  expect(configAfterToggle.piTeam).toBe(true);

  // 5) 팀이 켜진 평문 → mode=team(범위는 프로젝트 전체).
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

  // 7) 설정 모달은 같은 값을 읽고 쓴다 — 팀 옵션은 「동작」탭에 있다.
  await page.getByTestId("topbar-ai-settings").click();
  await page.getByTestId("ai-settings-tab-behavior").click();
  const settingsTeam = page.getByTestId("ai-config-pi-team");
  await expect(settingsTeam).toBeVisible();
  await expect(settingsTeam).toHaveValue("team");
  await settingsTeam.selectOption("single");
  const configAfterSettings = await readConfig(page);
  log.configAfterSettings = configAfterSettings;
  expect(configAfterSettings.piTeam).toBe(false);
  await page.keyboard.press("Escape");
  await expect(settingsTeam).toBeHidden();

  // 8) 설정에서 끈 것이 컴포저에 즉시 반영된다(두 표면이 같은 비트를 쓴다).
  await expect(team).toHaveAttribute("data-team", "false");

  // 9) 팀이 꺼진 평문 → mode=single + 현재 맵 범위.
  await page.getByTestId("ai-input").fill("길 하나");
  await page.getByTestId("ai-send").click();
  await expect.poll(() => runs.length, { timeout: 30_000 }).toBe(2);
  log.runWithoutTeam = runs[1];
  expect(runs[1]?.mode).toBe("single");
  expect(runs[1]?.mapIds?.length).toBe(1);

  writeFileSync(path.join(EVIDENCE, "SUMMARY.json"), `${JSON.stringify(log, null, 2)}\n`);
});

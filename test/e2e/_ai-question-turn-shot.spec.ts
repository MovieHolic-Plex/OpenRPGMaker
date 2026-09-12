/**
 * 질문 발화의 실표면 증거 스펙 — 「균형」(do) 다이얼에서 "편집하지 마" 류 질문을내면
 * 의도 선언이 mode=question 으로 읽어 Pi 요청이 readOnly 로 나가고, 보드는 「완료」 배지 +
 * 답 말풍선(시스템 줄 앞)으로 끝난다. 스크린샷은 output/evidence/ai-question-turn/ 에 둔다.
 *
 * 실행: npx playwright test test/e2e/_ai-question-turn-shot.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("output/evidence/ai-question-turn");
mkdirSync(EVIDENCE, { recursive: true });

test("균형 다이얼의 질문 발화가 읽기 전용으로 승격되고 답 말풍선이 먼저 온다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  // 의도 선언 LLM — 원문 발화를 보고 question 으로 분류.
  let intentCalls = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    intentCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify({ mode: "question", summary: "맵 이름·크기 조회" }) } }],
      }),
    });
  });

  // Pi 에이전트 — 변경 0건, 본문 답 하나.
  let sawReadOnly: boolean | null = null;
  let sawTask = "";
  await page.route("**/v1/agent/run**", async (route) => {
    const body = route.request().postDataJSON() as { project?: unknown; readOnly?: boolean; task?: string };
    sawReadOnly = body.readOnly === true;
    sawTask = body.task ?? "";
    const events = [
      { type: "start", provider: "google-antigravity", model: "gemini-3.7-flash", toolCount: 4 },
      { type: "turn", index: 1 },
      { type: "assistant", text: "이 맵의 이름은 「빈 맵」이고 크기는 20×15 타일입니다." },
      { type: "done", project: body.project, stats: { ms: 1200, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] },
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      status: 200,
      body: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/auth/**", (route) => route.fulfill({ json: { ok: true, authenticated: true } }));

  const guest = page.getByTestId("login-guest");
  const bootReady = guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await bootReady;
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ai-input")).toBeVisible();

  const dial = page.getByTestId("ai-composer-autonomy");
  await dial.selectOption("balanced");
  await expect(dial).toHaveValue("balanced");

  await page.getByTestId("ai-input").fill("이 맵의 이름과 크기만 알려줘. 편집하지 마.");
  await page.getByTestId("ai-send").click();

  const log = page.getByTestId("ai-chat-log");
  await expect(log).toContainText("읽기 전용", { timeout: 30_000 });
  await expect(log).toContainText("20×15", { timeout: 30_000 });

  // 구조적 보장: Pi 요청이 실제로 readOnly 로 나갔고, 분류 호출이 있었다.
  expect(sawReadOnly).toBe(true);
  expect(intentCalls).toBeGreaterThan(0);
  expect(sawTask).toContain("이 맵의 이름과 크기만 알려줘");

  // 「적용됨」이 아니라 「완료」여야 한다.
  await expect(log).toContainText("완료");
  await expect(log).not.toContainText("적용됨");

  await page.screenshot({ path: path.join(EVIDENCE, "question-promoted.png"), animations: "disabled" });
  await log.screenshot({ path: path.join(EVIDENCE, "question-promoted-log.png"), animations: "disabled" });
});

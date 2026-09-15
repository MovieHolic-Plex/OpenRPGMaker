/**
 * 진단 전용(`_` 접두): 의도 라우터 실측 — 문장 여러 개를 각각 새 빈 프로젝트에 넣고 실제 모델로 한 런을 돌려
 * 라우팅 흔적(planner/의도 확인/volume-contract/tools:exposed)·툴 호출·맵 델타를 /tmp/intent-cases/ 에 남긴다.
 *   OPRN_OH_MY_PI_AUTH_PATH=/home/main/.oprn/oh-my-pi-auth.json DEV_SERVER_PORT=9877 E2E_RETRIES=0 E2E_FREEZE_DEV_SERVER=1 \
 *   AGENT_MODE=auto npx playwright test test/e2e/_intent-router-cases.spec.ts --project=chromium --workers=1
 * CASES 환경변수(줄바꿈 구분)로 문장을 바꿀 수 있다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT_DIR = process.env.CASES_OUT ?? "/tmp/intent-cases";
const AGENT_MODE = process.env.AGENT_MODE === "chat" ? "chat" : "auto";
const DEFAULT_CASES = [
  "술집 지어줘",
  "대장간 지어줘",
  "민가 한 채 지어줘",
  "교회 지어줘",
  "이 마을에 상인 하나 추가해줘",
  "마을은 만들지 말고 여관만 지어줘",
  "퀘스트 말고 상점만 만들어줘",
  "프로젝트 저장해줘",
  "여관이 뭐야",
  "적당히 꾸며줘",
  "마을에 여관 하나 지어줘",
];
const CASES = (process.env.CASES ? process.env.CASES.split("\n") : DEFAULT_CASES).map((line) => line.trim()).filter(Boolean);

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript((agentMode: string) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 40, maxTokens: 32768, agentMode }));
  }, AGENT_MODE);
  await page.setViewportSize({ width: 1440, height: 980 });
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
}

const STATUS_RE = /planner|의도 확인|volume-contract|HARNESS|tools:exposed|tools:escalated|턴 종료|work-plan|계획|autonomous|driver|런 /u;

test.describe(`의도 라우터 실측 (${AGENT_MODE})`, () => {
  test.describe.configure({ timeout: 480_000 });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [index, prompt] of CASES.entries()) {
    test(`${index + 1}. ${prompt}`, async ({ page }) => {
      const auth = await page.request.get("/auth/status").then((res) => res.json() as Promise<{ connected: boolean; provider: string }>);
      expect(auth.connected, JSON.stringify(auth)).toBe(true);
      await bootEditor(page);
      const t0 = Date.now();
      const result = await page.evaluate(async (text: string) => {
        type Audit = Record<string, unknown> & { kind: string };
        const bridge = (window as unknown as { __oprnAiBridge?: { send: (value: string) => Promise<unknown>; audit: () => readonly Audit[] } }).__oprnAiBridge;
        if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
        const before = bridge.audit().length;
        const turn = (await bridge.send(text)) as { ok: boolean; error?: string; lastAssistantText?: string; audit: readonly Audit[] };
        const project = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: { startMapId: string; maps: Record<string, { name: string; width: number; height: number; events: { name?: string; id: string }[] }>; quests?: unknown[] } } } }).__oprnProjectE2E?.currentProject().project;
        return {
          ok: turn.ok,
          error: turn.error ?? null,
          lastAssistantText: (turn.lastAssistantText ?? "").slice(0, 600),
          audit: turn.audit.slice(before),
          startMapId: project?.startMapId ?? null,
          quests: project?.quests?.length ?? 0,
          maps: project
            ? Object.fromEntries(Object.entries(project.maps).map(([id, map]) => [id, { name: map.name, size: `${map.width}x${map.height}`, events: map.events.length, eventNames: map.events.slice(0, 12).map((event) => event.name ?? event.id) }]))
            : null,
        };
      }, prompt);
      const elapsedMs = Date.now() - t0;
      const audit = result.audit as Array<{ kind: string; text?: string; name?: string; ok?: boolean; summary?: string; args?: Record<string, unknown> }>;
      const userEntries = audit.filter((entry) => entry.kind === "user").map((entry) => (entry.text ?? "").slice(0, 2500));
      const statuses = audit.filter((entry) => entry.kind === "status" && STATUS_RE.test(entry.text ?? "")).map((entry) => (entry.text ?? "").slice(0, 400));
      const tools = audit.filter((entry) => entry.kind === "tool").map((entry) => ({ name: entry.name, ok: entry.ok, summary: (entry.summary ?? "").slice(0, 160), args: JSON.stringify(entry.args ?? {}).slice(0, 200) }));
      const llmCalls = audit.filter((entry) => entry.kind === "assistant").length;
      const summary = {
        prompt,
        agentMode: AGENT_MODE,
        provider: auth.provider,
        elapsedMs,
        ok: result.ok,
        error: result.error,
        llmCalls,
        toolCalls: tools.length,
        toolNames: tools.map((tool) => `${tool.name}${tool.ok ? "" : "✗"}`),
        statuses,
        userPayloadHead: userEntries[0]?.slice(0, 1200) ?? null,
        userPayloads: userEntries.length,
        maps: result.maps,
        quests: result.quests,
        lastAssistantText: result.lastAssistantText,
        tools,
      };
      writeFileSync(`${OUT_DIR}/${String(index + 1).padStart(2, "0")}.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
      writeFileSync(`${OUT_DIR}/${String(index + 1).padStart(2, "0")}.audit.json`, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
      console.log(`[case ${index + 1}] ${prompt} — ${elapsedMs}ms llm=${llmCalls} tools=${tools.length} maps=${Object.keys(result.maps ?? {}).length} ${result.ok ? "ok" : `ERR ${result.error}`}`);
    });
  }
});

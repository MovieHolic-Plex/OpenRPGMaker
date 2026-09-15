/**
 * 진단 전용(`_` 접두): 「여관 지어줘」 한 턴의 **감사 로그 전체**(status·tool·orchestration)를 덤프한다.
 * 덤 시공(시작 맵 길·NPC·상점)의 발화점을 찾기 위한 것. 산출은 /tmp 로만 쓴다(dev 서버 리로드 방지).
 *   OPRN_OH_MY_PI_AUTH_PATH=/home/main/.rpg-zzu/oh-my-pi-auth.json DEV_SERVER_PORT=9877 E2E_RETRIES=0 \
 *   npx playwright test test/e2e/_concept-inn-audit.spec.ts --project=chromium --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

const OUT = process.env.AUDIT_OUT ?? "/tmp/inn-audit.json";
const INSTRUCTION = process.env.AUDIT_PROMPT ?? "여관 지어줘";

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 40, maxTokens: 32768, agentMode: "chat" }));
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
}

test.describe("개념 여관 — 감사 로그 덤프", () => {
  test.describe.configure({ timeout: 900_000 });
  test("한 턴의 감사 로그 전체", async ({ page }) => {
    const auth = await page.request.get("/auth/status").then((res) => res.json() as Promise<{ connected: boolean; provider: string }>);
    expect(auth.connected, JSON.stringify(auth)).toBe(true);
    await bootEditor(page);
    const t0 = Date.now();
    const result = await page.evaluate(async (prompt: string) => {
      const bridge = (window as unknown as { __oprnAiBridge?: { send: (value: string) => Promise<unknown>; audit: () => readonly unknown[] } }).__oprnAiBridge;
      if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
      const before = bridge.audit().length;
      const turn = (await bridge.send(prompt)) as { ok: boolean; error?: string; lastAssistantText?: string; audit: readonly Record<string, unknown>[] };
      const project = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: { maps: Record<string, { name: string; events: unknown[] }> } } } }).__oprnProjectE2E?.currentProject().project;
      return {
        ok: turn.ok,
        error: turn.error,
        lastAssistantText: turn.lastAssistantText,
        audit: turn.audit.slice(before),
        maps: project ? Object.fromEntries(Object.entries(project.maps).map(([id, map]) => [id, { name: map.name, events: map.events.length }])) : null,
      };
    }, INSTRUCTION);
    writeFileSync(OUT, `${JSON.stringify({ provider: auth.provider, prompt: INSTRUCTION, elapsedMs: Date.now() - t0, ...result }, null, 2)}\n`, "utf8");
    console.log(`[inn-audit] ${Date.now() - t0}ms entries=${result.audit.length} maps=${JSON.stringify(result.maps)}`);
  });
});

/**
 * 진단 전용(`_` 접두): 실제 모델 턴 뒤 새로 생긴 실내 맵의 **설계 실체**를 덤프한다 —
 * 맵 크기, 하네스 플랜의 방(id·크기·테마), 개념 오버레이의 방별 물건, seed, 타일 해시.
 * 「모델이 템플릿을 그대로 복사했나, 설계를 고쳤나」를 인자 없이도 맵에서 읽는다.
 *   AUDIT_OUT=/tmp/x.json AUDIT_PROMPT='여관 지어줘' OPRN_OH_MY_PI_AUTH_PATH=... DEV_SERVER_PORT=<port> E2E_RETRIES=0 \
 *   npx playwright test test/e2e/_concept-plan-verify.spec.ts --project=chromium --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

const OUT = process.env.AUDIT_OUT ?? "/tmp/concept-plan-verify.json";
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
  await page.goto("/?blankProject=1", { waitUntil: "load" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible({ timeout: 3_000 }).catch(() => false)) await start.click();
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) await skip.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 180_000 });
}

test.describe("개념 시설 — 실 모델 설계 실체 덤프", () => {
  test.describe.configure({ timeout: 900_000 });
  test("한 턴 뒤 새 맵의 플랜·물건·타일 해시", async ({ page }) => {
    const auth = await page.request.get("/auth/status").then((res) => res.json() as Promise<{ connected: boolean; provider: string }>);
    expect(auth.connected, JSON.stringify(auth)).toBe(true);
    await bootEditor(page);
    const t0 = Date.now();
    const result = await page.evaluate(async (prompt: string) => {
      const bridge = (window as unknown as { __oprnAiBridge?: { send: (value: string) => Promise<unknown>; audit: () => readonly unknown[] } }).__oprnAiBridge;
      if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
      const before = bridge.audit().length;
      const turn = (await bridge.send(prompt)) as { ok: boolean; error?: string; lastAssistantText?: string; audit: readonly Record<string, unknown>[] };
      type Plan = {
        seed?: number;
        rooms?: readonly { id: string; x: number; y: number; w: number; h: number; theme?: string; floorTile?: number }[];
        wallMaterial?: string;
        concept?: { facilityLabel: string; rooms: Record<string, { placeId: string; placeLabel: string; role: string; things: readonly { objectId: string; label: string; required: boolean }[] }> };
      };
      type MapView = { name: string; width: number; height: number; lowerTiles: number[]; upperTiles: number[]; events: unknown[]; roomHarnessPlan?: { plan: Plan } };
      const project = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: { maps: Record<string, MapView> } } } }).__oprnProjectE2E?.currentProject().project;
      const hash = (tiles: readonly number[]): string => {
        let h = 2166136261;
        for (const t of tiles) { h ^= (t + 2) & 0xffff; h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(16);
      };
      const maps = project
        ? Object.fromEntries(Object.entries(project.maps).filter(([id]) => id !== "map_blank_start").map(([id, map]) => {
            const plan = map.roomHarnessPlan?.plan;
            return [id, {
              name: map.name,
              width: map.width,
              height: map.height,
              events: map.events.length,
              tileHash: hash([...map.lowerTiles, ...map.upperTiles]),
              seed: plan?.seed,
              wallMaterial: plan?.wallMaterial ?? "cream",
              rooms: (plan?.rooms ?? []).map((room) => ({ id: room.id, x: room.x, y: room.y, w: room.w, h: room.h, theme: room.theme, floorTile: room.floorTile })),
              facility: plan?.concept?.facilityLabel,
              things: Object.fromEntries(Object.entries(plan?.concept?.rooms ?? {}).map(([roomId, room]) => [
                roomId, `${room.placeLabel}[${room.role}]: ${room.things.map((thing) => thing.objectId + (thing.required ? "*" : "")).join(",")}`,
              ])),
              lowerTiles: map.lowerTiles,
              upperTiles: map.upperTiles,
            }];
          }))
        : null;
      return { ok: turn.ok, error: turn.error, lastAssistantText: turn.lastAssistantText, tools: turn.audit.slice(before).filter((entry) => entry.kind === "tool").map((entry) => `${String(entry.name)} | ${String(entry.summary ?? "")}`), maps };
    }, INSTRUCTION);
    writeFileSync(OUT, `${JSON.stringify({ provider: auth.provider, prompt: INSTRUCTION, elapsedMs: Date.now() - t0, ...result }, null, 2)}\n`, "utf8");
    console.log(`[plan-verify] ${Date.now() - t0}ms tools=${result.tools.length} maps=${Object.keys(result.maps ?? {}).join(",")}`);
  });
});

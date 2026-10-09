import { expect, test } from "@playwright/test";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

// 동료 간격(gap) 이 실제 플레이 화면에서 지켜지는지 확인한다. 위치 계산은 유닛으로 고정했지만
// "화면에 정말 그 간격으로 서는가"는 런타임 궤적 승계 + 스프라이트 배치를 다 통과해야 나온다.

type RuntimeState = {
  readonly player: { readonly x: number; readonly y: number };
  readonly followers?: readonly { readonly name: string }[];
  readonly followerTrail?: readonly { readonly x: number; readonly y: number }[];
};

const GAP = 4;

async function readRuntimeState(scope: { getByTestId: (id: string) => { textContent: () => Promise<string | null> } }): Promise<RuntimeState> {
  const raw = await scope.getByTestId("runtime-state-json").textContent();
  return JSON.parse(raw ?? "{}") as RuntimeState;
}

test("동료가 gap 규칙만큼 떨어져 따라온다", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?blankProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  const authored = await page.evaluate(async ({ gap }) => {
    const tools = (await import(/* @vite-ignore */ "/src/editor/tools/applyChangesetToStore.ts")) as {
      applyToolToStore: (name: string, args: Record<string, unknown>) => { ok: boolean; summary: string };
    };
    const { store } = (await import(/* @vite-ignore */ "/src/project/store.ts")) as {
      store: { getCurrent: () => { startMapId: string; maps: Record<string, { events: unknown[] }> } };
    };
    const mapId = store.getCurrent().startMapId;
    const results = [
      tools.applyToolToStore("configure_companion_rules", { gap, maxCompanions: 4 }),
      tools.applyToolToStore("add_companion", {
        who: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 0 },
        target: { mapId, x: 3, y: 3 },
        trigger: "autorun",
        name: "야옹이",
      }),
      tools.applyToolToStore("add_companion", {
        who: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 1 },
        target: { mapId, x: 4, y: 3 },
        trigger: "autorun",
        name: "까망이",
      }),
    ];
    return { results: results.map((entry) => ({ ok: entry.ok, summary: entry.summary })), mapId };
  }, { gap: GAP });

  for (const entry of authored.results) expect(entry.ok, entry.summary).toBe(true);

  await openTestPlayWindow(page);
  const modal = page.getByTestId("test-play-window");
  await startNewGameFromTitle(page, { timeoutMs: 60_000 });

  await expect
    .poll(async () => (await readRuntimeState(modal)).followers?.length ?? 0, { timeout: 20_000 })
    .toBe(2);

  for (let step = 0; step < 12; step += 1) await tapKey(page, "ArrowRight");

  const state = await readRuntimeState(modal);
  const trail = state.followerTrail ?? [];
  expect(trail.length).toBeGreaterThanOrEqual(2 * GAP);

  // index 번째 동료는 trail[(index+1)*gap - 1] 을 읽는다 → 서로 gap 칸 떨어져 있어야 한다.
  const first = trail[GAP - 1];
  const second = trail[2 * GAP - 1];
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  const spacing = Math.abs((first?.x ?? 0) - (second?.x ?? 0)) + Math.abs((first?.y ?? 0) - (second?.y ?? 0));
  expect(spacing).toBe(GAP);
  expect(Math.abs(state.player.x - (first?.x ?? 0)) + Math.abs(state.player.y - (first?.y ?? 0))).toBe(GAP);

  await modal.getByTestId("play-stage").screenshot({ path: "reports/shots/companion/gap4-follow.png" });
});

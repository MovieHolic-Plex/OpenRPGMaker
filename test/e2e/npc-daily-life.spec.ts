// 주민이 시간표대로 실제로 움직이는지 브라우저에서 증명한다.
//
// 실측 배경(2026-07-26): 데모 마을은 집 12채에 주민 4명이었고 시간표 0개, system.timeSystem 미설정.
// updateNpcSchedules 는 시간 시스템이 없으면 즉시 return 하므로(npcSchedules.ts:31) 주민이
// 영원히 제자리에 얼어 있었다. "마을이 살아 있다" 는 건 이 테스트가 통과할 때만 참이다.
//
// 시계를 빠르게 돌리는 이유: 기본값(1분/실초)으로는 아침(6~10시)에서 낮(10~18시)으로 넘어가는 데
// 실제 4분이 걸린다. 테스트가 검증하려는 것은 시계 속도가 아니라 **시간표가 작동하는가** 이므로
// minutesPerRealSecond 만 올려 같은 메커니즘을 빠르게 통과시킨다.
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type DebugState = {
  readonly gameTime?: { readonly hour: number; readonly minute: number };
  readonly npcActivities: Record<string, string>;
};

// window.__oprnDebug 는 런타임이 이미 선언한다(playSceneTestHooks). 여기서 다시 declare 하면
// 실제 타입과 충돌해 프로젝트 전체 타입 검사를 깨뜨린다(실측) — 그래서 evaluate 결과만 캐스팅한다.
type DebugWindow = { __oprnDebug?: { readState(): DebugState } };

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

test("주민이 시간표대로 낮 활동으로 옮겨간다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  const project = createSampleAdventureProject();
  // 시간표가 이미 붙어 있어야 한다 — 이게 0이면 아래 검증은 의미가 없다.
  const scheduled = project.maps[project.startMapId]!.events.filter((e) => (e.schedule?.length ?? 0) > 0);
  expect(scheduled.length, "데모 마을에 시간표를 가진 주민이 없다").toBeGreaterThan(0);
  // 시간 시스템을 켜는 것은 **제품의 책임**이다. 여기서 켜 주면 기본값이 꺼져도 테스트가 통과한다
  // (실제로 그랬다 — 네거티브 컨트롤로 잡은 구멍이다). 그래서 켜져 있는지 확인만 하고 속도만 올린다.
  expect(project.system.timeSystem?.enabled, "데모 프로젝트의 시간 시스템이 꺼져 있다 — 시간표가 실행되지 않는다").toBe(true);
  project.system = {
    ...project.system,
    timeSystem: { ...project.system.timeSystem!, minutesPerRealSecond: 240 },
  };

  await seedProjectFromSupabaseCanonical(page, project);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  const readState = async (): Promise<DebugState | null> =>
    await page.evaluate(() => (window as unknown as DebugWindow).__oprnDebug?.readState() ?? null);

  // 시계가 실제로 흐르는지 먼저 확인한다 — 멈춰 있으면 시간표 검증이 무의미하다.
  const first = await expect
    .poll(async () => (await readState())?.gameTime?.hour ?? null, { timeout: 20_000 })
    .not.toBeNull()
    .then(async () => (await readState())!.gameTime!);

  await expect
    .poll(async () => {
      const t = (await readState())?.gameTime;
      if (!t) return 0;
      return t.hour * 60 + t.minute;
    }, { timeout: 30_000 })
    .toBeGreaterThan(first.hour * 60 + first.minute);

  // 낮 활동(market/field/play/watch)이 하나라도 배정되면 시간표가 작동한 것이다.
  const dayActivities = ["market", "field", "play", "watch"];
  await expect
    .poll(async () => {
      const activities = Object.values((await readState())?.npcActivities ?? {});
      return activities.filter((a) => dayActivities.includes(a));
    }, { timeout: 40_000 })
    .not.toEqual([]);

  const state = await readState();
  expect(Object.keys(state!.npcActivities).length, "활동이 배정된 주민이 없다").toBeGreaterThan(0);
});

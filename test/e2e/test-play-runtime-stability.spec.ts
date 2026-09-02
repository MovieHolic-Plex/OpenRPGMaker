// 편집기 테스트 플레이 창의 런타임 안정성 — 2026-09-03 리뷰의 세 결함이 실제 편집기 경로에서
// 고쳐졌는지 브라우저로 확인한다.
//
//  1. 방향키를 **짧게 탭**해도(keydown→keyup 이 한 프레임 안에 끝나도) 한 걸음이 나간다.
//     실측(고치기 전): 즉시 탭 4회 → 1칸. 프레임이 늘어지는 기계에서 「될 때도 안 될 때도」의 원인.
//  2. 테스트 플레이 창이 열린 동안 편집기 Phaser 게임은 잠들고, 닫으면 깨어난다.
//  3. 대화 한 번에 타일 계층이 다시 만들어지지 않고 카메라 startFollow 스냅이 없다.
import { expect, test, type Page } from "@playwright/test";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const SIZE = 24;

test.setTimeout(150_000);
test.use({ serviceWorkers: "block" });

type RuntimeState = { readonly player: { readonly x: number; readonly y: number } };
type PerfCounters = {
  readonly tileRebuilds: number;
  readonly cameraRefollows: number;
  readonly eventLayerRebuilds: number;
};

async function runtimeState(page: Page): Promise<RuntimeState> {
  return await page.evaluate(() => {
    const text = document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}";
    return JSON.parse(text) as { player: { x: number; y: number } };
  });
}

async function perfCounters(page: Page): Promise<PerfCounters> {
  return await page.evaluate(() => {
    const read = (window as unknown as { __oprnPerf?: () => PerfCounters | null }).__oprnPerf;
    const counters = read?.();
    if (!counters) throw new Error("__oprnPerf 훅이 없다 — 계측 부팅이 아니다");
    return counters;
  });
}

function openFieldProject(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const map = createBlankMap("탭 이동 증거 맵", SIZE, SIZE);
  map.id = "map_tap_field";
  map.tilesetId = project.maps[project.startMapId]!.tilesetId;
  map.lowerTiles = new Array(SIZE * SIZE).fill(TILE.GRASS);
  map.upperTiles = new Array(SIZE * SIZE).fill(-1);
  map.events = [
    {
      id: "ev_greeter",
      x: 12,
      y: 8,
      trigger: { kind: "action" },
      commands: [{ kind: "text", body: "안녕. 탭 이동 증거 맵이야." }, { kind: "text", body: "두 번째 문장." }],
      sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
    },
  ];
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 12, y: 10 };
  return project;
}

test("편집기 테스트 플레이: 짧은 탭도 한 걸음 · 편집기 게임은 잠들고 · 대화가 타일을 다시 만들지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:test-play-auto-start", "0");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, openFieldProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("mode-play").click({ force: true });
  const playWindow = page.getByTestId("test-play-window");
  await expect(playWindow).toBeVisible({ timeout: 20_000 });
  // 2. 창이 열린 동안 편집기 게임은 잠든다.
  await expect(playWindow).toHaveAttribute("data-editor-game-suspended", "true");

  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  await expect.poll(async () => (await runtimeState(page)).player.y, { timeout: 15_000 }).toBe(10);
  await page.waitForTimeout(500);

  // 1. keyboard.press 는 keydown 직후 keyup 을 보낸다 — 프레임 폴링만으로는 대부분 놓치는 입력이다.
  const before = await runtimeState(page);
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(350);
  }
  await expect.poll(async () => (await runtimeState(page)).player.y, { timeout: 5_000 }).toBe(before.player.y + 4);

  // 3. NPC(12,8) 바로 아래 (12,9) 로 올라가 위를 보고 말을 건다. 대화가 열리고 닫히는 동안
  //    타일 계층 재생성과 카메라 재추적이 0 이어야 한다.
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(350);
  }
  await expect.poll(async () => (await runtimeState(page)).player.y, { timeout: 5_000 }).toBe(9);
  const perfBefore = await perfCounters(page);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 10_000 });
  for (let index = 0; index < 6; index += 1) {
    if ((await page.getByTestId("dialogue-box").count()) === 0) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
  }
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0, { timeout: 10_000 });
  const perfAfter = await perfCounters(page);
  expect(perfAfter.tileRebuilds - perfBefore.tileRebuilds, "대화 중 타일 계층이 다시 만들어졌다").toBe(0);
  expect(perfAfter.cameraRefollows - perfBefore.cameraRefollows, "대화 중 카메라가 startFollow 로 스냅됐다").toBe(0);
  // 이벤트 계층은 대화 시작·끝에 다시 그려진다(페이지 조건 반영) — 0 이면 갱신이 사라진 것이다.
  expect(perfAfter.eventLayerRebuilds - perfBefore.eventLayerRebuilds).toBeGreaterThan(0);

  // 2. 닫으면 편집기 게임이 깨어나고 편집기가 그대로 살아 있다.
  await page.getByTestId("test-play-window-close").click();
  await expect(playWindow).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __oprnEditorGameSuspended?: boolean }).__oprnEditorGameSuspended))
    .toBe(false);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});

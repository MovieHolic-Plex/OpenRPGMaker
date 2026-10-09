import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";

/**
 * 얼음 대평원 64×64 를 실제 에디터/런타임 화면에서 관찰한다.
 *
 * 이 판의 지형 계약: 물은 한 칸도 없고(감독 지시), 절벽 한 겹은 벽 두 행(373/403)이며
 * 그 바로 위 행은 평지 립 343 이라 걸어다닐 수 있다. 고도는 계단으로만 넘는다.
 */
const SHOTS = "tmp/ice-plain-e2e";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  mkdirSync(SHOTS, { recursive: true });
});

test("walls block the climb and the stair is the only way up", async ({ page }) => {
  // 이 토판은 27칸을 걷는다(y62→51 · x32→36 · y51→39). 한 칸당 상태 재독이 있어
  // 기본 30소 한도로는 마지막 스킬샷에서 넘는다. 단언은 전부 상태 기반이므로
  // 대기 시간을 늘리는 것이 아니라 이동 예산만 넓힌다.
  test.setTimeout(120_000);
  await page.goto("/?devProject=1&icePlain64=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("edit-canvas").locator("canvas").first().screenshot({ path: `${SHOTS}/01-editor.png` });

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);

  const state = page.getByTestId("runtime-state-json");
  await expect(state).toBeAttached({ timeout: 20_000 });
  const read = async (): Promise<{ mapId: string; player: { x: number; y: number } }> =>
    JSON.parse((await state.textContent()) ?? "{}");

  /**
   * 좌표를 읽어 목표 쪽으로 한 펄스씩 가고 매번 다시 읽는다.
   *
   * 한 번의 입력이 한 칸 갈지 두 칸 갈지는 프레임 타이밍에 달려 있어 고정되지 않는다.
   * 지나치면 반대 방향으로 되돌아오므로 이 루프는 타이밍과 무관하게 목표 칸에 수렴한다.
   *
   * 한 번 안 움직인 것을 바로 "벽"으로 보면 안 된다 — 이동 애니메이션 중이거나 입력이
   * 한 번 누락되면 제자리로 읽히는데, 그것을 벽으로 처리해서 실제로 이 테스트가 깨졌다
   * (y=51 을 기대했으나 61 에서 멈췄다). 같은 자리가 STUCK_LIMIT 번 연속 나올 때만 막힌 것으로 본다.
   */
  const STUCK_LIMIT = 4;
  const walkTo = async (axis: "x" | "y", target: number): Promise<number> => {
    let stuck = 0;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const at = (await read()).player[axis];
      if (at === target) return at;
      const key = axis === "x"
        ? (at > target ? "ArrowLeft" : "ArrowRight")
        : (at > target ? "ArrowUp" : "ArrowDown");
      await tapKey(page, key, 120);
      if ((await read()).player[axis] === at) {
        stuck += 1;
        if (stuck >= STUCK_LIMIT) break;
      } else {
        stuck = 0;
      }
    }
    return (await read()).player[axis];
  };

  await expect.poll(async () => (await read()).player.y, { timeout: 20_000 }).toBe(62);
  const start = await read();
  expect(start.mapId).toBe("map_ice_grand_plain_64");
  expect(start.player).toEqual({ x: 32, y: 62 });
  await page.screenshot({ path: `${SHOTS}/02-play-start.png` });

  // 시작 열(x=32)에서 북으로 계속 가면 겹A 의 벽에 막혀 y=51 에서 멈춘다(통행 실측).
  // 계단은 x35~38 이므로 시작 열은 계단이 아니다 — 절벽이 진짜 벽으로 작동하는지 보는 것이다.
  expect(await walkTo("y", 40)).toBe(51);
  await page.screenshot({ path: `${SHOTS}/03-blocked-by-wall.png` });

  // 계단 열(x=36)로 네 칸 옮기면 같은 겹을 끊어 놓았으므로 위 대지까지 올라간다.
  expect(await walkTo("x", 36)).toBe(36);
  expect(await walkTo("y", 39)).toBe(39);
  await page.screenshot({ path: `${SHOTS}/04-climbed-stair.png` });
});

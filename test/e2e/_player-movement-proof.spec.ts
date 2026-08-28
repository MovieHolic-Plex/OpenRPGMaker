// C1 실물 증거: 내보내기 플레이어 빌드(편집기 셸·저작 게이트 없음)를 실제 브라우저에서 띄우고,
// 이동 유형 "무작위" + 일정을 가진 예제 마을 주민의 런타임 타일 좌표가 변하는지 관찰한다.
// 사전 준비(감독자가 수행): npm run build:player →
//   npx vite-node scripts/tmp-player-movement-fixture.mts dist/export-player/project.json →
//   (cd dist/export-player && python3 -m http.server 9861 --bind 127.0.0.1)
import { expect, test } from "@playwright/test";

const PLAYER_URL = process.env.PLAYER_URL ?? "http://127.0.0.1:9861/player.html";
const VILLAGER_ID = process.env.VILLAGER_ID ?? "ev_mir_elder";

type SpriteDebug = { readonly events: Record<string, { readonly x: number; readonly y: number }> };
type DebugWindow = {
  __oprnDebug?: { readState(): unknown };
  __oprnCharacterSprites?: () => SpriteDebug | null;
};

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });

test("내보내기 플레이어에서 무작위 이동 주민이 실제로 타일을 옮긴다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(PLAYER_URL);

  // 타이틀에서 "여정을 시작" 을 골라야 PlayScene 이 생성되고 런타임 훅이 설치된다.
  const newGame = page.getByTestId("title-new-game");
  if (await newGame.count() > 0) {
    await newGame.click({ force: true }).catch(() => undefined);
  }
  await page.keyboard.press("Enter").catch(() => undefined);

  await expect.poll(
    async () => await page.evaluate(() => typeof (window as unknown as DebugWindow).__oprnDebug === "object"),
    { timeout: 120_000, message: `런타임 디버그 훅이 설치되지 않았다. pageerror=${JSON.stringify(errors)}` },
  ).toBe(true);

  const readTile = async (): Promise<string | null> =>
    await page.evaluate((id) => {
      const sprites = (window as unknown as DebugWindow).__oprnCharacterSprites?.();
      const sprite = sprites?.events?.[id];
      return sprite ? `${Math.round(sprite.x)},${Math.round(sprite.y)}` : null;
    }, VILLAGER_ID);

  const first = await readTile();
  expect(first, `주민 ${VILLAGER_ID} 이 이벤트 스프라이트 스냅샷에 없다`).not.toBeNull();

  const seen = new Set<string>([first!]);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && seen.size < 2) {
    const tile = await readTile();
    if (tile) seen.add(tile);
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: "verify-shots/event-left-panel/player-random-movement.png" });
  console.log(`[proof] villager=${VILLAGER_ID} start=${first} tiles=${JSON.stringify([...seen])}`);

  expect(
    seen.size,
    `주민 ${VILLAGER_ID} 이 60초 동안 ${first} 에서 한 칸도 움직이지 않았다 (관찰 타일: ${JSON.stringify([...seen])})`,
  ).toBeGreaterThan(1);
});

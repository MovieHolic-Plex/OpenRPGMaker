/**
 * 진단: **광산이 실제로 열리고, 돌이 보이고, 캐지는가.**
 *
 * 유닛 테스트는 저작만 본다. 이 데모에서 이미 한 번 물린 자리가 있다 —
 * 기력 100 을 저작하고 유닛은 초록인데 런타임은 0 이었다(`startSession` 이 시작 변수를 버렸다).
 * 설치물도 같은 모양의 위험이 있다: 필드를 시드해도 렌더 경로가 없으면 **보이지 않는 돌을
 * 곡괭이로 캐는** 반쪽이 된다. 그래서 화면과 인벤토리로 확인한다.
 *
 * 주의: `playwright.config.ts` 는 포트 9173 에 `reuseExistingServer: true` 라서 병렬 워크트리가
 * 있으면 **남의 dev 서버를 검증한다**. 반드시 `DEV_SERVER_PORT=<빈 포트>` 로 돌린다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "output/evidence/stardew/runtime/";
const FARM_MAP_ID = "map_farming_demo";
const MINE_MAP_ID = "map_mine_1f";
const log: string[] = [];

type RuntimeState = { currentMapId: string; x: number; y: number; inventory: Record<string, number> };

async function waitForHooks(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as never as { __oprnDebug?: { teleport?: unknown }; __oprnInput?: unknown };
      return typeof w.__oprnDebug?.teleport === "function" && !!w.__oprnInput;
    },
    undefined,
    { timeout: 30_000 },
  );
}

async function state(page: Page): Promise<RuntimeState> {
  await waitForHooks(page);
  return page.evaluate(() => {
    const s = (window as never as { __oprnDebug: { readState: () => RuntimeState } }).__oprnDebug.readState();
    return { currentMapId: s.currentMapId, x: s.x, y: s.y, inventory: s.inventory };
  });
}

async function teleport(page: Page, mapId: string, x: number, y: number): Promise<void> {
  await waitForHooks(page);
  await page.evaluate(
    ([m, tx, ty]) =>
      (window as never as { __oprnDebug: { teleport: (a: string, b: number, c: number) => void } })
        .__oprnDebug.teleport(m as string, tx as number, ty as number),
    [mapId, x, y] as const,
  );
  await page.waitForTimeout(400);
}

async function face(page: Page, dir: string): Promise<void> {
  await page.evaluate(
    (d) => (window as never as { __oprnInput: { face: (v: string) => void } }).__oprnInput.face(d),
    dir,
  );
  await page.waitForTimeout(160);
}

/** 방향키를 holdMs 동안 누른다(런타임 입력 훅). */
async function walk(page: Page, dir: string, holdMs: number): Promise<void> {
  await page.evaluate(
    (d) => (window as never as { __oprnInput: { dir: (v: string | null) => void } }).__oprnInput.dir(d),
    dir,
  );
  await page.waitForTimeout(holdMs);
  await page.evaluate(() =>
    (window as never as { __oprnInput: { dir: (v: string | null) => void } }).__oprnInput.dir(null),
  );
  await page.waitForTimeout(500);
}

/** 대사창은 실제 keydown 을 듣는다 — Phaser 훅으로는 넘어가지 않는다(실측). */
async function clearDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    if ((await page.getByTestId("dialogue-box").count()) === 0) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
}

test("광산에 들어가 보이는 돌을 곡괭이로 캐고 밖으로 나온다", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createFarmingDemoProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);

  const start = await state(page);
  log.push(`[시작] 맵=${start.currentMapId} 곡괭이=${start.inventory.item_pickaxe ?? 0} 돌=${start.inventory.item_stone ?? 0}`);

  // 1) 광산 입구(17,10) — 아래 칸에 서서 위를 본다.
  await teleport(page, FARM_MAP_ID, 17, 11);
  await face(page, "up");
  await tapKey(page, "Space", 260);
  await page.waitForTimeout(700);
  await clearDialogue(page);
  await page.waitForTimeout(1200);
  const inMine = await state(page);
  log.push(`[입구] 맵=${inMine.currentMapId} 좌표=(${inMine.x},${inMine.y})`);
  expect(inMine.currentMapId, "광산 입구가 전이하지 않았다").toBe(MINE_MAP_ID);

  // 스폰 스프라이트가 엉뚱한 캐릭셋으로 폴백되면 박쥐가 사람으로 보인다 — 실제 키를 찍는다.
  const sprites = await page.evaluate(() => {
    const hook = (window as never as { __oprnCharacterSprites?: () => { events: Record<string, { textureKey: string; frame: string | number }> } | null })
      .__oprnCharacterSprites;
    const dump = hook?.();
    return Object.entries(dump?.events ?? {}).map(([id, s]) => `${id}=${s.textureKey}#${s.frame}`);
  });
  log.push(`[스프라이트] ${sprites.join(" ") || "(없음)"}`);

  // 던전 칩셋은 통행 플래그 기본값이 없다 — 암벽이 solid 로 저작되지 않으면 벽을 걸어 통과한다.
  await teleport(page, MINE_MAP_ID, 9, 5);
  await walk(page, "up", 1200);
  const walled = await state(page);
  log.push(`[암벽] 좌표=(${walled.x},${walled.y})`);
  expect(walled.y, "광산 암벽을 걸어서 통과했다 — 던전 칩셋 통행 플래그가 없다").toBe(5);

  // 2) 돌(4,6) 아래 칸에 서서 위를 본다. 캐기 전/후를 같은 자리에서 찍어 화면 차이가
  //    오직 돌 때문이도록 한다.
  await teleport(page, MINE_MAP_ID, 4, 7);
  await face(page, "up");
  await page.waitForTimeout(600);
  const shotBefore = await page.getByTestId("play-stage").screenshot();
  writeFileSync(`${OUT}mine-01-before.png`, shotBefore);

  await tapKey(page, "Space", 260);
  await page.waitForTimeout(900);
  await face(page, "up");
  await page.waitForTimeout(600);
  const shotAfter = await page.getByTestId("play-stage").screenshot();
  writeFileSync(`${OUT}mine-02-after.png`, shotAfter);

  const mined = await state(page);
  log.push(`[채굴] 돌=${mined.inventory.item_stone ?? 0} 화면변화=${!shotBefore.equals(shotAfter)}`);
  expect(mined.inventory.item_stone ?? 0, "곡괭이로 캤는데 돌이 들어오지 않았다").toBeGreaterThanOrEqual(1);
  expect(shotBefore.equals(shotAfter), "돌을 캤는데 화면이 한 픽셀도 바뀌지 않았다 — 렌더 경로가 없다").toBe(false);

  // 3) 출구(9,15) — 한 칸 아래로 걸어 들어가 playerTouch 를 발동시킨다.
  await teleport(page, MINE_MAP_ID, 9, 14);
  await walk(page, "down", 1400);
  await page.waitForTimeout(700);
  const out = await state(page);
  log.push(`[출구] 맵=${out.currentMapId} 좌표=(${out.x},${out.y})`);
  expect(out.currentMapId, "광산 출구가 농장으로 돌려보내지 않았다").toBe(FARM_MAP_ID);

  writeFileSync(`${OUT}mine-notes.txt`, log.join("\n"));
  console.log(log.join("\n"));
  console.log(`>>> 광산진입=${inMine.currentMapId} 돌=${mined.inventory.item_stone ?? 0} 복귀=${out.currentMapId}`);
});

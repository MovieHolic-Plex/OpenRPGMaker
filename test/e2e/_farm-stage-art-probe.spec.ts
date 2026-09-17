/**
 * 진단: **수확기처럼 보이는데 수확이 안 되는 단계**가 있는지 본다.
 *
 * 감자는 `stages: [{days:1},{days:1}]`(총 2일)이고 `graphicStages` 는 두 장
 * (새싹=frame0, 수확기=frame1)이다. 렌더러는 `stages[min(stage, len-1)]` 로 고른다.
 *   1일차 → stage 1 → graphicStages[1] = 「감자 수확기」 그림, 그런데 isCropReady 는 false
 *   2일차 → stage 2 → 같은 그림으로 고정(clamp), 이때 처음 수확 가능
 * 그림이 같으면 플레이어는 익은 것과 안 익은 것을 구별할 수 없다. 화면과 토스트로 확인한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/AppData/Local/Temp/farm-inspect/";
const MAP_ID = "map_farming_demo";
const log: string[] = [];

function projectWithGrowthLever(): ReturnType<typeof createFarmingDemoProject> {
  const project = createFarmingDemoProject();
  const map = project.maps[MAP_ID];
  if (!map) throw new Error("농사 데모 맵을 찾지 못했다");
  map.events.push({
    id: "ev_grow",
    x: 9,
    y: 4,
    trigger: { kind: "action" },
    commands: [{ kind: "advanceCropGrowth", days: 1 }],
  } as never);
  return project;
}

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([mapId, tx, ty]) =>
      (window as never as { __oprnDebug: { teleport: (m: string, a: number, b: number) => void } })
        .__oprnDebug.teleport(mapId as string, tx as number, ty as number),
    [MAP_ID, x, y] as const,
  );
  await page.waitForTimeout(240);
}

async function face(page: Page, dir: string): Promise<void> {
  await page.evaluate(
    (d) => (window as never as { __oprnInput: { face: (v: string) => void } }).__oprnInput.face(d),
    dir,
  );
  await page.waitForTimeout(120);
}

async function toastText(page: Page): Promise<string> {
  const zone = page.getByTestId("zone-feedback");
  if ((await zone.count()) === 0) return "";
  return ((await zone.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

async function potatoCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const debug = (window as never as { __oprnDebug: { readState: () => { inventory: Record<string, number> } } }).__oprnDebug;
    return debug.readState().inventory.item_potato ?? 0;
  });
}

/** (x,5) 를 정면에 두고 A. */
async function actOn(page: Page, x: number, what: string): Promise<string> {
  await teleport(page, x, 4);
  await face(page, "down");
  await tapKey(page, "Space", 220);
  await page.waitForTimeout(320);
  const toast = await toastText(page);
  log.push(`[행동] ${what}(${x},5) 안내="${toast || "없음"}"`);
  return toast;
}

async function growOneDay(page: Page): Promise<void> {
  await teleport(page, 8, 4);
  await face(page, "right");
  await tapKey(page, "Space", 260);
  await page.waitForTimeout(800);
}

test("1일차 감자는 수확기 그림인데 수확이 되는가", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, projectWithGrowthLever());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);

  // 갈고 심고 물 준다 (한 칸만).
  await page.keyboard.press("1");
  await page.waitForTimeout(180);
  await actOn(page, 4, "갈기");
  await page.keyboard.press("3");
  await page.waitForTimeout(180);
  await actOn(page, 4, "심기");
  await page.keyboard.press("2");
  await page.waitForTimeout(180);
  await actOn(page, 4, "물주기");

  // 1일차 성장 → 그림을 남기고, 빈 손으로 수확을 시도한다.
  await growOneDay(page);
  await teleport(page, 4, 4);
  await face(page, "down");
  await page.waitForTimeout(400);
  writeFileSync(`${OUT}probe-day1.png`, await page.getByTestId("play-stage").screenshot());
  await page.keyboard.press("0"); // 빈 손 — 레거시 캐스케이드(수확 우선)
  await page.waitForTimeout(180);
  const before = await potatoCount(page);
  const day1Toast = await actOn(page, 4, "1일차 수확 시도");
  const afterDay1 = await potatoCount(page);
  log.push(`[1일차] 감자 ${before} → ${afterDay1}`);

  // 2일차: 물 주고 한 번 더 키운 뒤 같은 자리에서 수확한다.
  await page.keyboard.press("2");
  await page.waitForTimeout(180);
  await actOn(page, 4, "물주기(2일차)");
  await growOneDay(page);
  await teleport(page, 4, 4);
  await face(page, "down");
  await page.waitForTimeout(400);
  writeFileSync(`${OUT}probe-day2.png`, await page.getByTestId("play-stage").screenshot());
  await page.keyboard.press("0");
  await page.waitForTimeout(180);
  const day2Toast = await actOn(page, 4, "2일차 수확 시도");
  const afterDay2 = await potatoCount(page);
  log.push(`[2일차] 감자 ${afterDay1} → ${afterDay2}`);

  writeFileSync(`${OUT}probe-notes.txt`, log.join("\n"));
  console.log(log.join("\n"));
  console.log(`1일차 토스트="${day1Toast}" / 2일차 토스트="${day2Toast}"`);
});

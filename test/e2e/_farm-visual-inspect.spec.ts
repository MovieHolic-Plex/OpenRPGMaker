/**
 * 농사 런타임 **시각 검수**(진단용 `_` 스펙). 유닛 검사는 세션 객체만 본다 —
 * 밭 오버레이가 실제 오토타일로 그려지는지, 손 슬롯 HUD 가 손에 든 것을 말해 주는지,
 * 씨앗을 다 쓰고 나서 「빈 손」으로 떨어지는지는 화면에서만 확인된다.
 *
 * 농사 데모: 시작 (4,4) · 밭 x4..9 y5..8 · 괭이1 물뿌리개1 감자씨3 딸기씨2 토마토씨2 옥수수씨2.
 * 감자는 1일 단계 두 개라 물주기→성장 두 번이면 수확기가 된다. 달력을 움직이지 않고
 * 같은 성장 루프만 돌리는 `advanceCropGrowth` 이벤트를 (9,4) 에 심어 쓴다.
 *
 * **위치는 방향키로 걷지 않고 teleport 로 확정한다.** 방향키 드라이버로 걸으면 이동이 한 칸
 * 밀리거나 씬이 바쁠 때 삼켜져서, 같은 칸을 두 번 때린 것을 앱 결함으로 오독하게 된다(실측).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/AppData/Local/Temp/farm-inspect/";
const MAP_ID = "map_farming_demo";
const shot = (name: string): string => `${OUT}${name}.png`;
const log: string[] = [];

function projectWithGrowthLever(): ReturnType<typeof createFarmingDemoProject> {
  const project = createFarmingDemoProject();
  // maps 는 배열이 아니라 Record<MapId, GameMap> 이다.
  const map = project.maps[MAP_ID];
  if (!map) throw new Error("농사 데모 맵을 찾지 못했다");
  // 밭(y5..8) 밖이면서 손이 닿는 칸에 둔다 — 밭 위에 두면 조사 이벤트가 농사 액션을 가로챈다.
  map.events.push({
    id: "ev_grow",
    x: 9,
    y: 4,
    trigger: { kind: "action" },
    commands: [{ kind: "advanceCropGrowth", days: 1 }],
  } as never);
  return project;
}

type Probe = { readonly x: number; readonly y: number; readonly inventory: Record<string, number> };

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const debug = (window as never as { __rpgzzuDebug: { readState: () => Probe } }).__rpgzzuDebug;
    const state = debug.readState();
    return { x: state.x, y: state.y, inventory: state.inventory };
  });
}

/** 손 슬롯 칩이 말하는 현재 손. HUD 가 진실이다 — 세션을 읽으면 HUD 결함을 놓친다. */
async function handLabel(page: Page): Promise<string> {
  const chip = page.getByTestId("hand-slot-label");
  if ((await chip.count()) === 0) return "(칩 없음)";
  return ((await chip.first().textContent()) ?? "").trim();
}

/** 마지막 농사 안내 토스트. 실패 사유를 화면에서 그대로 읽어 온다. */
async function toastText(page: Page): Promise<string> {
  const zone = page.getByTestId("zone-feedback");
  if ((await zone.count()) === 0) return "";
  return ((await zone.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

/** 숫자키는 window keydown 전역 핸들러가 먹는다 — tapKey 는 방향/액션만 아므로 직접 누른다. */
async function equipSlot(page: Page, digit: string, why: string): Promise<void> {
  await page.keyboard.press(digit);
  await page.waitForTimeout(200);
  log.push(`[손] ${digit}번키 → "${await handLabel(page)}" (${why})`);
}

/** (x, y) 를 정면으로 두고 A. 위 칸에 서서 아래를 본다. */
async function actOn(page: Page, x: number, y: number, what: string): Promise<void> {
  await page.evaluate(
    ([mapId, tx, ty]) =>
      (window as never as { __rpgzzuDebug: { teleport: (m: string, a: number, b: number) => void } })
        .__rpgzzuDebug.teleport(mapId as string, tx as number, ty as number),
    [MAP_ID, x, y - 1] as const,
  );
  await page.waitForTimeout(260);
  await page.evaluate(() =>
    (window as never as { __rpgzzuInput: { face: (d: string) => void } }).__rpgzzuInput.face("down"),
  );
  await page.waitForTimeout(120);
  await tapKey(page, "Space", 220);
  await page.waitForTimeout(320);
  const at = await probe(page);
  const toast = await toastText(page);
  log.push(
    `[행동] ${what} 대상(${x},${y}) 서있음(${at.x},${at.y})` + (toast ? ` 안내="${toast}"` : " 안내=없음"),
  );
}

/** (9,4) 조사 이벤트로 성장 루프 한 번. 달력은 움직이지 않는다. */
async function growOneDay(page: Page, label: string): Promise<void> {
  await page.evaluate(
    ([mapId]) =>
      (window as never as { __rpgzzuDebug: { teleport: (m: string, a: number, b: number) => void } })
        .__rpgzzuDebug.teleport(mapId as string, 8, 4),
    [MAP_ID] as const,
  );
  await page.waitForTimeout(260);
  await page.evaluate(() =>
    (window as never as { __rpgzzuInput: { face: (d: string) => void } }).__rpgzzuInput.face("right"),
  );
  await page.waitForTimeout(120);
  await tapKey(page, "Space", 260);
  await page.waitForTimeout(800);
  log.push(`[성장] ${label}`);
}

const ROW = [4, 5, 6] as const;
const TARGET_Y = 5;

test("농사 한 사이클을 화면으로 검수한다 — 갈기·심기·물주기·성장·수확", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });

  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, projectWithGrowthLever());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);

  // 1) 첫 화면 — 손 슬롯 HUD 가 붙었는지, 밭 가능 영역이 보이는지.
  log.push(`[시작] 손="${await handLabel(page)}"`);
  writeFileSync(shot("01-start"), await page.getByTestId("play-stage").screenshot());

  // 2) 괭이로 세 칸 — 오토타일 모양은 이웃이 있어야 드러난다.
  await equipSlot(page, "1", "괭이");
  for (const x of ROW) await actOn(page, x, TARGET_Y, "갈기");
  writeFileSync(shot("02-tilled"), await page.getByTestId("play-stage").screenshot());

  // 3) 감자 씨앗 세 개를 세 칸에. 씨앗은 정확히 3개 — 마지막을 심으면 손이 비어야 한다.
  await equipSlot(page, "3", "감자 씨앗");
  for (const x of ROW) await actOn(page, x, TARGET_Y, "심기");
  log.push(`[씨앗] 마지막 파종 후 손="${await handLabel(page)}" 잔량=${(await probe(page)).inventory.item_potato_seed ?? 0}`);
  writeFileSync(shot("03-planted"), await page.getByTestId("play-stage").screenshot());

  // 4) 물뿌리개 — 젖은 흙은 어두운 틴트 한 겹이어야 한다.
  await equipSlot(page, "2", "물뿌리개");
  for (const x of ROW) await actOn(page, x, TARGET_Y, "물주기");
  writeFileSync(shot("04-watered"), await page.getByTestId("play-stage").screenshot());

  // 5) 성장 → 물 → 성장. 감자는 1일 단계 두 개라 여기서 수확기가 된다.
  await growOneDay(page, "1일차");
  writeFileSync(shot("05-grown-1"), await page.getByTestId("play-stage").screenshot());
  await equipSlot(page, "2", "물뿌리개 재장착");
  for (const x of ROW) await actOn(page, x, TARGET_Y, "물주기(2일차)");
  await growOneDay(page, "2일차");
  writeFileSync(shot("06-mature"), await page.getByTestId("play-stage").screenshot());

  // 6) **괭이를 든 채로** 수확한다. 다 자란 작물은 손에 뭘 들었든 수확돼야 한다(이번 수정의 핵심).
  await equipSlot(page, "1", "괭이 — 수확은 손과 무관해야 한다");
  const before = (await probe(page)).inventory.item_potato ?? 0;
  for (const x of ROW) await actOn(page, x, TARGET_Y, "수확(괭이 든 채)");
  const after = (await probe(page)).inventory.item_potato ?? 0;
  log.push(`[수확] 감자 ${before} → ${after}`);
  writeFileSync(shot("07-harvested"), await page.getByTestId("play-stage").screenshot());
  writeFileSync(shot("07-harvested-full"), await page.screenshot());

  writeFileSync(`${OUT}notes.txt`, log.join("\n"));
  console.log(log.join("\n"));

  // 판정은 스샷을 본 뒤에 한다. 다만 세 칸을 다 수확하지 못하면 시각 검수가 성립하지 않는다.
  expect(after - before, "세 칸에서 감자가 나오지 않았다").toBe(ROW.length);
});

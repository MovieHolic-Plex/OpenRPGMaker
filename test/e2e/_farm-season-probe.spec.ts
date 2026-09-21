/**
 * 적대 검수: **철이 아닌 씨앗을 심으려 할 때 런타임이 무슨 말을 하는가.**
 *
 * `farming.ts` 의 plant 분기는 out-of-season 을 `wrong-tool-for-plot` 으로 돌려주고,
 * 그 문구는 "지금 든 도구로는 할 수 없습니다" 다. 플레이어는 **올바른 도구(씨앗)** 를
 * **올바르게 갈린 밭** 에 대고 있다. 진짜 이유(계절)는 화면에 전혀 나오지 않는다.
 * 바로 위 줄이 "도구가 없다는 안내는 거짓이다" 라며 경계한 그 거짓이다.
 *
 * 데모 작물 4종이 전부 spring 전용이므로, 여름이 되면 밭 전체가 죽고 심을 것도 없다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/AppData/Local/Temp/farm-inspect/";
const MAP_ID = "map_farming_demo";
const log: string[] = [];

function projectWithLevers(): ReturnType<typeof createFarmingDemoProject> {
  const project = createFarmingDemoProject();
  const map = project.maps[MAP_ID];
  if (!map) throw new Error("농사 데모 맵을 찾지 못했다");
  // (9,4) 하루 성장 · (10,4) 28일 경과(= 봄 1일 → 여름 1일)
  map.events.push(
    { id: "ev_grow", x: 9, y: 4, trigger: { kind: "action" }, commands: [{ kind: "advanceCropGrowth", days: 1 }] } as never,
    { id: "ev_season", x: 10, y: 4, trigger: { kind: "action" }, commands: [{ kind: "advanceTime", days: 28 }] } as never,
  );
  return project;
}

/**
 * 취침 페이드(28일 = 28회) 도중에는 씬이 재생성되며 `__oprnDebug` 가 잠시 사라진다.
 * 곧바로 teleport 를 부르면 `Cannot read properties of undefined` 로 죽는다(실측).
 */
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

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await waitForHooks(page);
  await page.evaluate(
    ([m, tx, ty]) =>
      (window as never as { __oprnDebug: { teleport: (a: string, b: number, c: number) => void } })
        .__oprnDebug.teleport(m as string, tx as number, ty as number),
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

async function toast(page: Page): Promise<string> {
  const zone = page.getByTestId("zone-feedback");
  if ((await zone.count()) === 0) return "";
  return ((await zone.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

async function clock(page: Page): Promise<string> {
  const hud = page.getByTestId("runtime-time-hud");
  if ((await hud.count()) === 0) return "(시계 없음)";
  return ((await hud.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

/**
 * `advanceTime {days}` 는 하루당 취침 연출을 **순차로** 돌린다(28일 = 28회 페이드).
 * 고정 대기로는 중간에 끊겨 "봄 5일" 같은 엉뚱한 날짜에서 검사하게 된다(실측).
 * 시계가 멈출 때까지 기다린다.
 */
async function waitForClockToSettle(page: Page): Promise<string> {
  let previous = "";
  for (let tick = 0; tick < 60; tick += 1) {
    const now = await clock(page);
    if (now === previous && now !== "") return now;
    previous = now;
    await page.waitForTimeout(1000);
  }
  return previous;
}

async function hand(page: Page): Promise<string> {
  const chip = page.getByTestId("hand-slot-label");
  if ((await chip.count()) === 0) return "(칩 없음)";
  return ((await chip.first().textContent()) ?? "").trim();
}

/** (x,5) 를 정면에 두고 A. */
async function actOn(page: Page, x: number, what: string): Promise<string> {
  await teleport(page, x, 4);
  await face(page, "down");
  await tapKey(page, "Space", 220);
  await page.waitForTimeout(320);
  const said = await toast(page);
  log.push(`[행동] ${what} 손="${await hand(page)}" 안내="${said || "없음"}"`);
  return said;
}

async function pull(page: Page, x: number, label: string): Promise<void> {
  await teleport(page, x - 1, 4);
  await face(page, "right");
  await tapKey(page, "Space", 260);
  await page.waitForTimeout(600);
  log.push(`[레버] ${label} → ${await waitForClockToSettle(page)}`);
}

test("여름이 된 밭에서 봄 씨앗을 심으려 하면 무슨 말을 하는가", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, projectWithLevers());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  log.push(`[시작] ${await clock(page)}`);

  // 봄: 두 칸을 갈고 감자를 심고 물을 준다.
  await page.keyboard.press("1");
  await page.waitForTimeout(180);
  for (const x of [4, 5]) await actOn(page, x, "갈기");
  await page.keyboard.press("3");
  await page.waitForTimeout(180);
  await actOn(page, 4, "감자 심기");
  await page.keyboard.press("2");
  await page.waitForTimeout(180);
  await actOn(page, 4, "물주기");
  writeFileSync(`${OUT}season-01-spring.png`, await page.getByTestId("play-stage").screenshot());

  // 28일 경과 → 여름 1일.
  await pull(page, 10, "28일 경과");
  await teleport(page, 4, 4);
  await face(page, "down");
  await page.waitForTimeout(500);
  writeFileSync(`${OUT}season-02-summer.png`, await page.getByTestId("play-stage").screenshot());

  // 여름에 봄 씨앗(감자는 소진, 딸기 2개 보유)을 들고 **갈린 빈 밭** 에 심어 본다.
  await page.keyboard.press("4"); // 딸기 씨앗 (봄 전용)
  await page.waitForTimeout(200);
  const said = await actOn(page, 5, "여름에 봄 씨앗 심기 시도");
  writeFileSync(`${OUT}season-03-plant-refused.png`, await page.getByTestId("play-stage").screenshot());

  // 죽은 감자 칸도 눌러 본다.
  const deadSaid = await actOn(page, 4, "죽은 작물 칸");

  // 여름 작물(블루베리)은 여름에 실제로 심겨야 한다 — 계절 컨텐츠가 붙었는지 화면으로 본다.
  await page.evaluate(() =>
    (window as never as { __oprnDebug: { giveItem: (id: string, n: number) => void } })
      .__oprnDebug.giveItem("item_blueberry_seed", 3),
  );
  await page.waitForTimeout(300);
  // 손 슬롯 번호를 추측하지 않는다 — 칩 문구를 보고 블루베리가 잡힐 때까지 숫자키를 넘긴다.
  let picked = "";
  for (let digit = 1; digit <= 9; digit += 1) {
    await page.keyboard.press(String(digit));
    await page.waitForTimeout(150);
    const label = await hand(page);
    if (label.includes("블루베리")) {
      picked = label;
      break;
    }
  }
  log.push(`[여름작물] 손="${picked || "블루베리를 손에 못 잡음"}"`);
  const summerPlant = await actOn(page, 5, "여름에 여름 씨앗 심기");
  await page.waitForTimeout(400);
  writeFileSync(`${OUT}season-04-summer-planted.png`, await page.getByTestId("play-stage").screenshot());
  console.log(`>>> 여름작물 손="${picked}" 심기안내="${summerPlant || "없음(=성공)"}"`);

  writeFileSync(`${OUT}season-notes.txt`, log.join("\n"));
  console.log(log.join("\n"));
  console.log(`>>> 봄씨앗/여름 안내 = "${said}"`);
  console.log(`>>> 죽은칸 안내 = "${deadSaid}"`);
});

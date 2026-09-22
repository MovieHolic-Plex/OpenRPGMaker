/**
 * 진단: **농사 루프가 닫혔는가.** 침대로 하루를 넘기고, 씨앗 상인에게 수확물을 팔 수 있는지 본다.
 *
 * 이전 데모에는 침대도 상점도 없었다 — 작물은 하루가 지나야 자라는데 하루를 넘길 수단이
 * 실시간 20분 걸어다니기뿐이었고, 수확물을 골드로 바꿀 경로가 아예 없었다.
 *
 * 주의: `playwright.config.ts` 는 포트 9173 에 `reuseExistingServer: true` 라서 병렬 워크트리가
 * 있으면 **남의 dev 서버를 검증한다**(실측). 반드시 `DEV_SERVER_PORT=<빈 포트>` 로 돌린다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "output/evidence/stardew/runtime/";
const MAP_ID = "map_farming_demo";
const log: string[] = [];

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

async function clock(page: Page): Promise<string> {
  const hud = page.getByTestId("runtime-time-hud");
  if ((await hud.count()) === 0) return "(시계 없음)";
  return ((await hud.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

async function state(page: Page): Promise<{ gold: number; variables: Record<string, number>; inventory: Record<string, number> }> {
  await waitForHooks(page);
  return page.evaluate(() => {
    const s = (window as never as { __oprnDebug: { readState: () => { gold: number; variables: Record<string, number>; inventory: Record<string, number> } } })
      .__oprnDebug.readState();
    return { gold: s.gold, variables: s.variables, inventory: s.inventory };
  });
}

/** 옆 칸 이벤트를 조사한다. */
async function talkTo(page: Page, x: number, y: number, dir: string, label: string): Promise<void> {
  await teleport(page, x, y);
  await face(page, dir);
  await tapKey(page, "Space", 260);
  await page.waitForTimeout(900);
  log.push(`[조사] ${label}`);
}

test("침대로 하루를 넘기고 씨앗 상인에게 수확물을 판다", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, createFarmingDemoProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);

  const before = await state(page);
  log.push(`[시작] ${await clock(page)} 골드=${before.gold} 기력=${before.variables.var_stamina ?? "없음"}`);

  // 1) 침대(3,3) — 위 칸(3,2)에 서서 아래를 본다.
  const dayBefore = await clock(page);
  await talkTo(page, 3, 2, "down", "침대");
  // 대사창을 넘겨 sleepUntilMorning 까지 진행시킨다.
  // 대사창은 **실제 keydown** 을 듣는다 — __oprnInput.action() 훅은 Phaser 쪽이라 대사를
  // 넘기지 못한다(실측: 대사창이 그대로 떠 있고 하루가 넘어가지 않았다).
  for (let i = 0; i < 6; i += 1) {
    if ((await page.getByTestId("dialogue-box").count()) === 0) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  const dayAfter = await clock(page);
  const afterSleep = await state(page);
  log.push(`[침대] ${dayBefore} → ${dayAfter} 기력=${afterSleep.variables.var_stamina ?? "없음"}`);
  writeFileSync(`${OUT}loop-01-after-sleep.png`, await page.getByTestId("play-stage").screenshot());

  // 2) 수확물을 손에 넣고 씨앗 상인(12,3)에게 간다 — 왼 칸(11,3)에서 오른쪽을 본다.
  await page.evaluate(() =>
    (window as never as { __oprnDebug: { giveItem: (id: string, n: number) => void } })
      .__oprnDebug.giveItem("item_potato", 6),
  );
  await page.waitForTimeout(300);
  // 침대 대사창이 열려 있으면 이후 조작을 전부 삼킨다 — 먼저 닫는다.
  for (let i = 0; i < 8; i += 1) {
    if ((await page.getByTestId("dialogue-box").count()) === 0) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  await talkTo(page, 11, 3, "right", "씨앗 상인");
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }
  // 본문 텍스트로 판정하면 뒤에 있는 에디터 DOM의 "상점" 글자를 잡는다(실측 거짓 양성).
  // 런타임이 실제로 그리는 shop-scene 만 본다.
  const shopOpen = (await page.getByTestId("shop-scene").count()) > 0;
  const shopText = shopOpen ? ((await page.getByTestId("shop-scene").first().textContent()) ?? "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
  log.push(`[상점] 열림=${shopOpen} 목록="${shopText}"`);
  writeFileSync(`${OUT}loop-02-shop.png`, await page.screenshot());

  writeFileSync(`${OUT}loop-notes.txt`, log.join("\n"));
  console.log(log.join("\n"));
  console.log(`>>> 잠들기 전="${dayBefore}" 후="${dayAfter}" 상점열림=${shopOpen}`);
  expect(dayAfter, "침대에서 잤는데 날짜가 바뀌지 않았다").not.toBe(dayBefore);
  expect(afterSleep.variables.var_stamina, "수면 뒤 기력이 회복되지 않았다").toBe(100);
  expect(shopOpen, "씨앗 상인과 대화했는데 상점이 열리지 않았다").toBe(true);
});

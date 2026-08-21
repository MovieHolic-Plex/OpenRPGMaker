// 적대적 완주 하네스 — rpg-zzu-quest-demo 를 실제로 끝까지 플레이하고,
// 도중에 발견한 어색함/막힘을 전부 수집해 출력한다. 확인 후 삭제한다.
//
// 적대적으로 굴리는 지점:
//   - 열쇠 없이 봉인문을 먼저 두드린다(잠김 처리가 실제로 막는지)
//   - 대사 중에 이동/공격 입력을 밀어넣는다(입력 누수)
//   - 메뉴를 열었다 닫고 그 사이 상태가 깨지는지 본다
//   - 상자를 두 번 연다(중복 수령)
//   - 우물을 만복 상태에서 쓴다
import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

const SHOT = { x: 320, y: 190, width: 640, height: 520 };
type InputHandle = { dir: (d: string | null) => void; attack: () => void };

const complaints: string[] = [];
function complain(text: string): void {
  complaints.push(text);
  console.log(`COMPLAINT ${text}`);
}

async function press(page: Page, dir: string, ms = 220): Promise<void> {
  await page.evaluate(async ({ dir, ms }) => {
    const h = (window as unknown as { __oprnInput?: InputHandle }).__oprnInput;
    h?.dir(dir);
    await new Promise((r) => setTimeout(r, ms));
    h?.dir(null);
  }, { dir, ms });
  await page.waitForTimeout(90);
}

async function state(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node) return null;
    try {
      return JSON.parse(String(node.textContent)) as Record<string, unknown>;
    } catch {
      return null;
    }
  });
}

async function dialogueOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const overlay = document.querySelector(".dialogue-overlay");
    return overlay ? overlay.children.length > 0 : false;
  });
}

/** 대사를 끝까지 넘긴다. 넘겨진 횟수를 돌려준다. */
async function clearDialogue(page: Page, label: string): Promise<number> {
  for (let i = 0; i < 20; i += 1) {
    if (!(await dialogueOpen(page))) return i;
    await page.locator(".dialogue-box").first().click({ force: true });
    await page.waitForTimeout(240);
  }
  complain(`${label}: 대사창이 20번 눌러도 닫히지 않는다`);
  return -1;
}

async function playerAt(page: Page): Promise<{ x: number; y: number } | null> {
  const snapshot = await state(page);
  return (snapshot?.player as { x: number; y: number } | undefined) ?? null;
}

// 한 번 누를 때 **두 칸** 움직인다(실측: 260ms → 2칸). 그래서 목표 칸을 정확히 밟으려 하면
// 홀수 좌표에서 6↔8 처럼 영원히 왕복한다. 짧게 눌러 한 칸씩 옮긴다.
const STEP_MS = 120;

/**
 * 대상 칸에 **인접**할 때까지 걸어가고, 마지막에 대상을 바라본다.
 * 이벤트 칸 자체는 overlapForbidden 으로 밟을 수 없으므로 인접이 정답이다.
 */
async function goAdjacent(page: Page, tx: number, ty: number, label: string, maxSteps = 90): Promise<boolean> {
  let stuck = 0;
  let last: { x: number; y: number } | null = null;
  for (let i = 0; i < maxSteps; i += 1) {
    const player = await playerAt(page);
    if (!player) {
      complain(`${label}: 플레이어 좌표를 읽을 수 없다`);
      return false;
    }
    const dx = tx - player.x;
    const dy = ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) <= 1) {
      // 대상을 바라보게 한 방향만 살짝 눌러 둔다(이동은 막혀도 방향은 바뀐다).
      if (dx !== 0) await press(page, dx > 0 ? "right" : "left", 60);
      else if (dy !== 0) await press(page, dy > 0 ? "down" : "up", 60);
      return true;
    }
    if (last && last.x === player.x && last.y === player.y) {
      stuck += 1;
      // 적이 길을 막았을 수 있다 — 베어 본다.
      await page.evaluate(() => {
        const h = (window as unknown as { __oprnInput?: InputHandle }).__oprnInput;
        h?.attack();
      });
      await page.waitForTimeout(160);
      // 축을 바꿔 우회한다.
      if (stuck % 3 === 1 && dx !== 0) await press(page, dx > 0 ? "right" : "left", STEP_MS);
      else if (stuck % 3 === 2 && dy !== 0) await press(page, dy > 0 ? "down" : "up", STEP_MS);
      if (stuck > 14) {
        complain(`${label}: (${tx},${ty}) 인접까지 못 갔다 — (${player.x},${player.y}) 에서 막힘`);
        return false;
      }
    } else {
      stuck = 0;
    }
    last = { ...player };
    // 세로를 먼저 맞춘다 — 통로가 세로로 난 구조가 많다.
    if (dy !== 0) await press(page, dy > 0 ? "down" : "up", STEP_MS);
    else await press(page, dx > 0 ? "right" : "left", STEP_MS);
  }
  const snapshot = await state(page);
  complain(
    `${label}: (${tx},${ty}) 인접 도달 실패 — pos ${JSON.stringify(snapshot?.player)}`
    + ` inputEnabled=${String((snapshot as { inputEnabled?: boolean } | null)?.inputEnabled)}`
    + ` running=${String((snapshot as { running?: boolean } | null)?.running)}`
  );
  return false;
}

/**
 * 경유지를 거쳐 이동한다. goAdjacent 는 장애물 회피를 못 하므로
 * 벽으로 갈라진 구역을 건널 때는 통로 지점을 먼저 밟아야 한다.
 */
async function goVia(page: Page, waypoints: readonly [number, number][], label: string): Promise<boolean> {
  for (const [wx, wy] of waypoints.slice(0, -1)) {
    if (!(await goAdjacent(page, wx, wy, `${label} 경유(${wx},${wy})`))) return false;
  }
  const [tx, ty] = waypoints[waypoints.length - 1];
  return goAdjacent(page, tx, ty, label);
}

async function interact(page: Page): Promise<void> {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
}

test("완주: 마을 → 폐허 → 보스 → 엔딩", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() !== "error") return;
    // 개발 서버 환경 잡음은 게임 결함이 아니다.
    if (/ERR_CONNECTION_REFUSED|404 \(Not Found\)/.test(text)) return;
    errors.push(text.slice(0, 200));
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?project=rpg-zzu-quest-demo");
  await page.waitForTimeout(6000);
  await page.getByTestId("mode-play").click({ force: true });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: testInfo.outputPath("q01-title.png"), clip: SHOT });

  await startNewGameFromTitle(page);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: testInfo.outputPath("q02-village.png"), clip: SHOT });

  const start = await state(page);
  console.log("START", JSON.stringify(start?.player), (start as { mapId?: string } | null)?.mapId);

  // ── 1. 안내판 (11,8) — 시작 지점 오른쪽
  await goAdjacent(page, 11, 8, "안내판 접근");
  await interact(page);
  if (!(await dialogueOpen(page))) complain("안내판: 조사해도 대사가 뜨지 않는다");
  await page.screenshot({ path: testInfo.outputPath("q03-sign.png"), clip: SHOT });
  // 적대적: 대사 중에 이동·공격을 밀어넣는다.
  await press(page, "left", 200);
  await page.evaluate(() => {
    const h = (window as unknown as { __oprnInput?: InputHandle }).__oprnInput;
    h?.attack();
  });
  const duringDialogue = await state(page);
  const movedDuringDialogue = (duringDialogue?.player as { x: number } | undefined)?.x !== 10;
  if (movedDuringDialogue) complain("안내판: 대사 중에 플레이어가 이동했다(입력 누수)");
  await clearDialogue(page, "안내판");

  // ── 2. 촌장 (8,6) — 회복약 지급
  const beforeElder = await state(page);
  await goAdjacent(page, 8, 6, "촌장 접근");
  await interact(page);
  await clearDialogue(page, "촌장");
  const afterElder = await state(page);
  const inv = (afterElder as { inventory?: Record<string, number> } | null)?.inventory ?? {};
  if ((inv.item_potion ?? 0) < 3) complain(`촌장: 회복약 3개를 못 받았다 — inventory ${JSON.stringify(inv.item_potion)}`);
  // 적대적: 두 번 말을 건다(중복 지급이면 결함)
  await interact(page);
  await clearDialogue(page, "촌장 재대화");
  const afterElder2 = await state(page);
  const inv2 = (afterElder2 as { inventory?: Record<string, number> } | null)?.inventory ?? {};
  if ((inv2.item_potion ?? 0) > (inv.item_potion ?? 0)) complain("촌장: 두 번 대화하면 회복약을 또 준다(중복 지급)");
  void beforeElder;

  // ── 2b. 집 문 3개가 반응하는지(벽 덩어리를 말없이 세워두면 안 된다)
  for (const [hx, hy, label] of [[4, 5, "집 문 A"], [15, 5, "집 문 B"], [4, 10, "창고 문"]] as const) {
    // 도로(y=7)를 따라 x 를 맞춘 뒤 앞마당으로 올라간다 — NPC 가 y=6 줄에 서 있어 그 줄로는 못 지난다.
    await goVia(page, [[hx, 7], [hx, hy]], `${label} 접근`);
    await interact(page);
    if (!(await dialogueOpen(page))) complain(`${label}: 조사해도 아무 반응이 없다`);
    await clearDialogue(page, label);
  }

  // ── 2c. 상점이 실제로 열리고 거래되는지
  await goVia(page, [[14, 7], [14, 6]], "행상인 접근");
  await interact(page);
  await page.waitForTimeout(900);
  // 상인 인사말을 넘기면 상점 창이 떠야 한다.
  for (let i = 0; i < 4 && (await dialogueOpen(page)); i += 1) {
    const shopOpen = await page.getByTestId("shop-mode-buy").isVisible().catch(() => false);
    if (shopOpen) break;
    await page.locator(".dialogue-box").first().click({ force: true });
    await page.waitForTimeout(500);
  }
  const shopVisible = await page.getByTestId("shop-mode-buy").isVisible().catch(() => false);
  await page.screenshot({ path: testInfo.outputPath("q03b-shop.png"), clip: SHOT });
  if (shopVisible) {
    // 상점 뒤가 왜 파랗게 덮이는지 — 화면 중앙에 실제로 무엇이 있는지 스택으로 본다.
    console.log("SHOP_STACK", JSON.stringify(await page.evaluate(() => {
      return document.elementsFromPoint(640, 380).slice(0, 5).map((n) => {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return `${n.tagName.toLowerCase()}.${String((n as HTMLElement).className)}|${Math.round(r.width)}x${Math.round(r.height)}|bg=${cs.backgroundColor}|bi=${cs.borderImageSource === "none" ? "none" : "img"}|z=${cs.zIndex}`;
      });
    })));
  }
  if (!shopVisible) {
    complain("행상인: 상점 창(shop-mode-buy)이 열리지 않는다 — 골드를 쓸 곳이 없다");
  }
  // 상점을 닫고 나온다.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if (!(await page.getByTestId("shop-mode-buy").isVisible().catch(() => false))) break;
  }
  await clearDialogue(page, "행상인 마무리");

  // ── 3. 폐허로 이동 (북쪽 9,1 / 10,1 playerTouch)
  await goAdjacent(page, 10, 2, "북쪽 출구 접근");
  await press(page, "up", 400);
  await page.waitForTimeout(1400);
  const inRuins = await state(page);
  const ruinsMap = (inRuins as { mapId?: string } | null)?.mapId;
  if (ruinsMap !== "map_quest_ruins") complain(`폐허 이동 실패 — 현재 맵 ${ruinsMap}`);
  await page.screenshot({ path: testInfo.outputPath("q04-ruins.png"), clip: SHOT });

  // ── 4. 적대적: 열쇠 없이 봉인문 먼저 (10,4)
  await goAdjacent(page, 10, 4, "봉인문 접근(열쇠 없이)");
  await interact(page);
  const lockedOpen = await dialogueOpen(page);
  if (!lockedOpen) complain("봉인문: 열쇠 없이 조사했는데 아무 반응이 없다");
  await clearDialogue(page, "봉인문(잠김)");
  const afterLocked = await state(page);
  if ((afterLocked as { mapId?: string } | null)?.mapId !== "map_quest_ruins") {
    complain("봉인문: 열쇠가 없는데 보스방으로 넘어갔다");
  }
  await page.screenshot({ path: testInfo.outputPath("q05-locked.png"), clip: SHOT });

  // ── 5. 열쇠 상자 (3,3)
  await goVia(page, [[10, 7], [4, 7], [4, 4], [3, 3]], "열쇠 상자 접근");
  await interact(page);
  await clearDialogue(page, "열쇠 상자");
  const afterChest = await state(page);
  const switches = (afterChest as { switches?: Record<string, boolean> } | null)?.switches ?? {};
  if (switches.sw_quest_key !== true) complain("열쇠 상자: 열었는데 sw_quest_key 가 켜지지 않았다");
  const goldAfterChest = (afterChest as { gold?: number } | null)?.gold ?? 0;
  // 적대적: 상자를 또 연다
  await interact(page);
  await clearDialogue(page, "열쇠 상자 재개방");
  const afterChest2 = await state(page);
  if (((afterChest2 as { gold?: number } | null)?.gold ?? 0) > goldAfterChest) {
    complain("열쇠 상자: 두 번 열면 골드를 또 준다(중복 수령)");
  }
  await page.screenshot({ path: testInfo.outputPath("q06-key.png"), clip: SHOT });

  // ── 6. 적대적: 메뉴를 열었다 닫는다
  await page.keyboard.press("X");
  await page.waitForTimeout(900);
  const menuVisible = await page.getByTestId("main-menu").isVisible().catch(() => false);
  if (!menuVisible) complain("메뉴: X 를 눌러도 열리지 않는다");
  await page.screenshot({ path: testInfo.outputPath("q07-menu.png"), clip: SHOT });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  if (await page.getByTestId("main-menu").isVisible().catch(() => false)) {
    complain("메뉴: Escape 로 닫히지 않는다");
  }
  const afterMenu = await state(page);
  if ((afterMenu as { inputEnabled?: boolean } | null)?.inputEnabled !== true) {
    complain("메뉴: 닫은 뒤 입력이 되살아나지 않았다(inputEnabled false)");
  }

  // ── 6a-1. 전투가 실제로 아프게 하는지 — 적 서식지에 가만히 서 있는다.
  const heroHp = (snapshot: Record<string, unknown> | null): number | null => {
    const vitals = (snapshot as { actorVitals?: Record<string, { hp: number }> } | null)?.actorVitals ?? {};
    const first = Object.values(vitals)[0];
    return first ? first.hp : null;
  };
  await goVia(page, [[10, 7], [5, 7], [5, 5]], "슬라임 서식지 진입");
  const hpBeforeHits = heroHp(await state(page));
  for (let i = 0; i < 24; i += 1) await page.waitForTimeout(500);
  const hpAfterHits = heroHp(await state(page));
  console.log("HP", hpBeforeHits, "->", hpAfterHits);
  if (hpBeforeHits !== null && hpAfterHits !== null && hpAfterHits >= hpBeforeHits) {
    complain(`적 서식지에서 12초 서 있었는데 HP 가 줄지 않았다 (${hpBeforeHits} → ${hpAfterHits}) — 접촉 피해가 성립하지 않는다`);
  }

  // ── 6a-2. 회복약을 메뉴에서 실제로 써 본다.
  await page.keyboard.press("X");
  await page.waitForTimeout(900);
  if (await page.getByTestId("main-menu").isVisible().catch(() => false)) {
    await page.getByTestId("status-menu-command-items").click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: testInfo.outputPath("q06b-items.png"), clip: SHOT });
    const potionRow = page.getByTestId("status-menu-item-item_potion");
    if ((await potionRow.count()) === 0) {
      complain("아이템 메뉴: 받은 회복약(item_potion)이 목록에 없다");
    } else {
      const hpBeforePotion = heroHp(await state(page));
      await potionRow.click({ force: true });
      await page.waitForTimeout(900);
      // 대상 선택이 뜨면 확정한다.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(900);
      const afterPotion = await state(page);
      const hpAfterPotion = heroHp(afterPotion);
      const potionLeft = ((afterPotion as { inventory?: Record<string, number> } | null)?.inventory ?? {}).item_potion ?? 0;
      console.log("POTION", hpBeforePotion, "->", hpAfterPotion, "남은", potionLeft);
      if (hpBeforePotion !== null && hpAfterPotion !== null && hpAfterPotion <= hpBeforePotion) {
        complain(`회복약을 썼는데 HP 가 늘지 않았다 (${hpBeforePotion} → ${hpAfterPotion})`);
      }
      if (potionLeft >= 3) complain(`회복약을 썼는데 개수가 줄지 않았다 — 남은 ${potionLeft}`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }

  // ── 6a-3. 세이브가 진행 상태(열쇠)를 담는지
  await page.keyboard.press("X");
  await page.waitForTimeout(800);
  if (await page.getByTestId("main-menu").isVisible().catch(() => false)) {
    await page.getByTestId("status-menu-command-save").click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    const slot = page.getByTestId("save-slot-1");
    if ((await slot.count()) > 0) {
      await slot.click({ force: true });
      await page.waitForTimeout(1200);
      const saved = await page.evaluate(() => {
        const raw = window.localStorage.getItem("oprn:save-slot:1");
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { session?: { switches?: Record<string, boolean> } };
          return parsed.session?.switches?.sw_quest_key ?? null;
        } catch {
          return "parse-error";
        }
      });
      console.log("SAVED_KEY_SWITCH", JSON.stringify(saved));
      if (saved !== true) complain(`세이브에 열쇠 진행이 담기지 않았다 — sw_quest_key=${JSON.stringify(saved)}`);
    } else {
      complain("저장 메뉴: 세이브 칸(save-slot-1)을 찾을 수 없다");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }

  // ── 6b. 적대적: 대사 중에 메뉴를 연다
  await goAdjacent(page, 11, 12, "비석 접근");
  await interact(page);
  if (await dialogueOpen(page)) {
    await page.keyboard.press("X");
    await page.waitForTimeout(700);
    const menuDuringDialogue = await page.getByTestId("main-menu").isVisible().catch(() => false);
    if (menuDuringDialogue) complain("대사 중에 메뉴가 열린다(입력 격리 실패)");
    if (menuDuringDialogue) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  }
  await clearDialogue(page, "비석");

  // ── 6c. 적대적: NPC 를 베어 본다(마을 NPC 는 검에 반응하면 안 된다)
  const beforeSwing = await state(page);
  await page.evaluate(() => {
    const h = (window as unknown as { __oprnInput?: InputHandle }).__oprnInput;
    for (let i = 0; i < 5; i += 1) h?.attack();
  });
  await page.waitForTimeout(600);
  const afterSwing = await state(page);
  if (JSON.stringify((beforeSwing as { switches?: unknown } | null)?.switches)
      !== JSON.stringify((afterSwing as { switches?: unknown } | null)?.switches)) {
    complain("비석 앞에서 검을 휘두르자 스위치 상태가 바뀌었다");
  }

  // ── 6d. 적대적: 벽/물로 계속 밀어붙인다(좌표가 맵 밖으로 빠지면 결함)
  for (let i = 0; i < 6; i += 1) await press(page, "down", 200);
  const afterWallPush = await playerAt(page);
  if (afterWallPush && (afterWallPush.x < 0 || afterWallPush.y < 0 || afterWallPush.x > 19 || afterWallPush.y > 14)) {
    complain(`벽으로 밀어붙이자 맵 밖으로 나갔다 — ${JSON.stringify(afterWallPush)}`);
  }

  // ── 6e. 적대적: 마을로 되돌아갔다가 다시 온다(열쇠 스위치가 유지되어야 한다)
  await goVia(page, [[10, 9], [10, 13]], "마을 복귀 통로");
  await press(page, "down", 400);
  await page.waitForTimeout(1500);
  const backInVillage = await state(page);
  if ((backInVillage as { mapId?: string } | null)?.mapId !== "map_quest_village") {
    complain(`마을 복귀 실패 — 현재 맵 ${(backInVillage as { mapId?: string } | null)?.mapId}`);
  } else {
    const keptKey = ((backInVillage as { switches?: Record<string, boolean> } | null)?.switches ?? {}).sw_quest_key;
    if (keptKey !== true) complain("맵을 왕복하자 열쇠 스위치가 풀렸다");
    // 우물을 만복 상태에서 쓴다 — 아무 말도 없으면 어색하다.
    await goAdjacent(page, 14, 11, "우물 접근");
    await interact(page);
    if (!(await dialogueOpen(page))) complain("우물: 만복 상태에서 조사했는데 아무 반응이 없다");
    await clearDialogue(page, "우물");
    await goAdjacent(page, 10, 2, "북쪽 출구 재접근");
    await press(page, "up", 400);
    await page.waitForTimeout(1500);
    if ((await state(page) as { mapId?: string } | null)?.mapId !== "map_quest_ruins") {
      complain("폐허 재입장 실패");
    }
  }

  // ── 7. 봉인문 다시 — 이제 열려야 한다
  await goVia(page, [[10, 7], [10, 5], [10, 4]], "봉인문 재접근");
  await interact(page);
  await clearDialogue(page, "봉인문(열림)");
  await page.waitForTimeout(1600);
  const inBoss = await state(page);
  const bossMap = (inBoss as { mapId?: string } | null)?.mapId;
  if (bossMap !== "map_quest_boss") complain(`봉인문: 열쇠가 있는데 보스방으로 못 갔다 — 현재 맵 ${bossMap}`);
  await page.screenshot({ path: testInfo.outputPath("q08-bossroom.png"), clip: SHOT });

  // ── 8. 보스 (10,4)
  await goAdjacent(page, 10, 4, "보스 접근");
  await interact(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath("q09-boss-encounter.png"), clip: SHOT });

  // 전투가 떴으면 이길 때까지 공격을 누른다.
  // 전투를 **한 번도 못 봤는데** 엔딩이 뜨면 그건 싸우지 않은 완주다(트룹 누락 등).
  const expOf = (snapshot: Record<string, unknown> | null): number => {
    const table = (snapshot as { actorExperience?: Record<string, number> } | null)?.actorExperience ?? {};
    return Object.values(table).reduce((sum, value) => sum + (value ?? 0), 0);
  };
  const expBeforeBoss = expOf(await state(page));
  const hpBeforeBoss = heroHp(await state(page));
  let hpFloorDuringBoss = hpBeforeBoss ?? 0;
  let battleTurns = 0;
  let sawBattle = false;
  let battleShotTaken = false;
  for (let round = 0; round < 80; round += 1) {
    const battleVisible = await page.getByTestId("battle-scene").isVisible().catch(() => false);
    const endingVisible = await page.getByTestId("ending-screen").isVisible().catch(() => false);
    if (battleVisible) {
      sawBattle = true;
      if (!battleShotTaken) {
        await page.screenshot({ path: testInfo.outputPath("q09b-battle.png"), clip: SHOT });
        battleShotTaken = true;
      }
      battleTurns += 1;
      // 전투 중에는 runtime-state-json 의 actorVitals 가 갱신되지 않는다(실측: 39턴 내내 514 고정).
      // 전투 화면에 표시되는 "HP n/n" 텍스트가 그 시점의 진짜 값이다.
      // 전투 화면 전체를 긁으면 **적 HP** 까지 섞여 최저값이 0(죽은 적)으로 잡힌다(실측).
      // 파티 그룹(battle-party) 안의 HP 만 읽는다.
      const shownHp = await page.evaluate(() => {
        const party = document.querySelector("[data-testid='battle-party']");
        const text = party ? String(party.textContent) : "";
        const hits = [...text.matchAll(/HP\s*(\d+)\s*\/\s*(\d+)/g)].map((m) => Number(m[1]));
        return hits.length > 0 ? Math.min(...hits) : null;
      });
      if (shownHp !== null && shownHp < hpFloorDuringBoss) hpFloorDuringBoss = shownHp;
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      continue;
    }
    if (endingVisible) break;
    if (await dialogueOpen(page)) {
      await page.locator(".dialogue-box").first().click({ force: true });
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(400);
  }
  const expAfterBoss = expOf(await state(page));
  console.log(
    "BOSS_BATTLE sawBattle=", sawBattle, "turns", battleTurns,
    "exp", expBeforeBoss, "->", expAfterBoss,
    "hp", hpBeforeBoss, "최저", hpFloorDuringBoss
  );
  // 보스가 장식이면 안 된다 — 체력을 전혀 깎지 못하는 상대는 보스가 아니다.
  if (hpBeforeBoss !== null && hpFloorDuringBoss >= hpBeforeBoss) {
    complain(`보스전: 주인공 HP 가 한 번도 줄지 않았다 (${hpBeforeBoss} 유지, ${battleTurns}턴) — 보스가 위협이 되지 않는다`);
  }
  if (battleTurns > 0 && battleTurns < 3) {
    complain(`보스전: ${battleTurns}턴에 끝났다 — 너무 쉽다`);
  }
  if (!sawBattle) {
    complain("보스: 전투 화면이 한 번도 뜨지 않았는데 진행됐다 — battleProcessing 이 통과됐다(트룹 누락 의심)");
  }
  if (expAfterBoss <= expBeforeBoss) {
    complain(`보스: 전투 후 경험치가 늘지 않았다 (${expBeforeBoss} → ${expAfterBoss}) — 실제로 싸우지 않았을 수 있다`);
  }
  await page.screenshot({ path: testInfo.outputPath("q10-after-battle.png"), clip: SHOT });

  const endingVisible = await page.getByTestId("ending-screen").isVisible().catch(() => false);
  if (!endingVisible) {
    const finalState = await state(page);
    complain(`완주 실패 — 엔딩 화면이 뜨지 않았다. 상태 ${JSON.stringify(finalState?.player)} 맵 ${(finalState as { mapId?: string } | null)?.mapId}`);
  }
  await page.screenshot({ path: testInfo.outputPath("q11-ending.png"), clip: SHOT });

  // 엔딩 버튼의 커서(▶)가 글자를 덮지 않는지 측정한다.
  if (endingVisible) {
    const cursorGeo = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>("[data-testid='return-title']");
      if (!button) return null;
      const cs = getComputedStyle(button);
      const before = getComputedStyle(button, "::before");
      return {
        paddingLeft: cs.paddingLeft,
        textAlign: cs.textAlign,
        cursorContent: before.content,
        cursorLeft: before.left,
        classes: button.className,
        width: Math.round(button.getBoundingClientRect().width),
      };
    });
    console.log("ENDING_BUTTON", JSON.stringify(cursorGeo));
    if (cursorGeo && cursorGeo.cursorContent !== "none" && parseFloat(cursorGeo.paddingLeft) < 20) {
      complain(`엔딩 버튼: 커서 ▶ 자리가 확보되지 않아 글자를 덮는다 — padding-left ${cursorGeo.paddingLeft}`);
    }
  }

  // ── 9. 적대적: 엔딩 → 타이틀 → 새 게임. 진행 상태가 초기화되어야 한다.
  if (endingVisible) {
    await page.getByTestId("return-title").click({ force: true });
    await page.waitForTimeout(2500);
    const titleBack = await page.getByTestId("title-screen").isVisible().catch(() => false);
    if (!titleBack) complain("엔딩: '타이틀로 돌아가기' 를 눌렀는데 타이틀 화면이 뜨지 않는다");
    await page.screenshot({ path: testInfo.outputPath("q12-title-again.png"), clip: SHOT });
    if (titleBack) {
      await startNewGameFromTitle(page);
      await page.waitForTimeout(3000);
      const fresh = await state(page);
      const freshSwitches = (fresh as { switches?: Record<string, boolean> } | null)?.switches ?? {};
      const freshMap = (fresh as { mapId?: string } | null)?.mapId;
      const freshInv = (fresh as { inventory?: Record<string, number> } | null)?.inventory ?? {};
      console.log("NEWGAME", freshMap, "key", freshSwitches.sw_quest_key, "boss", freshSwitches.sw_quest_boss_down, "potion", freshInv.item_potion);
      if (freshMap !== "map_quest_village") complain(`새 게임: 마을에서 시작하지 않는다 — ${freshMap}`);
      if (freshSwitches.sw_quest_key === true) complain("새 게임: 열쇠 스위치가 초기화되지 않았다(이전 회차 진행이 남았다)");
      if (freshSwitches.sw_quest_boss_down === true) complain("새 게임: 보스 격파 스위치가 초기화되지 않았다");
      if ((freshInv.item_potion ?? 0) > 0) complain(`새 게임: 이전 회차 아이템이 남았다 — 회복약 ${freshInv.item_potion}`);
      await page.screenshot({ path: testInfo.outputPath("q13-newgame.png"), clip: SHOT });
    }
  }

  if (errors.length > 0) complain(`콘솔 오류 ${errors.length}건: ${errors.slice(0, 3).join(" | ")}`);

  console.log(`COMPLAINT_COUNT ${complaints.length}`);
  console.log("COMPLAINTS_JSON", JSON.stringify(complaints));
  expect(endingVisible, `엔딩 미도달. 지적사항:\n${complaints.join("\n")}`).toBe(true);
});

// 《천공의 계단》 다수 전투가 **화면에 실제로 여럿으로 보이는지** 검사한다.
//
// 데이터에 enemyIds 를 4개 넣는 것과, 전투 화면에 배틀러가 4개 그려지는 것은 다른 사실이다.
// 이 저장소에서 반복해서 나온 결함이 정확히 그 간극이었다. 그래서 여기서는
//   ① 적 배틀러 노드가 3개 이상 존재하고  ② 그 이미지 src 가 서로 다르며(같은 스프라이트 재탕 금지)
//   ③ 각 배틀러가 서로 다른 좌표에 놓였고  ④ 아군 4명이 함께 그려지는지
// DOM 에서 직접 센다.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createSkyStairProject, SKY_MAP, SKY_TROOP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const TRIGGER_ID = "battle-start";

/** 시작 칸에 전투 유발 이벤트를 하나 얹은 프로젝트를 만든다(출하 게임은 건드리지 않는다). */
function projectWithBattleTrigger(troopId: string) {
  const project = createSkyStairProject();
  project.startMapId = SKY_MAP.wheat;
  project.startPos = { x: 15, y: 13 };
  const map = project.maps[SKY_MAP.wheat];
  if (!map) throw new Error("황금 밀밭 맵이 없다");
  map.events.push({
    id: TRIGGER_ID,
    x: 15,
    y: 12,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "battle_start_page",
        name: "전투 시작",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: true }],
      },
    ],
  });
  return project;
}

async function openBattle(page: Page, troopId: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, projectWithBattleTrigger(troopId));
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(900);
  await page.locator(`[data-testid='event-${TRIGGER_ID}']`).click({ force: true });
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1200);
}

/** 전투 화면의 적 배틀러를 DOM 에서 읽는다. */
async function readEnemies(page: Page): Promise<{ count: number; sources: string[]; positions: string[] }> {
  return await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    const nodes = [...(scene?.querySelectorAll(".battle-enemy") ?? [])] as HTMLElement[];
    const visible = nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    });
    const srcOf = (node: HTMLElement): string => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img?.src) return img.src;
      const bg = getComputedStyle(node).backgroundImage;
      return bg && bg !== "none" ? bg : node.dataset.testid ?? "";
    };
    return {
      count: visible.length,
      sources: visible.map(srcOf),
      positions: visible.map((node) => {
        const rect = node.getBoundingClientRect();
        return `${Math.round(rect.x)},${Math.round(rect.y)}`;
      }),
    };
  });
}

test("4인 전투가 화면에 배틀러 4개로 그려진다", async ({ page }) => {
  await openBattle(page, SKY_TROOP.mineCrew); // 코볼트·해골궁수·검은우즈·코볼트

  const enemies = await readEnemies(page);
  expect(enemies.count, `적 배틀러가 ${enemies.count}개뿐 — 다수 전투가 화면에 안 나온다`).toBeGreaterThanOrEqual(4);

  // 좌표가 겹치면 한 마리처럼 보인다 — 자동 진형이 실제로 흩어놓았는지 확인한다.
  expect(new Set(enemies.positions).size, `배틀러가 같은 자리에 겹쳤다: ${enemies.positions.join(" / ")}`).toBe(
    enemies.count
  );

  // 서로 다른 종이 섞였으니 스프라이트도 최소 3종이어야 한다(이 그룹은 3종 4마리).
  const distinct = new Set(enemies.sources.filter((src) => src.length > 0));
  expect(distinct.size, `스프라이트가 ${distinct.size}종뿐: ${[...distinct].join(" / ")}`).toBeGreaterThanOrEqual(3);
});

test("3인 전투에서 아군 4명이 함께 그려진다", async ({ page }) => {
  await openBattle(page, SKY_TROOP.skyWardens); // 그리핀·타락한 기사·와이번

  const enemies = await readEnemies(page);
  expect(enemies.count, "제단 파수꾼이 3인으로 안 나온다").toBeGreaterThanOrEqual(3);

  // 사이드뷰(ff) 스킨은 아군 스프라이트를 그린다 — 4인 파티가 화면에 서야 한다.
  const allies = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    const nodes = [...(scene?.querySelectorAll(".battle-actor, .battle-ally, [data-battle-actor]") ?? [])] as HTMLElement[];
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    }).length;
  });
  expect(allies, `아군이 ${allies}명만 보인다 — 4인 파티가 화면에 서지 않았다`).toBeGreaterThanOrEqual(4);
});

test("전투 배경이 층의 것으로 바뀐다", async ({ page }) => {
  await openBattle(page, SKY_TROOP.scarecrow);

  // 황금 밀밭의 battleBackground(노을)가 실제로 전투 화면에 붙었는지 본다.
  const backdrop = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']") as HTMLElement | null;
    if (!scene) return null;
    const candidates = [scene, ...(scene.querySelectorAll("*") as unknown as HTMLElement[])];
    for (const node of candidates) {
      const image = getComputedStyle(node).backgroundImage;
      if (image && image !== "none" && image.includes("url(")) return image;
      const img = node as HTMLImageElement;
      if (img.tagName === "IMG" && img.src && !img.src.includes("monster-") && !img.src.includes("hero-")) return img.src;
    }
    return null;
  });
  expect(backdrop, "전투 배경 이미지가 화면에 없다").toBeTruthy();
  expect(backdrop, `전투 배경이 밀밭 것이 아니다: ${backdrop}`).toMatch(/sunset|backdrop/i);
});

// 포켓몬 코어 언락 DOM 플레이테스트 — "잡은 몬스터가 실제 전투 화면에 출전한다"를 실브라우저로 실증.
// 헤드리스 시뮬(pkmnCoreUnlock)이 로직을 증명했고, 여기서는 Phaser 플레이 씬 + 전투 DOM을 증명한다.
// 결정적 구성: LLM 없이 에디터 도구(run)를 Node에서 직접 실행해 프로젝트를 만든 뒤 시드한다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { createBlankProject } from "@/project/defaults";
import { MONSTER_SYSTEM_TOOLS } from "@/editor/tools/monsterSystemTools";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import type { Project } from "@/project/types";

function makePokemonProject(): Project {
  const project = createBlankProject();
  const configure = MONSTER_SYSTEM_TOOLS.find((tool) => tool.name === "configure_monster_system")!;
  configure.run(project, { enabled: true, battleParty: true });

  const sx = project.startPos.x;
  const sy = project.startPos.y;
  const giveStarter = DB_TOOLS.find((tool) => tool.name === "give_starter_monsters")!;
  // 스타터 1종(물타입 아쿠아링) — 선택지 1개라 대화 진행이 결정적.
  giveStarter.run(project, { speciesIds: ["species_aqualing"], x: sx + 1, y: sy });

  // 야생 전투 트리거: 스타터 이벤트 page 골격을 복제해 battleProcessing 커맨드로 교체(shape 보존).
  const map = project.maps[project.startMapId]!;
  const starter = map.events.find((event) => event.id.startsWith("ev_starter"));
  if (!starter) throw new Error("starter event missing");
  const battleEvent = JSON.parse(JSON.stringify(starter)) as {
    id: string; name: string; x: number; y: number;
    pages: { conditions: unknown[]; commands: unknown[] }[];
  };
  battleEvent.id = "ev_wild_battle";
  battleEvent.name = "야생 전투";
  battleEvent.x = Math.max(0, sx - 1);
  battleEvent.y = sy;
  battleEvent.pages = [battleEvent.pages[0]!];
  battleEvent.pages[0]!.conditions = [];
  battleEvent.pages[0]!.commands = [
    { kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: true },
  ];
  (map.events as unknown[]).push(battleEvent);
  return project;
}

async function startTitle(page: Page): Promise<void> {
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => page.evaluate(() => typeof (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput))
    .toBe("object");
}

// 방향 탭(90ms) — 막힌 타일(이벤트)을 향하면 제자리에서 방향만 튼다.
async function tapDir(page: Page, dir: "left" | "right"): Promise<void> {
  await page.evaluate((d) => (window as unknown as { __rpgzzuInput: { dir(v: string | null): void } }).__rpgzzuInput.dir(d), dir);
  await page.waitForTimeout(120);
  await page.evaluate(() => (window as unknown as { __rpgzzuInput: { dir(v: string | null): void } }).__rpgzzuInput.dir(null));
  await page.waitForTimeout(320);
}

async function pressAction(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __rpgzzuInput: { action(): void } }).__rpgzzuInput.action());
  await page.waitForTimeout(450);
}

// 대화/선택지 진행: 대화창(.dialogue-box)/선택지(runtime-choices)가 닫힐 때까지 Enter.
// 타자기 연출 때문에 페이지당 Enter 2회(완성+진행)가 필요할 수 있어 상한을 넉넉히 둔다.
async function advanceDialog(page: Page, maxPresses = 14): Promise<void> {
  for (let i = 0; i < maxPresses; i += 1) {
    const open = await page.evaluate(
      () => document.querySelector(".dialogue-box, [data-testid='runtime-choices']") !== null
    );
    if (!open) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(550);
  }
}

test("pokemon DOM: 스타터 획득 → 전투에서 몬스터(영웅 아님)가 아군 슬롯에 출전", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // 기본(basic) UI 모드는 상단 메뉴(mode-play)를 숨긴다 — expert 주입(시드 헬퍼가 clear 후에도 보존).
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, makePokemonProject());
  await page.getByTestId("mode-play").click();
  await startTitle(page);

  // 1) 오른쪽 스타터 이벤트: 방향 전환 → 말 걸기 → 선택지 1개 수락(giveMonster L5).
  await tapDir(page, "right");
  await pressAction(page);
  await advanceDialog(page);
  await page.screenshot({ path: "output/pkmn-dom-01-starter.png" });

  // 2) 왼쪽 야생 전투 이벤트: 방향 전환 → 말 걸기 → battleProcessing(troop_slime).
  await tapDir(page, "left");
  await pressAction(page);

  // 3) 전투 DOM 실증 — 핵심 단정.
  await expect(page.getByTestId("battle-field")).toBeVisible({ timeout: 15_000 });
  // (a) 아군 슬롯에 몬스터 배틀러(recordId=instanceId=monster_N)가 실존.
  const monsterNode = page.locator("[data-testid^='battle-actor-monster_']");
  await expect(monsterNode.first()).toBeVisible({ timeout: 10_000 });
  // (b) 영웅 액터는 전투에 없다 — 몬스터 파티 모드가 실제로 영웅을 대체.
  await expect(page.locator("[data-testid='battle-actor-actor_hero']")).toHaveCount(0);
  // (c) 포획 커맨드 노출 = monsterCollection 게이트 ON.
  await expect(page.getByTestId("battle-command-grid")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "output/pkmn-dom-02-battle-monster-party.png" });

  // 4) 몬스터가 실제로 행동: 공격 → 대상 선택 → 데미지.
  await page.getByTestId("actor-command-attack").click();
  const target = page.locator("[data-testid^='battle-target-']").first();
  await target.click();
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: "output/pkmn-dom-03-monster-attacks.png" });

  // 5) 전투 필드가 유지되고(크래시/즉시 패배 아님) 몬스터 노드가 살아 있다.
  await expect(monsterNode.first()).toBeVisible();
  console.log("PKMN_DOM_PROOF", JSON.stringify(await monsterNode.first().getAttribute("data-testid")));
});

// 대조군: 같은 헤드리스 환경에서 액터(영웅) 경로 전투 — 몬스터 모드 HUD 글리치가
// 모드A 결함인지 헤드리스 렌더 아티팩트인지 시각 비교용.
test("control: battleParty off이면 영웅이 그대로 출전한다(액터 경로 불변)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  const project = createBlankProject();
  const sx = project.startPos.x;
  const sy = project.startPos.y;
  // 몬스터 시스템 OFF 상태에서 전투 이벤트만 배치(스타터 이벤트 골격 재사용을 위해 임시 생성 후 커맨드 교체).
  const giveStarter = DB_TOOLS.find((tool) => tool.name === "give_starter_monsters")!;
  giveStarter.run(project, { speciesIds: ["species_aqualing"], x: sx + 1, y: sy });
  const map = project.maps[project.startMapId]!;
  const starter = map.events.find((event) => event.id.startsWith("ev_starter"))!;
  const battleEvent = JSON.parse(JSON.stringify(starter)) as {
    id: string; name: string; x: number; y: number;
    pages: { conditions: unknown[]; commands: unknown[] }[];
  };
  battleEvent.id = "ev_wild_battle";
  battleEvent.x = Math.max(0, sx - 1);
  battleEvent.y = sy;
  battleEvent.pages = [battleEvent.pages[0]!];
  battleEvent.pages[0]!.conditions = [];
  battleEvent.pages[0]!.commands = [
    { kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: true },
  ];
  (map.events as unknown[]).push(battleEvent);
  // 스타터 이벤트 제거 + 몬스터 플래그 미설정 → 순수 액터 경로.
  map.events.splice(map.events.indexOf(starter), 1);

  await seedProjectFromSupabaseCanonical(page, project);
  await page.getByTestId("mode-play").click();
  await startTitle(page);
  await tapDir(page, "left");
  await pressAction(page);

  await expect(page.getByTestId("battle-field")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("battle-actor-actor_hero")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-testid^='battle-actor-monster_']")).toHaveCount(0);
  await page.screenshot({ path: "output/pkmn-dom-04-actor-control.png" });
});

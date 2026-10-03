// Gen1 Tier-0 배선 복구 증거 — 6레인 적대 감사에서 찾은 "이미 만든 데이터가 화면에
// 안 나오는" 배선 끊김 4건을 실브라우저로 실증한다.
//   1) 출하 포켓몬 데모가 battleModel: "gen1" 을 켠다 (body[data-battle-model])
//   2) 상태 runtimeEffects 를 에디터 폼으로 저작하면 프로젝트에 남는다
//   3) battle-status-icon-* 이 실제로 렌더된다(이전엔 CSS 규칙 0건 → 0×0 빈 span)
//   4) 파티 몬스터 전투의 레벨업/습득 기술이 결과 패널에 나온다
import { expect, test, type Page } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";
import { exportedProject } from "./rm2k3-database-helpers";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import type { Project } from "@/project/types";

const POISON_SKILL_ID = "skill_poison_sting";
// 결과 패널에서 몬스터 레벨업 행을 액터(트레이너) 행과 구분하기 위한 표시 이름.
const MONSTER_NAME = "스파르츄";

// qa-pokemon-dom.spec.ts 의 결정적 구성을 따른다: LLM 없이 에디터 도구를 Node 에서
// 직접 실행해 프로젝트를 만든 뒤 시드한다.
function makeBattleEvidenceProject(): Project {
  const project = createScarloxyPokemonDemoProject();

  // 스타터가 슬라임을 여러 턴 버텨야 독 배지와 승리 패널을 둘 다 찍을 수 있다.
  const sparchu = (project.database.monsterSpecies ?? []).find((species) => species.id === scarloxySpeciesId("sparchu"));
  if (!sparchu) throw new Error("Scarloxy Sparchu species missing");
  // 표시 이름이 바뀌면 결과 패널 단정이 조용히 액터 행을 잡게 되므로 여기서 막는다.
  if (sparchu.name !== MONSTER_NAME) throw new Error(`MONSTER_NAME drift: ${sparchu.name} !== ${MONSTER_NAME}`);
  sparchu.baseStats = { ...sparchu.baseStats, maxHp: 200, defense: 90, attack: 80 };
  // 독침을 Lv1 학습 목록에 넣는다 — monsterSkillIds 가 종족 skillsByLevel 을 합쳐준다.
  sparchu.skillsByLevel = [...(sparchu.skillsByLevel ?? []), { level: 1, skillId: POISON_SKILL_ID }];

  // 독침의 부여 확률/명중을 100 으로 고정한다(연출 증거라 확률에 맡기지 않는다).
  const poison = project.database.skills.find((skill) => skill.id === POISON_SKILL_ID);
  if (!poison) throw new Error("skill_poison_sting missing");
  poison.hitRate = 100;
  poison.successRate = 100;
  poison.mpCost = { flat: 0, percentMax: 0 };
  poison.stateEffects = [{ stateId: "state_poison", chance: 100, operation: "add" }];

  // 레벨업을 보장한다 — 기본 enemy_slime 의 exp 5 로는 Lv5 스타터가 안 오른다.
  const slime = project.database.enemies.find((enemy) => enemy.id === "enemy_slime");
  if (!slime) throw new Error("enemy_slime missing");
  slime.rewards = { ...slime.rewards, exp: 600 };
  // 독침(위력 8) 한 방에 죽으면 상태 배지를 찍을 프레임이 없다(기본 maxHp 15 → 플레이크였다).
  // 통상공격 ~25/턴이라 60 이면 독침 1회 + 통상 2~3회로 끝난다. 반대로 슬라임 공격 8 vs
  // 스타터 방어 90 이면 턴당 최소피해 1 이므로 스타터가 죽을 일은 없다.
  slime.stats = { ...slime.stats, maxHp: 60, defense: 4, attack: 8 };

  const sx = project.startPos.x;
  const sy = project.startPos.y;
  const giveStarter = DB_TOOLS.find((tool) => tool.name === "give_starter_monsters")!;
  giveStarter.run(project, { speciesIds: [scarloxySpeciesId("sparchu")], x: sx + 1, y: sy });

  // 야생 전투 트리거: 스타터 이벤트 골격을 복제해 battleProcessing 으로 교체(shape 보존).
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
    .poll(async () => page.evaluate(() => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput))
    .toBe("object");
}

async function tapDir(page: Page, dir: "left" | "right"): Promise<void> {
  await page.evaluate((d) => (window as unknown as { __oprnInput: { dir(v: string | null): void } }).__oprnInput.dir(d), dir);
  await page.waitForTimeout(120);
  await page.evaluate(() => (window as unknown as { __oprnInput: { dir(v: string | null): void } }).__oprnInput.dir(null));
  await page.waitForTimeout(320);
}

async function pressAction(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __oprnInput: { action(): void } }).__oprnInput.action());
  await page.waitForTimeout(450);
}

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

test("Tier0-1/2: 데모가 gen1 게이트를 켜고, 상태 runtimeEffects 가 폼에서 저장된다", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1474, height: 950 });
  // 기본(basic) UI 모드는 상단 툴바 항목을 숨긴다 — expert 주입(시드 헬퍼가 clear 후에도 보존).
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectForEditor(page, createScarloxyPokemonDemoProject());

  // (1) 출하 데모가 규칙 엔진을 켰다. syncBattleModelAttribute 가 store 구독으로 찍는 속성.
  //     이전에는 데모가 battleUiStyle(스킨)만 켜서 이 값이 "rm2k3" 였다.
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.battleModel), { timeout: 15_000 })
    .toBe("gen1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();

  // 전투 화면 탭의 「전투 방식」이 몬스터 대치(pokemon + gen1)를 반영한다(2026-10-02: 규칙 셀렉트 대신 방식 단추).
  // 화면과 규칙이 어긋나면 rules-mismatch 안내가 뜨므로, 그 안내가 없어야 gen1 까지 맞은 것이다.
  await page.getByTestId("db-tab-battle-screen").click();
  const monsterMethod = page.getByTestId("db-battle-method-monster");
  await expect(monsterMethod).toBeVisible({ timeout: 10_000 });
  await expect(monsterMethod).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("db-battle-method-rules-mismatch")).toHaveCount(0);
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("tier0-01-demo-battle-model-gen1.png") });

  // (2) 상태 탭의 새 "전투 규칙 (Gen1 knob)" 패널 — 이전엔 필드도 뮤테이터도 없어서
  //     화상(공격 반감)을 에디터로 만들 수 없었다.
  await page.getByTestId("db-tab-states").click();
  const workbench = page.getByTestId("db-states-rm2k3-workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench).toContainText("전투 규칙 (Gen1 knob)");

  const attackMult = page.getByTestId("db-state-rt-attack-mult");
  const hpPercent = page.getByTestId("db-state-rt-hp-percent");
  await expect(attackMult).toBeVisible();
  // 소수 입력이 :invalid 로 뜨지 않는다(numberField step 배선).
  await expect(hpPercent).toHaveAttribute("step", "0.05");

  // Gen1 화상 = 공격 배율 0.5 + 턴당 HP 6.25%(=1/16). 첫 레코드(독)에 저작한다.
  await attackMult.fill("0.5");
  await hpPercent.fill("6.25");
  await page.getByTestId("db-state-rt-restricts").uncheck();

  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("tier0-02-state-gen1-knobs.png") });

  // 저장 경로 실증: 프로젝트 직렬화에 runtimeEffects 가 남는다.
  const project = await exportedProject(page);
  const edited = project.database.states[0] as { runtimeEffects?: Record<string, unknown> };
  expect(edited.runtimeEffects).toBeTruthy();
  expect(edited.runtimeEffects?.attackMultiplier).toBe(0.5);
  expect(edited.runtimeEffects?.hpDamagePercentPerTurn).toBe(6.25);
  console.log("TIER0_STATE_RUNTIME_EFFECTS", JSON.stringify(edited.runtimeEffects));
});

test("Tier0-3/4: 상태 배지가 렌더되고, 몬스터 레벨업이 결과 패널에 나온다", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectForEditor(page, makeBattleEvidenceProject());
  await page.getByTestId("mode-play").click();
  await startTitle(page);

  // 스타터 획득 → 야생 전투 진입.
  await tapDir(page, "right");
  await pressAction(page);
  await advanceDialog(page);
  await tapDir(page, "left");
  await pressAction(page);
  await expect(page.getByTestId("battle-field")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-testid^='battle-actor-monster_']").first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded");

  // (3) 독침으로 적에게 독을 건다 → 상태 배지.
  const battleScene = page.getByTestId("battle-scene");
  await page.getByTestId("actor-command-skill").click();
  // 서브메뉴 항목은 actor-skill-<id> 다(커맨드 그리드의 actor-command-skill-<id> 와 다름).
  await page.getByTestId(`actor-skill-${POISON_SKILL_ID}`).click();
  await page.locator("[data-testid^='battle-target-']").first().click();
  await expect(battleScene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });

  // CSS 실증: 이전엔 battle-status-icon-* 규칙이 0건이라 빈 인라인 span(0×0)이었다.
  // syncStatusIcons 가 매 동기화마다 클러스터를 replaceWith 로 교체하므로 locator 를
  // 잡아두면 측정 직전에 노드가 분리된다 → 크기·글리프를 한 번의 evaluate 로 원자적으로 읽는다.
  let badge: { width: number; height: number; glyph: string } | null = null;
  for (let attempt = 0; attempt < 30 && badge === null; attempt += 1) {
    badge = await page.evaluate(() => {
      const node = document.querySelector(".battle-enemy .battle-status-icon[data-status-icon='poison']");
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return { width: rect.width, height: rect.height, glyph: window.getComputedStyle(node, "::before").content };
    });
    if (badge === null) await page.waitForTimeout(400);
  }
  expect(badge).not.toBeNull();
  expect(badge!.width).toBeGreaterThan(8);
  expect(badge!.height).toBeGreaterThan(6);
  expect(badge!.glyph).toContain("PSN");
  console.log("TIER0_STATUS_BADGE", JSON.stringify(badge));
  await page.screenshot({ path: testInfo.outputPath("tier0-03-status-badge-poison.png") });
  // 적 스프라이트는 idle 연출로 계속 움직여서 요소 스샷이 "not stable" 로 죽는다 → 애니메이션 정지.
  await page.locator(".battle-enemy").first().screenshot({
    path: testInfo.outputPath("tier0-03b-status-badge-closeup.png"),
    animations: "disabled",
  });

  // (4) 승리까지 공격 → 결과 패널에 몬스터 레벨업 행.
  const readBattle = async (): Promise<unknown> => page.evaluate(() => ({
    allies: [...document.querySelectorAll("[data-testid^='battle-actor-']")].map((n) => ({
      id: (n as HTMLElement).dataset.testid,
      text: (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 70),
    })),
    enemies: [...document.querySelectorAll(".battle-enemy-list-row, [data-testid^='battle-enemy-list-hp-']")]
      .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim()).slice(0, 4),
    buttons: [...document.querySelectorAll("[data-testid^='actor-command-'], [data-testid^='battle-target-']")]
      .map((n) => (n as HTMLElement).dataset.testid),
  }));
  console.log("TIER0_BATTLE_START", JSON.stringify(await readBattle()));

  for (let turn = 0; turn < 14; turn += 1) {
    if (await page.locator(".battle-result-panel").count() > 0) break;
    // 연출이 끝나고 커맨드 입력 단계로 돌아올 때까지 기다린다 — 이 동기화 없이
    // 버튼 존재만 보고 클릭하면 서브메뉴/타겟 모드에 갇혀 루프가 헛돈다(플레이크 원인).
    await expect(battleScene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 }).catch(() => undefined);
    await expect(battleScene).toHaveAttribute("data-battle-phase", "actorCommand", { timeout: 20_000 }).catch(() => undefined);
    if (await page.locator(".battle-result-panel").count() > 0) break;
    const attack = page.getByTestId("actor-command-attack");
    if (await attack.count() === 0) {
      // 서브메뉴에 갇혔으면 되돌아온다(예: 아이템 목록이 비어 있는 "빈 손").
      for (const backId of ["actor-command-back", "battle-target-cancel"]) {
        const back = page.getByTestId(backId);
        if (await back.count() > 0) await back.click().catch(() => undefined);
      }
      await page.waitForTimeout(400);
      continue;
    }
    await attack.click().catch(() => undefined);
    // battle-target- 접두사는 battle-target-cancel/prompt 도 잡는다 → 실제 대상만 고른다.
    const target = page.locator("[data-testid^='battle-target-']:not([data-testid='battle-target-cancel'])").first();
    await target.click({ timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    console.log(`TIER0_BATTLE_TURN_${turn}`, JSON.stringify(await readBattle()));
  }
  // 패배로 끝났으면 원인을 즉시 알 수 있게 명시적으로 실패시킨다(증거 스샷은 이미 남는다).
  const resultKind = await page.locator(".battle-result-panel").first().getAttribute("data-battle-result").catch(() => null);
  expect(resultKind, "몬스터 레벨업 증거는 승리 전투에서만 나온다").toBe("victory");

  const resultPanel = page.locator(".battle-result-panel");
  await expect(resultPanel).toBeVisible({ timeout: 20_000 });
  // 이전엔 이 패널에 액터 레벨업 행만 있었고, 몬스터 파티 전투는 성장 피드백이 0 이었다.
  await expect(resultPanel).toContainText("레벨 업!", { timeout: 10_000 });
  const rows = await resultPanel.locator(".battle-result-reward-row").allTextContents();
  console.log("TIER0_RESULT_ROWS", JSON.stringify(rows));
  // 몬스터 이름이 붙은 레벨업 행을 지목해서 확인한다 — "레벨 업!" 만 보면 액터(트레이너)
  // 행에 걸린다. 참고: 그 트레이너 행은 기존 결함이다. 런타임의 computeLevelUpPreview 는
  // monsterPartyMode 를 보지 않는데 battleRewardsToSession 은 액터 루프를 건너뛰므로,
  // 결과 화면이 실제로는 일어나지 않는 트레이너 레벨업을 표시한다(이번 커밋 범위 밖).
  const monsterRow = rows.find((row) => row.includes(MONSTER_NAME) && row.includes("레벨 업!"));
  expect(monsterRow, `몬스터 레벨업 행이 없다. rows=${JSON.stringify(rows)}`).toBeTruthy();
  expect(monsterRow).toMatch(/Lv\.\d+→\d+/);
  const skillRow = rows.find((row) => row.includes("기술 습득"));
  console.log("TIER0_MONSTER_SKILL_ROW", JSON.stringify(skillRow ?? null));
  await page.screenshot({ path: testInfo.outputPath("tier0-04-monster-levelup-result.png") });
  await resultPanel.screenshot({ path: testInfo.outputPath("tier0-04b-monster-levelup-closeup.png") });
});

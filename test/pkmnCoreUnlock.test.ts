import { describe, expect, it } from "vitest";
import { monsterBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import { MONSTER_SYSTEM_TOOLS } from "@/editor/tools/monsterSystemTools";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { getTool } from "@/editor/tools/toolRegistry";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { monsterBattleStats, monsterStatAtLevel } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

function aqualing(project: Project, instanceId: string, level = 20): MonsterInstance {
  return {
    instanceId,
    speciesId: "species_aqualing", // water
    level,
    exp: 0,
    ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
    friendship: 70,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
}

// enemy_slime 를 지정 종족/스탯으로 바꾼 프로젝트(방어 1, 초고 HP → 한 대 맞고 생존).
function projectWithTargetSpecies(speciesId: string): Project {
  const project = createBlankProject();
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime");
  enemy.speciesId = speciesId;
  enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1 };
  return project;
}

function firstActorDamage(result: ReturnType<typeof simulateBattle>): number {
  return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 배치 1 — 몬스터 6스탯 레벨 스케일링
// ─────────────────────────────────────────────────────────────────────────────
describe("batch 1 · monster stat level scaling", () => {
  it("returns base+iv at L1 (backward-compat) and scales with level", () => {
    // Pokemon-style other-stat formula: floor((2*base+iv)*level/100)+5
    expect(monsterStatAtLevel(22, 7, 1, 10)).toBe(5);
    expect(monsterStatAtLevel(22, 7, 99, 10)).toBe(55);
    expect(monsterStatAtLevel(8, 7, 99, 6)).toBe(27);
    // clamp: 최소 1, round 적용
    expect(monsterStatAtLevel(0, 0, 99, 10)).toBe(5);
    expect(monsterStatAtLevel(1, 0, 50, 10)).toBeGreaterThanOrEqual(1);
  });

  it("scales all six stats with Pokemon formula and keeps L1 near base floor", () => {
    const project = createBlankProject();
    const species = project.database.monsterSpecies?.find((s) => s.id === "species_leafling");
    if (!species) throw new Error("missing leafling");
    const leaflingL1 = monsterBattleStats(project, {
      ...aqualing(project, "leaf", 1),
      speciesId: "species_leafling",
    });
    // L1 HP = floor((2*base+iv)/100)+1+10 = 11 for base 36
    expect(leaflingL1.maxHp).toBe(11);
    expect(leaflingL1.attack).toBe(5);
    expect(leaflingL1.agility).toBe(5);

    const leaflingL99 = monsterBattleStats(project, {
      ...aqualing(project, "leaf99", 99),
      speciesId: "species_leafling",
    });
    // floor((2*36)*99/100)+99+10 = 180
    expect(leaflingL99.maxHp).toBe(180);
    expect(leaflingL99.attack).toBe(18);
    expect(leaflingL99.agility).toBe(28);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 배치 2 — 몬스터→배틀러 변환 + 모드 스위치 + 타입 대칭 (핵심 언락)
// ─────────────────────────────────────────────────────────────────────────────
describe("batch 2 · monsters actually fight (headless unlock proof)", () => {
  // (a) 몬스터 배틀러가 행동 로그에 등장한다.
  it("(a) a monster battler appears in the strict-mode action log", () => {
    const project = projectWithTargetSpecies("species_cave_bat"); // fire target
    const party = [aqualing(project, "mon_water_1", 20)];
    const result = simulateBattle({
      project,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 1,
      monsterParty: party,
      strictScript: [[{ actorId: "mon_water_1", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
      maxSteps: 6,
    });
    const monsterAction = result.roundLogs[0]?.actions.find(
      (action) => action.side === "actor" && action.userRecordId === "mon_water_1"
    );
    expect(monsterAction, "monster battler must appear in the action log").toBeTruthy();
    expect(result.participatingActorIds).toContain("mon_water_1");
  });

  // (b) 물몬 vs 불몬(약점 2×) 데미지가 물몬 vs 물몬(내성 0.5×)보다 크다 — 상성 배율이 데미지에 반영.
  it("(b) type-chart multiplier is applied: water-vs-fire (weak) >> water-vs-water (resist)", () => {
    const script = [[{ actorId: "mon_w", command: "skill" as const, skillId: "skill_water", target: "enemy-1" }]];

    const weakProject = projectWithTargetSpecies("species_cave_bat"); // fire → water is super effective
    const weak = simulateBattle({
      project: weakProject,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 3,
      monsterParty: [aqualing(weakProject, "mon_w", 20)],
      strictScript: script,
      maxSteps: 6,
    });

    const resistProject = projectWithTargetSpecies("species_aqualing"); // water → water is resisted
    const resist = simulateBattle({
      project: resistProject,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 3,
      monsterParty: [aqualing(resistProject, "mon_w", 20)],
      strictScript: script,
      maxSteps: 6,
    });

    const weakDamage = firstActorDamage(weak);
    const resistDamage = firstActorDamage(resist);
    expect(weakDamage).toBeGreaterThan(0);
    expect(resistDamage).toBeGreaterThan(0);
    // 2× 약점 vs 0.5× 내성 → 순수 배율비 4× (동일 시전자·스킬·시드). 변산(±10%) 여유로 2× 이상만 확인.
    expect(weakDamage).toBeGreaterThan(resistDamage * 2);
  });

  // (c) 몬스터 파티를 넘기지 않으면 액터 경로가 그대로 유지된다(회귀 0).
  it("(c) actor path is unchanged when no monsterParty is supplied", () => {
    const project = createBlankProject();
    const actorRun = simulateBattle({ project, troopId: "troop_slime", heroLevel: 5, n: 20, seed: 1 });
    // 액터가 참가 기록에 남고, 몬스터 instanceId 는 등장하지 않는다.
    expect(actorRun.participatingActorIds).toContain("actor_hero");
    expect(actorRun.participatingActorIds.some((id) => id.startsWith("mon_"))).toBe(false);
    expect(actorRun.winRate).toBeGreaterThan(0);

    // 동일 입력 재현성(로그 불변 근거): 같은 시드 → 같은 winRate.
    const actorRunAgain = simulateBattle({ project, troopId: "troop_slime", heroLevel: 5, n: 20, seed: 1 });
    expect(actorRunAgain.winRate).toBe(actorRun.winRate);
  });

  // (d) 같은 종 2마리 파티에서 recordId(=instanceId) 유일성으로 둘 다 정상 추적된다.
  it("(d) two same-species monsters keep unique recordIds and both participate", () => {
    const project = createBlankProject();
    const battlers = monsterBattlers(project, [aqualing(project, "mon_a"), aqualing(project, "mon_b")]);
    expect(battlers.map((b) => b.recordId)).toEqual(["mon_a", "mon_b"]);
    expect(battlers.every((b) => b.speciesId === "species_aqualing")).toBe(true);
    expect(new Set(battlers.map((b) => b.recordId)).size).toBe(2); // recordId=instanceId, NOT speciesId

    const result = simulateBattle({
      project,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 1,
      activeSlots: 2,
      monsterParty: [aqualing(project, "mon_a"), aqualing(project, "mon_b")],
      maxSteps: 40,
    });
    // recordId 가 speciesId 였다면 둘이 한 슬롯으로 붕괴해 1개만 참가했을 것.
    expect(result.participatingActorIds).toContain("mon_a");
    expect(result.participatingActorIds).toContain("mon_b");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 배치 3 — 포획 활성화 + 모드 토글 도구
// ─────────────────────────────────────────────────────────────────────────────
describe("batch 3 · configure_monster_system tool + toggle", () => {
  const tool = MONSTER_SYSTEM_TOOLS.find((entry) => entry.name === "configure_monster_system");
  if (!tool) throw new Error("missing configure_monster_system");

  it("is registered in the global tool registry", () => {
    expect(getTool("configure_monster_system")?.name).toBe("configure_monster_system");
  });

  it("enabled:true sets monsterCollection; battleParty:true sets monsterBattleParty", () => {
    const project = createBlankProject();
    tool.run(project, { enabled: true, battleParty: true });
    expect(project.system.monsterCollection).toBe(true);
    expect(project.system.monsterBattleParty).toBe(true);
  });

  it("enabled:true without battleParty leaves battle-party flag unset", () => {
    const project = createBlankProject();
    tool.run(project, { enabled: true });
    expect(project.system.monsterCollection).toBe(true);
    expect(project.system.monsterBattleParty).toBeUndefined();
  });

  it("enabled:true without battleParty keeps an existing monster battle party (monster-collect preset)", () => {
    const project = createBlankProject();
    project.system.monsterBattleParty = true;
    project.system.battleParty = "monsters";
    tool.run(project, { enabled: true });
    expect(project.system.monsterBattleParty).toBe(true);
    expect(project.system.battleParty).toBe("monsters");
    tool.run(project, { enabled: true, battleParty: false });
    expect(project.system.monsterBattleParty).toBeUndefined();
  });

  it("enabled:false removes both flags", () => {
    const project = createBlankProject();
    tool.run(project, { enabled: true, battleParty: true });
    tool.run(project, { enabled: false });
    expect(project.system.monsterCollection).toBeUndefined();
    expect(project.system.monsterBattleParty).toBeUndefined();
  });

  it("normalizeSystemRecords round-trips the monsterBattleParty flag", () => {
    const normalized = normalizeSystemRecords({ startActorIds: ["actor_hero"], monsterBattleParty: true });
    expect(normalized.monsterBattleParty).toBe(true);
    const off = normalizeSystemRecords({ startActorIds: ["actor_hero"] });
    expect(off.monsterBattleParty).toBeUndefined();
  });

  it("give_starter_monsters warns when monsterCollection is off, and not when on", () => {
    const starter = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
    if (!starter) throw new Error("missing give_starter_monsters");

    const offProject = createBlankProject();
    const offResult = starter.run(offProject, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
    expect(offResult.warnings?.some((w) => w.includes("configure_monster_system"))).toBe(true);

    const onProject = createBlankProject();
    onProject.system.monsterCollection = true;
    const onResult = starter.run(onProject, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
    expect(onResult.warnings ?? []).toHaveLength(0);
  });
});

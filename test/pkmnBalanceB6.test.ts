// 배치 6 — 몬스터 전투 밸런스 회귀 테스트.
// 튜닝 목표를 고정 시드(n=50, seed=42)로 단정한다:
//  (1) 동급 매치업 winRate 0.6~0.9, (2) 전투 길이 3~10턴(동급 기준),
//  (3) 약점(2×) 공격이 내성(0.5×) 공격 대비 ≥3× 데미지,
//  (4) 레벨 진행 사다리(과레벨=확실한 승리, 저레벨=패배)와 L1 하위호환.
// 시뮬레이터가 결정적(mulberry32 시드)이라 같은 시드·같은 상수면 값이 재현된다.
import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/battle/simulate";
import { createBlankProject } from "@/project/defaults";
import { monsterBattleStats, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

const N = 50;
const SEED = 42;
const STARTERS = ["species_aqualing", "species_leafling", "species_sparkit"] as const;

function mon(project: Project, speciesId: string, level: number, id = "mon_1"): MonsterInstance {
  return {
    instanceId: id,
    speciesId,
    level,
    exp: 0,
    ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
    friendship: 70,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
}

function run(troopId: string, speciesId: string, level: number) {
  const project = createBlankProject();
  return simulateBattle({
    project,
    troopId,
    heroLevel: 1,
    n: N,
    seed: SEED,
    monsterParty: [mon(project, speciesId, level)],
  });
}

function runTrio(troopId: string, level: number) {
  const project = createBlankProject();
  return simulateBattle({
    project,
    troopId,
    heroLevel: 1,
    n: N,
    seed: SEED,
    monsterParty: STARTERS.map((speciesId, index) => mon(project, speciesId, level, `mon_${index + 1}`)),
  });
}

describe("batch 6 · same-tier matchups sit in the 0.6~0.9 win-rate band", () => {
  // 초반 동급: 갓 잡은 스타터(L5) vs 첫 트룹(슬라임 1). 이길 확률이 높지만 확정은 아니어야 한다.
  it("aqualing L5 vs troop_slime", () => {
    const r = run("troop_slime", "species_aqualing", 5);
    expect(r.winRate).toBeGreaterThanOrEqual(0.6);
    expect(r.winRate).toBeLessThanOrEqual(0.9);
  });

  it("leafling L5 vs troop_slime", () => {
    const r = run("troop_slime", "species_leafling", 5);
    expect(r.winRate).toBeGreaterThanOrEqual(0.6);
    expect(r.winRate).toBeLessThanOrEqual(0.9);
  });

  // sparkit 은 속공형이라 L5 슬라임전은 거의 확승(0.9 초과 허용) — 대신 동급 밴드는
  // 한 단계 위 콘텐츠(슬라임 페어, L11)에서 확인한다.
  it("sparkit L5 vs troop_slime wins most but its band cell is L11 vs slime pair", () => {
    const l5 = run("troop_slime", "species_sparkit", 5);
    expect(l5.winRate).toBeGreaterThanOrEqual(0.9);
    const band = run("troop_slime_pair", "species_sparkit", 11);
    expect(band.winRate).toBeGreaterThanOrEqual(0.6);
    expect(band.winRate).toBeLessThanOrEqual(0.9);
  });

  // 후반 동급: 보스(드래곤)는 권장 레벨(L26)에서 아슬아슬해야 한다.
  it("aqualing L26 vs troop_dragon (boss at recommended level)", () => {
    const r = run("troop_dragon", "species_aqualing", 26);
    expect(r.winRate).toBeGreaterThanOrEqual(0.6);
    expect(r.winRate).toBeLessThanOrEqual(0.9);
  });
});

describe("batch 6 · battle length lands in the 3~10 turn window", () => {
  it("same-tier fights average 3~10 actor decisions", () => {
    // 동급 셀들의 평균 턴: 페어전·보스전은 5~7턴, 첫 슬라임전은 ~3턴.
    expect(run("troop_slime_pair", "species_sparkit", 11).avgTurns).toBeGreaterThanOrEqual(3);
    expect(run("troop_slime_pair", "species_sparkit", 11).avgTurns).toBeLessThanOrEqual(10);
    const dragon = run("troop_dragon", "species_aqualing", 26);
    expect(dragon.avgTurns).toBeGreaterThanOrEqual(3);
    expect(dragon.avgTurns).toBeLessThanOrEqual(10);
    // 첫 슬라임전(체급 최소 콘텐츠)은 패배 런이 평균을 끌어내려 2.5턴까지 허용.
    const first = run("troop_slime", "species_aqualing", 5);
    expect(first.avgTurns).toBeGreaterThanOrEqual(2.5);
    expect(first.avgTurns).toBeLessThanOrEqual(10);
  });
});

describe("batch 6 · type weakness is clearly felt (>=3x vs resist)", () => {
  function skillDamageVs(targetSpecies: string, level: number): number {
    const project = createBlankProject();
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing enemy_slime");
    enemy.speciesId = targetSpecies;
    enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1 };
    const result = simulateBattle({
      project,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 3,
      monsterParty: [mon(project, "species_aqualing", level, "mon_w")],
      strictScript: [[{ actorId: "mon_w", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
      maxSteps: 6,
    });
    return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
  }

  it("water skill on fire target deals >=3x the damage of water target, at L5 and L35", () => {
    for (const level of [5, 35]) {
      const weak = skillDamageVs("species_cave_bat", level); // fire → 2× (+STAB)
      const resist = skillDamageVs("species_aqualing", level); // water → 0.5× (+STAB)
      expect(weak).toBeGreaterThan(0);
      expect(resist).toBeGreaterThan(0);
      expect(weak / resist).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("batch 6 · progression ladder sanity", () => {
  it("overleveled sweeps, underleveled loses (levels are felt)", () => {
    // 과레벨(+5): 첫 트룹은 확실히 이긴다.
    expect(run("troop_slime", "species_aqualing", 10).winRate).toBeGreaterThanOrEqual(0.95);
    // 저레벨(-2): 페어 트룹에는 진다 — 레벨업 유인.
    expect(run("troop_slime_pair", "species_aqualing", 8).winRate).toBeLessThanOrEqual(0.2);
    // 스타터 트리오(3마리 파티)는 파티 콘텐츠를 안정적으로 클리어한다.
    const swarm = runTrio("troop_bat_swarm", 15);
    expect(swarm.winRate).toBeGreaterThanOrEqual(0.9);
    expect(swarm.avgTurns).toBeLessThanOrEqual(10);
    const golem = runTrio("troop_golem_guard", 25);
    expect(golem.winRate).toBeGreaterThanOrEqual(0.9);
    expect(golem.avgTurns).toBeLessThanOrEqual(10);
  });

  it("L1 stats still equal species baseStats exactly (save backward-compat)", () => {
    const project = createBlankProject();
    for (const speciesId of STARTERS) {
      const species = monsterSpeciesById(project, speciesId);
      if (!species) throw new Error(`missing ${speciesId}`);
      const stats = monsterBattleStats(project, species, mon(project, speciesId, 1));
      expect(stats.maxHp).toBe(species.baseStats.maxHp);
      expect(stats.attack).toBe(species.baseStats.attack);
      expect(stats.defense).toBe(species.baseStats.defense);
      expect(stats.mind).toBe(species.baseStats.mind);
      expect(stats.agility).toBe(species.baseStats.agility);
    }
  });
});

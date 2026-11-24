import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { createBlankProject } from "@/project/defaults";
import { normalizeEnemyRecord, normalizeSkillRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { monsterBattleStats, monsterSpeciesById, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project, PlacementSurfaceCondition } from "@/project/types";
import { asPlacementFacing, asPlacementZone, checkPlacementSurface, describePlacementSurface, evaluatePlacementConditions, surfaceRuleFromClusterRule, tileSetSurfaceProbe, type SurfaceProbe } from "@/project/placementSurface";
import { BATTLER_IDLE_ANIMATIONS } from "@/assets/battlerIdleAnimations";
import { readStoredZipEntry, readStoredZipEntryNames } from "@/project/packageZip";
import { WEB_PLAYER_MANIFEST, collectWebExportAssets, createWebPlayerExportPackage, discoverWebPlayerBundleFiles, prepareWebExport } from "@/project/webExport";
import { loadVerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";
import { unicodeCaseFoldKey } from "@/project/unicodeCaseFold.js";
import { sha256HexBytes, sha256HexText } from "@/util/sha256";
import { createPlayerDeploymentManifest, parsePlayerDeploymentManifest } from "../scripts/lib/playerDeploymentManifest.mjs";
import { isolateTimers } from "./mergedTeardown";

// B6's six July gauge calibrations predate Pokemon stats and the actor-party enemy rebalance.
// Preserve the seven tracked coverage slots and the existing type-effectiveness check,
// using explicit Gen1 fixtures and independent known answers rather than retuning shipped data.
describe("pkmnBalanceB6", () => {
  isolateTimers();
  const STARTERS = ["species_aqualing", "species_leafling", "species_sparkit"] as const;
  function mon(project: Project, speciesId: string, level: number, id = "mon_1"): MonsterInstance {
    return {
      instanceId: id, speciesId, level, exp: 0,
      ivs: { hp: 0, atk: 0, def: 0, spd: 0 }, friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    };
  }
  function gen1Fixture() {
    const project = createBlankProject();
    project.system = {
      ...project.system, battleModel: "gen1", battleFlow: "strict", battleUiStyle: "pokemon",
      battleParty: "monsters", monsterCollection: true, activeSlots: undefined,
      typeChart: { types: ["normal", "water"], multipliers: { normal: { water: 1 } } },
    };
    const species = normalizeMonsterSpeciesRecord({
      id: "species_b6", name: "B6 specimen", types: ["water"],
      baseStats: { maxHp: 100, maxMp: 0, attack: 95, defense: 95, mind: 95, agility: 40 },
      skillsByLevel: [{ level: 1, skillId: "skill_b6" }],
    });
    const skill = normalizeSkillRecord({
      id: "skill_b6", name: "B6 strike", type: "normal", scope: "enemy",
      mpCost: { flat: 0, percentMax: 0 }, power: 40, hitRate: 100, successRate: 100, variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      elementId: "normal", maxPp: 5, movePriority: 1,
    });
    const enemy = normalizeEnemyRecord({
      id: "enemy_b6", name: "B6 opponent", speciesId: species.id, level: 50,
      stats: { maxHp: 100, maxMp: 0, attack: 1, defense: 100, mind: 100, agility: 1 },
      actions: [{ skillId: "skill_b6_enemy", priority: 5, condition: { kind: "always" } }],
      stateRates: {}, elementRates: {},
    });
    project.database.monsterSpecies = [species];
    project.database.skills = [skill, { ...skill, id: "skill_b6_enemy", name: "B6 reply", movePriority: 0 }];
    project.database.enemies = [enemy];
    project.database.troops = [normalizeTroopRecord({ id: "troop_b6", name: "B6 duel", enemyIds: [enemy.id] })];
    project.database.states = [];
    project.database.elements = [{
      id: "normal", name: "Normal", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"],
      damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
    }];
    return { project, species, skill, enemy };
  }
  function duel(project: Project, party: readonly MonsterInstance[]) {
    // Each move gets noncritical byte 255, maximum damage byte 255, and hit byte 0.
    // One target/action and unequal priority/Speed avoid unrelated RNG draws.
    let byteIndex = 0;
    return createBattleRuntime({
      project, troopId: "troop_b6", partyMonsters: party, canEscape: false, canLose: true,
      rng: () => (byteIndex++ % 3 === 2 ? 0 : 255 / 256),
    });
  }
  const strike = { kind: "skill", skillId: "skill_b6", targetEnemyId: "enemy-1" } as const;
  describe("batch 6 · explicit Gen1 combat contracts", () => {
    it("uses Pokemon stat known answers at L5 and L50 with explicit IVs", () => {
      const { project, species } = gen1Fixture();
      const starter = mon(project, species.id, 5);
      const trained = { ...starter, level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } };

      // HP=floor((200+IV)*L/100)+L+10; other stats=floor((190+IV)*L/100)+5.
      expect(monsterBattleStats(project, starter)).toEqual({ maxHp: 25, maxMp: 0, attack: 14, defense: 14, mind: 14, agility: 9 });
      expect(monsterBattleStats(project, trained)).toEqual({ maxHp: 167, maxMp: 0, attack: 107, defense: 107, mind: 100, agility: 52 });
    });

    it("deals the cartridge L50 P40 A100 D100 known answer and spends one PP", () => {
      const { project, species } = gen1Fixture();
      const runtime = duel(project, [mon(project, species.id, 50)]);
      const before = runtime.snapshot();
      expect(before.actors[0]?.skillPp?.skill_b6).toBe(5);

      runtime.performActorCommand(strike);

      // floor(floor((floor(2*50/5)+2)*40*100/100)/50)+2 = 19; no STAB.
      const after = runtime.snapshot();
      expect(after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
        .toMatchObject({ hit: true, critical: false, amount: 19 });
      expect(after.enemies[0]?.hp).toBe(81);
      expect(after.actors[0]?.skillPp?.skill_b6).toBe(4);
    });

    it("orders a slow priority move before a fast opponent and Speed breaks equal priority", () => {
      for (const priority of [1, 0]) {
        const { project, species, skill, enemy } = gen1Fixture();
        skill.movePriority = priority;
        enemy.stats.agility = 100;
        const runtime = duel(project, [mon(project, species.id, 50)]);

        runtime.performActorCommand(strike);

        const sides = runtime.snapshot().roundLogs.flatMap((round) => round.actions.map((action) => action.side));
        expect(sides).toEqual(priority === 1 ? ["actor", "enemy"] : ["enemy", "actor"]);
      }
    });

    it("matches both combatants at L26 and uses that level in the damage formula", () => {
      const { project, species, enemy } = gen1Fixture();
      enemy.level = 26;
      enemy.stats = { maxHp: 88, maxMp: 0, attack: 54, defense: 54, mind: 54, agility: 25 };
      const runtime = duel(project, [mon(project, species.id, 26)]);
      const before = runtime.snapshot();
      expect(before.actors[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });
      expect(before.enemies[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });

      runtime.performActorCommand(strike);

      // L26's level term is 12: floor(12*40/50)+2 = 11, not the L50 answer 19.
      expect(runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
        .toMatchObject({ hit: true, critical: false, amount: 11 });
    });

    it("counts two usable-move decisions and two resolved attacks in a seeded Gen1 simulation", () => {
      const { project, species, enemy } = gen1Fixture();
      species.baseStats.agility = 1; // Critical threshold floor(base Speed / 2) = 0.
      enemy.stats.maxHp = 20; // Two neutral hits of 16..19, never a one-hit victory.
      const actor = { ...mon(project, species.id, 50), skillPp: { skill_b6: 2 } };

      const result = simulateBattle({ project, troopId: "troop_b6", heroLevel: 1, monsterParty: [actor], n: 1, seed: 42, maxSteps: 4 });

      expect(result.battleFlow).toBe("strict");
      expect(result.samples).toBe(1);
      expect(result.winRate).toBe(1);
      expect(result.avgTurns).toBe(2);
      const actions = result.roundLogs.flatMap((round) => round.actions).filter((action) => action.side === "actor");
      expect(actions.map((action) => ({ kind: action.commandKind, hit: action.hit })))
        .toEqual([{ kind: "skill", hit: true }, { kind: "skill", hit: true }]);
      expect(result.participatingActorIds).toEqual(["mon_1"]);
      expect(actor.skillPp).toEqual({ skill_b6: 2 }); // Simulation consumes battle state, not its input.
    });

    it("defaults a Gen1 trio to one active monster and admits reserves only by switching", () => {
      const { project, species } = gen1Fixture();
      const party = ["mon_1", "mon_2", "mon_3"].map((id) => mon(project, species.id, 50, id));
      const runtime = duel(project, party);
      expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_1"]);
      expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_2", "mon_3"]);
      expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1"]);

      runtime.performActorCommand({ kind: "switch", targetActorId: "mon_2" });

      expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_2"]);
      expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_1", "mon_3"]);
      expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1", "mon_2"]);
      expect(runtime.snapshot().reserveActors.find((actor) => actor.recordId === "mon_3")?.hp).toBe(160);
    });
  });
  describe("batch 6 · type weakness is clearly felt (>=3x vs resist)", () => {
    function skillDamageVs(targetSpecies: string, level: number): number {
      const project = createBlankProject();
      const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
      if (!enemy) throw new Error("missing enemy_slime");
      enemy.speciesId = targetSpecies;
      // 적은 과녁일 뿐이다: 먼저 움직이거나(민첩) 정신력 기술(독침)로 몬스터를 쓰러뜨리지 않게 한다.
      enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1, mind: 1, agility: 1 };
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
    it("L1 stats use the Pokemon formula through the instance API", () => {
      const project = createBlankProject();
      for (const speciesId of STARTERS) {
        const species = monsterSpeciesById(project, speciesId);
        if (!species) throw new Error(`missing ${speciesId}`);
        const stats = monsterBattleStats(project, mon(project, speciesId, 1));
        expect(stats.maxHp).toBe(Math.floor(2 * species.baseStats.maxHp / 100) + 11);
        expect(stats.attack).toBe(Math.floor(2 * species.baseStats.attack / 100) + 5);
        expect(stats.defense).toBe(Math.floor(2 * species.baseStats.defense / 100) + 5);
        expect(stats.mind).toBe(Math.floor(2 * species.baseStats.mind / 100) + 5);
        expect(stats.agility).toBe(Math.floor(2 * species.baseStats.agility / 100) + 5);
      }
    });
  });
});

describe("placementSurface", () => {
  isolateTimers();
  /**
   * 테스트용 방. `#` = 벽, `.` = 바닥.
   * 좌표는 문자열 인덱스 그대로 — (x, y) = (열, 행).
   */
  function probeFromArt(rows: readonly string[]): SurfaceProbe {
    const height = rows.length;
    const width = Math.max(...rows.map((row) => row.length));
    return tileSetSurfaceProbe({
      height,
      tileAt: (x, y) => (rows[y]?.[x] === "#" ? 1 : 0),
      width,
      wallTiles: new Set([1]),
    });
  }
  /** 5×5 방: 테두리가 벽, 안이 바닥. */
  const ROOM = [
    "#####",
    "#...#",
    "#...#",
    "#...#",
    "#####",
  ];
  describe("placementSurface — 배치 면 판정", () => {
    it("벽에 붙은 바닥: 북쪽은 위 칸이 벽일 때만 통과한다", () => {
      const probe = probeFromArt(ROOM);
      const north = { facing: "north", zone: "againstWall" } as const;

      // (2,1): 위가 테두리 벽 → 통과
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: north }).ok).toBe(true);
      // (2,2): 위가 바닥 → 실패
      const middle = checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: north });
      expect(middle.ok).toBe(false);
      expect(middle.reason).toContain("북쪽");
    });

    it("방향을 명시하면 다른 쪽이 벽이어도 통과하지 않는다 — 실패 이유가 붙어 있는 쪽을 알려준다", () => {
      const probe = probeFromArt(ROOM);
      // (1,2): 서쪽이 벽, 북쪽은 바닥
      const check = checkPlacementSurface({
        probe,
        rect: { x: 1, y: 2, w: 1, h: 1 },
        rule: { facing: "north", zone: "againstWall" },
      });
      expect(check.ok).toBe(false);
      expect(check.satisfiedFacings).toEqual(["west"]);
      expect(check.reason).toContain("서쪽");
    });

    it("방향을 any 로 두면 네 방향 중 하나만 벽이어도 통과한다", () => {
      const probe = probeFromArt(ROOM);
      expect(
        checkPlacementSurface({ probe, rect: { x: 1, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
      ).toBe(true);
      expect(
        checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
      ).toBe(false);
    });

    it("화덕처럼 키 큰 물건은 **발밑 줄**로 판정한다 — 윗칸이 벽에 겹쳐도 통과", () => {
      const probe = probeFromArt(ROOM);
      // 1×2 세로쌍의 좌상단을 벽 행(y=0)에 두고 발밑을 y=1 에 둔다.
      // 사각 전체를 봤다면 y=0 이 벽이라 어떤 바닥 zone 도 만족할 수 없다.
      const stove = checkPlacementSurface({
        probe,
        rect: { x: 2, y: 0, w: 1, h: 2 },
        rule: { facing: "north", zone: "againstWall" },
      });
      expect(stove.ok).toBe(true);
      expect(stove.reason).toContain("북쪽");
    });

    it("빈 땅(clearArea)은 사각 전체를 본다 — 발밑만 보는 anyFloor 와 갈린다", () => {
      const probe = probeFromArt(ROOM);
      const rect = { x: 2, y: 0, w: 1, h: 2 };
      expect(checkPlacementSurface({ probe, rect, rule: { zone: "anyFloor" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect, rule: { zone: "clearArea" } }).ok).toBe(false);
    });

    it("구석은 세로 한 쪽 + 가로 한 쪽이 모두 벽이어야 한다", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 1, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(true);
      // (2,1): 북쪽만 벽 — 가로가 비어 구석이 아니다
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(false);
    });

    it("벽에서 떨어진 바닥(openFloor)은 네 방향 모두 트여 있어야 한다", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(false);
    });

    it("벽면(wallFace)은 발밑 자체가 벽이어야 한다 — 창문·아궁이", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 0, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(false);
    });

    it("맵 밖은 벽으로 센다 — 경계에 등을 대는 것도 «벽에 붙은» 것이다", () => {
      // 테두리 없는 3×3 바닥. (1,0) 의 북쪽은 맵 밖.
      const probe = probeFromArt(["...", "...", "..."]);
      expect(
        checkPlacementSurface({ probe, rect: { x: 1, y: 0, w: 1, h: 1 }, rule: { facing: "north", zone: "againstWall" } }).ok,
      ).toBe(true);
    });

    it("가로로 넓은 물건은 발밑 줄 **전부**가 그 방향으로 벽이어야 한다", () => {
      // 위쪽 벽이 왼쪽 2칸만 있는 방
      const probe = probeFromArt([
        "##..",
        "....",
        "....",
      ]);
      const rule = { facing: "north", zone: "againstWall" } as const;
      expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 2, h: 1 }, rule }).ok).toBe(true);
      // 3칸이면 (2,0) 이 바닥이라 실패
      expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 3, h: 1 }, rule }).ok).toBe(false);
    });
  });
  describe("placementSurface — 조건 목록 판정", () => {
    const north: PlacementSurfaceCondition = {
      id: "pc_north",
      strength: "hard",
      zone: "againstWall",
      facing: "north",
    };
    const openSoft: PlacementSurfaceCondition = { id: "pc_open", strength: "soft", zone: "openFloor" };

    it("hard 는 blocked, soft 는 warnings 로 갈린다", () => {
      const probe = probeFromArt(ROOM);
      // (2,2): 북쪽이 바닥(hard 위반) + 네 방향 트임(soft 통과)
      const middle = evaluatePlacementConditions({
        conditions: [north, openSoft],
        probe,
        rect: { x: 2, y: 2, w: 1, h: 1 },
      });
      expect(middle.blocked).toHaveLength(1);
      expect(middle.warnings).toHaveLength(0);

      // (2,1): 북쪽이 벽(hard 통과) + 북쪽이 벽이라 openFloor 위반(soft)
      const top = evaluatePlacementConditions({
        conditions: [north, openSoft],
        probe,
        rect: { x: 2, y: 1, w: 1, h: 1 },
      });
      expect(top.blocked).toHaveLength(0);
      expect(top.warnings).toHaveLength(1);
    });

    it("조건이 없거나 undefined 면 아무것도 막지 않는다 — 기존 킷 하위 호환", () => {
      const probe = probeFromArt(ROOM);
      const rect = { x: 2, y: 2, w: 1, h: 1 };
      expect(evaluatePlacementConditions({ conditions: undefined, probe, rect }).blocked).toHaveLength(0);
      expect(evaluatePlacementConditions({ conditions: [], probe, rect }).blocked).toHaveLength(0);
    });

    it("사람이 쓴 message 가 있으면 그것을 앞세우고 판정 이유를 괄호로 붙인다", () => {
      const probe = probeFromArt(ROOM);
      const verdict = evaluatePlacementConditions({
        conditions: [{ ...north, message: "화덕은 북벽에 붙습니다" }],
        probe,
        rect: { x: 2, y: 2, w: 1, h: 1 },
      });
      expect(verdict.blocked[0]?.text).toContain("화덕은 북벽에 붙습니다");
      expect(verdict.blocked[0]?.text).toContain("북쪽");
    });
  });
  describe("placementSurface — 라벨과 파싱", () => {
    it("사람 말 설명은 방향까지 담는다", () => {
      expect(describePlacementSurface({ facing: "north", zone: "againstWall" })).toBe("북쪽(위) 벽에 붙은 바닥");
      expect(describePlacementSurface({ zone: "againstWall" })).toBe("벽에 붙은 바닥");
      // 방향은 againstWall 에서만 뜻이 있다 — 다른 면에서는 무시한다
      expect(describePlacementSurface({ facing: "north", zone: "openFloor" })).toBe("벽에서 떨어진 바닥");
    });

    it("모르는 값은 undefined 로 떨어진다 — 억지 매핑 금지", () => {
      expect(asPlacementZone("againstWall")).toBe("againstWall");
      expect(asPlacementZone("againstWallFloor")).toBeUndefined();
      expect(asPlacementFacing("north")).toBe("north");
      expect(asPlacementFacing("up")).toBeUndefined();
    });

    it("surface 클러스터 규칙 params → 규칙. 다른 kind 나 잘못된 zone 은 undefined", () => {
      expect(
        surfaceRuleFromClusterRule({
          id: "r",
          kind: "surface",
          params: { facing: "north", zone: "againstWall" },
          strength: "hard",
        }),
      ).toEqual({ facing: "north", zone: "againstWall" });
      expect(
        surfaceRuleFromClusterRule({ id: "r", kind: "surface", params: { zone: "뭐지" }, strength: "hard" }),
      ).toBeUndefined();
      expect(
        surfaceRuleFromClusterRule({ id: "r", kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
      ).toBeUndefined();
    });
  });
});

describe("playerManifestContract", () => {
  isolateTimers();
  const encoder = new TextEncoder();
  const BUNDLE_BASE = "/export-player/";
  const RUNTIME_ASSET_PATH = "assets/runtime-required.png";
  type FileRecord = {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  };
  type FixtureOptions = {
    readonly manifestMode?: "valid" | "missing" | "malformed";
    readonly omitArtifactRecord?: string;
    readonly extraArtifact?: readonly [path: string, contents: string];
    readonly viteCss?: boolean;
    readonly viteManifestText?: string;
    readonly unavailablePath?: string;
    readonly tamperedPath?: string;
    readonly interruptPath?: string;
    readonly runtimeCaseCollision?: boolean;
    readonly viteCaseCollision?: boolean;
    readonly viteCollisionPaths?: readonly [string, string];
    readonly reservedZipCollision?: boolean;
    readonly reservedZipPath?: string;
    readonly mutateManifest?: (manifest: Record<string, unknown>) => void;
  };
  type DeploymentFixture = {
    readonly artifactBytes: ReadonlyMap<string, Uint8Array>;
    readonly artifactPaths: readonly string[];
    readonly runtimeBytes: Uint8Array;
    readonly fetchBytes: (requestPath: string) => Promise<Uint8Array>;
  };
  describe("player deployment manifest", () => {
    it.each([
      ["Cyrillic U+1C89 drift", "assets/\u1c89.js", "assets/\u1c8a.js"],
      ["Garay U+10D50 drift", "assets/\u{10d50}.js", "assets/\u{10d70}.js"],
    ])("uses pinned Unicode 15 semantics for post-version %s", (_name, left, right) => {
      expect(unicodeCaseFoldKey(left)).not.toBe(unicodeCaseFoldKey(right));
    });

    it("emits one coherent Node build contract for the complete Vite closure", async () => {
      const viteManifestValue = {
        "player.html": {
          file: "player.js",
          isEntry: true,
          css: ["assets/player.css"],
          dynamicImports: ["scene"],
        },
        scene: { file: "assets/chunk.js" },
      };
      const files = await recordsFor(new Map([
        ["assets/chunk.js", encoder.encode("chunk")],
        ["assets/player.css", encoder.encode("css")],
        ["player-manifest.json", encoder.encode(JSON.stringify(viteManifestValue))],
        ["player.html", encoder.encode("html")],
        ["player.js", encoder.encode("entry")],
      ]));
      const sourceInputs = await recordsFor(new Map([["src/player/exportEntry.ts", encoder.encode("source")]]));
      const runtimeAssets = await recordsFor(new Map([[RUNTIME_ASSET_PATH, encoder.encode("runtime")]]));

      const manifest = createPlayerDeploymentManifest({
        files,
        sourceInputs,
        runtimeAssets,
        viteManifestValue,
        sourceRevision: "fixture-revision",
        builtAt: "2026-07-22T00:00:00.000Z",
      });
      const parsed = parsePlayerDeploymentManifest(manifest, { viteManifestValue });

      expect(parsed.deployment.artifactPaths).toEqual(files.map((record) => record.path));
      expect(parsed.deployment.runtimeAssets).toEqual(runtimeAssets);
      expect(parsed.deployment.deploymentDigest).toMatch(/^[a-f0-9]{64}$/u);
    });

    it("rejects export when the authoritative manifest is unavailable even if player.js exists", async () => {
      const fixture = await deploymentFixture({ manifestMode: "missing" });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-unavailable",
      });
    });

    it("rejects export when the authoritative manifest is malformed", async () => {
      const fixture = await deploymentFixture({ manifestMode: "malformed" });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-malformed",
      });
    });

    it.each([
      ["sentinel", (manifest: Record<string, unknown>) => { manifest["sentinel"] = "misleading-manifest"; }],
      ["contract schema", (manifest: Record<string, unknown>) => { manifest["schemaVersion"] = 999; }],
      ["source digest", (manifest: Record<string, unknown>) => { manifest["sourceDigest"] = "0".repeat(64); }],
      ["artifact digest", (manifest: Record<string, unknown>) => { manifest["artifactDigest"] = "0".repeat(64); }],
      ["deployment schema", (manifest: Record<string, unknown>) => {
        mutableRecord(manifest["deployment"])["schemaVersion"] = 999;
      }],
      ["deployment entry path", (manifest: Record<string, unknown>) => {
        mutableRecord(manifest["deployment"])["entryHtml"] = "alternate.html";
      }],
      ["traversal path", (manifest: Record<string, unknown>) => {
        mutableFirstRecord(manifest["files"])["path"] = "../outside.js";
      }],
      ["absolute path", (manifest: Record<string, unknown>) => {
        mutableFirstRecord(manifest["files"])["path"] = "C:/outside.js";
      }],
      ["encoded traversal path", (manifest: Record<string, unknown>) => {
        mutableFirstRecord(manifest["files"])["path"] = "%2e%2e/outside.js";
      }],
    ])("rejects an incoherent %s without exposing manifest values", async (_name, mutateManifest) => {
      const fixture = await deploymentFixture({ mutateManifest });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-contract-mismatch",
      });
    });

    it("rejects a manifest whose CSS dependency is absent from the exact artifact set", async () => {
      const fixture = await deploymentFixture({ omitArtifactRecord: "assets/player.css" });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-incomplete",
      });
    });

    it("includes the digest-bound collector companion in browser deployment closure", async () => {
      const fixture = await deploymentFixture({ extraArtifact: ["dependency-collector.js", "retained collector"] });
      const files = await discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes);
      expect(files.map(file => file.zipPath)).toContain("dependency-collector.js");
      const tampered = await deploymentFixture({ extraArtifact: ["dependency-collector.js", "retained collector"], tamperedPath: "dependency-collector.js" });
      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, tampered.fetchBytes)).rejects.toMatchObject({ code: "bundle-integrity-mismatch" });
      const absent = await deploymentFixture({ extraArtifact: ["dependency-collector.js", "retained collector"], unavailablePath: "dependency-collector.js" });
      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, absent.fetchBytes)).rejects.toMatchObject({ code: "bundle-unavailable" });
    });

    it("rejects an undeclared stale chunk in the exact artifact set", async () => {
      const fixture = await deploymentFixture({ extraArtifact: ["assets/stale.js", "stale"] });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-incomplete",
      });
    });

    it("rejects an entry graph with no stylesheet", async () => {
      const fixture = await deploymentFixture({ viteCss: false, omitArtifactRecord: "assets/player.css" });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-incomplete",
      });
    });

    it("rejects a malformed transitive Vite manifest even when its own hash is valid", async () => {
      const fixture = await deploymentFixture({ viteManifestText: "{not-json" });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-incomplete",
      });
    });

    it("rejects case-insensitive collisions in the Vite output closure", async () => {
      const fixture = await deploymentFixture({ viteCaseCollision: true });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-path-collision",
      });
    });

    it.each([
      ["sharp-s", "assets/Straße.js", "assets/STRASSE.js"],
      ["Greek final sigma", "assets/ος.js", "assets/οσ.js"],
      ["compatibility ligature", "assets/ﬃ.js", "assets/ffi.js"],
      ["NFC composition", "assets/café.js", "assets/cafe\u0301.js"],
    ])("rejects a portable Unicode %s collision in the browser manifest", async (_name, left, right) => {
      const fixture = await deploymentFixture({ viteCollisionPaths: [left, right] });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-path-collision",
      });
    });

    it("rejects case-insensitive collisions in declared runtime assets", async () => {
      const fixture = await deploymentFixture({ runtimeCaseCollision: true });

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: "manifest-path-collision",
      });
    });

    it.each([
      ["missing chunk", { unavailablePath: "assets/chunk.js" }, "bundle-unavailable", "assets/chunk.js"],
      ["tampered chunk", { tamperedPath: "assets/chunk.js" }, "bundle-integrity-mismatch", "assets/chunk.js"],
      ["wrong chunk byte count", { tamperedPath: "player.js" }, "bundle-integrity-mismatch", "player.js"],
      ["missing runtime asset", { unavailablePath: RUNTIME_ASSET_PATH }, "runtime-asset-unavailable", RUNTIME_ASSET_PATH],
      ["tampered runtime asset", { tamperedPath: RUNTIME_ASSET_PATH }, "runtime-asset-integrity-mismatch", RUNTIME_ASSET_PATH],
      ["interrupted bundle read", { interruptPath: "assets/chunk.js" }, "bundle-unavailable", "assets/chunk.js"],
    ])("rejects %s before ZIP success", async (_name, options, expectedCode, expectedPath) => {
      const fixture = await deploymentFixture(options);

      await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
        code: expectedCode,
        paths: [expectedPath],
      });
    });

    it("names the missing bundle file and omits the host path from a failed read", async () => {
      const sensitiveMarker = `sk-${"T".repeat(32)}`;
      const hostPath = "C:/private/build/player.js";
      const fixture = await deploymentFixture({ unavailablePath: "player.js" });
      const failingFetch = async (requestPath: string): Promise<Uint8Array> => {
        if (requestPath.endsWith("player.js")) throw new Error(`${hostPath}:${sensitiveMarker}`);
        return fixture.fetchBytes(requestPath);
      };

      const error = await discoverWebPlayerBundleFiles(BUNDLE_BASE, failingFetch).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: "bundle-unavailable", paths: ["player.js"] });
      expect(String(error)).toContain("player.js");
      expect(String(error)).not.toContain(hostPath);
      expect(String(error)).not.toContain(sensitiveMarker);
    });

    it.each([
      ["manifest string", WEB_PLAYER_MANIFEST, `C:/private/${"manifest-canary"}`, "manifest-unavailable"],
      ["bundle object", "player.js", { canary: "bundle-canary", hostPath: "C:/private/player.js" }, "bundle-unavailable"],
      ["runtime string", RUNTIME_ASSET_PATH, `C:/private/${"runtime-canary"}`, "runtime-asset-unavailable"],
    ])("redacts a non-Error %s throw into a typed export failure", async (_name, failingPath, thrownValue, expectedCode) => {
      const fixture = await deploymentFixture();
      const failingFetch = async (requestPath: string): Promise<Uint8Array> => {
        if (requestPath.endsWith(failingPath)) throw thrownValue;
        return fixture.fetchBytes(requestPath);
      };

      const error = await discoverWebPlayerBundleFiles(BUNDLE_BASE, failingFetch).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: expectedCode, paths: [failingPath] });
      expect(JSON.stringify(error)).not.toContain("canary");
      expect(String(error)).not.toContain("C:/private");
    });

    it("redacts a non-Error manifest parser failure", async () => {
      const fixture = await deploymentFixture();
      const error = await loadVerifiedPlayerDeployment({
        bundleBase: BUNDLE_BASE,
        adapters: {
          fetchBytes: fixture.fetchBytes,
          parseJson: () => { throw `C:/private/${"parser-canary"}`; },
        },
      }).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: "manifest-malformed" });
      expect(String(error)).not.toContain("parser-canary");
      expect(String(error)).not.toContain("C:/private");
    });

    it("redacts a non-Error manifest hash failure", async () => {
      const fixture = await deploymentFixture();
      const error = await loadVerifiedPlayerDeployment({
        bundleBase: BUNDLE_BASE,
        adapters: {
          fetchBytes: fixture.fetchBytes,
          hashText: async () => { throw { canary: "manifest-hash-canary", hostPath: "C:/private/hash" }; },
        },
      }).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: "manifest-contract-mismatch" });
      expect(JSON.stringify(error)).not.toContain("canary");
      expect(String(error)).not.toContain("C:/private");
    });

    it("redacts a non-Error bundle hash failure", async () => {
      const fixture = await deploymentFixture();
      const error = await loadVerifiedPlayerDeployment({
        bundleBase: BUNDLE_BASE,
        adapters: {
          fetchBytes: fixture.fetchBytes,
          hashBytes: async () => { throw `C:/private/${"bundle-hash-canary"}`; },
        },
      }).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: "bundle-integrity-mismatch" });
      expect(String(error)).not.toContain("bundle-hash-canary");
      expect(String(error)).not.toContain("C:/private");
    });

    it("rejects a deployment path that case-collides with generated project.json", async () => {
      const fixture = await deploymentFixture({ reservedZipCollision: true });

      await expect(createWebPlayerExportPackage(createBlankProject(), {
        bundleBase: BUNDLE_BASE,
        fetchBytes: fixture.fetchBytes,
      })).rejects.toMatchObject({ code: "zip-path-collision", paths: ["project.json", "PROJECT.JSON"] });
    });

    it("rejects case-colliding generated uploaded-asset paths", async () => {
      const fixture = await deploymentFixture();
      const project = createBlankProject();
      const firstItem = project.database.items[0];
      if (firstItem === undefined) throw new TypeError("fixture database item expected");
      project.assets.uploaded = {
        Hero: uploadedPicture("Hero"),
        hero: uploadedPicture("hero"),
      };
      project.database.items[0] = {
        ...firstItem,
        imageResourceId: "Hero",
        iconResourceId: "hero",
      };

      const error = await createWebPlayerExportPackage(project, {
        bundleBase: BUNDLE_BASE,
        fetchBytes: fixture.fetchBytes,
      }).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ code: "zip-path-collision" });
      expect([...(error as { paths: string[] }).paths].sort()).toEqual([
        "assets/uploaded/Hero.png",
        "assets/uploaded/hero.png",
      ].sort());
    });

    it("rejects a full-casefold collision across deployment and generated ZIP entries", async () => {
      const fixture = await deploymentFixture({ reservedZipPath: "assets/uploaded/STRASSE.png" });
      const project = createBlankProject();
      const firstItem = project.database.items[0];
      if (firstItem === undefined) throw new TypeError("fixture database item expected");
      project.assets.uploaded = { Straße: uploadedPicture("Straße") };
      project.database.items[0] = { ...firstItem, imageResourceId: "Straße" };

      await expect(createWebPlayerExportPackage(project, {
        bundleBase: BUNDLE_BASE,
        fetchBytes: fixture.fetchBytes,
      })).rejects.toMatchObject({
        code: "zip-path-collision",
        paths: ["assets/uploaded/STRASSE.png", "assets/uploaded/Straße.png"],
      });
    });

    it.each([undefined, "pokemon", "retro2003"] as const)("writes the exact verified deployment closure and project payload into the ZIP for %s", async skin => {
      const fixture = await deploymentFixture();
      const project = createBlankProject();
      project.system.battleUiStyle = skin;
      // 기본 액터는 이제 칩셋 배틀러(charset-battler-*)를 써서 생성 영웅 뒷모습(-back)이 파생되지 않는다.
      // 포켓몬 스킨의 뒷모습 동봉을 보려면 생성 영웅 전투 시트를 쓰는 액터 넷을 둔다(partySpriteResources actorBackSpriteId).
      if (skin === "pokemon") {
        project.database.actors.slice(0, 4).forEach((actor, index) => {
          actor.battleCharacterResourceId = `generated-actor-hero-0${index + 1}-battle`;
        });
      }

      const result = await createWebPlayerExportPackage(project, {
        bundleBase: BUNDLE_BASE,
        fetchBytes: fixture.fetchBytes,
      });
      const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
      const projectAssetPaths = collectWebExportAssets(prepareWebExport(project).project).map((asset) => asset.zipPath);
      const expectedPaths = [...new Set([
        "project.json",
        // 불러오는 중 화면이 project.json 보다 먼저 읽는 안내(webExportZip exactWebExportEntries loadingInfo, #3318).
        "loading.json",
        ...fixture.artifactPaths,
        RUNTIME_ASSET_PATH,
        ...projectAssetPaths,
      ])].sort((left, right) => left.localeCompare(right));

      expect(readStoredZipEntryNames(zipBytes)).toEqual(expectedPaths);
      for (const idle of BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.resourceId.endsWith("-back"))) {
        for (const path of [idle.path.replace("/idle/", "/"), idle.path]) {
          const bytes = readStoredZipEntry(zipBytes, path);
          if (skin === "pokemon") expect(bytes, path).toEqual(await fixture.fetchBytes(`/${path}`));
          else expect(bytes, path).toBeNull();
        }
      }
      for (const [filePath, bytes] of fixture.artifactBytes) {
        expect(await digestZipEntry(zipBytes, filePath)).toBe(await sha256HexBytes(bytes));
      }
      expect(await digestZipEntry(zipBytes, RUNTIME_ASSET_PATH)).toBe(await sha256HexBytes(fixture.runtimeBytes));
      expect(result.summary.playerBundleFileCount).toBe(fixture.artifactPaths.length);
      expect(result.summary.zipEntryCount).toBe(expectedPaths.length);
    });
  });
  async function deploymentFixture(options: FixtureOptions = {}): Promise<DeploymentFixture> {
    const viteCollisionPaths = options.viteCollisionPaths
      ?? (options.viteCaseCollision ? ["assets/Chunk.js", "assets/chunk.js"] as const : undefined);
    const reservedZipPath = options.reservedZipPath ?? (options.reservedZipCollision ? "PROJECT.JSON" : undefined);
    const viteManifestValue = viteCollisionPaths !== undefined
      ? {
          "player.html": {
            file: "player.js",
            isEntry: true,
            css: options.viteCss === false ? undefined : ["assets/player.css"],
            dynamicImports: ["scene-upper", "scene-lower"],
          },
          "scene-upper": { file: viteCollisionPaths[0] },
          "scene-lower": { file: viteCollisionPaths[1] },
        }
      : {
          "player.html": {
            file: "player.js",
            isEntry: true,
            css: options.viteCss === false ? undefined : ["assets/player.css"],
            dynamicImports: ["src/player/PlayScene.ts"],
            assets: reservedZipPath === undefined ? undefined : [reservedZipPath],
          },
          "src/player/PlayScene.ts": {
            file: "assets/chunk.js",
          },
        };
    const viteManifestText = options.viteManifestText ?? JSON.stringify(viteManifestValue);
    const artifactBytes = new Map<string, Uint8Array>([
      ["assets/player.css", encoder.encode(".play-stage{display:block}")],
      ["player-manifest.json", encoder.encode(viteManifestText)],
      ["player.html", encoder.encode("<!doctype html><main id=app></main>")],
      ["player.js", encoder.encode("import './assets/chunk.js';")],
    ]);
    if (viteCollisionPaths === undefined) artifactBytes.set("assets/chunk.js", encoder.encode("export const chunk = true;"));
    else {
      artifactBytes.set(viteCollisionPaths[0], encoder.encode("first collision output"));
      artifactBytes.set(viteCollisionPaths[1], encoder.encode("second collision output"));
    }
    if (reservedZipPath !== undefined) artifactBytes.set(reservedZipPath, encoder.encode("reserved collision"));
    if (options.omitArtifactRecord !== undefined) artifactBytes.delete(options.omitArtifactRecord);
    if (options.extraArtifact !== undefined) artifactBytes.set(options.extraArtifact[0], encoder.encode(options.extraArtifact[1]));
    const artifactRecords = await recordsFor(artifactBytes);
    const sourceRecords = await recordsFor(new Map([["src/player/exportEntry.ts", encoder.encode("fixture source")]]));
    const runtimeBytes = encoder.encode("runtime asset bytes");
    const runtimeFileBytes = new Map([[RUNTIME_ASSET_PATH, runtimeBytes]]);
    if (options.runtimeCaseCollision) runtimeFileBytes.set("assets/Runtime-Required.png", runtimeBytes);
    const runtimeRecords = await recordsFor(runtimeFileBytes);
    const artifactDigest = await digestRecords(artifactRecords);
    const sourceDigest = await digestRecords(sourceRecords);
    const runtimeAssetDigest = await digestRecords(runtimeRecords);
    const deploymentDigest = await sha256HexText(JSON.stringify({
      artifactDigest,
      runtimeAssetDigest,
      entryHtml: "player.html",
      entryScript: "player.js",
      viteManifest: "player-manifest.json",
    }));
    const manifest: Record<string, unknown> = {
      sentinel: "rpg-zzu/player-sdk-manifest",
      contractVersion: 2,
      schemaVersion: 4,
      artifactVersion: artifactDigest.slice(0, 16),
      artifactDigest,
      sourceDigest,
      sourceRevision: "fixture-revision",
      builtAt: "2026-07-22T00:00:00.000Z",
      files: artifactRecords,
      sourceInputs: sourceRecords,
      deployment: {
        schemaVersion: 1,
        entryHtml: "player.html",
        entryScript: "player.js",
        viteManifest: "player-manifest.json",
        artifactPaths: artifactRecords.map((record) => record.path),
        runtimeAssets: runtimeRecords,
        runtimeAssetDigest,
        deploymentDigest,
      },
    };
    options.mutateManifest?.(manifest);
    const manifestBytes = options.manifestMode === "malformed"
      ? encoder.encode("{not-json")
      : encoder.encode(JSON.stringify(manifest));

    const fetchBytes = async (requestPath: string): Promise<Uint8Array> => {
      const relativePath = requestPath.startsWith(BUNDLE_BASE)
        ? requestPath.slice(BUNDLE_BASE.length)
        : requestPath.replace(/^\/+/, "");
      if (relativePath === WEB_PLAYER_MANIFEST) {
        if (options.manifestMode === "missing") throw new Error("fixture manifest unavailable");
        return manifestBytes;
      }
      if (relativePath === options.interruptPath) {
        const interruption = new Error("fixture interrupted");
        interruption.name = "AbortError";
        throw interruption;
      }
      if (relativePath === options.unavailablePath) throw new Error("fixture dependency unavailable");
      if (relativePath === options.tamperedPath) return encoder.encode("tampered fixture bytes");
      const artifact = artifactBytes.get(relativePath);
      if (artifact !== undefined) return artifact;
      if (relativePath.toLowerCase() === RUNTIME_ASSET_PATH.toLowerCase()) return runtimeBytes;
      return encoder.encode(`project-asset:${relativePath}`);
    };
    return {
      artifactBytes,
      artifactPaths: artifactRecords.map((record) => record.path),
      runtimeBytes,
      fetchBytes,
    };
  }
  async function recordsFor(files: ReadonlyMap<string, Uint8Array>): Promise<readonly FileRecord[]> {
    const records = await Promise.all([...files.entries()].map(async ([filePath, bytes]) => ({
      path: filePath,
      bytes: bytes.length,
      sha256: await sha256HexBytes(bytes),
    })));
    return records.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  }
  function uploadedPicture(id: string): {
    readonly id: string;
    readonly name: string;
    readonly kind: "picture";
    readonly dataUrl: string;
    readonly meta: { readonly width: number; readonly height: number };
  } {
    return {
      id,
      name: id,
      kind: "picture",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 1, height: 1 },
    };
  }
  async function digestRecords(records: readonly FileRecord[]): Promise<string> {
    return sha256HexText(JSON.stringify(records.map((record) => [record.path, record.bytes, record.sha256])));
  }
  function mutableRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("fixture record expected");
    return value;
  }
  function mutableFirstRecord(value: unknown): Record<string, unknown> {
    if (!Array.isArray(value)) throw new TypeError("fixture record array expected");
    const first = value[0];
    return mutableRecord(first);
  }
  async function digestZipEntry(zipBytes: Uint8Array, filePath: string): Promise<string> {
    const entry = readStoredZipEntry(zipBytes, filePath);
    if (entry === null) throw new TypeError("fixture ZIP entry expected");
    return sha256HexBytes(entry);
  }
});

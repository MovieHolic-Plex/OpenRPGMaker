import { normalizeClassRecord, normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import type { ActorParameterCurves, GameEvent, Project } from "@/project/types";

export const HUNTING_LOW_TROOP_ID = "troop_phase8b_slime";
export const HUNTING_HIGH_TROOP_ID = "troop_phase8b_wolf";
export const HUNTING_PROMOTED_CLASS_ID = "class_phase8b_warrior";
export const HUNTING_PROMOTION_SWITCH_ID = "sw_phase8b_promoted";

function flatCurve(value: number): number[] {
  return Array.from({ length: 99 }, () => value);
}

function curves(values: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number }): ActorParameterCurves {
  return {
    maxHp: flatCurve(values.maxHp),
    maxMp: flatCurve(values.maxMp),
    attack: flatCurve(values.attack),
    defense: flatCurve(values.defense),
    mind: flatCurve(values.mind),
    agility: flatCurve(values.agility),
  };
}

export function createPhase8bHuntingFixture(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");

  map.name = "Phase 8b 두 구획 사냥터";
  map.encounterRate = 20;
  map.fieldSpawns = [
    { id: "phase8b_slime_spawn", troopId: HUNTING_LOW_TROOP_ID, area: { x: 2, y: 1, w: 1, h: 1 }, maxAlive: 1, respawnSec: 1 },
    { id: "phase8b_wolf_spawn", troopId: HUNTING_HIGH_TROOP_ID, area: { x: 12, y: 1, w: 3, h: 2 }, maxAlive: 2, respawnSec: 5, chase: true },
  ];
  map.encounterTable = [
    { troopId: HUNTING_LOW_TROOP_ID, weight: 3, conditions: { maxPartyLevel: 4, region: { x: 0, y: 0, w: 10, h: map.height } } },
    { troopId: HUNTING_HIGH_TROOP_ID, weight: 2, conditions: { minPartyLevel: 5, region: { x: 10, y: 0, w: map.width - 10, h: map.height } } },
  ];
  project.startPos = { x: 1, y: 1 };

  const hero = project.database.actors[0];
  if (!hero) throw new Error("missing hero");
  hero.initialLevel = 1;
  hero.maxLevel = 20;
  hero.expCurve = { base: 10, extra: 0, acceleration: 0 };
  hero.parameterCurves = curves({ maxHp: 120, maxMp: 20, attack: 80, defense: 60, mind: 20, agility: 40 });
  project.session.partyActorIds = [hero.id];
  project.system.startActorIds = [hero.id];

  const baseClass = project.database.classes.find((entry) => entry.id === hero.classId);
  if (baseClass) {
    baseClass.promotions = [{ toClassId: HUNTING_PROMOTED_CLASS_ID, requires: { level: 5 } }];
    baseClass.battleCommands = [{ id: "cmd_attack", name: "공격", kind: "attack" }];
  }
  project.database.classes.push(normalizeClassRecord({
    id: HUNTING_PROMOTED_CLASS_ID,
    name: "1차 전사",
    battleCommands: [{ id: "cmd_attack", name: "공격", kind: "attack" }],
    parameterCurves: curves({ maxHp: 150, maxMp: 25, attack: 95, defense: 70, mind: 20, agility: 45 }),
  }));
  project.switches.push({ id: HUNTING_PROMOTION_SWITCH_ID, name: "Phase 8b 승급 성공" });

  project.database.enemies.push(
    normalizeEnemyRecord({
      id: "enemy_phase8b_slime",
      name: "초보 슬라임",
      level: 1,
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 },
      rewards: { exp: 10, gold: 1, dropRatePercent: 0 },
    }),
    normalizeEnemyRecord({
      id: "enemy_phase8b_wolf",
      name: "고원 늑대",
      level: 5,
      monsterResourceId: "generated-enemy-bat-01",
      stats: { maxHp: 6, maxMp: 0, attack: 5, defense: 2, mind: 1, agility: 3 },
      rewards: { exp: 20, gold: 4, dropRatePercent: 0 },
    })
  );
  project.database.troops.push(
    normalizeTroopRecord({ id: HUNTING_LOW_TROOP_ID, name: "초보 슬라임 무리", enemyIds: ["enemy_phase8b_slime"] }),
    normalizeTroopRecord({ id: HUNTING_HIGH_TROOP_ID, name: "고원 늑대 무리", enemyIds: ["enemy_phase8b_wolf"] })
  );
  return project;
}

export function phase8bPromotionEvent(heroId: string): GameEvent {
  return {
    id: "ev_phase8b_promote",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_phase8b_promote",
        name: "1차 승급",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "promoteActor",
            actorId: heroId,
            successBranch: [{ kind: "setSwitch", switchId: HUNTING_PROMOTION_SWITCH_ID, value: true }],
            failureBranch: [{ kind: "setSwitch", switchId: HUNTING_PROMOTION_SWITCH_ID, value: false }],
          },
        ],
      },
    ],
  };
}

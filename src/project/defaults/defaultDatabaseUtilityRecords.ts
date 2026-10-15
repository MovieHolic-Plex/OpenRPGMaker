import type {
  ActorRateGrade,
  DatabaseBattleCommandRecord,
  DatabaseElementRecord,
  DatabaseTerrainRecord,
} from "../types";

const DEFAULT_ELEMENT_DAMAGE_MULTIPLIERS: Record<ActorRateGrade, number> = {
  A: 200,
  B: 150,
  C: 100,
  D: 50,
  E: 0,
};

function elementRecord(id: string, name: string, kind: DatabaseElementRecord["kind"]): DatabaseElementRecord {
  return { id, name, kind, rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { ...DEFAULT_ELEMENT_DAMAGE_MULTIPLIERS } };
}

export function defaultElementRecords(): DatabaseElementRecord[] {
  return [
    elementRecord("sword", "Sword", "physical"),
    elementRecord("spear", "Spear", "physical"),
    elementRecord("hit", "Hit", "physical"),
    elementRecord("bow", "Bow", "physical"),
    elementRecord("fire", "Fire", "magical"),
    elementRecord("ice", "Ice", "magical"),
    elementRecord("thunder", "Thunder", "magical"),
    elementRecord("water", "Water", "magical"),
    elementRecord("earth", "Earth", "magical"),
    elementRecord("wind", "Wind", "magical"),
    elementRecord("holy", "Holy", "magical"),
    elementRecord("dark", "Dark", "magical"),
    elementRecord("atk", "ATK", "magical"),
    elementRecord("def", "DEF", "magical"),
    elementRecord("int", "INT", "magical"),
    elementRecord("agi", "AGI", "magical"),
    elementRecord("absorb", "Absorb", "magical"),
    // Leaf attacks and the farmer roster refer to this id. Keep existing slots stable.
    elementRecord("grass", "Grass", "magical"),
  ];
}

/** 지형 태그 5 = 키 큰 풀(몬스터 칩셋). terrains[4] 가 이 기록이어야 한다. */
export const GRASS_TERRAIN_ID = "terrain_grass";
export const GRASS_TERRAIN_TAG = 5;

/**
 * 지형 기록 「초원 풀밭」을 태그 5 자리(terrains[4])에 심는다 — 기본 기록 4개(물·모래·눈·돌)는 그대로이고 새 프로젝트 기본값도 바꾸지 않는다.
 * 조우표 `conditions.terrainId = "terrain_grass"` 가 이 기록을 가리킨다. 이미 있으면 아무것도 안 한다.
 * 배율 100%(보통과 같음), 이름에 「숲」을 넣지 않는다(전투 배경 추정이 이름의 「숲」을 숲 배경으로 읽는다).
 * 반환: 태그 5 자리에 둘 수 있었는지(앞 네 칸이 모자라거나 다른 기록이 이미 5번 자리에 있으면 false).
 */
export function ensureGrassTerrainRecord(terrains: DatabaseTerrainRecord[]): boolean {
  if (terrains.some((record) => record.id === GRASS_TERRAIN_ID)) return terrains[GRASS_TERRAIN_TAG - 1]?.id === GRASS_TERRAIN_ID;
  if (terrains.length !== GRASS_TERRAIN_TAG - 1) return false;
  terrains.push({
    id: GRASS_TERRAIN_ID,
    name: "초원 풀밭",
    damage: 0,
    encounterRatePercent: 100,
    characterDisplay: "normal",
    vehiclePassage: { boat: false, ship: false, airshipLand: true },
  });
  return true;
}

/**
 * 기본 지형 기록. **배열 순서 = 타일셋 지형 태그 − 1** 이다(terrainRecordAt: tag N → terrains[N-1]).
 * 번들 칩셋은 chipsetMapping.TERRAIN_TAG 로 태그를 준다 — 0 보통 땅(기록 없음), 1 물, 2 모래, 3 눈, 4 돌.
 * 2026-09-27 까지는 [초원, 숲, "사막"(id terrain_water)] 이라 물 칸(태그 1)이 초원 기록을 읽어
 * 배가 기본 물 위를 못 다녔고, 모래 칸은 숲 배경을, 눈 칸은 이름만 사막인 물 기록을 읽었다.
 * 이미 저장된 프로젝트는 자기 database.terrains 를 그대로 쓴다 — 새 프로젝트만 바뀐다.
 */
export function defaultTerrainRecords(): DatabaseTerrainRecord[] {
  return [
    {
      id: "terrain_water",
      name: "물",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "battle-scenery-plains",
      characterDisplay: "normal",
      vehiclePassage: { boat: true, ship: true, airshipLand: false },
    },
    {
      id: "terrain_sand",
      name: "모래",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "battle-scenery-desert",
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
    {
      id: "terrain_snow",
      name: "눈",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "battle-scenery-snow",
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
    {
      id: "terrain_stone",
      name: "돌",
      damage: 0,
      encounterRatePercent: 50,
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
  ];
}

export function defaultBattleCommandRecords(): DatabaseBattleCommandRecord[] {
  return [
    { id: "cmd_attack", name: "공격", kind: "attack" },
    { id: "cmd_skill", name: "스킬", kind: "skill" },
    { id: "cmd_defend", name: "방어", kind: "defend" },
    { id: "cmd_item", name: "아이템", kind: "item" },
  ];
}

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
  ];
}

export function defaultTerrainRecords(): DatabaseTerrainRecord[] {
  return [
    {
      id: "terrain_grassland",
      name: "초원",
      damage: 0,
      encounterRatePercent: 100,
      // Tag 1 — open grass: dawn sky battle field (distinct from forest fallback).
      battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
    {
      id: "terrain_road",
      name: "숲",
      damage: 0,
      encounterRatePercent: 50,
      battleBackgroundResourceId: "generated-battle-reference-forest",
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
    {
      id: "terrain_water",
      name: "사막",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "easyrpg-backdrop-sunset1",
      characterDisplay: "normal",
      vehiclePassage: { boat: true, ship: true, airshipLand: false },
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

import { isGenrePackId } from "@/project/genrePackId";
import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";

export function validateDatabase(value: unknown): void {
  const database = requireRecord("database", value);
  for (const key of [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ]) {
    requireArray(`database.${key}`, database[key]);
  }
  if (database.elements !== undefined) requireArray("database.elements", database.elements);
  if (database.terrains !== undefined) requireArray("database.terrains", database.terrains);
  if (database.battleCommands !== undefined) requireArray("database.battleCommands", database.battleCommands);
  if (database.monsterSpecies !== undefined) requireArray("database.monsterSpecies", database.monsterSpecies);
  if (database.crops !== undefined) requireArray("database.crops", database.crops);
  // 가드가 없으면 normalizeDatabaseRecords 의 .map 이 TypeError 로 터져 프로젝트 전체가 열리지 않는다
  // (손상·수작업 편집된 JSON 에서 실제로 재현됨). 다른 옵셔널 컬렉션과 동일 계약으로 맞춘다.
  if (database.lifeSkills !== undefined) requireArray("database.lifeSkills", database.lifeSkills);
}

export function validateSystem(value: unknown): void {
  const system = requireRecord("system", value);
  requireArray("system.startActorIds", system.startActorIds);
  if (system.genre !== undefined) {
    requireString("system.genre", system.genre);
    assert(isGenrePackId(system.genre), `system.genre is not a supported genre pack id: ${system.genre}`);
  }
  if (system.titleScreen !== undefined) {
    const titleScreen = requireRecord("system.titleScreen", system.titleScreen);
    // additive optional 배열 — 있으면 배열이기만 하면 된다. 요소 정합은 normalize 가 관대하게 거른다
    // (무효 레이어는 drop). 배열이 아니면 normalize 의 순회가 TypeError 로 터지므로 여기서 가드한다.
    if (titleScreen.backgroundLayers !== undefined) {
      requireArray("system.titleScreen.backgroundLayers", titleScreen.backgroundLayers);
    }
  }
  if (system.monsterCollection !== undefined) requireBoolean("system.monsterCollection", system.monsterCollection);
  if (system.monsterBattleParty !== undefined) requireBoolean("system.monsterBattleParty", system.monsterBattleParty);
  if (system.giftSystem !== undefined) requireBoolean("system.giftSystem", system.giftSystem);
  if (system.timeSystem !== undefined) validateTimeSystem(system.timeSystem);
  if (system.typeChart !== undefined) {
    const chart = requireRecord("system.typeChart", system.typeChart);
    requireArray("system.typeChart.types", chart.types);
    requireRecord("system.typeChart.multipliers", chart.multipliers);
  }
}

function validateTimeSystem(value: unknown): void {
  const timeSystem = requireRecord("system.timeSystem", value);
  requireBoolean("system.timeSystem.enabled", timeSystem.enabled);
  if (timeSystem.minutesPerRealSecond !== undefined) requireNumber("system.timeSystem.minutesPerRealSecond", timeSystem.minutesPerRealSecond);
  if (timeSystem.dayStartHour !== undefined) requireNumber("system.timeSystem.dayStartHour", timeSystem.dayStartHour);
  if (timeSystem.dayEndHour !== undefined) requireNumber("system.timeSystem.dayEndHour", timeSystem.dayEndHour);
  if (timeSystem.daysPerSeason !== undefined) requireNumber("system.timeSystem.daysPerSeason", timeSystem.daysPerSeason);
  if (timeSystem.forceSleep !== undefined) requireBoolean("system.timeSystem.forceSleep", timeSystem.forceSleep);
  if (timeSystem.onDayEnd !== undefined) requireString("system.timeSystem.onDayEnd", timeSystem.onDayEnd);
}

export function validateSession(value: unknown): void {
  const session = requireRecord("session", value);
  requireRecord("session.switches", session.switches);
  requireRecord("session.variables", session.variables);
  requireRecord("session.inventory", session.inventory);
  requireArray("session.partyActorIds", session.partyActorIds);
}

import { requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";

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
  if (database.animals !== undefined) requireArray("database.animals", database.animals);
}

export function validateSystem(value: unknown): void {
  const system = requireRecord("system", value);
  requireArray("system.startActorIds", system.startActorIds);
  if (system.titleScreen !== undefined) requireRecord("system.titleScreen", system.titleScreen);
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

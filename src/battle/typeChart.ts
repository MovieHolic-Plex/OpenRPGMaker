import type { Project } from "@/project/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import { monsterSpeciesById } from "@/project/monsterCollection";

// 배틀러의 타입(속성)을 직접 받아 상성·STAB 배율을 계산한다(recordId 우회 없이).
// 플레이어 몬스터는 recordId=instanceId 라 record 역조회가 실패하므로 이 경로가 필수.
export function typeChartMultiplierForTypes(
  project: Project,
  attackType: string | undefined,
  attackerTypes: readonly string[],
  defenderTypes: readonly string[]
): number {
  const chart = project.system.typeChart;
  if (!chart || !attackType || !chart.types.includes(attackType)) return 1;
  const filteredDefenderTypes = defenderTypes.filter((type) => chart.types.includes(type));
  const row = chart.multipliers[attackType] ?? {};
  const typeProduct = filteredDefenderTypes.reduce((product, defenderType) => {
    const multiplier = row[defenderType];
    return product * (typeof multiplier === "number" && Number.isFinite(multiplier) ? multiplier : 1);
  }, 1);
  const stab = attackerTypes.includes(attackType) ? 1.5 : 1;
  return typeProduct * stab;
}

// 기존 시그니처는 enemy 경로 회귀 0을 위해 얇은 래퍼로 유지한다.
export function typeChartMultiplierFor(
  project: Project,
  attackType: string | undefined,
  attackerRecordId: string,
  defenderRecordId: string
): number {
  return typeChartMultiplierForTypes(
    project,
    attackType,
    monsterTypesForRecord(project, attackerRecordId),
    monsterTypesForRecord(project, defenderRecordId)
  );
}

// 배틀러의 타입 목록. 플레이어 몬스터(speciesId 有)는 종족 types, 그 외는 recordId 역조회
// (enemy.speciesId → types, actor 는 [] 무타입 유지 → 회귀 0).
export function battlerTypes(project: Project, battler: MutableBattler): readonly string[] {
  if (battler.speciesId) return monsterSpeciesById(project, battler.speciesId)?.types ?? [];
  return monsterTypesForRecord(project, battler.recordId);
}

export function monsterTypesForRecord(project: Project, recordId: string): readonly string[] {
  const enemy = project.database.enemies.find((record) => record.id === recordId);
  const speciesId = enemy?.speciesId ?? ((project.database.monsterSpecies ?? []).some((species) => species.id === recordId) ? recordId : undefined);
  if (!speciesId) return [];
  return project.database.monsterSpecies?.find((species) => species.id === speciesId)?.types ?? [];
}

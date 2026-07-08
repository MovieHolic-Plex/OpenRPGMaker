import type { Project } from "@/project/types";

export function typeChartMultiplierFor(
  project: Project,
  attackType: string | undefined,
  attackerRecordId: string,
  defenderRecordId: string
): number {
  const chart = project.system.typeChart;
  if (!chart || !attackType || !chart.types.includes(attackType)) return 1;
  const attackerTypes = monsterTypesForRecord(project, attackerRecordId);
  const defenderTypes = monsterTypesForRecord(project, defenderRecordId).filter((type) => chart.types.includes(type));
  const row = chart.multipliers[attackType] ?? {};
  const typeProduct = defenderTypes.reduce((product, defenderType) => {
    const multiplier = row[defenderType];
    return product * (typeof multiplier === "number" && Number.isFinite(multiplier) ? multiplier : 1);
  }, 1);
  const stab = attackerTypes.includes(attackType) ? 1.5 : 1;
  return typeProduct * stab;
}

export function monsterTypesForRecord(project: Project, recordId: string): readonly string[] {
  const enemy = project.database.enemies.find((record) => record.id === recordId);
  const speciesId = enemy?.speciesId ?? ((project.database.monsterSpecies ?? []).some((species) => species.id === recordId) ? recordId : undefined);
  if (!speciesId) return [];
  return project.database.monsterSpecies?.find((species) => species.id === speciesId)?.types ?? [];
}

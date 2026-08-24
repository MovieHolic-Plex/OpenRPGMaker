import type { Project } from "@/project/types";
import { monsterSpeciesById } from "@/project/monsterCollection";

export interface Gen1TypeModifiers {
  readonly stab: boolean;
  /** Cartridge-style effectiveness factors expressed in tenths (5 = 1/2, 20 = 2x). */
  readonly typeFactors: readonly number[];
}

export type Gen1CanonicalType =
  | "normal" | "fighting" | "flying" | "poison" | "ground" | "rock" | "bug" | "ghost"
  | "fire" | "water" | "grass" | "electric" | "psychic" | "ice" | "dragon";

const GEN1_CANONICAL_TYPES: readonly Gen1CanonicalType[] = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon",
];

const GEN1_LOCALIZED_TYPE_ALIASES: Readonly<Record<string, Gen1CanonicalType>> = {
  노말: "normal",
  격투: "fighting",
  비행: "flying",
  독: "poison",
  땅: "ground",
  바위: "rock",
  벌레: "bug",
  고스트: "ghost",
  불꽃: "fire",
  불: "fire",
  물: "water",
  풀: "grass",
  전기: "electric",
  에스퍼: "psychic",
  얼음: "ice",
  드래곤: "dragon",
};

/** Resolves cartridge type meaning without requiring the authored chart id itself to be English. */
export function gen1CanonicalTypeForId(project: Project, typeId: string | undefined): Gen1CanonicalType | undefined {
  if (!typeId) return undefined;
  const elementName = project.database.elements?.find((element) => element.id === typeId)?.name;
  for (const source of [typeId, elementName]) {
    if (!source) continue;
    const token = source.normalize("NFKC").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const localized = GEN1_LOCALIZED_TYPE_ALIASES[token];
    if (localized) return localized;
    for (const canonical of GEN1_CANONICAL_TYPES) {
      if (token === canonical || token.endsWith(`_${canonical}`)) return canonical;
    }
  }
  return undefined;
}

/** Finds the authored chart id that represents a cartridge type. */
export function gen1ElementIdForCanonical(project: Project, canonical: Gen1CanonicalType): string | undefined {
  return project.system.typeChart?.types.find((typeId) => gen1CanonicalTypeForId(project, typeId) === canonical)
    ?? project.database.elements?.find((element) => gen1CanonicalTypeForId(project, element.id) === canonical)?.id;
}

/**
 * Keeps STAB and each defending type separate so Gen1's floor-after-each-step
 * arithmetic can be applied by the damage helper.
 */
export function gen1TypeModifiersForTypes(
  project: Project,
  attackType: string | undefined,
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
): Gen1TypeModifiers {
  const chart = project.system.typeChart;
  if (!chart || !attackType || !chart.types.includes(attackType)) {
    return { stab: false, typeFactors: [] };
  }
  const row = chart.multipliers[attackType] ?? {};
  const defenderTypeSet = new Set(defenderTypes);
  const knownDefenderTypes = chart.types.filter((type) => defenderTypeSet.has(type));
  return {
    stab: attackerTypes.includes(attackType),
    typeFactors: knownDefenderTypes.map((defenderType) => {
      const multiplier = row[defenderType];
      return typeof multiplier === "number" && Number.isFinite(multiplier)
        ? Math.max(0, Math.round(multiplier * 10))
        : 10;
    }),
  };
}

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
// 구조적 타입으로 받아 runtime(MutableBattler) 과 predict(BattleBattlerSnapshot) 가
// 동일 경로를 탄다 — 예전엔 predict 가 recordId 기반 typeChartMultiplierFor 만 써서
// 플레이어 몬스터(recordId=instanceId)에서 타상성·STAB 이 빠졌다 (B1 수정).
export interface BattlerTypeRef {
  readonly speciesId?: string;
  readonly recordId: string;
}
export function battlerTypes(project: Project, battler: BattlerTypeRef): readonly string[] {
  if (battler.speciesId) return monsterSpeciesById(project, battler.speciesId)?.types ?? [];
  return monsterTypesForRecord(project, battler.recordId);
}

export function monsterTypesForRecord(project: Project, recordId: string): readonly string[] {
  const enemy = project.database.enemies.find((record) => record.id === recordId);
  const speciesId = enemy?.speciesId ?? ((project.database.monsterSpecies ?? []).some((species) => species.id === recordId) ? recordId : undefined);
  if (!speciesId) return [];
  return project.database.monsterSpecies?.find((species) => species.id === speciesId)?.types ?? [];
}

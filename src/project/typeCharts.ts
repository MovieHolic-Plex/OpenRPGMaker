// project/typeCharts.ts
// 몬스터 타입 상성표 프리셋. 기본 몬스터 프로젝트는 1세대(15타입, 옛 표 그대로 — 기존 프로젝트·세이브 불변)이고,
// 3세대 이후 게임은 악·강철(·페어리)이 있는 표를 고른다(set_type_chart {preset}). 표는 시드일 뿐 — 저작자는 그 뒤에도 칸을 고칠 수 있다.
import type { TypeChartRecord } from '@/project/types';

export type TypeChartPreset = 'gen1' | 'gen3' | 'gen6';
export const TYPE_CHART_PRESETS: readonly TypeChartPreset[] = ['gen1', 'gen3', 'gen6'];

const GEN1_TYPES = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon'] as const;
/** 3세대(에메랄드): 15타입 + 악·강철, 고스트→에스퍼 2배(1세대 버그값 수정) */
const GEN3_TYPES = [...GEN1_TYPES, 'dark', 'steel'] as const;
/** 6세대 이후: 3세대 + 페어리, 강철은 고스트·악을 더는 반감하지 않는다 */
const GEN6_TYPES = [...GEN3_TYPES, 'fairy'] as const;

type Row = Readonly<Record<string, number>>;
// 공격 타입 → { 방어 타입: 배율 } (적은 칸만 적고 나머지는 1배). 3세대(에메랄드) 표.
const GEN3_ROWS: Readonly<Record<string, Row>> = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  dragon: { dragon: 2, steel: 0.5 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 },
};

function build(types: readonly string[], rows: Readonly<Record<string, Row>>): TypeChartRecord {
  const multipliers: Record<string, Record<string, number>> = {};
  for (const attacker of types) {
    multipliers[attacker] = {};
    for (const defender of types) multipliers[attacker]![defender] = rows[attacker]?.[defender] ?? 1;
  }
  return { types: [...types], multipliers };
}

/** 6세대 표: 3세대 표에서 강철의 고스트·악 반감을 없애고 페어리 행·열을 더한다. */
function gen6Rows(): Record<string, Row> {
  const rows: Record<string, Record<string, number>> = {};
  for (const [type, row] of Object.entries(GEN3_ROWS)) rows[type] = { ...row };
  delete rows.ghost!.steel;
  delete rows.dark!.steel;
  rows.fire!.fairy = 1;
  rows.fighting!.fairy = 0.5;
  rows.poison!.fairy = 2;
  rows.bug!.fairy = 0.5;
  rows.dragon!.fairy = 0;
  rows.dark!.fairy = 0.5;
  rows.steel!.fairy = 2;
  rows.fairy = { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 };
  return rows;
}

/** 프리셋 표(깊은 복사). gen1 은 기본 프로젝트가 쓰는 옛 표라 여기서 만들지 않는다 — null. */
export function typeChartForPreset(preset: TypeChartPreset): TypeChartRecord | null {
  if (preset === 'gen1') return null;
  if (preset === 'gen3') return build(GEN3_TYPES, GEN3_ROWS);
  return build(GEN6_TYPES, gen6Rows());
}

/** 아직 손대지 않은 기본 상성표(불·물·풀 셋)인지 — 몬스터 도구가 18타입 표를 자동 시드해도 되는 경우. */
export function isUntouchedDefaultTypeChart(chart: TypeChartRecord | undefined): boolean {
  if (!chart) return true;
  const ids = [...chart.types].sort().join(',');
  return ids === 'fire,grass,water' && chart.multipliers.fire?.grass === 2 && chart.multipliers.water?.fire === 2 && chart.multipliers.grass?.water === 2;
}

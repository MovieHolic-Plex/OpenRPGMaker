// 몬스터 능력치 심화 규칙(옵트인): 성격(성격 보정 ±10%)과 노력치(EV). 꺼져 있으면(system.monsterStatRules 생략) 이 파일의 값은 쓰이지 않고
// 능력치 공식·저장 바이트는 기존 그대로다. project/monsterCollection.ts 의 monsterBattleStatsForSpecies 가 extras 로 받아 쓴다.
import type { MonsterSpeciesRecord, Project } from "@/project/types";
import type { MonsterInstanceEvs } from "@/project/session";

/** 성격이 올리고 내리는 능력치. 몬스터 능력치 4축 중 HP 를 뺀 공격·방어·특공(mind)·속도. */
export type MonsterNatureStat = "attack" | "defense" | "mind" | "agility";

export interface MonsterNature {
  readonly id: string;
  readonly name: string;
  /** 1.1 배가 되는 능력치. 중립이면 없음. */
  readonly up?: MonsterNatureStat;
  /** 0.9 배가 되는 능력치. 중립이면 없음. */
  readonly down?: MonsterNatureStat;
}

const STAT_LABEL: Readonly<Record<MonsterNatureStat, string>> = { attack: "공격", defense: "방어", mind: "특공", agility: "속도" };

/** 3세대 25종 중 이 게임의 4축에 맞춘 13종(중립 1 + 올림·내림 조합 12). 이름은 원작 이름이 아닌 오리지널 표기다. */
export const MONSTER_NATURES: readonly MonsterNature[] = [
  { id: "steady", name: "차분한" },
  { id: "brave", name: "용감한", up: "attack", down: "agility" },
  { id: "bold", name: "의젓한", up: "defense", down: "attack" },
  { id: "timid", name: "겁많은", up: "agility", down: "attack" },
  { id: "modest", name: "조용한", up: "mind", down: "attack" },
  { id: "lonely", name: "외로운", up: "attack", down: "defense" },
  { id: "hasty", name: "서두는", up: "agility", down: "defense" },
  { id: "mild", name: "온화한", up: "mind", down: "defense" },
  { id: "adamant", name: "고집센", up: "attack", down: "mind" },
  { id: "impish", name: "장난꾸러기", up: "defense", down: "mind" },
  { id: "jolly", name: "명랑한", up: "agility", down: "mind" },
  { id: "relaxed", name: "느긋한", up: "defense", down: "agility" },
  { id: "quiet", name: "무던한", up: "mind", down: "agility" },
];

export function monsterNatureById(id: string | undefined): MonsterNature | undefined {
  return id === undefined ? undefined : MONSTER_NATURES.find((nature) => nature.id === id);
}

/** 「공격↑ 속도↓」 같은 짧은 설명. 중립이면 「보정 없음」. */
export function monsterNatureEffectText(nature: MonsterNature | undefined): string {
  if (!nature?.up || !nature.down) return "능력 보정 없음";
  return `${STAT_LABEL[nature.up]}↑ ${STAT_LABEL[nature.down]}↓`;
}

export interface MonsterStatRules {
  readonly natures: boolean;
  readonly evs: boolean;
}

export function monsterStatRulesOf(project: Pick<Project, "system">): MonsterStatRules {
  const rules = project.system.monsterStatRules;
  return { natures: rules?.natures === true, evs: rules?.evs === true };
}

export const EV_PER_STAT_MAX = 255;
export const EV_TOTAL_MAX = 510;

export const EMPTY_EVS: MonsterInstanceEvs = { hp: 0, atk: 0, def: 0, spd: 0 };

/** 한 종목 255, 합계 510 을 넘지 않게 자르고 정수로 만든다. */
export function clampMonsterEvs(evs: Partial<MonsterInstanceEvs> | undefined): MonsterInstanceEvs {
  const clean = (value: number | undefined): number => Math.max(0, Math.min(EV_PER_STAT_MAX, Math.trunc(Number.isFinite(value) ? value! : 0)));
  const next = { hp: clean(evs?.hp), atk: clean(evs?.atk), def: clean(evs?.def), spd: clean(evs?.spd) };
  let over = next.hp + next.atk + next.def + next.spd - EV_TOTAL_MAX;
  for (const key of ["spd", "def", "atk", "hp"] as const) {
    if (over <= 0) break;
    const cut = Math.min(next[key], over);
    next[key] -= cut;
    over -= cut;
  }
  return next;
}

/** 승리로 얻은 노력치를 더한다(상한 적용). 얻은 것이 없으면 같은 객체를 돌려준다. */
export function addMonsterEvs(current: Partial<MonsterInstanceEvs> | undefined, gain: Partial<MonsterInstanceEvs> | undefined): MonsterInstanceEvs {
  const base = clampMonsterEvs(current);
  if (!gain || (!gain.hp && !gain.atk && !gain.def && !gain.spd)) return base;
  return clampMonsterEvs({ hp: base.hp + (gain.hp ?? 0), atk: base.atk + (gain.atk ?? 0), def: base.def + (gain.def ?? 0), spd: base.spd + (gain.spd ?? 0) });
}

/** 씨앗 문자열로 성격을 정한다(몬스터 인스턴스 id 가 같으면 같은 성격 — IV 와 같은 결정론). */
export function natureIdFromSeed(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return MONSTER_NATURES[(hash >>> 0) % MONSTER_NATURES.length]!.id;
}

/** 쓰러뜨린 적 종들의 evYield 합. 얻을 것이 없으면 undefined(보상 스냅샷에 필드를 두지 않는다). */
export function monsterEvYieldOf(species: readonly (MonsterSpeciesRecord | undefined)[]): Partial<MonsterInstanceEvs> | undefined {
  const total = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const record of species) {
    for (const key of ["hp", "atk", "def", "spd"] as const) total[key] += record?.evYield?.[key] ?? 0;
  }
  if (!total.hp && !total.atk && !total.def && !total.spd) return undefined;
  return { ...(total.hp ? { hp: total.hp } : {}), ...(total.atk ? { atk: total.atk } : {}), ...(total.def ? { def: total.def } : {}), ...(total.spd ? { spd: total.spd } : {}) };
}

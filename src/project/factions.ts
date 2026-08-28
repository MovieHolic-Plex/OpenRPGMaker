// project/factions.ts
// 진영(faction) 레지스트리 정규화 + 태도(stance) 해석. 순수 모듈 — Phaser/DOM/세션을 모른다.
//
// 설계 요약(출시작 4종에서 수렴한 형태):
//  - 태도는 N×N 밀집 행렬(Int8Array)이고 미저작 쌍의 기본값은 0(중립)이다. 예외 쌍만 저작한다.
//  - 대각선(자기 진영)의 기본값은 2(동맹)다. 같은 진영끼리는 유탄도 서로 맞지 않는다.
//  - 방향별로 값이 다르면 **더 적대적인 쪽**을 취한다(Math.min). 한쪽의 낙관이 적대를 숨기지 못한다.
//  - 태도는 "싸워도 되는가" 허가일 뿐이고, 실제 선공은 진영별 aggression 이 결정한다.

import type {
  FactionAggression,
  FactionDef,
  FactionStance,
  ProjectFactions,
} from "@/project/types";

/** 파티(플레이어)가 항상 속하는 예약 진영. */
export const PLAYER_FACTION_ID = "player";
/** factionId 를 저작하지 않은 적이 속하는 예약 진영. */
export const DEFAULT_ENEMY_FACTION_ID = "enemy";
export const DEFAULT_AGGRESSION: FactionAggression = 1;

const STANCE_SELF_DEFAULT: FactionStance = 2;
const STANCE_NEUTRAL: FactionStance = 0;
const STANCE_ENEMY: FactionStance = -1;

const STANCE_BAR_COLOR_HOSTILE = 0xe0564a;
const STANCE_BAR_COLOR_NEUTRAL = 0xe8b53c;
const STANCE_BAR_COLOR_FRIENDLY = 0x54c9a0;

const DEFAULT_FACTION_COLOR = "#c9c2b4";

export interface ResolvedFactionTable {
  readonly ids: readonly string[];
  readonly names: readonly string[];
  readonly colors: readonly string[];
  readonly size: number;
  /** size*size 밀집 행렬. index = a*size + b (a 가 b 를 어떻게 보는가). */
  readonly stances: Int8Array;
  readonly aggression: Int8Array;
  readonly protectedFromNpcs: Uint8Array;
}

function clampStance(value: unknown): FactionStance {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(2, Math.max(-2, n)) as FactionStance;
}

function clampAggression(value: unknown): FactionAggression {
  if (value === undefined || value === null) return DEFAULT_AGGRESSION;
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : DEFAULT_AGGRESSION;
  return Math.min(3, Math.max(0, n)) as FactionAggression;
}

/**
 * 저작 데이터를 스키마에 맞게 다듬는다. 빈 id/중복 id 는 버리고, 알 수 없는 진영을 가리키는 관계도 버린다.
 * 예약 진영(player/enemy)은 defs 에 없어도 항상 유효한 관계 대상이다.
 */
export function normalizeProjectFactions(input: Partial<ProjectFactions> | undefined): ProjectFactions | undefined {
  if (!input || typeof input !== "object") return undefined;
  const defs: FactionDef[] = [];
  const seen = new Set<string>([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID]);
  const declared = new Set<string>([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID]);
  for (const raw of input.defs ?? []) {
    if (!raw || typeof raw.id !== "string" || raw.id.length === 0) continue;
    if (defs.some((entry) => entry.id === raw.id)) continue;
    const def: FactionDef = {
      id: raw.id,
      name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    };
    if (typeof raw.color === "string" && raw.color.length > 0) def.color = raw.color;
    if (raw.aggression !== undefined) def.aggression = clampAggression(raw.aggression);
    if (raw.protectedFromNpcs === true) def.protectedFromNpcs = true;
    defs.push(def);
    seen.add(def.id);
    declared.add(def.id);
  }
  const relations = (input.relations ?? [])
    .filter((raw) => (
      raw != null
      && typeof raw.a === "string" && typeof raw.b === "string"
      && declared.has(raw.a) && declared.has(raw.b)
    ))
    .map((raw) => ({ a: raw.a, b: raw.b, stance: clampStance(raw.stance) }));
  if (defs.length === 0 && relations.length === 0) return undefined;
  return { defs, relations };
}

/**
 * 런타임 조회용 밀집 테이블을 만든다. 예약 진영 두 개가 항상 앞자리를 차지하고,
 * player↔enemy 는 기본 -1(적)이다 — 진영을 저작하지 않은 프로젝트가 지금과 똑같이 굴러가는 근거.
 * 저작된 관계는 이 기본값을 덮어쓸 수 있다.
 */
export function resolveFactionTable(factions: ProjectFactions | undefined): ResolvedFactionTable {
  const ids: string[] = [PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID];
  const names: string[] = ["플레이어", "적"];
  const colors: string[] = ["#7ec8f0", "#e0564a"];
  const aggression: number[] = [DEFAULT_AGGRESSION, DEFAULT_AGGRESSION];
  const protectedFromNpcs: number[] = [0, 0];
  const index = new Map<string, number>([[PLAYER_FACTION_ID, 0], [DEFAULT_ENEMY_FACTION_ID, 1]]);

  for (const def of factions?.defs ?? []) {
    const existing = index.get(def.id);
    const slot = existing ?? ids.length;
    if (existing === undefined) {
      index.set(def.id, slot);
      ids.push(def.id);
      names.push(def.name);
      colors.push(def.color ?? DEFAULT_FACTION_COLOR);
      aggression.push(clampAggression(def.aggression));
      protectedFromNpcs.push(def.protectedFromNpcs === true ? 1 : 0);
      continue;
    }
    // 예약 진영 재정의: 이름/색/성향만 덮어쓴다.
    names[slot] = def.name;
    if (def.color !== undefined) colors[slot] = def.color;
    aggression[slot] = clampAggression(def.aggression);
    protectedFromNpcs[slot] = def.protectedFromNpcs === true ? 1 : 0;
  }

  const size = ids.length;
  const stances = new Int8Array(size * size).fill(STANCE_NEUTRAL);
  for (let i = 0; i < size; i += 1) stances[i * size + i] = STANCE_SELF_DEFAULT;
  stances[0 * size + 1] = STANCE_ENEMY;
  stances[1 * size + 0] = STANCE_ENEMY;

  for (const relation of factions?.relations ?? []) {
    const a = index.get(relation.a);
    const b = index.get(relation.b);
    if (a === undefined || b === undefined) continue;
    const stance = clampStance(relation.stance);
    stances[a * size + b] = stance;
    stances[b * size + a] = stance;
  }

  return {
    ids,
    names,
    colors,
    size,
    stances,
    aggression: Int8Array.from(aggression),
    protectedFromNpcs: Uint8Array.from(protectedFromNpcs),
  };
}

/**
 * 알 수 없는 진영 id 는 예약 진영 enemy 로 떨어진다.
 * 오타 난 factionId 가 "아무와도 싸우지 않는 동상"이 되는 대신 기존 적처럼 굴러가게 하는 안전한 폴백이다.
 */
function slotFor(table: ResolvedFactionTable, factionId: string | undefined): number {
  if (factionId === undefined) return 1;
  const found = table.ids.indexOf(factionId);
  return found >= 0 ? found : 1;
}

/** 양방향 중 더 적대적인 값을 반환한다. 미저작 쌍은 0(중립), 같은 진영은 2(동맹). */
export function factionStance(
  table: ResolvedFactionTable,
  a: string | undefined,
  b: string | undefined
): FactionStance {
  const ai = slotFor(table, a);
  const bi = slotFor(table, b);
  const forward = table.stances[ai * table.size + bi] ?? STANCE_NEUTRAL;
  const backward = table.stances[bi * table.size + ai] ?? STANCE_NEUTRAL;
  return Math.min(forward, backward) as FactionStance;
}

export function factionAggression(table: ResolvedFactionTable, factionId: string | undefined): FactionAggression {
  return (table.aggression[slotFor(table, factionId)] ?? DEFAULT_AGGRESSION) as FactionAggression;
}

export function isProtectedFromNpcs(table: ResolvedFactionTable, factionId: string | undefined): boolean {
  return table.protectedFromNpcs[slotFor(table, factionId)] === 1;
}

export function factionColor(table: ResolvedFactionTable, factionId: string | undefined): string {
  return table.colors[slotFor(table, factionId)] ?? DEFAULT_FACTION_COLOR;
}

export function factionName(table: ResolvedFactionTable, factionId: string | undefined): string {
  return table.names[slotFor(table, factionId)] ?? DEFAULT_ENEMY_FACTION_ID;
}

/**
 * 태도 + 성향 → 선공 여부. 태도는 허가, 성향이 방아쇠다.
 * 0 비공격: 절대 먼저 때리지 않는다(보복은 별개 규칙).
 * 1 공격적: 적(-1 이하)에게만.
 * 2 매우 공격적: 중립(0)까지 먼저 때린다.
 * 3 광폭: 아군까지 가린다.
 */
export function willAttackOnSight(stance: FactionStance, aggression: FactionAggression): boolean {
  switch (aggression) {
    case 0:
      return false;
    case 1:
      return stance <= -1;
    case 2:
      return stance <= 0;
    default:
      return true;
  }
}

/** 유탄/광역이 맞는 대상인가. 우호(1) 이상은 아군 오사에서 면제된다. */
export function isHittableByFaction(stance: FactionStance): boolean {
  return stance <= 0;
}

/** 플레이어 기준 태도를 HP 바 테두리 색으로 바꾼다. 적대 빨강 / 중립 호박 / 우호 청록. */
export function stanceBarColor(stance: FactionStance): number {
  if (stance <= -1) return STANCE_BAR_COLOR_HOSTILE;
  if (stance === 0) return STANCE_BAR_COLOR_NEUTRAL;
  return STANCE_BAR_COLOR_FRIENDLY;
}

// project/factionsFromWorld.ts
// 세계관 세력을 전투 진영 저작안으로 바꾸는 단방향 브리지. 순수 모듈 — DOM/Phaser/세션을 모른다.
//
// 정체성 규칙: 전투 ID 규약에 맞고 예약어가 아닌 WorldEntity.id는 그대로 쓴다. 그래야 세계관 ID를
// NPC factionId에도 복사해 추적할 수 있다. player/enemy 또는 공백·한글 등이 든 ID는
// `world_<읽을 수 있는 조각>_<안정 해시>`로 바꾼다. 이름은 정체성이 아니다. 같은 이름의 수기 진영은
// 합치지 않고 경고만 내며, 계산된 ID가 수기 진영과 충돌하면 덮어쓰지 않고 해당 세력을 보류한다.
//
// 병합 규칙: 세계관은 빈 칸만 채운다. 스키마에 출처 표식이 없어서 기존 행을 세계관 산출물이라고
// 증명할 수 없으므로, 기존 정의/관계는 수정·삭제하지 않는다. 같은 값은 이미 반영된 것으로 보고,
// 다른 값은 conflict로 남긴다. 이 보수적 규칙 덕분에 반복 적용은 멱등이고 수기 전투 데이터가 보존된다.

import {
  DEFAULT_AGGRESSION,
  DEFAULT_ENEMY_FACTION_ID,
  PLAYER_FACTION_ID,
} from "@/project/factions";
import type {
  FactionDef,
  FactionRelationDef,
  FactionStance,
  ProjectFactions,
} from "@/project/types";
import type { ProjectWorld, WorldEntity, WorldRelation } from "@/project/world/types";

export const WORLD_ENEMY_STANCE: FactionStance = -1;
export const WORLD_ALLY_STANCE: FactionStance = 2;

// enemyOf는 일반적인 '적'이므로 -1이다. -2는 원한·절멸전처럼 별도 강도가 있을 때 수기로 남긴다.
// allyOf는 단순 우호가 아니라 명시적인 '동맹'이므로 2다. 생성 진영의 aggression은 기본값 1로 두어
// 적대 세력에는 선공하되, 관계를 쓰지 않은 중립 세력까지 공격하지 않게 한다.
const MATERIALIZED_AGGRESSION = DEFAULT_AGGRESSION;
const RESERVED_IDS = new Set([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID]);
export const WORLD_COMBAT_FACTION_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

export interface FactionsFromWorldChange<T> {
  readonly before: T;
  readonly after: T;
}

export interface FactionsFromWorldDefConflict {
  readonly existing: FactionDef;
  readonly implied: FactionDef;
  readonly worldEntityId: string;
}

export interface FactionsFromWorldRelationConflict {
  readonly existing: readonly FactionRelationDef[];
  readonly implied: FactionRelationDef;
}

export interface FactionsFromWorldDiff {
  readonly defs: {
    readonly added: readonly FactionDef[];
    readonly changed: readonly FactionsFromWorldChange<FactionDef>[];
    readonly removed: readonly FactionDef[];
    readonly conflicts: readonly FactionsFromWorldDefConflict[];
  };
  readonly relations: {
    readonly added: readonly FactionRelationDef[];
    readonly changed: readonly FactionsFromWorldChange<FactionRelationDef>[];
    readonly removed: readonly FactionRelationDef[];
    readonly conflicts: readonly FactionsFromWorldRelationConflict[];
  };
}

export type WorldFactionMappingStatus = "added" | "existing" | "blocked";

export interface WorldFactionMapping {
  readonly worldEntityId: string;
  readonly worldEntityName: string;
  readonly combatFactionId: string;
  readonly status: WorldFactionMappingStatus;
  readonly remapped: boolean;
}

export type FactionsFromWorldIssueCode =
  | "reserved-id-remapped"
  | "invalid-id-remapped"
  | "name-collision"
  | "id-collision"
  | "mapping-collision"
  | "relation-non-faction"
  | "relation-endpoint-blocked"
  | "relation-conflict";

export interface FactionsFromWorldIssue {
  readonly severity: "warning" | "conflict";
  readonly code: FactionsFromWorldIssueCode;
  readonly message: string;
  readonly worldEntityId?: string;
  readonly relation?: WorldRelation;
}

export interface FactionsFromWorldPlan {
  readonly mapping: readonly WorldFactionMapping[];
  readonly diff: FactionsFromWorldDiff;
  readonly issues: readonly FactionsFromWorldIssue[];
  readonly result: ProjectFactions | undefined;
  readonly hasChanges: boolean;
}

/** WorldEntity.id 하나를 전투 진영 ID로 결정한다. 기존 테이블과 무관해 같은 세계관은 항상 같은 ID가 된다. */
export function combatFactionIdFromWorldEntityId(worldEntityId: string): string {
  if (WORLD_COMBAT_FACTION_ID_PATTERN.test(worldEntityId) && !RESERVED_IDS.has(worldEntityId)) {
    return worldEntityId;
  }
  const readable = worldEntityId
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/gu, "_")
    .replace(/^[_-]+|[_-]+$/gu, "")
    .toLowerCase()
    .slice(0, 40) || "faction";
  return `world_${readable}_${stableHash(worldEntityId)}`;
}

/** 세계관과 현재 전투 테이블을 비교해, 적용 전 검토할 수 있는 비파괴 변경안을 만든다. */
export function planFactionsFromWorld(
  world: ProjectWorld,
  existing: ProjectFactions | undefined,
): FactionsFromWorldPlan {
  const base = cloneFactions(existing);
  const addedDefs: FactionDef[] = [];
  const addedRelations: FactionRelationDef[] = [];
  const defConflicts: FactionsFromWorldDefConflict[] = [];
  const relationConflicts: FactionsFromWorldRelationConflict[] = [];
  const mapping: WorldFactionMapping[] = [];
  const issues: FactionsFromWorldIssue[] = [];
  const combatIdOwner = new Map<string, string>();
  const availableByWorldId = new Map<string, string>();
  const existingDefById = new Map(base.defs.map((def) => [def.id, def]));
  const knownNames = new Map<string, { readonly id: string; readonly name: string }>();

  for (const def of base.defs) knownNames.set(normalizeName(def.name), { id: def.id, name: def.name });

  const loreFactions = world.entities.filter((entity) => entity.type === "faction");
  for (const entity of loreFactions) {
    const combatFactionId = combatFactionIdFromWorldEntityId(entity.id);
    const remapped = combatFactionId !== entity.id;
    if (remapped) {
      const reserved = RESERVED_IDS.has(entity.id);
      issues.push({
        severity: "warning",
        code: reserved ? "reserved-id-remapped" : "invalid-id-remapped",
        worldEntityId: entity.id,
        message: reserved
          ? `세계관 세력 '${entity.name}'의 ID '${entity.id}'는 예약 진영이라 '${combatFactionId}'로 바꿉니다.`
          : `세계관 세력 '${entity.name}'의 ID '${entity.id}'는 전투 ID 규약에 맞지 않아 '${combatFactionId}'로 바꿉니다.`,
      });
    }

    const priorOwner = combatIdOwner.get(combatFactionId);
    if (priorOwner && priorOwner !== entity.id) {
      mapping.push(mappingEntry(entity, combatFactionId, "blocked", remapped));
      issues.push({
        severity: "conflict",
        code: "mapping-collision",
        worldEntityId: entity.id,
        message: `세계관 ID '${entity.id}'와 '${priorOwner}'가 같은 전투 ID '${combatFactionId}'로 계산되어 보류합니다.`,
      });
      continue;
    }
    combatIdOwner.set(combatFactionId, entity.id);

    const existingDef = existingDefById.get(combatFactionId);
    if (existingDef && !compatibleExistingDef(existingDef, entity)) {
      defConflicts.push({
        existing: { ...existingDef },
        implied: { id: combatFactionId, name: entity.name, aggression: MATERIALIZED_AGGRESSION },
        worldEntityId: entity.id,
      });
      mapping.push(mappingEntry(entity, combatFactionId, "blocked", remapped));
      issues.push({
        severity: "conflict",
        code: "id-collision",
        worldEntityId: entity.id,
        message:
          `전투 ID '${combatFactionId}'는 수기 진영 '${existingDef.name}'이 이미 사용합니다. ` +
          `세계관 세력 '${entity.name}'은 덮어쓰지 않고 보류합니다.`,
      });
      continue;
    }

    const sameName = knownNames.get(normalizeName(entity.name));
    if (sameName && sameName.id !== combatFactionId) {
      issues.push({
        severity: "warning",
        code: "name-collision",
        worldEntityId: entity.id,
        message:
          `세계관 세력 '${entity.name}'과 같은 이름의 전투 진영 '${sameName.id}'가 있습니다. ` +
          `이름으로 합치지 않고 '${combatFactionId}'를 별도 정체성으로 유지합니다.`,
      });
    }

    if (existingDef) {
      mapping.push(mappingEntry(entity, combatFactionId, "existing", remapped));
    } else {
      const def: FactionDef = {
        id: combatFactionId,
        name: entity.name,
        aggression: MATERIALIZED_AGGRESSION,
      };
      addedDefs.push(def);
      existingDefById.set(combatFactionId, def);
      knownNames.set(normalizeName(entity.name), { id: combatFactionId, name: entity.name });
      mapping.push(mappingEntry(entity, combatFactionId, "added", remapped));
    }
    availableByWorldId.set(entity.id, combatFactionId);
  }

  const loreFactionIds = new Set(loreFactions.map((entity) => entity.id));
  const impliedByPair = new Map<string, FactionRelationDef>();
  for (const relation of world.relations) {
    if (relation.kind !== "enemyOf" && relation.kind !== "allyOf") continue;
    if (!loreFactionIds.has(relation.a) || !loreFactionIds.has(relation.b)) {
      issues.push({
        severity: "warning",
        code: "relation-non-faction",
        relation,
        message: `관계 '${relation.a} ↔ ${relation.b}'는 양쪽 모두 세력일 때만 전투 태도로 옮깁니다.`,
      });
      continue;
    }
    const a = availableByWorldId.get(relation.a);
    const b = availableByWorldId.get(relation.b);
    if (!a || !b) {
      issues.push({
        severity: "conflict",
        code: "relation-endpoint-blocked",
        relation,
        message: `관계 '${relation.a} ↔ ${relation.b}'는 보류된 세력을 포함해 전투 태도로 옮기지 않습니다.`,
      });
      continue;
    }
    const stance = relation.kind === "enemyOf" ? WORLD_ENEMY_STANCE : WORLD_ALLY_STANCE;
    const key = pairKey(a, b);
    const prior = impliedByPair.get(key);
    // 같은 쌍에 동맹과 적대가 함께 있으면 낙관이 적대를 숨기지 못하게 더 적대적인 값을 택한다.
    if (!prior || stance < prior.stance) impliedByPair.set(key, { a, b, stance });
  }

  const existingByPair = new Map<string, FactionRelationDef[]>();
  for (const relation of base.relations) {
    const key = pairKey(relation.a, relation.b);
    const entries = existingByPair.get(key) ?? [];
    entries.push(relation);
    existingByPair.set(key, entries);
  }

  for (const [key, implied] of impliedByPair) {
    const authored = existingByPair.get(key) ?? [];
    if (authored.length > 0) {
      const authoredStance = Math.min(...authored.map((relation) => relation.stance)) as FactionStance;
      if (authoredStance !== implied.stance) {
        relationConflicts.push({
          existing: authored.map((relation) => ({ ...relation })),
          implied: { ...implied },
        });
        issues.push({
          severity: "conflict",
          code: "relation-conflict",
          message:
            `전투 관계 '${implied.a} ↔ ${implied.b}'의 수기 태도 ${authoredStance}를 보존합니다. ` +
            `세계관이 뜻하는 ${implied.stance}는 적용하지 않습니다.`,
        });
      }
      continue;
    }
    // 자기 자신과의 동맹은 런타임 기본값 2라 희소 테이블에 쓸 필요가 없다.
    if (implied.a === implied.b && implied.stance === WORLD_ALLY_STANCE) continue;
    addedRelations.push(implied);
  }

  const result = resultFactions(base, addedDefs, addedRelations, existing);
  const diff: FactionsFromWorldDiff = {
    defs: { added: addedDefs, changed: [], removed: [], conflicts: defConflicts },
    relations: { added: addedRelations, changed: [], removed: [], conflicts: relationConflicts },
  };
  return {
    mapping,
    diff,
    issues,
    result,
    hasChanges: addedDefs.length > 0 || addedRelations.length > 0,
  };
}

/** 검토된 plan의 결과를 호출자가 저장할 수 있도록 새 객체로 돌려준다. */
export function applyFactionsFromWorldPlan(plan: FactionsFromWorldPlan): ProjectFactions | undefined {
  return plan.result ? cloneFactions(plan.result) : undefined;
}

function compatibleExistingDef(existing: FactionDef, entity: WorldEntity): boolean {
  return existing.name === entity.name && (existing.aggression ?? DEFAULT_AGGRESSION) === MATERIALIZED_AGGRESSION;
}

function mappingEntry(
  entity: WorldEntity,
  combatFactionId: string,
  status: WorldFactionMappingStatus,
  remapped: boolean,
): WorldFactionMapping {
  return {
    worldEntityId: entity.id,
    worldEntityName: entity.name,
    combatFactionId,
    status,
    remapped,
  };
}

function resultFactions(
  base: ProjectFactions,
  addedDefs: readonly FactionDef[],
  addedRelations: readonly FactionRelationDef[],
  original: ProjectFactions | undefined,
): ProjectFactions | undefined {
  if (addedDefs.length === 0 && addedRelations.length === 0) {
    return original ? cloneFactions(original) : undefined;
  }
  return {
    defs: [...base.defs, ...addedDefs.map((def) => ({ ...def }))],
    relations: [...base.relations, ...addedRelations.map((relation) => ({ ...relation }))],
    ...(base.playerKillReputation ? { playerKillReputation: { ...base.playerKillReputation } } : {}),
  };
}

function cloneFactions(factions: ProjectFactions | undefined): ProjectFactions {
  return {
    defs: (factions?.defs ?? []).map((def) => ({ ...def })),
    relations: (factions?.relations ?? []).map((relation) => ({ ...relation })),
    ...(factions?.playerKillReputation
      ? { playerKillReputation: { ...factions.playerKillReputation } }
      : {}),
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function pairKey(a: string, b: string): string {
  return a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

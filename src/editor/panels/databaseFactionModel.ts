// 진영 편집기의 순수 변경 모델.
//
// UI가 관계 기본값이나 양방향 판정을 따로 흉내 내면 전투 규칙과 곧 어긋난다. 기본값과
// 유효 태도는 project/factions.ts 에 맡기고, 이 모듈은 희소 저작·ID 참조 정리만 담당한다.

import { visitProjectCommands, type ProjectCommandLocation } from "@/editor/tools/commandTraversal";
import {
  DEFAULT_ENEMY_FACTION_ID,
  PLAYER_FACTION_ID,
  factionStance,
  resolveFactionTable,
  type ResolvedFactionTable,
} from "@/project/factions";
import type {
  FactionAggression,
  FactionDef,
  FactionStance,
  Project,
  ProjectFactions,
} from "@/project/types";

const RESERVED_FACTION_IDS = new Set([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID]);

export type FactionMutationResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly reason: string };

export type FactionMatrixCell = {
  readonly stance: FactionStance;
  readonly authored: boolean;
};

export function isReservedFactionId(id: string): boolean {
  return RESERVED_FACTION_IDS.has(id);
}

/** 저작 행렬은 세션 오버레이를 받지 않고 프로젝트에 저장된 태도만 보여 준다. */
export function authoredFactionStance(
  table: ResolvedFactionTable,
  a: string,
  b: string,
): FactionStance {
  return factionStance(table, a, b);
}

export function factionMatrixCell(
  table: ResolvedFactionTable,
  factions: ProjectFactions | undefined,
  a: string,
  b: string,
): FactionMatrixCell {
  return {
    stance: authoredFactionStance(table, a, b),
    authored: (factions?.relations ?? []).some((relation) => samePair(relation.a, relation.b, a, b)),
  };
}

/** 관계가 없을 때의 값도 런타임 테이블에서 구한다. player↔enemy 기본 적대도 여기 포함된다. */
export function defaultFactionStance(
  factions: ProjectFactions | undefined,
  a: string,
  b: string,
): FactionStance {
  const table = resolveFactionTable({ defs: cloneDefs(factions?.defs), relations: [] });
  return authoredFactionStance(table, a, b);
}

/**
 * 한 셀을 고치면 순서가 뒤집힌 중복 관계까지 걷어내고 한 쌍으로 합친다. 기본값과 같으면
 * 아무 항목도 쓰지 않아, N² 화면이 프로젝트 JSON을 N² 데이터로 부풀리지 않는다.
 */
export function setSparseFactionStance(
  factions: ProjectFactions | undefined,
  a: string,
  b: string,
  stance: FactionStance,
): ProjectFactions | undefined {
  const defs = cloneDefs(factions?.defs);
  const relations = (factions?.relations ?? [])
    .filter((relation) => !samePair(relation.a, relation.b, a, b))
    .map((relation) => ({ ...relation }));
  if (stance !== defaultFactionStance({ defs, relations }, a, b)) relations.push({ a, b, stance });
  return compactFactions(withFactionOptions(factions, defs, relations));
}

export function upsertFactionDef(
  factions: ProjectFactions | undefined,
  id: string,
  fallbackName: string,
  patch: Partial<Omit<FactionDef, "id">>,
): ProjectFactions | undefined {
  const defs = cloneDefs(factions?.defs);
  const index = defs.findIndex((def) => def.id === id);
  const current = index >= 0 ? defs[index]! : { id, name: fallbackName };
  const next: FactionDef = { ...current, ...patch, id };
  if (!next.name.trim()) next.name = id;
  if (next.color === undefined || next.color.trim() === "") delete next.color;
  if (next.protectedFromNpcs !== true) delete next.protectedFromNpcs;
  if (index >= 0) defs[index] = next;
  else defs.push(next);
  return compactFactions(withFactionOptions(factions, defs, cloneRelations(factions?.relations)));
}

export function renameFaction(
  project: Project,
  oldId: string,
  requestedId: string,
): FactionMutationResult {
  if (isReservedFactionId(oldId)) return { ok: false, reason: "예약 진영의 ID는 바꿀 수 없습니다." };
  const nextId = requestedId.trim();
  if (!nextId) return { ok: false, reason: "진영 ID를 입력하세요." };
  if (isReservedFactionId(nextId)) return { ok: false, reason: "player와 enemy는 예약된 ID입니다." };
  const factions = project.factions;
  const defs = cloneDefs(factions?.defs);
  const target = defs.find((def) => def.id === oldId);
  if (!target) return { ok: false, reason: "변경할 진영을 찾을 수 없습니다." };
  if (nextId !== oldId && defs.some((def) => def.id === nextId)) {
    return { ok: false, reason: "이미 사용 중인 진영 ID입니다." };
  }
  if (nextId === oldId) return { ok: true, project };

  target.id = nextId;
  const relations = (factions?.relations ?? []).map((relation) => ({
    ...relation,
    a: relation.a === oldId ? nextId : relation.a,
    b: relation.b === oldId ? nextId : relation.b,
  }));
  const nextProject = structuredClone(withProjectFactions(
    project,
    compactFactions(withFactionOptions(factions, defs, relations)),
  ));
  nextProject.database = {
    ...nextProject.database,
    enemies: nextProject.database.enemies.map((enemy) => (
      enemy.factionId === oldId ? { ...enemy, factionId: nextId } : enemy
    )),
  };
  nextProject.maps = Object.fromEntries(Object.entries(nextProject.maps).map(([mapId, map]) => [
    mapId,
    map.fieldSpawns?.some((spawn) => spawn.factionId === oldId)
      ? {
          ...map,
          fieldSpawns: map.fieldSpawns.map((spawn) => (
            spawn.factionId === oldId ? { ...spawn, factionId: nextId } : spawn
          )),
        }
      : map,
  ]));
  visitProjectCommands(nextProject, ({ command }) => {
    if (command.kind !== "changeFactionStance") return;
    if (command.a === oldId) command.a = nextId;
    if (command.b === oldId) command.b = nextId;
  });
  return { ok: true, project: nextProject };
}

export function deleteFaction(
  project: Project,
  id: string,
): FactionMutationResult {
  if (isReservedFactionId(id)) return { ok: false, reason: "player와 enemy 진영은 삭제할 수 없습니다." };
  const factions = project.factions;
  const defs = cloneDefs(factions?.defs);
  if (!defs.some((def) => def.id === id)) return { ok: false, reason: "삭제할 진영을 찾을 수 없습니다." };
  const references = factionReferenceLabels(project, id);
  if (references.length > 0) {
    return { ok: false, reason: `이 진영을 사용 중이라 삭제할 수 없습니다: ${references.join(", ")}` };
  }
  return {
    ok: true,
    project: withProjectFactions(project, compactFactions(withFactionOptions(
      factions,
      defs.filter((def) => def.id !== id),
      (factions?.relations ?? [])
        .filter((relation) => relation.a !== id && relation.b !== id)
        .map((relation) => ({ ...relation })),
    ))),
  };
}

export function duplicateFaction(
  factions: ProjectFactions | undefined,
  source: FactionDef,
  id: string,
): ProjectFactions {
  const duplicate: FactionDef = { ...source, id, name: `${source.name} 복사본` };
  return withFactionOptions(
    factions,
    [...cloneDefs(factions?.defs), duplicate],
    // 관계까지 복제하면 원본의 동맹과 적을 조용히 물려받는다. 복제는 정체성만 복사한다.
    cloneRelations(factions?.relations),
  );
}

export function setPlayerKillReputation(
  factions: ProjectFactions | undefined,
  enabled: boolean,
  weight = 0.25,
): ProjectFactions | undefined {
  const next = withFactionOptions(factions, cloneDefs(factions?.defs), cloneRelations(factions?.relations));
  if (enabled) next.playerKillReputation = { weight: Math.max(0, weight) };
  else delete next.playerKillReputation;
  return compactFactions(next);
}

export function nextFactionId(factions: ProjectFactions | undefined, prefix = "faction"): string {
  const used = new Set([
    PLAYER_FACTION_ID,
    DEFAULT_ENEMY_FACTION_ID,
    ...(factions?.defs ?? []).map((def) => def.id),
  ]);
  let index = 1;
  while (used.has(`${prefix}_${index}`)) index += 1;
  return `${prefix}_${index}`;
}

function compactFactions(factions: ProjectFactions): ProjectFactions | undefined {
  if (
    factions.defs.length === 0
    && factions.relations.length === 0
    && factions.playerKillReputation === undefined
  ) return undefined;
  return factions;
}

function withFactionOptions(
  source: ProjectFactions | undefined,
  defs: FactionDef[],
  relations: ProjectFactions["relations"],
): ProjectFactions {
  return {
    defs,
    relations,
    ...(source?.playerKillReputation !== undefined
      ? { playerKillReputation: { ...source.playerKillReputation } }
      : {}),
  };
}

function withProjectFactions(project: Project, factions: ProjectFactions | undefined): Project {
  const next = { ...project };
  if (factions) next.factions = factions;
  else delete next.factions;
  return next;
}

function factionReferenceLabels(project: Project, factionId: string): string[] {
  const labels = project.database.enemies
    .filter((enemy) => enemy.factionId === factionId)
    .map((enemy) => `몬스터 '${enemy.name}' (${enemy.id})`);
  for (const map of Object.values(project.maps)) {
    for (const spawn of map.fieldSpawns ?? []) {
      if (spawn.factionId === factionId) labels.push(`맵 '${map.name}'의 필드 스폰 '${spawn.id}'`);
    }
  }
  const commandOwners = new Set<string>();
  visitProjectCommands(project, ({ command, location }) => {
    if (command.kind !== "changeFactionStance" || (command.a !== factionId && command.b !== factionId)) return;
    commandOwners.add(factionCommandOwnerLabel(location));
  });
  labels.push(...commandOwners);
  return labels;
}

function factionCommandOwnerLabel(location: ProjectCommandLocation): string {
  switch (location.kind) {
    case "legacyEvent":
      return `맵 '${location.mapName}'의 이벤트 '${location.eventId}'`;
    case "eventPage":
      return `맵 '${location.mapName}'의 이벤트 '${location.eventId}' 페이지 '${location.pageName || location.pageId}'`;
    case "commonEvent":
      return `커먼 이벤트 '${location.commonEventName}' (${location.commonEventId})`;
    case "troopPage":
      return `적 그룹 '${location.troopName}' (${location.troopId})의 전투 이벤트 페이지 '${location.pageName || location.pageId}'`;
  }
}

function samePair(leftA: string, leftB: string, rightA: string, rightB: string): boolean {
  return (leftA === rightA && leftB === rightB) || (leftA === rightB && leftB === rightA);
}

function cloneDefs(defs: readonly FactionDef[] | undefined): FactionDef[] {
  return (defs ?? []).map((def) => ({ ...def }));
}

function cloneRelations(relations: ProjectFactions["relations"] | undefined): ProjectFactions["relations"] {
  return (relations ?? []).map((relation) => ({ ...relation }));
}

export function aggressionLabel(aggression: FactionAggression): string {
  switch (aggression) {
    case 0: return "비공격";
    case 1: return "적에게만 선공";
    case 2: return "중립에게도 선공";
    case 3: return "광폭";
  }
}

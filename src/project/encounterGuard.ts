// 야생 조우 보호 — 도망 뒤 무적 걸음 · 벌레퇴치류 · 탈출 로프의 «마지막 입구».
// 세션에는 `encounterGuard` 한 필드만 둔다. 값이 없으면 필드째 비워 저장 바이트가 기존과 같다.
import { withJosa } from "@/util/josa";
import type { GameMap, ItemRecord, MapId, Project } from "@/project/types";
import type { PlaySession } from "@/project/session";

export interface EncounterGuardState {
  /** 도망 성공 뒤 남은 «조우 면제» 걸음. */
  graceSteps?: number;
  /** 벌레퇴치 남은 걸음. */
  repelSteps?: number;
  /** 지금 효과를 내는 벌레퇴치 아이템 id(끝날 때 문장에 이름을 쓴다). */
  repelItemId?: string;
  /** true 면 벌레퇴치가 파티 선두보다 레벨이 낮은 야생만 막는다. */
  repelBelowLead?: boolean;
  /** 마지막으로 던전에 들어가기 직전에 서 있던 바깥 칸 — 탈출 로프의 목적지. */
  entrance?: { mapId: MapId; x: number; y: number };
}

/** 도망 성공 뒤 기본 면제 걸음(원작식 «도망치면 잠깐 안 만난다»). 몬스터 파티 게임만 기본 켬 — 다른 장르는 system.escapeGraceSteps 를 적어야 켜진다. */
export const DEFAULT_ESCAPE_GRACE_STEPS = 4;
export const REPEL_STEPS_MAX = 9999;
export const ESCAPE_GRACE_STEPS_MAX = 99;

export function escapeGraceStepsOf(project: Pick<Project, "system">): number {
  const configured = project.system.escapeGraceSteps;
  if (typeof configured === "number" && Number.isFinite(configured)) return Math.max(0, Math.min(ESCAPE_GRACE_STEPS_MAX, Math.trunc(configured)));
  const monsterParty = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
  return monsterParty ? DEFAULT_ESCAPE_GRACE_STEPS : 0;
}

function commit(session: PlaySession, next: EncounterGuardState): void {
  const compact: EncounterGuardState = {};
  if ((next.graceSteps ?? 0) > 0) compact.graceSteps = next.graceSteps;
  if ((next.repelSteps ?? 0) > 0) {
    compact.repelSteps = next.repelSteps;
    if (next.repelItemId) compact.repelItemId = next.repelItemId;
    if (next.repelBelowLead) compact.repelBelowLead = true;
  }
  if (next.entrance) compact.entrance = next.entrance;
  if (Object.keys(compact).length === 0) delete session.encounterGuard;
  else session.encounterGuard = compact;
}

/** 세이브·불러오기용: 알 수 없는 값은 버리고, 비면 undefined(필드째 생략). */
export function parseEncounterGuard(raw: unknown): EncounterGuardState | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const steps = (input: unknown, max: number): number | undefined => (typeof input === "number" && Number.isFinite(input) && input >= 1 ? Math.min(max, Math.trunc(input)) : undefined);
  const entrance = value.entrance as Record<string, unknown> | undefined;
  const graceSteps = steps(value.graceSteps, ESCAPE_GRACE_STEPS_MAX);
  const repelSteps = steps(value.repelSteps, REPEL_STEPS_MAX);
  const next: EncounterGuardState = {
    ...(graceSteps !== undefined ? { graceSteps } : {}),
    ...(repelSteps !== undefined ? { repelSteps } : {}),
    ...(repelSteps !== undefined && typeof value.repelItemId === "string" && value.repelItemId ? { repelItemId: value.repelItemId } : {}),
    ...(repelSteps !== undefined && value.repelBelowLead === true ? { repelBelowLead: true } : {}),
    ...(entrance && typeof entrance.mapId === "string" && Number.isSafeInteger(entrance.x) && Number.isSafeInteger(entrance.y)
      ? { entrance: { mapId: entrance.mapId, x: entrance.x as number, y: entrance.y as number } } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

/** 도망에 성공했다 — 다음 몇 걸음은 야생이 나오지 않는다. */
export function grantEscapeGrace(project: Pick<Project, "system">, session: PlaySession): void {
  const steps = escapeGraceStepsOf(project);
  if (steps <= 0) return;
  commit(session, { ...session.encounterGuard, graceSteps: Math.max(session.encounterGuard?.graceSteps ?? 0, steps) });
}

export function repelStepsLeft(session: Pick<PlaySession, "encounterGuard">): number {
  return Math.max(0, Math.trunc(session.encounterGuard?.repelSteps ?? 0));
}

export function normalizeRepelSteps(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const steps = Math.trunc(value);
  return steps >= 1 ? Math.min(REPEL_STEPS_MAX, steps) : undefined;
}

export type RepelUseResult =
  | { readonly kind: "used"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

/** 벌레퇴치 사용. 이미 효과가 남았으면 겹쳐 쓰지 않는다(원작과 같다). 아이템 소모는 호출자가 한다. */
export function applyRepel(session: PlaySession, item: Pick<ItemRecord, "id" | "name" | "repelSteps" | "repelBelowLead">): RepelUseResult {
  const steps = normalizeRepelSteps(item.repelSteps);
  if (steps === undefined) return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };
  const left = repelStepsLeft(session);
  if (left > 0) return { kind: "unusable", message: `아직 효과가 남아 있습니다 — 남은 ${left}걸음` };
  commit(session, { ...session.encounterGuard, repelSteps: steps, repelItemId: item.id, repelBelowLead: item.repelBelowLead === true });
  return { kind: "used", message: `${withJosa(item.name, "을/를")} 뿌렸다! 앞으로 ${steps}걸음 동안 ${item.repelBelowLead ? "약한 야생 몬스터가" : "야생 몬스터가"} 다가오지 않는다` };
}

export interface EncounterStepGuard {
  /** 이번 걸음은 야생 판정을 건너뛴다(도망 무적·벌레퇴치 전부 막기). */
  readonly suppress: boolean;
  /** 레벨이 낮은 야생만 막는 벌레퇴치가 켜져 있다(뽑은 뒤 판정). */
  readonly repelBelowLead: boolean;
  /** 이번 걸음에 효과가 끝난 벌레퇴치 아이템 id(없으면 안 끝남). 문장은 repelExpiredMessage 로 만든다. */
  readonly expiredItemId?: string;
}

/** 한 걸음이 끝날 때마다 한 번 부른다: 남은 걸음을 줄이고 이번 걸음의 보호 여부를 돌려준다. */
export function tickEncounterGuard(session: PlaySession): EncounterStepGuard {
  const guard = session.encounterGuard;
  if (!guard || ((guard.graceSteps ?? 0) <= 0 && (guard.repelSteps ?? 0) <= 0)) return { suppress: false, repelBelowLead: false };
  const next: EncounterGuardState = { ...guard };
  let suppress = false;
  let expiredItemId: string | undefined;
  if ((next.graceSteps ?? 0) > 0) {
    next.graceSteps = (next.graceSteps ?? 0) - 1;
    suppress = true;
  }
  const belowLead = next.repelBelowLead === true && (next.repelSteps ?? 0) > 0;
  if ((next.repelSteps ?? 0) > 0) {
    next.repelSteps = (next.repelSteps ?? 0) - 1;
    if (!belowLead) suppress = true;
    if (next.repelSteps === 0) {
      expiredItemId = next.repelItemId ?? "";
      delete next.repelBelowLead;
      delete next.repelItemId;
    }
  }
  commit(session, next);
  return { suppress, repelBelowLead: belowLead, ...(expiredItemId !== undefined ? { expiredItemId } : {}) };
}

export function repelExpiredMessage(project: Pick<Project, "database">, itemId: string | undefined): string {
  const name = project.database.items.find((item) => item.id === itemId)?.name ?? "벌레퇴치";
  return `${name}의 효과가 사라졌다`;
}

/** 낮은 레벨의 야생만 막는 벌레퇴치: 뽑힌 야생이 파티 선두(leadLevel)보다 낮으면 true(레벨을 모르면 막지 않는다). */
export function repelBlocksWildLevel(wildLevel: number | undefined, leadLevel: number | undefined): boolean {
  if (wildLevel === undefined || leadLevel === undefined) return false;
  return wildLevel < leadLevel;
}

/** 조우로 뽑힌 야생의 레벨: 조우표가 굴린 레벨이 있으면 그것, 없으면 그 무리 적 레코드의 가장 높은 레벨. */
export function troopWildLevel(project: Pick<Project, "database">, troopId: string, rolled?: number): number | undefined {
  if (rolled !== undefined) return rolled;
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  if (!troop) return undefined;
  const enemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
  const levels = enemyIds.map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.level).filter((level): level is number => typeof level === "number");
  return levels.length > 0 ? Math.max(...levels) : undefined;
}

/** 던전 입구 기록 — 바깥 → 던전으로 넘어갈 때 바깥에서 서 있던 칸을 적고, 던전을 나오면 지운다. */
export function recordDungeonEntrance(
  session: PlaySession,
  from: Pick<GameMap, "id" | "mapRole"> | undefined,
  to: Pick<GameMap, "id" | "mapRole"> | undefined,
  at: { readonly x: number; readonly y: number }
): void {
  if (!to) return;
  const toDungeon = to.mapRole === "dungeon";
  const fromDungeon = from?.mapRole === "dungeon";
  if (toDungeon && !fromDungeon && from && from.id !== to.id) {
    commit(session, { ...session.encounterGuard, entrance: { mapId: from.id, x: at.x, y: at.y } });
  } else if (!toDungeon && session.encounterGuard?.entrance) {
    const { entrance: _dropped, ...rest } = session.encounterGuard;
    commit(session, rest);
  }
}

export type EscapeDestination = { readonly mapId: MapId; readonly x: number; readonly y: number };

export type EscapeRopeResult =
  | { readonly kind: "ok"; readonly destination: EscapeDestination; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

/** 탈출 로프 — 던전(mapRole dungeon)에서만 듣는다. 마지막 입구 → 없으면 시작 지점으로 나간다. */
export function resolveEscapeRope(project: Project, session: PlaySession, item: Pick<ItemRecord, "name" | "escapeTo">): EscapeRopeResult {
  if (item.escapeTo !== "entrance") return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };
  const here = project.maps[session.currentMapId];
  if (here?.mapRole !== "dungeon") return { kind: "unusable", message: `${item.name}의 효과가 없습니다 — 동굴·던전 안에서만 쓸 수 있습니다` };
  const candidates: EscapeDestination[] = [
    ...(session.encounterGuard?.entrance ? [session.encounterGuard.entrance] : []),
    { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  ];
  const destination = candidates.find((candidate) => project.maps[candidate.mapId] !== undefined && candidate.mapId !== session.currentMapId);
  if (!destination) return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };
  return { kind: "ok", destination, message: `${withJosa(item.name, "을/를")} 사용했다! 던전 밖으로 빠져나왔다` };
}

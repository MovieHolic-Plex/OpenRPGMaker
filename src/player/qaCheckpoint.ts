// 런타임 QA 체크포인트 — 타이틀부터 다시 하지 않고 게임의 한 단계에 바로 들어간다.
//
// 체크포인트는 «이름 붙은 상태» 하나다. 정본은 실제 저장(SaveSnapshot)이고, 없으면 새 게임
// 세션 위에 선언한 값만 덮는다. 둘 다 있으면 저장을 불러온 뒤 선언 값을 덮는다.
// 출하 플레이어가 이 모듈을 쓰는 길은 하나뿐이다: 부팅 설정 `qaInstrumentation: true` +
// `qaCheckpoint` (exportEntry.ts). 일반 빌드·호스트 셸은 둘 다 넣지 않는다.
// 프로젝트 데이터는 건드리지 않는다 — 세션만 만든다.
// 문서: openwiki/testing.md 「런타임 QA 체크포인트」.
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { startSession, type PlaySession } from "@/project/session";
import type { Dir, Project } from "@/project/types";
import { applySaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { applyStatePreset } from "@/testing/debugSession";

export type QaCheckpointPartyMember = {
  readonly actorId: string;
  readonly level?: number;
};

export type QaCheckpoint = {
  readonly id: string;
  readonly label?: string;
  /** 실제 저장(그 지점에서 `captureCheckpoint` 로 받은 것). 있으면 이것이 바탕이다. */
  readonly snapshot?: SaveSnapshot;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly facing?: Dir;
  readonly switches?: Record<string, boolean>;
  readonly variables?: Record<string, number>;
  /** eventId → { A: true, … } */
  readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  /** 주어지면 파티를 이 순서로 바꾼다. level 은 그 레벨의 최대 HP/MP 로 가득 채운다. */
  readonly party?: readonly QaCheckpointPartyMember[];
  /** 소지 수량을 그대로 쓴다(0 이하는 지운다). */
  readonly items?: Record<string, number>;
  readonly gold?: number;
  /**
   * 플러그인·장르 상태(호감도 relationships·friendship, 몬스터 파티 등) — 세션 최상위 키에 깊게 합친다.
   * 배열은 통째로 바꾼다.
   */
  readonly sessionPatch?: Record<string, unknown>;
  /** 불러온 직후 이 이벤트를 실행한다(맵 이벤트 id). */
  readonly startEventId?: string;
};

export type QaCheckpointBoot = {
  readonly checkpoint: QaCheckpoint;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    const current = target[key];
    if (isPlainObject(value) && isPlainObject(current)) deepMerge(current, value);
    else target[key] = structuredClone(value);
  }
}

function applyParty(project: Project, session: PlaySession, party: readonly QaCheckpointPartyMember[]): void {
  const known = new Set(project.database.actors.map((actor) => actor.id));
  const missing = party.filter((member) => !known.has(member.actorId)).map((member) => member.actorId);
  if (missing.length > 0) throw new Error(`QA 체크포인트: 없는 배우 ${missing.join(", ")}`);
  session.partyActorIds = party.map((member) => member.actorId);
  for (const member of party) {
    const actor = normalizeActorRecord(project.database.actors.find((entry) => entry.id === member.actorId)!);
    const level = Math.max(1, Math.min(99, Math.floor(member.level ?? session.actorLevels[member.actorId] ?? actor.initialLevel)));
    session.actorLevels[member.actorId] = level;
    const maxHp = parameterValueAtLevel(actor.parameterCurves.maxHp, level);
    const maxMp = parameterValueAtLevel(actor.parameterCurves.maxMp, level);
    session.actorVitals[member.actorId] = { maxHp, maxMp, hp: maxHp, mp: maxMp };
  }
}

/** 체크포인트를 플레이 세션으로 만든다. 프로젝트에 없는 맵·배우는 조용히 넘기지 않고 던진다. */
export function sessionFromQaCheckpoint(project: Project, checkpoint: QaCheckpoint): PlaySession {
  const session = checkpoint.snapshot ? applySaveSnapshot(project, checkpoint.snapshot) : startSession(project);
  const mapId = checkpoint.mapId ?? session.currentMapId;
  if (!project.maps[mapId]) throw new Error(`QA 체크포인트 ${checkpoint.id}: 없는 맵 ${mapId}`);
  applyStatePreset(session, {
    id: `qa-checkpoint:${checkpoint.id}`,
    name: checkpoint.label ?? checkpoint.id,
    switches: checkpoint.switches,
    variables: checkpoint.variables,
    inventory: checkpoint.items,
    gold: checkpoint.gold,
    startMapId: mapId,
    ...(checkpoint.x !== undefined && checkpoint.y !== undefined ? { startPos: { x: checkpoint.x, y: checkpoint.y } } : {}),
  });
  if (checkpoint.facing) session.playerFacing = checkpoint.facing;
  if (checkpoint.selfSwitches) {
    for (const [eventId, flags] of Object.entries(checkpoint.selfSwitches)) {
      session.selfSwitches[eventId] = { ...(session.selfSwitches[eventId] ?? {}), ...flags };
    }
  }
  if (checkpoint.party) applyParty(project, session, checkpoint.party);
  if (checkpoint.sessionPatch) deepMerge(session as unknown as Record<string, unknown>, checkpoint.sessionPatch);
  if (checkpoint.startEventId) {
    const events = project.maps[mapId]?.events ?? [];
    if (!events.some((event) => event.id === checkpoint.startEventId)) {
      throw new Error(`QA 체크포인트 ${checkpoint.id}: 맵 ${mapId} 에 이벤트 ${checkpoint.startEventId} 가 없다`);
    }
  }
  return session;
}

/** 부팅 설정의 qaCheckpoint 를 방어적으로 읽는다. 모양이 틀리면 null(→ 일반 부팅이 아니라 오류). */
export function parseQaCheckpointBoot(value: unknown): QaCheckpoint | null {
  if (!isPlainObject(value)) return null;
  const checkpoint = isPlainObject(value.checkpoint) ? value.checkpoint : value;
  if (typeof checkpoint.id !== "string" || checkpoint.id.length === 0) return null;
  return checkpoint as unknown as QaCheckpoint;
}

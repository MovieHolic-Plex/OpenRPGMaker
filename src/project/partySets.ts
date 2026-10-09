// 여러 파티 — 이름 붙은 파티 묶음(구성원 + 선 자리)을 저장하고 조작을 바꾼다(FF6 식 파티 나누기).
//
// storeParty: 지금 파티를 이름으로 저장한다. recallParty: 지금 파티를 activePartySetId 로 자동 저장한 뒤,
// 불러온 묶음의 구성원으로 바꾸고 그 자리로 옮긴다. 자리 이동은 인터프리터가 transfer 로 돌려준다 —
// 맵이 같아도 플레이어 스프라이트 위치를 바꿀 길은 transfer 뿐이다.
import { syncActorVitals } from "@/project/sessionVitals";
import type { PartySetState, PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const PARTY_SET_LIMIT = 8;
/** 이름 없이 떠난 파티가 저장되는 묶음 이름. */
export const PREVIOUS_PARTY_SET_ID = "__previous";

export function normalizePartySetId(value: string): string {
  return value.trim().slice(0, 32);
}

function snapshotParty(session: Pick<PlaySession, "partyActorIds" | "currentMapId" | "x" | "y">): PartySetState {
  return { actorIds: [...session.partyActorIds], mapId: session.currentMapId, x: session.x, y: session.y };
}

/** 지금 파티를 이름으로 저장한다. 빈 이름·상한 초과(새 이름)는 거절. */
export function storePartySet(session: PlaySession, partySetId: string): boolean {
  const id = normalizePartySetId(partySetId);
  if (!id) return false;
  const sets = session.partySets ?? {};
  if (!(id in sets) && Object.keys(sets).length >= PARTY_SET_LIMIT) return false;
  session.partySets = { ...sets, [id]: snapshotParty(session) };
  session.activePartySetId ??= id;
  return true;
}

export type RecallPartyResult =
  | { readonly ok: true; readonly set: PartySetState; readonly moved: boolean }
  | { readonly ok: false; readonly reason: "missingSet" | "emptySet" };

/**
 * 저장한 파티로 바꾼다. 바꾸기 전 파티는 activePartySetId(없으면 PREVIOUS_PARTY_SET_ID)로 저장한다.
 * 파티 구성원이 바뀌어 없는 배우는 빼고, 남는 배우가 없으면 실패한다. moved = 자리를 옮겨야 하는가.
 */
export function recallPartySet(project: Project, session: PlaySession, partySetId: string): RecallPartyResult {
  const id = normalizePartySetId(partySetId);
  const target = session.partySets?.[id];
  if (!target) return { ok: false, reason: "missingSet" };
  const actorIds = target.actorIds.filter((actorId) => project.database.actors.some((actor) => actor.id === actorId));
  if (actorIds.length === 0) return { ok: false, reason: "emptySet" };
  // 떠나는 파티는 자기 이름(없으면 PREVIOUS_PARTY_SET_ID)으로 남긴다. 같은 묶음을 다시 부르면 덮지 않는다.
  const previousId = session.activePartySetId ?? PREVIOUS_PARTY_SET_ID;
  const sets = { ...(session.partySets ?? {}) };
  if (previousId !== id) sets[previousId] = snapshotParty(session);
  session.partySets = sets;
  session.activePartySetId = id;
  session.partyActorIds = actorIds;
  for (const actorId of actorIds) syncActorVitals(project, session.actorVitals, actorId);
  const moved = target.mapId !== session.currentMapId || target.x !== session.x || target.y !== session.y;
  return { ok: true, set: { ...target, actorIds }, moved };
}

import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

/** 필드 메뉴에서 HP 0 파티원에게 붙이는 상태 이름. 전투의 쓰러짐 배지와 같은 낱말이다. */
export const KNOCKED_OUT_STATE_NAME = "전투불능";

/**
 * 필드 메뉴(파티 개요·아이템 대상·상태)에 보일 파티원 상태 이름.
 * 쓰러짐은 상태 DB 항목이 아니라 HP 0 이라는 사실이라 actorStateIds 에 없다 — 그래서 HP 0 인 미아가
 * 「정상」으로 보였다(J7). HP 가 0 이면 「전투불능」을 맨 앞에 붙인다. 걸린 상태 이름은 그대로 뒤에 둔다.
 */
export function actorFieldStateNames(project: Project, session: PlaySession, actorId: string): string[] {
  const names = (session.actorStateIds?.[actorId] ?? [])
    .map((stateId) => project.database.states.find((state) => state.id === stateId)?.name)
    .filter((name): name is string => Boolean(name));
  const vitals = session.actorVitals[actorId];
  if (vitals && vitals.maxHp > 0 && vitals.hp <= 0 && !names.includes(KNOCKED_OUT_STATE_NAME)) names.unshift(KNOCKED_OUT_STATE_NAME);
  return names;
}

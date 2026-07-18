/**
 * 세션 bag 공유 스토어 — 프로젝트에 얹힌 세션 맵의 저장/조회/존재확인을 한 곳에서 담당한다.
 * 룸 하네스(`roomHarnessSessions`), 마을(`villageSessions`) 등 서로 다른 bag이 각자
 * 저장/조회 로직을 중복 구현하던 것을 흡수한다. bag은 bagKey로만 구분한다.
 */
import type { Project } from "@/project/types";

type Bag<S> = Record<string, S>;

function holderOf<S>(project: Project): Record<string, Bag<S> | undefined> {
  return project as unknown as Record<string, Bag<S> | undefined>;
}

/** 세션을 bagKey 아래 id로 저장한다(불변 갱신). */
export function saveSession<S extends { id: string }>(project: Project, bagKey: string, session: S): void {
  const holder = holderOf<S>(project);
  holder[bagKey] = { ...(holder[bagKey] ?? {}), [session.id]: session };
}

/** bagKey 아래 id 세션을 조회한다(없으면 undefined). */
export function loadSession<S>(project: Project, bagKey: string, id: string): S | undefined {
  return holderOf<S>(project)[bagKey]?.[id];
}

/** bagKey 아래 id 세션 존재 여부. */
export function sessionExists(project: Project, bagKey: string, id: string): boolean {
  return Boolean(holderOf<unknown>(project)[bagKey]?.[id]);
}

// project/eventPageNow.ts
// 편집 도구가 「이 사람이 지금 하는 일」을 고를 때 쓰는 페이지 — 게임을 막 시작한 상태에서 말을 걸면 도는 페이지.
// 왜: 도구가 마지막 페이지에 무조건 붙이면 조건이 아직 안 맞는 페이지(「보스를 잡은 뒤」)에 들어가 말을 걸어도 안 돈다.

import { resolveEventPage } from "./io/pageResolution";
import type { EventPage, GameEvent, Project } from "./types";

/** 시작 상태(시작 스위치·변수·소지품·파티)에서 조건이 맞는 페이지. pages 를 주면 그 가운데서만 고른다. */
export function pageAtStart(project: Project, event: GameEvent, pages: readonly EventPage[] = event.pages ?? [], alsoOn: readonly string[] = []): EventPage | undefined {
  const start = project.session;
  return resolveEventPage({ ...event, pages: [...pages] }, {
    // alsoOn: 시작 상태에 더해 켜진 것으로 볼 스위치 — 「이 단계를 넘긴 뒤의 그 사람」 처럼 조금 뒤의 상태를 물을 때.
    switches: { ...(start?.switches ?? {}), ...Object.fromEntries(alsoOn.map((id) => [id, true])) },
    variables: { ...(start?.variables ?? {}) },
    inventory: { ...(start?.inventory ?? {}) },
    partyActorIds: [...(start?.partyActorIds ?? [])],
    gold: start?.gold ?? 0,
  });
}

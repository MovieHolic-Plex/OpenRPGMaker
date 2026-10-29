// 조사 표식(▼)을 어느 이벤트 위에 띄우나 — 순수 판정. 그리는 쪽은 playSceneFieldStaging.syncExamineMarkers.
//
// 2026-10-29 vm3 판정(terra 탈출·flash 추리):
//  - 이미 다 본 대상(「더는 볼 것이 없다」 쪽 페이지가 켜진 것) 위에도 ▼ 가 남아 다시 가 보게 했다 → 그 페이지면 숨긴다.
//  - 이야기에 필요한 NPC 가 누군지 표시가 없었다 → 그림 있는 대화 이벤트 중 상태를 바꾸는(스위치·아이템·선택지…) 페이지를 가진 사람에게
//    조사 대상과 같은 규칙(가까이 가면)으로 ▼ 를 띄운다. 대사만 있는 행인은 띄우지 않는다.
import type { EventPage, GameEvent } from "@/project/types";

/** 말만 하는 명령 — 이것들로만 된 페이지는 상태를 바꾸지 않는다. 모르는 종류는 상태를 바꾸는 것으로 본다(표식을 덜 숨기는 쪽). */
const TALK_ONLY = new Set(["text", "showText", "message", "changeFace", "wait", "comment", "playSe", "playSound", "balloon", "showBalloon"]);

type CommandLike = { readonly kind?: unknown };
const commandsOf = (page: EventPage | undefined): readonly CommandLike[] => ((page as { commands?: readonly CommandLike[] } | undefined)?.commands ?? []);

/** 이 페이지가 말만 하는가(빈 페이지 포함). */
export function talkOnlyPage(page: EventPage | undefined): boolean {
  return commandsOf(page).every((c) => TALK_ONLY.has(String(c.kind ?? "")));
}

/**
 * 다 본 페이지인가: 조건이 붙은 뒤쪽 페이지가 말만 하고, 그보다 앞 페이지 중 하나가 상태를 바꾼다(줍기·풀기를 끝낸 뒤 「더는 볼 것이 없다」).
 * 조건 없는 첫 페이지(아직 잠긴 「…가 필요하다」)는 다 본 것이 아니다.
 */
export function spentPage(event: GameEvent, page: EventPage | undefined): boolean {
  const pages = event.pages ?? [];
  // 런타임 뷰의 페이지는 그림을 풀어 쓴 얕은 사본이다 — 참조·id·명령 배열 참조 순으로 원본 페이지를 찾는다.
  const id = (page as { id?: string } | undefined)?.id;
  const index = page ? pages.findIndex((p) => p === page || (id !== undefined && (p as { id?: string }).id === id) || (commandsOf(p).length > 0 && commandsOf(p) === commandsOf(page))) : -1;
  if (index <= 0 || !talkOnlyPage(page)) return false;
  if (!((page as { conditions?: readonly unknown[] }).conditions ?? []).length) return false;
  return pages.slice(0, index).some((p) => !talkOnlyPage(p));
}

/** 이야기에 필요한 사람인가: 그림이 있고 조사로 말을 거는 이벤트이며, 어느 페이지든 상태를 바꾼다. */
export function storyPerson(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  const person = pages.some((p) => !!(p.graphic as { sprite?: unknown } | undefined)?.sprite && (typeof p.trigger === "string" ? p.trigger : p.trigger?.kind) === "action");
  return person && pages.some((p) => !talkOnlyPage(p));
}

/** 사람에게 쓰는 기본 반경(조사 반짝임이 없을 때). */
export const STORY_PERSON_RADIUS = 2;

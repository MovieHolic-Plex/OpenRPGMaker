// 이벤트의 표시 이름. 맵 마커·헤더·명령 요약·검색이 같은 규칙을 써야 한 이벤트가 화면마다
// 다른 이름으로 불리지 않는다.
//
// 규칙(2026-09-18 개정):
//  1. `GameEvent.name` — 저작한 이벤트 이름. 편집기 헤더 상자와 place_npc 가 여기에 쓴다.
//  2. 없으면 **이름이 붙은 마지막 페이지**에서 빌린다. `name` 필드가 없던 시절(~2026-09-05)의
//     저작물은 헤더 상자가 1페이지 이름에 썼으므로 그 이름을 잃지 않게 한다.
//     단 자동 이름(`페이지 N`)은 이름으로 치지 않는다 — 2페이지를 자동 이름 그대로 두고 저장한
//     NPC 가 맵 툴팁·목록·인스펙터에서 전부 「페이지 2」로 불렸다(2026-09-17 적대적 리뷰 P0-1).
//  3. 그것도 없으면 ID.
//
// 편집기 유틸(eventMarkerUx)과 명령 요약(commandSummary)이 서로를 import 하는 순환을 피하려고
// 프로젝트 층에 둔다 — 둘 다 여기서 가져간다.
import type { GameEvent } from "@/project/types";

/** `createDefaultEventPage` 가 붙이는 자동 이름. 공백 변형(`페이지  3`)도 같은 것으로 본다. */
const AUTO_PAGE_NAME = /^페이지\s*\d+$/u;

export function isAutoPageName(name: string | undefined): boolean {
  return AUTO_PAGE_NAME.test((name ?? "").trim());
}

/** 저작한 이름이 없을 때 페이지에서 빌려 오는 이름. 없으면 빈 문자열. */
export function eventNameFromPages(event: Pick<GameEvent, "pages">): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name?.trim();
    if (name && !isAutoPageName(name)) return name;
  }
  return "";
}

export function eventDisplayName(event: Pick<GameEvent, "id" | "name" | "pages">): string {
  const own = event.name?.trim();
  if (own) return own;
  return eventNameFromPages(event) || event.id;
}

/** 저작한 이름이 있는지 — 없으면 헤더가 「어디서 빌려 온 이름인지」를 말해 준다. */
export function hasAuthoredEventName(event: Pick<GameEvent, "name">): boolean {
  return Boolean(event.name?.trim());
}

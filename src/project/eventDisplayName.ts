// 이벤트의 표시 이름. `GameEvent` 에는 name 필드가 없어(types/events.ts) 이름이 붙은
// **마지막** 페이지에서 뽑고, 하나도 없으면 ID 를 그대로 쓴다. 맵 마커·헤더·명령 요약이
// 같은 규칙을 써야 한 이벤트가 화면마다 다른 이름으로 불리지 않는다.
//
// 편집기 유틸(eventMarkerUx)과 명령 요약(commandSummary)이 서로를 import 하는 순환을 피하려고
// 프로젝트 층에 둔다 — 둘 다 여기서 가져간다.
import type { GameEvent } from "@/project/types";

export function eventDisplayName(event: Pick<GameEvent, "id" | "pages">): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name?.trim();
    if (name) return name;
  }
  return event.id;
}

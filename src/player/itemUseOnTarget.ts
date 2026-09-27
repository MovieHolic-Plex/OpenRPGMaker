// «바라보는 대상에 사용» — 메뉴에서 아이템을 골라 주인공이 바라보는 이벤트에 쓴다.
//
// 페이지 조건 itemUsed(itemId) 는 session.itemUsedId 가 그 아이템일 때만 참이다. 판정 동안만 itemUsedId 를
// 심고, 이벤트 페이지가 **itemUsed 조건을 가진 페이지로 바뀔 때만** 그 페이지를 실행한다 — 평소 조사 페이지가
// 떠 있는 채로 아이템을 쓰면 대사가 나오는 오작동을 막는다. 아이템 소모는 페이지가 changeItem 으로 정한다
// (열쇠처럼 남기는 아이템과 먹이처럼 사라지는 아이템을 저자가 고른다).
import { resolveEventPage } from "@/project/io";
import { findRuntimeEventAtInMap, type RuntimeEventPositions } from "@/project/runtimeEventState";
import type { PlaySession } from "@/project/session";
import type { Condition, Dir, EventPage, GameEvent, GameMap, Project } from "@/project/types";

export type FacedItemTarget = {
  readonly event: GameEvent;
  readonly page: EventPage;
};

const DIR_DELTA: Record<Dir, { readonly x: number; readonly y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function conditionMentionsItemUsed(condition: Condition, itemId: string): boolean {
  switch (condition.kind) {
    case "itemUsed":
      return condition.itemId === itemId;
    case "all":
    case "any":
      return condition.conditions.some((child) => conditionMentionsItemUsed(child, itemId));
    case "not":
      return false;
    default:
      return false;
  }
}

/** 이 페이지가 «이 아이템을 쓰면 실행되는» 페이지인가. */
export function pageAcceptsItem(page: EventPage | undefined, itemId: string): page is EventPage {
  return Boolean(page && page.conditions.some((condition) => conditionMentionsItemUsed(condition, itemId)));
}

/**
 * 정면 칸(없으면 발밑)의 이벤트가 이 아이템을 받는가. 받으면 실행할 페이지를 돌려주고, 아니면 undefined.
 * session.itemUsedId 는 호출 전후로 같다(판정용으로만 잠깐 심는다).
 */
export function findFacedItemTarget(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySession,
  positions: RuntimeEventPositions,
  player: { readonly x: number; readonly y: number; readonly facing: Dir },
  itemId: string,
): FacedItemTarget | undefined {
  const delta = DIR_DELTA[player.facing];
  const previous = session.itemUsedId;
  session.itemUsedId = itemId;
  try {
    const tiles = [
      { x: player.x + delta.x, y: player.y + delta.y },
      { x: player.x, y: player.y },
    ];
    for (const tile of tiles) {
      // 트리거 종류는 따지지 않는다 — 조사 이벤트든 접촉 이벤트든 «아이템을 쓰면» 발동한다.
      const view = findRuntimeEventAtInMap(project, map, session, positions, tile.x, tile.y, ["action", "touch", "playerTouch", "eventTouch"]);
      if (!view) continue;
      const page = resolveEventPage(view.event, session, { locations: map.locations });
      if (pageAcceptsItem(page, itemId)) return { event: view.event, page };
    }
    return undefined;
  } finally {
    if (previous === undefined) delete session.itemUsedId;
    else session.itemUsedId = previous;
  }
}

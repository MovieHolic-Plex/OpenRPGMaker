// 이벤트를 **몸 사각**으로 찾는 공용 질의. 2차 스펙 §5.
//
// 편집기·도구 경로는 오랫동안 `event.x === x && event.y === y` 로 이벤트를 찾았다. 1x1 만
// 있던 시절에는 맞았지만, 2x2 이벤트의 비앵커 칸을 클릭하면 "여긴 빈 칸" 으로 판정되어
// **선택이 아니라 새 이벤트가 생겼다**. 발자국 저작이 열리는 순간 즉시 노출되는 결함이다.
//
// 통행 사각이 아니라 몸 사각인 이유: 머리를 클릭해도 선택돼야 한다. 통행이 열린 상체는
// 지나갈 수 있을 뿐이고, 조사·클릭·선택은 몸 전체가 받는다(사용자 결정).

import {
  footprintBounds,
  normalizeCharacterFootprint,
  normalizePassRows,
  passageBounds,
  pointRect,
  rectsOverlap,
} from "@/project/footprint";
import type { FootprintRect, GameEvent, GameMap } from "@/project/types";

/**
 * 이벤트의 몸 사각. 발자국은 **첫 페이지**에서 읽는다.
 *
 * 페이지마다 발자국이 다를 수 있는데 첫 페이지를 쓰는 이유: 편집 맵 마커도 조건 평가 없이
 * 첫 페이지(선택 시엔 선택 페이지)를 그린다. 클릭 판정이 그려진 것과 어긋나면 "보이는데
 * 안 잡히는" 칸이 생긴다. 선택 중인 이벤트의 선택 페이지가 첫 페이지와 다를 때만 사각이
 * 갈라지는데, 그 경우는 이미 선택된 상태라 클릭-선택이 걸려 있지 않다.
 */
export function eventBodyRect(event: GameEvent): FootprintRect {
  return footprintBounds(event.x, event.y, normalizeCharacterFootprint(event.pages?.[0]?.footprint));
}

/**
 * 이벤트의 통행 사각 — 몸 사각의 하단 `passRows` 행. 발자국과 마찬가지로 **첫 페이지**에서 읽는다.
 *
 * 런타임(`runtimeEventView`)은 조건을 평가해 활성 페이지의 사각을 쓰지만, 저작 시점 검사는
 * 조건을 평가할 수 없다(스위치 상태가 없다). 첫 페이지는 편집 맵이 그리는 것과 같은 페이지라,
 * 경고 좌표가 작성자가 화면에서 보는 사각과 일치한다.
 */
export function eventPassageRect(event: GameEvent): FootprintRect {
  const page = event.pages?.[0];
  const footprint = normalizeCharacterFootprint(page?.footprint);
  return passageBounds(event.x, event.y, footprint, normalizePassRows(page?.passRows, footprint.height));
}

/** 이 칸이 이벤트의 몸 사각 안인가. 1x1 이면 앵커 점 비교와 같다. */
export function eventCoversPoint(event: GameEvent, x: number, y: number): boolean {
  return rectsOverlap(eventBodyRect(event), pointRect(x, y));
}

/**
 * 이 칸을 덮는 첫 이벤트. 배열 순서가 우선순위다 — 2차에서 바꾸지 않고 명문화만 한다(D5).
 * 겹친 이벤트의 규칙을 지금 바꾸면 기존 프로젝트의 동작이 조용히 달라진다.
 */
export function findEventCoveringPoint(
  events: readonly GameEvent[],
  x: number,
  y: number
): GameEvent | undefined {
  return events.find((event) => eventCoversPoint(event, x, y));
}

/** 맵의 정적 이벤트 목록에 대한 얇은 래퍼. 초안(draft)을 보려면 목록을 직접 넘겨라. */
export function eventAtPoint(map: GameMap, x: number, y: number): GameEvent | undefined {
  return findEventCoveringPoint(map.events, x, y);
}

/** 몸 사각이 겹치는 이벤트 쌍 — 겹침 경고·lint 가 같은 판정식을 쓴다. */
export function overlappingEventPairs(
  events: readonly GameEvent[]
): { readonly a: GameEvent; readonly b: GameEvent }[] {
  const rects = events.map((event) => ({ event, rect: eventBodyRect(event) }));
  const pairs: { readonly a: GameEvent; readonly b: GameEvent }[] = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const left = rects[i];
      const right = rects[j];
      if (!left || !right) continue;
      if (rectsOverlap(left.rect, right.rect)) pairs.push({ a: left.event, b: right.event });
    }
  }
  return pairs;
}

// 페이지 조건 CRUD — 전부 **배열 인덱스** 기준이다.
//
// 예전에는 «kind 기준 n번째»(`switchConditionAt(page, slot)`, `withoutNthCondition`)로 조건을
// 짚었다. 12행 UI 가 슬롯 개념을 갖고 있었기 때문인데, 두 함수가 세는 방식이 어긋나면 엉뚱한
// 조건을 지웠고(스위치 3개 이상일 때), 켬/끔 토글은 배열에서 원소를 빼고 다시 밀어넣어 순서를
// 흔들었다. 지금 UI 는 «조건 하나 = 행 하나 = 배열 원소 하나» 이므로 인덱스로 충분하다.
import { updateEventPage } from "@/editor/eventPages";
import type { EventPage, EventPageCondition, MapId } from "@/project/types";

export type PageConditionContext = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  /** 이 이벤트에 NPC 관계(`characterId`)가 연결되어 있는가. 호감도 조건의 UI 게이트에 쓴다. */
  readonly hostHasCharacterId?: boolean;
};

export type PageConditionEntry = {
  readonly index: number;
  readonly condition: EventPageCondition;
};

/**
 * 페이지의 조건 전부를 배열 순서대로, 인덱스를 붙여 돌려준다.
 *
 * 예전 `advancedConditionEntries` 는 12행이 «소비하지 않은» 초과분만 돌려줬다. 그래서 종류마다
 * 편집 위치가 갈렸고, 소지금·전투 결과·탐험은 12행에 자리가 없어 늘 고급 목록으로 빠졌다.
 */
export function pageConditionEntries(page: EventPage): PageConditionEntry[] {
  return (page.conditions ?? []).map((condition, index) => ({ index, condition }));
}

export function appendCondition(context: PageConditionContext, condition: EventPageCondition): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: [...context.page.conditions, condition],
  });
}

export function replaceConditionAt(
  context: PageConditionContext,
  index: number,
  condition: EventPageCondition,
): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: context.page.conditions.map((item, itemIndex) => (itemIndex === index ? condition : item)),
  });
}

export function removeConditionAt(context: PageConditionContext, index: number): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: context.page.conditions.filter((_, itemIndex) => itemIndex !== index),
  });
}

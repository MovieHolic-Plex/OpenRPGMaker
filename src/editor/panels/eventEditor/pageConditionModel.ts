import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { Condition, EventPage, EventPageCondition, MapId } from "@/project/types";

export type PageConditionContext = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
};

export type SwitchConditionParams = PageConditionContext & {
  readonly slot: 0 | 1;
  readonly testPrefix: string;
};

export type AdvancedConditionEntry = {
  readonly index: number;
  readonly condition: EventPageCondition;
};

export type SimpleConditionKind = "actor" | "item" | "variable" | "timePhase" | "season" | "npcActivity" | "friendshipAtLeast";

export function switchConditionAt(page: EventPage, slot: 0 | 1): Extract<Condition, { kind: "switch" }> | undefined {
  return page.conditions.filter((item): item is Extract<Condition, { kind: "switch" }> => item.kind === "switch")[slot];
}

export function timerCondition(
  context: PageConditionContext,
  timerId: "timer1" | "timer2"
): Extract<EventPageCondition, { kind: "timer" }> | undefined {
  return context.page.conditions.find(
    (item): item is Extract<EventPageCondition, { kind: "timer" }> => item.kind === "timer" && item.timerId === timerId
  );
}

export function selfSwitchConditionAt(
  page: EventPage
): Extract<EventPageCondition, { kind: "selfSwitch" }> | undefined {
  return page.conditions.find(
    (item): item is Extract<EventPageCondition, { kind: "selfSwitch" }> => item.kind === "selfSwitch"
  );
}

export function withoutCondition(
  conditions: readonly EventPageCondition[],
  kind: EventPageCondition["kind"]
): EventPageCondition[] {
  return conditions.filter((condition) => condition.kind !== kind);
}

export function withoutFirstCondition(
  conditions: readonly EventPageCondition[],
  kind: EventPageCondition["kind"]
): EventPageCondition[] {
  let removed = false;
  return conditions.filter((condition) => {
    if (removed || condition.kind !== kind) return true;
    removed = true;
    return false;
  });
}

export function withoutNthCondition(
  conditions: readonly EventPageCondition[],
  kind: EventPageCondition["kind"],
  slot: number
): EventPageCondition[] {
  let seen = 0;
  return conditions.filter((condition) => {
    if (condition.kind !== kind) return true;
    const remove = seen === slot;
    seen += 1;
    return !remove;
  });
}

// 체크박스로 조건을 켤 때 기존 값이 없으면 안전한 기본 조건을 심는다.
// (이전: 기존 조건이 있을 때만 재추가 → '아이템 보유' 체크만 하면 아무 일도 안 일어남)
export function defaultSimpleCondition(kind: SimpleConditionKind): EventPageCondition | null {
  const project = store.getCurrent();
  switch (kind) {
    case "item": {
      const itemId = project.database.items[0]?.id;
      return itemId ? { kind: "item", itemId, present: true } : null;
    }
    case "actor": {
      const actorId = project.database.actors[0]?.id;
      return actorId ? { kind: "actor", actorId, present: true } : null;
    }
    case "variable": {
      const variableId = project.variables[0]?.id ?? "";
      return { kind: "variable", variableId, op: ">=", value: 0 };
    }
    case "timePhase":
      return { kind: "timePhase", phase: "day" };
    case "season":
      return { kind: "season", season: "spring" };
    case "npcActivity":
      return { kind: "npcActivity", activity: "work" };
    case "friendshipAtLeast":
      return { kind: "friendshipAtLeast", value: 100 };
  }
}

export function toggleSwitchCondition(
  context: PageConditionContext & { readonly slot: 0 | 1 },
  enabled: boolean
): void {
  const next = withoutNthCondition(context.page.conditions, "switch", context.slot);
  const condition = switchConditionAt(context.page, context.slot);
  if (enabled) {
    if (condition !== undefined) next.push({ ...condition });
    else {
      // slot마다 다른 기본 스위치를 고른다(둘 다 sw[0]이면 동일 조건 중복).
      const switches = store.getCurrent().switches;
      const switchId = switches[context.slot]?.id ?? switches[0]?.id ?? "";
      if (switchId) next.push({ kind: "switch", switchId, value: true });
    }
  }
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function toggleSimpleCondition(
  context: PageConditionContext,
  kind: SimpleConditionKind,
  enabled: boolean
): void {
  const condition = context.page.conditions.find((item) => item.kind === kind);
  const next = withoutFirstCondition(context.page.conditions, kind);
  if (enabled) {
    if (condition !== undefined) next.push(condition);
    else {
      const seeded = defaultSimpleCondition(kind);
      if (seeded) next.push(seeded);
    }
  }
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function toggleTimerCondition(
  context: PageConditionContext,
  timerId: "timer1" | "timer2",
  enabled: boolean
): void {
  const condition = timerCondition(context, timerId);
  const next = context.page.conditions.filter((item) => item.kind !== "timer" || item.timerId !== timerId);
  if (enabled) {
    if (condition !== undefined) next.push(condition);
    else next.push({ kind: "timer", timerId, seconds: 0 });
  }
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function toggleSelfSwitchCondition(
  context: PageConditionContext,
  enabled: boolean
): void {
  const condition = selfSwitchConditionAt(context.page);
  const next = withoutFirstCondition(context.page.conditions, "selfSwitch");
  if (enabled) {
    if (condition !== undefined) next.push(condition);
    else next.push({ kind: "selfSwitch", key: "A", value: true });
  }
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function advancedConditionEntries(page: EventPage): AdvancedConditionEntry[] {
  const seen = { switch: 0, variable: 0, item: 0, actor: 0, timePhase: 0, season: 0, npcActivity: 0, friendshipAtLeast: 0, selfSwitch: 0, timer1: 0, timer2: 0 };
  const entries: AdvancedConditionEntry[] = [];
  page.conditions.forEach((condition, index) => {
    if (condition.kind === "switch") {
      seen.switch += 1;
      if (seen.switch > 2) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "variable") {
      seen.variable += 1;
      if (seen.variable > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "item") {
      seen.item += 1;
      if (seen.item > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "actor") {
      seen.actor += 1;
      if (seen.actor > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "timePhase") {
      seen.timePhase += 1;
      if (seen.timePhase > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "season") {
      seen.season += 1;
      if (seen.season > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "npcActivity") {
      seen.npcActivity += 1;
      if (seen.npcActivity > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "friendshipAtLeast") {
      seen.friendshipAtLeast += 1;
      if (seen.friendshipAtLeast > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "timer") {
      if (condition.timerId === "timer1") {
        seen.timer1 += 1;
        if (seen.timer1 > 1) entries.push({ index, condition });
        return;
      }
      seen.timer2 += 1;
      if (seen.timer2 > 1) entries.push({ index, condition });
      return;
    }
    if (condition.kind === "selfSwitch") {
      seen.selfSwitch += 1;
      if (seen.selfSwitch > 1) entries.push({ index, condition });
      return;
    }
    // 소지금은 간단 행이 없으므로 전부 고급 목록에 표시 — 누락 시 편집 불가.
    if (condition.kind === "gold") {
      entries.push({ index, condition });
      return;
    }
    // 간단 행이 없는 kind 는 전부 고급 목록에 노출한다 — 누락 시 화면에서 통째로 사라진다.
    // battleResult 는 고급에서 편집 가능, all/any/not 은 읽기 전용 요약 + 삭제.
    if (
      condition.kind === "run" ||
      condition.kind === "battleResult" ||
      condition.kind === "all" ||
      condition.kind === "any" ||
      condition.kind === "not"
    ) {
      entries.push({ index, condition });
    }
  });
  return entries;
}

export function appendCondition(context: PageConditionContext, condition: EventPageCondition): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: [...context.page.conditions, condition],
  });
}

export function replaceConditionAt(context: PageConditionContext, index: number, condition: EventPageCondition): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: context.page.conditions.map((item, itemIndex) => (itemIndex === index ? condition : item)),
  });
}

export function removeConditionAt(context: PageConditionContext, index: number): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: context.page.conditions.filter((_, itemIndex) => itemIndex !== index),
  });
}

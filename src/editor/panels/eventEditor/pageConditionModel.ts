import { updateEventPage } from "@/editor/eventPages";
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

export function toggleSwitchCondition(
  context: PageConditionContext & { readonly slot: 0 | 1 },
  enabled: boolean
): void {
  const next = withoutNthCondition(context.page.conditions, "switch", context.slot);
  const condition = switchConditionAt(context.page, context.slot);
  if (enabled && condition !== undefined) next.push({ ...condition, value: true });
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function toggleSimpleCondition(
  context: PageConditionContext,
  kind: "actor" | "item" | "variable" | "timePhase" | "season",
  enabled: boolean
): void {
  const condition = context.page.conditions.find((item) => item.kind === kind);
  const next = withoutFirstCondition(context.page.conditions, kind);
  if (enabled && condition !== undefined) next.push(condition);
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function toggleTimerCondition(
  context: PageConditionContext,
  timerId: "timer1" | "timer2",
  enabled: boolean
): void {
  const condition = timerCondition(context, timerId);
  const next = context.page.conditions.filter((item) => item.kind !== "timer" || item.timerId !== timerId);
  if (enabled && condition !== undefined) next.push(condition);
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
}

export function advancedConditionEntries(page: EventPage): AdvancedConditionEntry[] {
  const seen = { switch: 0, variable: 0, item: 0, actor: 0, timePhase: 0, season: 0, timer1: 0, timer2: 0 };
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
    if (condition.kind === "timer") {
      if (condition.timerId === "timer1") {
        seen.timer1 += 1;
        if (seen.timer1 > 1) entries.push({ index, condition });
        return;
      }
      seen.timer2 += 1;
      if (seen.timer2 > 1) entries.push({ index, condition });
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

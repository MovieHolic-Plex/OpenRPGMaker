import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { Condition, EventPage, EventPageCondition, MapId } from "@/project/types";

export type PageConditionContext = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  /** 이 이벤트에 NPC 관계(`characterId`)가 연결되어 있는가. 호감도 조건의 UI 게이트에 쓴다. */
  readonly hostHasCharacterId?: boolean;
};

export type SwitchConditionParams = PageConditionContext & {
  readonly slot: 0 | 1;
  readonly testPrefix: string;
};

export { advancedConditionEntries, type AdvancedConditionEntry } from "./pageConditionLayout";

export type SimpleConditionKind = "actor" | "item" | "variable" | "timePhase" | "season" | "npcActivity" | "friendshipAtLeast" | "relationshipAtLeast";

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
    case "relationshipAtLeast":
      return { kind: "relationshipAtLeast", state: "dating" };
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


export function appendCondition(context: PageConditionContext, condition: EventPageCondition): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, {
    conditions: [...context.page.conditions, condition],
  });
}

/**
 * 조건 트리 안의 한 노드를 가리키는 경로.
 *
 * `[2]` = 페이지 조건 3번째, `[2, 0]` = 그 조건(그룹)의 첫 하위 조건.
 * 그룹(all/any/not) 편집기가 생기면서 인덱스 하나로는 위치를 못 집는다.
 */
export type ConditionPath = readonly number[];

export type GroupCondition = Extract<EventPageCondition, { kind: "all" | "any" | "not" }>;

export function isGroupCondition(condition: EventPageCondition): condition is GroupCondition {
  return condition.kind === "all" || condition.kind === "any" || condition.kind === "not";
}

/** not 은 하위가 한 개(`condition`), all/any 는 배열(`conditions`) — 읽는 쪽에서 통일한다. */
export function groupChildren(condition: GroupCondition): readonly EventPageCondition[] {
  return condition.kind === "not" ? [condition.condition] : condition.conditions;
}

function fallbackLeafCondition(): EventPageCondition {
  return { kind: "switch", switchId: store.getCurrent().switches[0]?.id ?? "", value: true };
}

/**
 * 하위 목록을 갈아끼운 같은 종류의 그룹.
 *
 * not 은 하위가 반드시 하나여야 한다 — 비면 스위치 기본 조건을 세운다(비운 not 은
 * 직렬화도 런타임 평가도 못 한다).
 */
export function withGroupChildren(
  group: GroupCondition,
  children: readonly EventPageCondition[]
): GroupCondition {
  if (group.kind === "not") return { kind: "not", condition: children[0] ?? fallbackLeafCondition() };
  return { kind: group.kind, conditions: [...children] };
}

/** 그룹 종류를 바꾸되 하위 조건은 살린다. all↔any 는 그대로, not 은 첫 하위만 유지. */
export function convertGroupKind(group: GroupCondition, kind: GroupCondition["kind"]): GroupCondition {
  const children = groupChildren(group);
  if (kind === "not") return { kind: "not", condition: children[0] ?? fallbackLeafCondition() };
  return { kind, conditions: [...children] };
}

function updateNodeAtPath(
  list: readonly EventPageCondition[],
  path: ConditionPath,
  fn: (node: EventPageCondition) => EventPageCondition | null
): EventPageCondition[] {
  const [head, ...rest] = path;
  if (head === undefined || head < 0 || head >= list.length) return [...list];
  const node = list[head]!;
  if (rest.length === 0) {
    const next = fn(node);
    return next === null
      ? list.filter((_, index) => index !== head)
      : list.map((item, index) => (index === head ? next : item));
  }
  if (!isGroupCondition(node)) return [...list];
  const nextChildren = updateNodeAtPath(groupChildren(node), rest, fn);
  return list.map((item, index) => (index === head ? withGroupChildren(node, nextChildren) : item));
}

function commitConditions(context: PageConditionContext, conditions: EventPageCondition[]): void {
  updateEventPage(context.mapId, context.eventId, context.page.id, { conditions });
}

export function replaceConditionAtPath(
  context: PageConditionContext,
  path: ConditionPath,
  condition: EventPageCondition
): void {
  commitConditions(context, updateNodeAtPath(context.page.conditions, path, () => condition));
}

export function removeConditionAtPath(context: PageConditionContext, path: ConditionPath): void {
  commitConditions(context, updateNodeAtPath(context.page.conditions, path, () => null));
}

/** `path` 가 가리키는 그룹의 하위 목록 끝에 조건을 붙인다. 그룹이 아니면 무시. */
export function appendConditionAtPath(
  context: PageConditionContext,
  path: ConditionPath,
  condition: EventPageCondition
): void {
  commitConditions(
    context,
    updateNodeAtPath(context.page.conditions, path, (node) =>
      isGroupCondition(node) ? withGroupChildren(node, [...groupChildren(node), condition]) : node
    )
  );
}

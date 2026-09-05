import type { EventPage, EventPageCondition } from "@/project/types";
import type { EventDraftFieldLocator } from "@/editor/eventDraftValidator";

export type AdvancedConditionEntry = {
  readonly index: number;
  readonly condition: EventPageCondition;
};

export function advancedConditionEntries(page: Pick<EventPage, "conditions">): AdvancedConditionEntry[] {
  const seen = { switch: 0, variable: 0, item: 0, actor: 0, timePhase: 0, season: 0, npcActivity: 0, friendshipAtLeast: 0, relationshipAtLeast: 0, selfSwitch: 0, timer1: 0, timer2: 0 };
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
    if (condition.kind === "relationshipAtLeast") {
      seen.relationshipAtLeast += 1;
      if (seen.relationshipAtLeast > 1) entries.push({ index, condition });
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


/** The renderer and validator share the simple/advanced partition and its row suffixes. */
export function pageConditionField(
  condition: EventPageCondition,
  advancedSuffix?: string,
  switchSlot = 0,
): EventDraftFieldLocator | undefined {
  if (advancedSuffix !== undefined) {
    const prefix = "event-page-advanced-condition";
    const field = (name: string): EventDraftFieldLocator => ({ testId: `${prefix}-${name}-${advancedSuffix}` });
    switch (condition.kind) {
      case "switch": case "variable": case "item": case "actor": return field(condition.kind);
      case "all": case "any": case "not": return field("group-kind");
      case "gold": return field("gold-amount");
      case "timer": return field("timer-seconds");
      case "timePhase": return field("time-phase");
      case "season": return field("season");
      case "npcActivity": return field("npc-activity");
      case "friendshipAtLeast": return field("friendship-npc-key");
      case "relationshipAtLeast": return field("relationship-npc-key");
      case "run": return { testId: "event-condition-run-flag", scopeTestId: `${prefix}-row-${advancedSuffix}` };
      case "selfSwitch": case "battleResult": return undefined;
    }
  }
  switch (condition.kind) {
    case "switch": return { testId: `event-page-switch${switchSlot === 1 ? "2" : ""}-condition-input` };
    case "variable": case "item": case "actor": return { testId: `event-page-${condition.kind}-condition-input` };
    default: return undefined; // Other simple controls already supply the exact field locator.
  }
}

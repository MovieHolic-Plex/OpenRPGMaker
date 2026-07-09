import { compareVariableValue } from "@/project/conditionEvaluation";
import { timePhaseFor } from "@/project/gameTime";
import { evalCondition, getFriendship, getSwitch, getTimer, getVariable } from "@/project/session";
import { storyFlagForTarget, targetShortLabel } from "@/project/storyFlags";
import type { Condition, GameEvent, Project } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

export type StoryEventSessionSource = "live-play-session" | "editor-default";

export interface StoryConditionTrace {
  readonly index: number;
  readonly kind: Condition["kind"];
  readonly ok: boolean;
  readonly targetId?: string;
  readonly targetLabel?: string;
  readonly flagId?: string;
  readonly actual?: string | number | boolean | null;
  readonly expected?: string | number | boolean;
  readonly op?: string;
  readonly summary: string;
}

export interface StoryEventPageTrace {
  readonly pageNumber: number;
  readonly pageId: string;
  readonly pageName: string;
  readonly conditionsMet: boolean;
  readonly conditions: StoryConditionTrace[];
  readonly falseConditions: string[];
}

export interface StoryEventExplanation {
  readonly mapId: string;
  readonly eventId: string;
  readonly sessionSource: StoryEventSessionSource;
  readonly note?: string;
  readonly activePageNumber: number | null;
  readonly pages: StoryEventPageTrace[];
  readonly summary: string;
}

export function explainEvent(
  project: Project,
  mapId: string,
  eventId: string,
  session: PlaySessionLike,
  sessionSource: StoryEventSessionSource
): StoryEventExplanation {
  const map = project.maps[mapId];
  if (!map) throw new Error(`맵을 찾을 수 없습니다: ${mapId}`);
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) throw new Error(`이벤트를 찾을 수 없습니다: ${eventId}`);
  const pages = (event.pages ?? []).map((page, index): StoryEventPageTrace => {
    const conditions = page.conditions.map((condition, conditionIndex) =>
      traceCondition(project, event, condition, conditionIndex, session)
    );
    const falseConditions = conditions.filter((condition) => !condition.ok).map((condition) => condition.summary);
    return {
      pageNumber: index + 1,
      pageId: page.id,
      pageName: page.name,
      conditionsMet: falseConditions.length === 0,
      conditions,
      falseConditions,
    };
  });
  const active = activePageNumber(pages);
  const note = sessionSource === "editor-default"
    ? "플레이 세션 없음: 스위치 OFF/변수 0 기본값으로 평가"
    : undefined;
  return {
    mapId,
    eventId,
    sessionSource,
    note,
    activePageNumber: active,
    pages,
    summary: summaryFor(sessionSource, active, pages),
  };
}

function activePageNumber(pages: readonly StoryEventPageTrace[]): number | null {
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    if (pages[index]?.conditionsMet) return pages[index].pageNumber;
  }
  return null;
}

function traceCondition(
  project: Project,
  event: GameEvent,
  condition: Condition,
  index: number,
  session: PlaySessionLike
): StoryConditionTrace {
  const ok = evalCondition(session, condition, event.id);
  switch (condition.kind) {
    case "switch": {
      const actual = getSwitch(session, condition.switchId);
      const targetLabel = targetShortLabel(project, "switch", condition.switchId);
      const flag = storyFlagForTarget(project, "switch", condition.switchId);
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.switchId,
        targetLabel,
        flagId: flag?.id,
        actual,
        expected: condition.value,
        summary: `${targetLabel}=${actual ? "on" : "off"} expected ${condition.value ? "on" : "off"}`,
      };
    }
    case "variable": {
      const actual = getVariable(session, condition.variableId);
      const targetLabel = targetShortLabel(project, "variable", condition.variableId);
      const flag = storyFlagForTarget(project, "variable", condition.variableId);
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.variableId,
        targetLabel,
        flagId: flag?.id,
        actual,
        expected: condition.value,
        op: condition.op,
        summary: `${targetLabel}=${actual} ${condition.op} ${condition.value}`,
      };
    }
    case "selfSwitch": {
      const actual = session.selfSwitches?.[event.id]?.[condition.key] ?? false;
      return {
        index,
        kind: condition.kind,
        ok,
        actual,
        expected: condition.value,
        targetLabel: `self:${condition.key}`,
        summary: `self:${condition.key}=${actual ? "on" : "off"} expected ${condition.value ? "on" : "off"}`,
      };
    }
    case "actor": {
      const actual = session.partyActorIds.includes(condition.actorId);
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.actorId,
        actual,
        expected: condition.present,
        summary: `actor:${condition.actorId}=${actual ? "present" : "absent"} expected ${condition.present ? "present" : "absent"}`,
      };
    }
    case "item": {
      const count = session.inventory[condition.itemId] ?? 0;
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.itemId,
        actual: count,
        expected: condition.present,
        summary: `item:${condition.itemId}=${count} expected ${condition.present ? "present" : "absent"}`,
      };
    }
    case "gold": {
      const actual = session.gold;
      return {
        index,
        kind: condition.kind,
        ok: compareVariableValue(actual, condition.op, condition.amount),
        actual,
        expected: condition.amount,
        op: condition.op,
        summary: `gold=${actual} ${condition.op} ${condition.amount}`,
      };
    }
    case "timer": {
      const actual = getTimer(session, condition.timerId);
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.timerId,
        actual,
        expected: condition.seconds,
        op: "<=",
        summary: `timer:${condition.timerId}=${actual} <= ${condition.seconds}`,
      };
    }
    case "timePhase": {
      const actual = timePhaseFor(session.gameTime) ?? null;
      return {
        index,
        kind: condition.kind,
        ok,
        actual,
        expected: condition.phase,
        summary: `timePhase=${actual ?? "none"} expected ${condition.phase}`,
      };
    }
    case "season": {
      const actual = session.gameTime?.season ?? null;
      return {
        index,
        kind: condition.kind,
        ok,
        actual,
        expected: condition.season,
        summary: `season=${actual ?? "none"} expected ${condition.season}`,
      };
    }
    case "npcActivity": {
      const actual = session.npcActivities?.[event.id] ?? null;
      return {
        index,
        kind: condition.kind,
        ok,
        actual,
        expected: condition.activity,
        summary: `npcActivity=${actual ?? "none"} expected ${condition.activity}`,
      };
    }
    case "friendshipAtLeast": {
      const actual = getFriendship(session, condition.npcKey, event.id);
      return {
        index,
        kind: condition.kind,
        ok,
        targetId: condition.npcKey ?? event.id,
        actual,
        expected: condition.value,
        op: ">=",
        summary: `friendship:${condition.npcKey ?? event.id}=${actual} >= ${condition.value}`,
      };
    }
  }
}

function summaryFor(
  sessionSource: StoryEventSessionSource,
  activePageNumberValue: number | null,
  pages: readonly StoryEventPageTrace[]
): string {
  const source = sessionSource === "editor-default" ? "editor-default" : "live-session";
  const firstBlocked = pages.find((page) => page.falseConditions.length > 0);
  const active = activePageNumberValue ?? "없음";
  if (!firstBlocked) return `${source}: 활성 페이지 ${active}`;
  return `${source}: 활성 페이지 ${active}; 페이지 ${firstBlocked.pageNumber} 비활성: ${firstBlocked.falseConditions[0]}`;
}

import { ownsMonsterSpecies } from "@/project/monsterOwnership";
import { compareVariableValue } from "../conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "../gameTime";
import { clampFriendship } from "../session";
import { resolveSocialKey } from "../socialKey";
import { evalRoguelikeRunCondition, type RoguelikeRunState } from "../roguelikeRun";
import { evalRelationshipCondition, type RelationshipState } from "../relationshipState";
import type { EventPage, EventPageCondition, GameEvent, ProjectSession } from "../types";

type EventPageSession = Pick<ProjectSession, "switches" | "variables"> &
  Partial<Pick<ProjectSession, "selfSwitches" | "inventory" | "partyActorIds" | "timers" | "gold" | "monsterInstances" | "monsterParty" | "monsterBox">> & {
    readonly gameTime?: GameTime;
    readonly npcActivities?: Record<string, string>;
    readonly friendship?: Record<string, number>;
    readonly relationships?: Record<string, RelationshipState>;
    readonly battleResult?: "victory" | "defeat" | "escape";
    readonly roguelikeRun?: RoguelikeRunState;
    readonly difficultyId?: string;
    readonly itemUsedId?: string;
    /** 주인공 타일 좌표. `insideLocation` 조건이만 사용한다. */
    readonly x?: number;
    readonly y?: number;
  };

/**
 * 로케이션 기하 해석기. 호출측이 현재 맵의 `locations` 를 넘긴다.
 * 넘기지 않으면 `insideLocation` 페이지 조건은 **거짓**이다(조용한 참 금지).
 */
export type EventPageLocationContext = {
  readonly locations?: readonly { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
};

export function resolveEventPage(
  event: GameEvent,
  session: EventPageSession,
  context?: EventPageLocationContext
): EventPage | undefined {
  if (!event.pages || event.pages.length === 0) return undefined;
  for (let index = event.pages.length - 1; index >= 0; index--) {
    const page = event.pages[index];
    if (page.conditions.every((condition) => evalPageCondition(condition, session, event, context))) {
      return page;
    }
  }
  return undefined;
}

function evalPageCondition(
  condition: EventPageCondition,
  session: EventPageSession,
  event: GameEvent,
  context?: EventPageLocationContext
): boolean {
  switch (condition.kind) {
    case "switch":
      return (session.switches[condition.switchId] ?? false) === condition.value;
    case "variable": {
      const value = session.variables[condition.variableId] ?? 0;
      return compareVariableValue(value, condition.op, condition.value);
    }
    case "selfSwitch": {
      const own = (session.selfSwitches ?? {})[event.id];
      return (own?.[condition.key] ?? false) === condition.value;
    }
    case "monsterSpecies":
      return ownsMonsterSpecies(session, condition.speciesId) === condition.present;
    case "actor":
      return (session.partyActorIds ?? []).includes(condition.actorId) === condition.present;
    case "item":
      return (((session.inventory ?? {})[condition.itemId] ?? 0) > 0) === condition.present;
    case "gold":
      return compareVariableValue(session.gold ?? 0, condition.op, condition.amount);
    case "timer":
      return ((session.timers ?? {})[condition.timerId] ?? 0) <= condition.seconds;
    case "timePhase":
      return conditionMatchesTimePhase(session.gameTime, condition.phase);
    case "season":
      return conditionMatchesSeason(session.gameTime, condition.season);
    case "npcActivity":
      return session.npcActivities?.[event.id] === condition.activity;
    case "insideLocation": {
      const location = context?.locations?.find((entry) => entry.id === condition.locationId);
      if (!location || session.x === undefined || session.y === undefined) return false;
      const inside =
        session.x >= location.x &&
        session.y >= location.y &&
        session.x < location.x + Math.max(0, location.w) &&
        session.y < location.y + Math.max(0, location.h);
      return inside === condition.inside;
    }
    case "friendshipAtLeast": {
      const npcKey = resolveSocialKey(event, condition.npcKey);
      if (!npcKey) return false;
      return clampFriendship(session.friendship?.[npcKey] ?? 0) >= clampFriendship(condition.value);
    }
    case "relationshipAtLeast":
      return evalRelationshipCondition(session, condition, resolveSocialKey(event, condition.npcKey));
    case "battleResult":
      return session.battleResult === condition.result;
    case "run":
      return evalRoguelikeRunCondition(session, condition);
    case "difficulty":
      return session.difficultyId !== undefined && session.difficultyId === condition.difficultyId;
    case "itemUsed":
      return session.itemUsedId !== undefined && session.itemUsedId === condition.itemId;
    case "all":
      return condition.conditions.every((child) => evalPageCondition(child, session, event, context));
    case "any":
      return condition.conditions.some((child) => evalPageCondition(child, session, event, context));
    case "not":
      return !evalPageCondition(condition.condition, session, event, context);
  }
}

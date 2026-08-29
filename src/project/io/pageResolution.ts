import { compareVariableValue } from "../conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "../gameTime";
import { clampFriendship } from "../session";
import { resolveSocialKey } from "../socialKey";
import { evalRoguelikeRunCondition, type RoguelikeRunState } from "../roguelikeRun";
import { evalRelationshipCondition, type RelationshipState } from "../relationshipState";
import type { EventPage, EventPageCondition, GameEvent, ProjectSession } from "../types";

type EventPageSession = Pick<ProjectSession, "switches" | "variables"> &
  Partial<Pick<ProjectSession, "selfSwitches" | "inventory" | "partyActorIds" | "timers" | "gold">> & {
    readonly gameTime?: GameTime;
    readonly npcActivities?: Record<string, string>;
    readonly friendship?: Record<string, number>;
    readonly relationships?: Record<string, RelationshipState>;
    readonly battleResult?: "victory" | "defeat" | "escape";
    readonly roguelikeRun?: RoguelikeRunState;
  };

export function resolveEventPage(
  event: GameEvent,
  session: EventPageSession
): EventPage | undefined {
  if (!event.pages || event.pages.length === 0) return undefined;
  for (let index = event.pages.length - 1; index >= 0; index--) {
    const page = event.pages[index];
    if (page.conditions.every((condition) => evalPageCondition(condition, session, event))) {
      return page;
    }
  }
  return undefined;
}

function evalPageCondition(condition: EventPageCondition, session: EventPageSession, event: GameEvent): boolean {
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
    case "all":
      return condition.conditions.every((child) => evalPageCondition(child, session, event));
    case "any":
      return condition.conditions.some((child) => evalPageCondition(child, session, event));
    case "not":
      return !evalPageCondition(condition.condition, session, event);
  }
}

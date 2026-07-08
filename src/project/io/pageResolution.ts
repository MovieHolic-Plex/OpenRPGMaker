import { compareVariableValue } from "../conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "../gameTime";
import type { EventPage, EventPageCondition, GameEvent, ProjectSession } from "../types";

type EventPageSession = Pick<ProjectSession, "switches" | "variables"> &
  Partial<Pick<ProjectSession, "selfSwitches" | "inventory" | "partyActorIds" | "timers" | "gold">> & {
    readonly gameTime?: GameTime;
    readonly npcActivities?: Record<string, string>;
  };

export function resolveEventPage(
  event: GameEvent,
  session: EventPageSession
): EventPage | undefined {
  if (!event.pages || event.pages.length === 0) return undefined;
  for (let index = event.pages.length - 1; index >= 0; index--) {
    const page = event.pages[index];
    if (page.conditions.every((condition) => evalPageCondition(condition, session, event.id))) {
      return page;
    }
  }
  return undefined;
}

function evalPageCondition(condition: EventPageCondition, session: EventPageSession, eventId: string): boolean {
  switch (condition.kind) {
    case "switch":
      return (session.switches[condition.switchId] ?? false) === condition.value;
    case "variable": {
      const value = session.variables[condition.variableId] ?? 0;
      return compareVariableValue(value, condition.op, condition.value);
    }
    case "selfSwitch": {
      const own = (session.selfSwitches ?? {})[eventId];
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
      return session.npcActivities?.[eventId] === condition.activity;
  }
}

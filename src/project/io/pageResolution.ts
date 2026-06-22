import type { EventPage, EventPageCondition, GameEvent, ProjectSession } from "../types";

type EventPageSession = Pick<ProjectSession, "switches" | "variables"> &
  Partial<Pick<ProjectSession, "inventory" | "partyActorIds">>;

export function resolveEventPage(
  event: GameEvent,
  session: EventPageSession
): EventPage | undefined {
  if (!event.pages || event.pages.length === 0) return undefined;
  for (let index = event.pages.length - 1; index >= 0; index--) {
    const page = event.pages[index];
    if (page.conditions.every((condition) => evalPageCondition(condition, session))) {
      return page;
    }
  }
  return undefined;
}

function evalPageCondition(condition: EventPageCondition, session: EventPageSession): boolean {
  switch (condition.kind) {
    case "switch":
      return (session.switches[condition.switchId] ?? false) === condition.value;
    case "variable": {
      const value = session.variables[condition.variableId] ?? 0;
      switch (condition.op) {
        case ">=":
          return value >= condition.value;
        case "<=":
          return value <= condition.value;
        case "==":
          return value === condition.value;
        case "!=":
          return value !== condition.value;
      }
    }
    case "actor":
      return (session.partyActorIds ?? []).includes(condition.actorId) === condition.present;
    case "item":
      return (((session.inventory ?? {})[condition.itemId] ?? 0) > 0) === condition.present;
  }
}

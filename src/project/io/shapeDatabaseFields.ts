import { requireArray, requireRecord } from "./guards";

export function validateDatabase(value: unknown): void {
  const database = requireRecord("database", value);
  for (const key of [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ]) {
    requireArray(`database.${key}`, database[key]);
  }
}

export function validateSystem(value: unknown): void {
  const system = requireRecord("system", value);
  requireArray("system.startActorIds", system.startActorIds);
}

export function validateSession(value: unknown): void {
  const session = requireRecord("session", value);
  requireRecord("session.switches", session.switches);
  requireRecord("session.variables", session.variables);
  requireRecord("session.inventory", session.inventory);
  requireArray("session.partyActorIds", session.partyActorIds);
}

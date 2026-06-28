import type { Command } from "@/project/types";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type M2NumericOperation = "set" | "add" | "remove";

export type M2BattleCommand =
  | { readonly kind: "changeEnemyHp"; readonly target: string; readonly operation: M2NumericOperation; readonly value: number }
  | { readonly kind: "enemyEncounter"; readonly target: string }
  | { readonly kind: "changeBattleback"; readonly resourceId: string }
  | { readonly kind: "forceEscape" }
  | { readonly kind: "actionTimes"; readonly target: string; readonly amount: number };

export function parseM2BattleCommand(command: M2Command): M2BattleCommand | undefined {
  switch (command.commandId) {
    case "m2-098-change-enemy-hp":
      return {
        kind: "changeEnemyHp",
        target: stringField(command, "target"),
        operation: numericOperation(command),
        value: numberField(command, "value"),
      };
    case "m2-101-enemy-encounter":
      return { kind: "enemyEncounter", target: stringField(command, "target") };
    case "m2-102-change-battleback":
      return { kind: "changeBattleback", resourceId: stringField(command, "resourceId") };
    case "m2-107-force-escape":
      return { kind: "forceEscape" };
    case "m2-108-action-times":
      return {
        kind: "actionTimes",
        target: stringField(command, "target"),
        amount: Math.max(0, numberField(command, "value", 1)),
      };
    default:
      return undefined;
  }
}

function stringField(command: M2Command, key: string): string {
  const value = command.fields[key];
  return typeof value === "string" ? value : "";
}

function numberField(command: M2Command, key: string, fallback = 0): number {
  const value = command.fields[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numericOperation(command: M2Command): M2NumericOperation {
  const value = command.fields.operation;
  if (value === "add" || value === "remove" || value === "set") return value;
  return "set";
}

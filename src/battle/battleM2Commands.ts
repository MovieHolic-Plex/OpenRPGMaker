import type { Command } from "@/project/types";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type M2NumericOperation = "set" | "add" | "remove";
type M2StateOperation = "add" | "remove";

export type M2BattleCommand =
  | { readonly kind: "changeEnemyHp"; readonly target: string; readonly operation: M2NumericOperation; readonly value: number }
  | { readonly kind: "changeEnemyMp"; readonly target: string; readonly operation: M2NumericOperation; readonly value: number }
  | { readonly kind: "changeEnemyState"; readonly target: string; readonly operation: M2StateOperation; readonly stateId: string }
  | { readonly kind: "enemyEncounter"; readonly target: string }
  | { readonly kind: "changeBattleback"; readonly resourceId: string }
  | { readonly kind: "showAnimation"; readonly target: string; readonly animationId: string }
  | { readonly kind: "abortBattle" }
  | { readonly kind: "battleEvents"; readonly target: string }
  | { readonly kind: "forceEscape" }
  | { readonly kind: "actionTimes"; readonly target: string; readonly amount: number }
  | { readonly kind: "callCommonEvent"; readonly commonEventId: string };

export function parseM2BattleCommand(command: M2Command): M2BattleCommand | undefined {
  // Persisted commands can predate shape validation. Reject malformed payloads
  // rather than crashing or interpreting missing numeric fields as a lethal zero.
  if (!command.fields || typeof command.fields !== "object" || Array.isArray(command.fields)) return undefined;
  switch (command.commandId) {
    case "m2-098-change-enemy-hp":
      return {
        kind: "changeEnemyHp",
        target: stringField(command, "target"),
        operation: numericOperation(command),
        value: numberField(command, "value"),
      };
    case "m2-099-change-enemy-mp":
      return {
        kind: "changeEnemyMp",
        target: stringField(command, "target"),
        operation: numericOperation(command),
        value: numberField(command, "value"),
      };
    case "m2-100-change-enemy-state":
      return {
        kind: "changeEnemyState",
        target: stringField(command, "target"),
        operation: stateOperation(command),
        stateId: stringField(command, "value"),
      };
    case "m2-101-enemy-encounter":
      return { kind: "enemyEncounter", target: stringField(command, "target") };
    case "m2-102-change-battleback":
      return { kind: "changeBattleback", resourceId: stringField(command, "resourceId") };
    case "m2-103-show-animation":
      return {
        kind: "showAnimation",
        target: stringField(command, "target"),
        animationId: stringField(command, "animationId"),
      };
    case "m2-104-battle-events":
      return { kind: "battleEvents", target: stringField(command, "target") };
    case "m2-105-abort-battle":
      return { kind: "abortBattle" };
    case "m2-106-call-common-event":
      // value 필드를 commonEventId로 사용(제네릭 Change/Processing 필드 매칭).
      // 빈 값이면 commonEventId 필드를 직접 본다.
      return { kind: "callCommonEvent", commonEventId: stringField(command, "value") || stringField(command, "commonEventId") };
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

function stateOperation(command: M2Command): M2StateOperation {
  const value = command.fields.operation;
  if (value === "remove") return "remove";
  return "add";
}

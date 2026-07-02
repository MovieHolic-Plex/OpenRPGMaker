import type { Condition } from "./types";

type VariableCondition = Extract<Condition, { kind: "variable" }>;

export function compareVariableValue(current: number, op: VariableCondition["op"], expected: number): boolean {
  switch (op) {
    case "==":
      return current === expected;
    case ">=":
      return current >= expected;
    case "<=":
      return current <= expected;
    case ">":
      return current > expected;
    case "<":
      return current < expected;
    case "!=":
      return current !== expected;
  }
}

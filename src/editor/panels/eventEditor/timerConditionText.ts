import { compareVariableValue } from "@/project/conditionEvaluation";
import type { Condition } from "@/project/types";

export type TimerCondition = Extract<Condition, { kind: "timer" }>;

const RELATION: Record<NonNullable<TimerCondition["op"]>, string> = {
  ">=": "이상",
  "<=": "이하",
  ">": "초과",
  "<": "미만",
  "==": "같음",
  "!=": "다름",
};

/** Stored operator, or the runtime default when the field was omitted. */
export function timerComparisonOp(condition: { readonly op?: TimerCondition["op"] } | undefined): NonNullable<TimerCondition["op"]> {
  return condition?.op ?? "<=";
}

export function timerRelationWord(op: TimerCondition["op"] | undefined): string {
  return RELATION[op ?? "<="];
}

/** `30초 이하` — the seconds number plus the comparison the runtime actually uses. */
export function timerThresholdLabel(condition: Pick<TimerCondition, "seconds" | "op">): string {
  return `${condition.seconds}초 ${timerRelationWord(condition.op)}`;
}

/** Keep a stored operator when the minutes/seconds fields rewrite the condition. */
export function timerOpFields(condition: { readonly op?: TimerCondition["op"] } | undefined): { op: NonNullable<TimerCondition["op"]> } | Record<string, never> {
  return condition?.op ? { op: condition.op } : {};
}

/** `<=` is the runtime default, so the field stays omitted and existing events do not change shape. */
export function timerOpFromChoice(value: string): { op: NonNullable<TimerCondition["op"]> } | Record<string, never> {
  switch (value) {
    case ">=":
    case ">":
    case "<":
    case "==":
    case "!=":
      return { op: value };
    default:
      return {};
  }
}

/**
 * An idle timer is read as 0. True when that 0 already satisfies the comparison,
 * so the condition matches before any timer command runs.
 */
export function idleTimerSatisfies(condition: TimerCondition): boolean {
  return compareVariableValue(0, timerComparisonOp(condition), condition.seconds);
}

/** Identity of the timer leaves that decide the idle-timer warning. `not` hides its child. */
export function timerConditionSignature(condition: Condition): string {
  const parts: string[] = [];
  const walk = (entry: Condition, negated: boolean): void => {
    if (entry.kind === "timer") {
      if (!negated) parts.push(`${entry.timerId}:${entry.op ?? "<="}:${entry.seconds}`);
      return;
    }
    if (entry.kind === "all" || entry.kind === "any") entry.conditions.forEach((child) => walk(child, negated));
    else if (entry.kind === "not") walk(entry.condition, !negated);
  };
  walk(condition, false);
  return parts.join("|");
}

export function idleTimerWarningMessage(condition: TimerCondition): string | null {
  if (!idleTimerSatisfies(condition)) return null;
  const name = condition.timerId === "timer2" ? "타이머 2" : "타이머 1";
  return `${name} · ${timerThresholdLabel(condition)} 조건은 타이머가 꺼져 있으면 남은 시간을 0초로 읽어 참이 됩니다. 타이머를 켜기 전에도 이 조건이 맞습니다.`;
}

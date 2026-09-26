import type { Condition, EndingCondition, EndingDef } from "@/project/types";

export function endingConditionKey(conditions: readonly (Condition | EndingCondition)[]): string {
  return conditions.map(normalizeConditionKey).sort().join("|");
}

export function collectEndingWarnings(endings: readonly EndingDef[]): string[] {
  const warnings: string[] = [];
  for (const ending of endings) {
    warnings.push(...conditionConflictWarnings(ending));
  }
  const byConditions = new Map<string, EndingDef[]>();
  for (const ending of endings) {
    const key = endingConditionKey(ending.conditions);
    byConditions.set(key, [...(byConditions.get(key) ?? []), ending]);
  }
  for (const group of byConditions.values()) {
    if (group.length < 2) continue;
    const maxPriority = Math.max(...group.map((ending) => ending.priority));
    const winners = group.filter((ending) => ending.priority === maxPriority);
    if (winners.length > 1) {
      warnings.push(`엔딩 조건 충돌: ${winners.map((ending) => ending.id).join(", ")}가 같은 조건과 priority ${maxPriority}를 공유합니다.`);
    }
    for (const ending of group) {
      if (ending.priority >= maxPriority) continue;
      warnings.push(`엔딩 도달 불능: ${ending.id}는 같은 조건 집합의 priority ${maxPriority} 엔딩에 가려집니다.`);
    }
  }
  return warnings;
}

function conditionConflictWarnings(ending: EndingDef): string[] {
  const warnings: string[] = [];
  const switches = new Map<string, boolean>();
  const variables = new Map<string, VariableBounds>();
  for (const condition of ending.conditions) {
    if (condition.kind === "switch") {
      const previous = switches.get(condition.switchId);
      if (previous !== undefined && previous !== condition.value) {
        warnings.push(`엔딩 조건 충돌: ${ending.id}는 스위치 ${condition.switchId}에 ON/OFF를 동시에 요구합니다.`);
      }
      switches.set(condition.switchId, condition.value);
    }
    if (condition.kind === "variable") {
      const bounds = variables.get(condition.variableId) ?? emptyBounds();
      applyVariableCondition(bounds, condition);
      variables.set(condition.variableId, bounds);
    }
  }
  for (const [variableId, bounds] of variables) {
    if (variableBoundsImpossible(bounds)) {
      warnings.push(`엔딩 조건 충돌: ${ending.id}의 변수 ${variableId} 조건을 동시에 만족할 수 없습니다.`);
    }
  }
  return warnings;
}

type VariableCondition = Extract<Condition, { kind: "variable" }>;

type VariableBounds = {
  min: number;
  minStrict: boolean;
  max: number;
  maxStrict: boolean;
  equals?: number;
  notEquals: Set<number>;
};

function emptyBounds(): VariableBounds {
  return {
    min: Number.NEGATIVE_INFINITY,
    minStrict: false,
    max: Number.POSITIVE_INFINITY,
    maxStrict: false,
    notEquals: new Set(),
  };
}

function applyVariableCondition(bounds: VariableBounds, condition: VariableCondition): void {
  switch (condition.op) {
    case "==":
      bounds.equals = condition.value;
      return;
    case "!=":
      bounds.notEquals.add(condition.value);
      return;
    case ">":
      if (condition.value > bounds.min || (condition.value === bounds.min && !bounds.minStrict)) {
        bounds.min = condition.value;
        bounds.minStrict = true;
      }
      return;
    case ">=":
      if (condition.value > bounds.min) {
        bounds.min = condition.value;
        bounds.minStrict = false;
      }
      return;
    case "<":
      if (condition.value < bounds.max || (condition.value === bounds.max && !bounds.maxStrict)) {
        bounds.max = condition.value;
        bounds.maxStrict = true;
      }
      return;
    case "<=":
      if (condition.value < bounds.max) {
        bounds.max = condition.value;
        bounds.maxStrict = false;
      }
      return;
  }
}

function variableBoundsImpossible(bounds: VariableBounds): boolean {
  if (bounds.equals !== undefined) {
    if (bounds.notEquals.has(bounds.equals)) return true;
    if (bounds.equals < bounds.min || (bounds.equals === bounds.min && bounds.minStrict)) return true;
    if (bounds.equals > bounds.max || (bounds.equals === bounds.max && bounds.maxStrict)) return true;
    return false;
  }
  if (bounds.min > bounds.max) return true;
  return bounds.min === bounds.max && (bounds.minStrict || bounds.maxStrict);
}

function normalizeConditionKey(condition: Condition | EndingCondition): string {
  return JSON.stringify(condition, Object.keys(condition).sort());
}

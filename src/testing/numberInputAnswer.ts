import type { Project } from "@/project/types";

/**
 * 헤드리스 자동 플레이가 숫자 입력(inputNumber)에 넣을 값.
 *
 * 예전에는 늘 0 을 넣어, 금고 암호처럼 `inputNumber → fork(var == 7419)` 로 짠 퍼즐을 자동 플레이가 영영
 * 못 풀었다(2026-09-24 추격 호러 r7 막힘). 저작된 조건 중 그 변수를 상수와 비교하는 것을 찾아 통과하는 값을
 * 고른다: `==` 가 있으면 그 값, 없으면 `>=`·`>` 의 문턱. 아무것도 없으면 0.
 */
export function numberInputAnswer(project: Project, variableId: string): number {
  let atLeast: number | undefined;
  let found: number | undefined;
  const visit = (value: unknown): void => {
    if (found !== undefined || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.kind === "variable" && record.variableId === variableId && typeof record.value === "number" && Number.isFinite(record.value)) {
      if (record.op === "==") { found = record.value; return; }
      if (record.op === ">=") atLeast ??= record.value;
      else if (record.op === ">") atLeast ??= record.value + 1;
    }
    for (const child of Object.values(record)) visit(child);
  };
  for (const map of Object.values(project.maps)) visit(map.events);
  visit(project.commonEvents);
  return found ?? atLeast ?? 0;
}

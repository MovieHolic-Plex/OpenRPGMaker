// 저수준 이벤트/커먼 이벤트 툴의 commands 입력 보정과 오류 힌트.
// 도메인 컴파일러를 우선 쓰되, 커스텀 로직이 필요할 때만 이 경로가 원시 커맨드를 받는다.

import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command } from "@/project/types";
import { ToolError } from "./types";

type RecordValue = Record<string, unknown>;

const ONE_COMMAND_EXAMPLE = `{"commands":[{"kind":"text","body":"안녕하세요"}]}`;
const SINGLE_OBJECT_ARRAY_MARK = "__rpgzzuSingleObjectArray";

export const LOW_LEVEL_COMMAND_SHAPE_HINT =
  `커맨드 kind는 문자열. 형식이 어려우면 event_command_assist(있으면)나 고수준 툴을 사용하라. 올바른 1커맨드 예시 JSON: ${ONE_COMMAND_EXAMPLE}`;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length:${value.length})`;
  switch (typeof value) {
    case "object": {
      const keys = Object.keys(value as RecordValue).slice(0, 4);
      return keys.length > 0 ? `object(keys:${keys.join(",")})` : "object";
    }
    case "string":
      return `string(${JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}...` : value)})`;
    case "number":
      return Number.isFinite(value) ? `number(${value})` : "number(non-finite)";
    case "boolean":
      return `boolean(${value})`;
    case "bigint":
      return "bigint";
    case "function":
      return "function";
    case "symbol":
      return "symbol";
    case "undefined":
      return "undefined";
  }
  return "unknown";
}

function commandShapeError(message: string): ToolError {
  return new ToolError(`${message} ${LOW_LEVEL_COMMAND_SHAPE_HINT}`, { code: "invalid-args" });
}

export function normalizeLowLevelCommandArray(value: unknown, label: string, warnings?: string[]): Command[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    if ((value as unknown as Record<string, unknown>)[SINGLE_OBJECT_ARRAY_MARK] === true) {
      warnings?.push(`${label} 단일 커맨드 객체를 Command[] 배열로 감쌌습니다.`);
    }
    return value as Command[];
  }
  if (isRecord(value)) {
    warnings?.push(`${label} 단일 커맨드 객체를 Command[] 배열로 감쌌습니다.`);
    return [value as Command];
  }
  throw commandShapeError(
    `커맨드 형식 오류: ${label}은 Command[] 배열 또는 단일 Command 객체여야 합니다. 실제 타입: ${describeValue(value)}.`
  );
}

export function validateLowLevelCommandArray(label: string, commands: readonly Command[]): void {
  const failures = collectKindShapeFailures(label, commands);
  if (failures.length > 0) {
    throw commandShapeError(`커맨드 형식 오류:\n- ${failures.join("\n- ")}`);
  }
  try {
    validateCommandArray(label, commands);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw commandShapeError(`커맨드 형식 오류: ${detail}.`);
  }
}

function collectKindShapeFailures(label: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const failures: string[] = [];
  for (const [index, raw] of value.entries()) {
    const path = `${label}[${index}]`;
    if (!isRecord(raw)) {
      failures.push(`${path}: 기대 형식 Command object, 실제 타입 ${describeValue(raw)}`);
      continue;
    }
    if (typeof raw.kind !== "string") {
      failures.push(`${path}.kind: 기대 형식 string, 실제 타입 ${describeValue(raw.kind)}`);
      continue;
    }
    failures.push(...nestedKindShapeFailures(path, raw));
  }
  return failures;
}

function nestedKindShapeFailures(path: string, command: RecordValue): string[] {
  switch (command.kind) {
    case "choices":
      return choicesFailures(path, command);
    case "fork":
      return [
        ...collectKindShapeFailures(`${path}.then`, command.then),
        ...(command.else === undefined ? [] : collectKindShapeFailures(`${path}.else`, command.else)),
      ];
    case "loop":
      return collectKindShapeFailures(`${path}.body`, command.body);
    case "shop":
      return command.transactionBranch === undefined
        ? []
        : collectKindShapeFailures(`${path}.transactionBranch`, command.transactionBranch);
    case "promoteActor":
    case "evolveMonster":
      return [
        ...(command.successBranch === undefined ? [] : collectKindShapeFailures(`${path}.successBranch`, command.successBranch)),
        ...(command.failureBranch === undefined ? [] : collectKindShapeFailures(`${path}.failureBranch`, command.failureBranch)),
      ];
    default:
      return [];
  }
}

function choicesFailures(path: string, command: RecordValue): string[] {
  const failures: string[] = [];
  if (Array.isArray(command.options)) {
    for (const [index, rawOption] of command.options.entries()) {
      if (!isRecord(rawOption)) continue;
      failures.push(...collectKindShapeFailures(`${path}.options[${index}].branch`, rawOption.branch));
    }
  }
  if (command.cancelBranch !== undefined) {
    failures.push(...collectKindShapeFailures(`${path}.cancelBranch`, command.cancelBranch));
  }
  return failures;
}

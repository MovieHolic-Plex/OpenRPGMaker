// project/eventCommands/coordinateDestination.ts
// 「좌표 목적지 이동」의 **공용** 좌표 소스 계약과 실패 결과 열거.
//
// 왜 한 곳인가 (OPRN-OUT-013): X·Y 를 「숫자 또는 변수」로 받는 자리가 저작 폼 · 저작 진단 ·
// 런타임 해석 셋인데, 각자 자기 규칙을 들고 있으면 「스튜디오에서는 통과했는데 플레이에서는
// (0,0) 으로 간다」가 재발한다. 실측된 옛 결함이 정확히 그것이다 — `m2Runtime` 의 변수 위치
// 이동이 값이 없을 때 현재 맵 + `(0,0)` 으로 조용히 떨어졌다.
//
// 이 파일은 순수하다. 프로젝트·세션 객체를 알지 못하고, 변수 값은 읽기 함수로 주입받는다.
// 그래서 편집기(변수 존재 여부만 아는 자리)와 런타임(실제 값을 아는 자리)이 **같은 판정**을
// 공유하면서도 서로를 import 하지 않는다.
//
// 저장 형태(정본) — 없는 키는 전부 「옛 고정 좌표 명령」의 기본값으로 읽힌다:
//   xSource / ySource : "fixed"(기본) | "variable"
//   x / y             : 고정 정수 (기존 필드 그대로, 의미 불변)
//   xVariableId / yVariableId : 변수 레코드 id (xSource 가 "variable" 일 때만 읽는다)
//   onFailure         : "continue"(기본, 안전) | "stop"
//   fallback          : "none"(기본, 안전) | "nearest"
//   resultVariableId / resultSwitchId : 명령별 결과 기록처(선택)
//
// 기본값이 곧 마이그레이션이다: 옛 저장본에는 이 키들이 없고, 없으면 fixed / continue / none
// 으로 읽혀 예전과 **완전히 같은** 동작을 한다. 저장본을 다시 쓰지 않는다.

/** 좌표 한 축의 값 출처. */
export type CoordinateSourceKind = "fixed" | "variable";

/** 실패 정책. 「분기」는 결과 변수·스위치 + 기존 조건 분기 명령의 조합으로 저작한다. */
export type CoordinateFailurePolicy = "continue" | "stop";

/** 저작자가 **명시적으로** 켜야 하는 대체 목적지. 기본은 없음(조용한 좌표 왜곡 금지). */
export type CoordinateFallbackPolicy = "none" | "nearest";

/**
 * 이동 명령 한 번의 결과. 성공 1종 + 실패 6종이며 **모두 구분 가능**해야 한다
 * (인수 기준: "successful arrival and every failure class are distinguishable").
 */
export type MovementResult =
  | "arrived"
  | "invalidInput"
  | "missingTarget"
  | "outOfBounds"
  | "blocked"
  | "unreachable"
  | "interrupted";

/**
 * 결과 변수에 실제로 기록되는 정수. 변수는 숫자만 담으므로(session.variables:
 * Record<string, number>) 열거를 숫자로 고정한다. **값은 계약이다** — 저작자가
 * 조건 분기에서 `결과 변수 == 3` 같이 쓰므로 순서를 바꾸거나 재사용하지 마라.
 */
export const MOVEMENT_RESULT_CODES: Readonly<Record<MovementResult, number>> = {
  arrived: 0,
  invalidInput: 1,
  missingTarget: 2,
  outOfBounds: 3,
  blocked: 4,
  unreachable: 5,
  interrupted: 6,
};

/** 저작 폼·요약·진단이 함께 쓰는 사람 말. */
export const MOVEMENT_RESULT_LABELS: Readonly<Record<MovementResult, string>> = {
  arrived: "도착",
  invalidInput: "좌표 값 오류",
  missingTarget: "대상 없음",
  outOfBounds: "맵 밖",
  blocked: "목적지 막힘",
  unreachable: "경로 없음",
  interrupted: "중단됨",
};

export function movementResultCode(result: MovementResult): number {
  return MOVEMENT_RESULT_CODES[result];
}

export function isMovementFailure(result: MovementResult): boolean {
  return result !== "arrived";
}

/** 좌표 해석 실패의 구체적 이유. 저작자에게 그대로 보여 준다. */
export type CoordinateFailureReason =
  | "noVariableSelected"
  | "missingVariable"
  | "nonNumeric"
  | "nonFinite"
  | "fractional"
  | "negative";

export const COORDINATE_FAILURE_LABELS: Readonly<Record<CoordinateFailureReason, string>> = {
  noVariableSelected: "변수를 고르지 않았습니다",
  missingVariable: "변수가 없습니다",
  nonNumeric: "숫자가 아닙니다",
  nonFinite: "유한한 수가 아닙니다",
  fractional: "정수가 아닙니다",
  negative: "음수입니다",
};

export type CoordinateResolution =
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly reason: CoordinateFailureReason;
      /** 읽으려던 변수 id. 고정 좌표 실패에는 없다. */
      readonly variableId?: string;
      /** 읽힌 원본 값. 진단 문구에 그대로 싣는다 — 절대 좌표로 쓰지 않는다. */
      readonly raw?: unknown;
    };

/** m2 명령 필드에서 좌표 한 축의 설정을 읽는다. 없는 키는 옛 고정 좌표로 읽는다. */
export type CoordinateAxisSpec = {
  readonly source: CoordinateSourceKind;
  readonly fixedValue: number;
  readonly variableId: string;
};

type FieldBag = Readonly<Record<string, unknown>>;

function readString(fields: FieldBag, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function readNumber(fields: FieldBag, key: string): number {
  const value = fields[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** `"x"` 또는 `"y"`. 필드 키는 `x`/`xSource`/`xVariableId` 규칙으로 파생한다. */
export type CoordinateAxis = "x" | "y";

export function coordinateAxisSpec(fields: FieldBag, axis: CoordinateAxis): CoordinateAxisSpec {
  const variableId = readString(fields, `${axis}VariableId`);
  // 소스 키가 없어도 변수 id 가 저장돼 있으면 변수 의도로 읽는다 — `valueSource`/
  // `valueVariableId` 짝이 이미 쓰는 규칙이고(commandBodyM2Actor), 부분 저장본을 구한다.
  const declared = readString(fields, `${axis}Source`);
  const source: CoordinateSourceKind = declared === "variable" || (!declared && variableId.length > 0)
    ? "variable"
    : "fixed";
  return { source, fixedValue: readNumber(fields, axis), variableId };
}

export function coordinateFailurePolicy(fields: FieldBag): CoordinateFailurePolicy {
  return readString(fields, "onFailure") === "stop" ? "stop" : "continue";
}

export function coordinateFallbackPolicy(fields: FieldBag): CoordinateFallbackPolicy {
  return readString(fields, "fallback") === "nearest" ? "nearest" : "none";
}

export function movementResultVariableId(fields: FieldBag): string {
  return readString(fields, "resultVariableId");
}

export function movementResultSwitchId(fields: FieldBag): string {
  return readString(fields, "resultSwitchId");
}

/**
 * 한 축의 좌표를 확정한다.
 *
 * `readVariable` 는 **키가 없으면 undefined 를 돌려줘야 한다.** `?? 0` 으로 메꾼 값을
 * 넘기면 「변수 없음」과 「값이 0」이 구분되지 않아 이 이슈의 원래 결함(나쁜 데이터가
 * (0,0) 이라는 그럴듯한 목적지가 되는 것)이 그대로 되살아난다.
 */
export function resolveCoordinateAxis(
  spec: CoordinateAxisSpec,
  readVariable: (variableId: string) => unknown
): CoordinateResolution {
  if (spec.source === "fixed") return validateCoordinateNumber(spec.fixedValue);
  if (!spec.variableId) return { ok: false, reason: "noVariableSelected" };
  const raw = readVariable(spec.variableId);
  if (raw === undefined || raw === null) {
    return { ok: false, reason: "missingVariable", variableId: spec.variableId, raw };
  }
  if (typeof raw !== "number") {
    // 문자열이라도 숫자로 읽히면 받아 준다(저장본 왕복에서 "12" 가 될 수 있다).
    // 그 밖의 형은 좌표가 아니다 — 강제 변환하지 않는다.
    if (typeof raw !== "string" || raw.trim().length === 0 || !Number.isFinite(Number(raw))) {
      return { ok: false, reason: "nonNumeric", variableId: spec.variableId, raw };
    }
    return withVariableContext(validateCoordinateNumber(Number(raw)), spec.variableId, raw);
  }
  return withVariableContext(validateCoordinateNumber(raw), spec.variableId, raw);
}

function withVariableContext(
  resolution: CoordinateResolution,
  variableId: string,
  raw: unknown
): CoordinateResolution {
  return resolution.ok ? resolution : { ...resolution, variableId, raw };
}

function validateCoordinateNumber(value: number): CoordinateResolution {
  if (typeof value !== "number" || Number.isNaN(value)) return { ok: false, reason: "nonNumeric", raw: value };
  if (!Number.isFinite(value)) return { ok: false, reason: "nonFinite", raw: value };
  if (!Number.isInteger(value)) return { ok: false, reason: "fractional", raw: value };
  if (value < 0) return { ok: false, reason: "negative", raw: value };
  return { ok: true, value };
}

export type DestinationResolution =
  | { readonly ok: true; readonly x: number; readonly y: number }
  | {
      readonly ok: false;
      readonly axis: CoordinateAxis;
      readonly reason: CoordinateFailureReason;
      readonly variableId?: string;
      readonly raw?: unknown;
    };

/** 두 축을 함께 확정한다. X 를 먼저 보고, 먼저 실패한 축을 보고한다. */
export function resolveDestination(
  fields: FieldBag,
  readVariable: (variableId: string) => unknown
): DestinationResolution {
  const resolved: { x?: number; y?: number } = {};
  for (const axis of ["x", "y"] as const) {
    const value = resolveCoordinateAxis(coordinateAxisSpec(fields, axis), readVariable);
    if (!value.ok) {
      return { ok: false, axis, reason: value.reason, variableId: value.variableId, raw: value.raw };
    }
    resolved[axis] = value.value;
  }
  return { ok: true, x: resolved.x!, y: resolved.y! };
}

/** 실패를 사람이 읽는 한 문장으로. 로그·저작 진단·요약이 모두 이 문구를 쓴다. */
export function describeDestinationFailure(failure: Extract<DestinationResolution, { ok: false }>): string {
  const axis = failure.axis.toUpperCase();
  const label = COORDINATE_FAILURE_LABELS[failure.reason];
  if (failure.variableId) {
    return `${axis} 좌표 변수 «${failure.variableId}» — ${label}${
      failure.raw === undefined ? "" : ` (값: ${String(failure.raw)})`
    }`;
  }
  return `${axis} 좌표 — ${label}${failure.raw === undefined ? "" : ` (값: ${String(failure.raw)})`}`;
}

// benchmark/town/contract.ts
// 마을 벤치마크 답변 파서 — fail-closed.
//
// 추출 메커니즘은 ../interior/contract.ts 와 같다: 원문 JSON → ```json 펜스 →
// 첫 균형 {...} 객체. "JSON 없음"과 "찾았지만 malformed"를 구분해 보고한다.
// 검증은 fail-closed 다 — 위반이 하나라도 있으면 답변 전체를 거부하고 어긋난
// 필드를 이름으로 지목한다. 부분 수용도, 조용한 보정도 없다.
//
// interior 트랙과 다른 점은 답변 형상이 셋이라는 것뿐이다:
//   tileSet  {"tileIds":[...]}                프로브 문항
//   grid     {"grid":[[...]]}                 단일 레이어(오토타일·길·문·울타리)
//   layered  {"lower":[[...]],"upper":[[...]]} 두 레이어(나무·벽·지붕·마을)

import { EMPTY_CELL, TOWN_TILE_COUNT, type TownAnswer, type TownAnswerKind } from "./types";

const MAX_TILE_ID = TOWN_TILE_COUNT - 1;

export type TownContractViolation =
  | "not-json"
  | "invalid-json"
  | "not-object"
  | "wrong-type"
  | "empty-grid"
  | "non-rectangular"
  | "shape-mismatch"
  | "non-integer-id"
  | "id-out-of-range"
  | "duplicate-id"
  | "not-ascending";

export class TownContractError extends Error {
  readonly field: string;
  readonly violation: TownContractViolation;
  readonly detail: string;

  constructor(field: string, violation: TownContractViolation, detail: string) {
    super(`Town benchmark answer rejected (${violation}) at ${field}: ${detail}`);
    this.name = "TownContractError";
    this.field = field;
    this.violation = violation;
    this.detail = detail;
  }
}

export function parseTownAnswer(raw: string, kind: TownAnswerKind): TownAnswer {
  const extraction = extractJsonCandidate(raw);
  if (extraction.kind === "none") {
    throw new TownContractError(
      "answer",
      "not-json",
      'response contains no JSON object (expected something like {"grid":[[-1]]})',
    );
  }
  if (extraction.kind === "malformed") {
    throw new TownContractError("answer", "invalid-json", describeParseFailure(extraction.text));
  }
  const parsed = extraction.value;
  if (!isJsonObject(parsed)) {
    throw new TownContractError(
      "answer",
      "not-object",
      `top-level value must be a JSON object (got ${Array.isArray(parsed) ? "an array" : typeof parsed})`,
    );
  }
  if (kind === "tileSet") return parseTileSet(parsed);
  if (kind === "grid") return { grid: readGrid(parsed, "grid") };
  return parseLayered(parsed);
}

function parseTileSet(parsed: Record<string, unknown>): TownAnswer {
  const value = parsed["tileIds"];
  if (!Array.isArray(value)) {
    throw new TownContractError("tileIds", "wrong-type", "tileIds must be an array of integers");
  }
  const tileIds: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index];
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new TownContractError(
        "tileIds",
        "non-integer-id",
        `tileIds[${index}] is not an integer (got ${JSON.stringify(id)})`,
      );
    }
    if (id < 0 || id > MAX_TILE_ID) {
      throw new TownContractError(
        "tileIds",
        "id-out-of-range",
        `tileIds[${index}] is ${id}; ids must be integers in 0..${MAX_TILE_ID}`,
      );
    }
    if (seen.has(id)) {
      throw new TownContractError("tileIds", "duplicate-id", `tileIds contains duplicate id ${id} at index ${index}`);
    }
    const previous = tileIds[tileIds.length - 1];
    if (previous !== undefined && id <= previous) {
      throw new TownContractError(
        "tileIds",
        "not-ascending",
        `tileIds must be strictly ascending; ${id} at index ${index} follows ${previous}`,
      );
    }
    seen.add(id);
    tileIds.push(id);
  }
  return { tileIds };
}

function parseLayered(parsed: Record<string, unknown>): TownAnswer {
  const lower = readGrid(parsed, "lower");
  const upper = readGrid(parsed, "upper");
  if (lower.length !== upper.length || lower[0]!.length !== upper[0]!.length) {
    throw new TownContractError(
      "upper",
      "shape-mismatch",
      `lower is ${lower.length}x${lower[0]!.length} but upper is ${upper.length}x${upper[0]!.length}; both grids must share one shape`,
    );
  }
  return { lower, upper };
}

function readGrid(parsed: Record<string, unknown>, field: string): number[][] {
  const value = parsed[field];
  if (!Array.isArray(value)) {
    throw new TownContractError(field, "wrong-type", `${field} must be an array of arrays`);
  }
  if (value.length === 0) {
    throw new TownContractError(field, "empty-grid", `${field} must contain at least one row`);
  }
  const grid: number[][] = [];
  let width = -1;
  for (let y = 0; y < value.length; y += 1) {
    const row = value[y];
    if (!Array.isArray(row)) {
      throw new TownContractError(field, "wrong-type", `${field} row ${y} must be an array`);
    }
    if (row.length === 0) {
      throw new TownContractError(field, "empty-grid", `${field} row ${y} must contain at least one cell`);
    }
    if (width === -1) width = row.length;
    else if (row.length !== width) {
      throw new TownContractError(
        field,
        "non-rectangular",
        `${field} row ${y} has width ${row.length} but row 0 has width ${width}`,
      );
    }
    const outRow: number[] = [];
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (typeof cell !== "number" || !Number.isInteger(cell)) {
        throw new TownContractError(
          field,
          "non-integer-id",
          `${field}[${y}][${x}] is not an integer (got ${JSON.stringify(cell)})`,
        );
      }
      if (cell < EMPTY_CELL || cell > MAX_TILE_ID) {
        throw new TownContractError(
          field,
          "id-out-of-range",
          `${field}[${y}][${x}] is ${cell}; cells must be ${EMPTY_CELL} or 0..${MAX_TILE_ID}`,
        );
      }
      outRow.push(cell);
    }
    grid.push(outRow);
  }
  return grid;
}

type JsonExtraction =
  | { readonly kind: "object"; readonly value: unknown }
  | { readonly kind: "malformed"; readonly text: string }
  | { readonly kind: "none" };

function extractJsonCandidate(responseText: string): JsonExtraction {
  const trimmed = responseText.trim();
  const direct = tryParseJson(trimmed);
  if (direct.ok) return { kind: "object", value: direct.value };
  const fenced = extractFencedJson(trimmed);
  if (fenced !== null) {
    const parsed = tryParseJson(fenced);
    return parsed.ok ? { kind: "object", value: parsed.value } : { kind: "malformed", text: fenced };
  }
  const balanced = extractBalancedObject(trimmed);
  if (balanced !== null) {
    const parsed = tryParseJson(balanced);
    return parsed.ok ? { kind: "object", value: parsed.value } : { kind: "malformed", text: balanced };
  }
  return { kind: "none" };
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function describeParseFailure(text: string): string {
  try {
    JSON.parse(text);
    return "malformed object";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function extractFencedJson(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match?.[1]?.trim() ?? null;
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

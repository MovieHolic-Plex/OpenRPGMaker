/**
 * Fail-closed response contract for the tileset-vision benchmark.
 *
 * Mirrors the response-normalization mechanism of normalizeCpenResponseText
 * (src/editor/panels/tilesetAiCpenClient.ts): strip markdown fences, then
 * extract a balanced JSON object from the text. The parsed value is then
 * validated per BenchmarkTaskKind and ANY violation rejects the WHOLE answer
 * with a structured BenchmarkContractError naming the offending field —
 * mirroring the fail-closed parseTilesetKnowledgeAnswer pattern in
 * src/editor/tilesetAiNativeAnalysis.ts. Invalid answers are never silently
 * repaired or partially accepted.
 */

export type BenchmarkTaskKind = "detection" | "construction" | "autotileGrid" | "autotileCount";

/** Valid tile ids: integers 0..479; -1 additionally means "empty cell" in grids. */
const MAX_TILE_ID = 479;
const MIN_GRID_CELL_ID = -1;

export type BenchmarkAnswer =
  | { readonly tileIds: number[] }
  | { readonly lower: number[][]; readonly upper: number[][] }
  | { readonly grid: number[][] }
  | { readonly count: number; readonly types: string[] };

export type BenchmarkContractViolation =
  | "not-json"
  | "invalid-json"
  | "not-object"
  | "wrong-type"
  | "empty-grid"
  | "non-rectangular"
  | "non-integer-id"
  | "id-out-of-range"
  | "duplicate-id"
  | "not-ascending"
  | "count-invalid";

export class BenchmarkContractError extends Error {
  readonly field: string;
  readonly violation: BenchmarkContractViolation;
  readonly detail: string;

  constructor(field: string, violation: BenchmarkContractViolation, detail: string) {
    super(`Benchmark answer rejected (${violation}): ${detail}`);
    this.name = "BenchmarkContractError";
    this.field = field;
    this.violation = violation;
    this.detail = detail;
  }
}

type JsonObject = Record<string, unknown>;

export function parseBenchmarkAnswer(raw: string, kind: BenchmarkTaskKind): BenchmarkAnswer {
  const extraction = extractJsonCandidate(raw);
  if (extraction.kind === "none") {
    throw new BenchmarkContractError(
      "answer",
      "not-json",
      "response contains no JSON object (expected an object such as {\"tileIds\":[306]})",
    );
  }
  if (extraction.kind === "malformed") {
    throw new BenchmarkContractError(
      "answer",
      "invalid-json",
      `response is not valid JSON: ${describeParseFailure(extraction.text)}`,
    );
  }
  const parsed: unknown = extraction.value;
  if (!isJsonObject(parsed)) {
    throw new BenchmarkContractError(
      "answer",
      "not-object",
      "top-level value must be a JSON object (got " + (Array.isArray(parsed) ? "an array" : typeof parsed) + ")",
    );
  }
  switch (kind) {
    case "detection":
      return parseDetection(parsed);
    case "construction":
      return parseConstruction(parsed);
    case "autotileGrid":
      return parseAutotileGrid(parsed);
    case "autotileCount":
      return parseAutotileCount(parsed);
  }
}

function parseDetection(parsed: JsonObject): { tileIds: number[] } {
  const value = parsed["tileIds"];
  if (!Array.isArray(value)) {
    throw new BenchmarkContractError("tileIds", "wrong-type", "tileIds must be an array of integers");
  }
  const tileIds: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index];
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new BenchmarkContractError(
        "tileIds",
        "non-integer-id",
        `tileIds[${index}] is not an integer (got ${JSON.stringify(id)}); tile ids must be integers`,
      );
    }
    if (id < 0 || id > MAX_TILE_ID) {
      throw new BenchmarkContractError(
        "tileIds",
        "id-out-of-range",
        `tileIds[${index}] has id ${id}; ids must be integers in 0..${MAX_TILE_ID}`,
      );
    }
    if (tileIds.includes(id)) {
      throw new BenchmarkContractError(
        "tileIds",
        "duplicate-id",
        `tileIds contains duplicate id ${id} at index ${index}`,
      );
    }
    const previous = tileIds[tileIds.length - 1];
    if (previous !== undefined && id <= previous) {
      throw new BenchmarkContractError(
        "tileIds",
        "not-ascending",
        `tileIds must be strictly ascending; ${id} at index ${index} is not greater than ${previous} at index ${index - 1}`,
      );
    }
    tileIds.push(id);
  }
  return { tileIds };
}

function parseConstruction(parsed: JsonObject): { lower: number[][]; upper: number[][] } {
  const lower = readGridField(parsed, "lower");
  const upper = readGridField(parsed, "upper");
  if (lower.length !== upper.length || lower[0].length !== upper[0].length) {
    throw new BenchmarkContractError(
      "lower",
      "non-rectangular",
      `lower is ${lower.length}x${lower[0].length} but upper is ${upper.length}x${upper[0].length}; both grids must share the same WxH shape`,
    );
  }
  return { lower, upper };
}

function parseAutotileGrid(parsed: JsonObject): { grid: number[][] } {
  return { grid: readGridField(parsed, "grid") };
}

function readGridField(parsed: JsonObject, field: string): number[][] {
  const value = parsed[field];
  if (!Array.isArray(value)) {
    throw new BenchmarkContractError(field, "wrong-type", `${field} must be an array of arrays`);
  }
  if (value.length === 0) {
    throw new BenchmarkContractError(field, "empty-grid", `${field} must contain at least one row`);
  }
  const grid: number[][] = [];
  let width = -1;
  for (let y = 0; y < value.length; y += 1) {
    const row = value[y];
    if (!Array.isArray(row)) {
      throw new BenchmarkContractError(field, "wrong-type", `${field} row ${y} must be an array`);
    }
    if (row.length === 0) {
      throw new BenchmarkContractError(field, "empty-grid", `${field} row ${y} must contain at least one cell`);
    }
    if (width === -1) {
      width = row.length;
    } else if (row.length !== width) {
      throw new BenchmarkContractError(
        field,
        "non-rectangular",
        `${field} row ${y} has width ${row.length} but row 0 has width ${width}`,
      );
    }
    const outRow: number[] = [];
    for (let x = 0; x < row.length; x += 1) {
      outRow.push(readGridCellId(row[x], field, y, x));
    }
    grid.push(outRow);
  }
  return grid;
}

function readGridCellId(value: unknown, field: string, y: number, x: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BenchmarkContractError(
      field,
      "non-integer-id",
      `${field}[${y}][${x}] is not an integer (got ${JSON.stringify(value)}); grid cells must be integers`,
    );
  }
  if (value < MIN_GRID_CELL_ID || value > MAX_TILE_ID) {
    throw new BenchmarkContractError(
      field,
      "id-out-of-range",
      `${field}[${y}][${x}] has id ${value}; ids must be 0..${MAX_TILE_ID} or -1 for empty`,
    );
  }
  return value;
}

function parseAutotileCount(parsed: JsonObject): { count: number; types: string[] } {
  const count = parsed["count"];
  if (typeof count !== "number" || !Number.isInteger(count)) {
    throw new BenchmarkContractError(
      "count",
      "count-invalid",
      `count must be an integer (got ${JSON.stringify(count)})`,
    );
  }
  if (count < 0) {
    throw new BenchmarkContractError("count", "count-invalid", `count must be >= 0 (got ${count})`);
  }
  const types = parsed["types"];
  if (!Array.isArray(types)) {
    throw new BenchmarkContractError("types", "wrong-type", "types must be an array of strings");
  }
  const outTypes: string[] = [];
  for (let index = 0; index < types.length; index += 1) {
    const type = types[index];
    if (typeof type !== "string") {
      throw new BenchmarkContractError(
        "types",
        "wrong-type",
        `types[${index}] must be a string (got ${JSON.stringify(type)})`,
      );
    }
    outTypes.push(type);
  }
  return { count, types };
}

type JsonExtraction =
  | { readonly kind: "object"; readonly value: unknown }
  | { readonly kind: "malformed"; readonly text: string }
  | { readonly kind: "none" };

/**
 * Mirror of normalizeCpenResponseText (tilesetAiCpenClient.ts): accept the
 * raw text when it parses as JSON, then try a ```json fence, then extract the
 * first balanced {...} object. Distinguishes "found but malformed" so the
 * caller can report invalid-json instead of silently treating it as prose.
 */
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
    if (char === "\"") {
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

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

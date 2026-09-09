import { assert, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { spatialId } from "@/project/spatial/domain";
import type { SpatialCompileRequest } from "./compilerTypes";

function record(value: unknown, path: string, fields: readonly string[]): Record<string, unknown> {
  const parsed = requireRecord(path, value);
  for (const key of Object.keys(parsed)) assert(fields.includes(key), `${path}.${key}: unsupported field`);
  // As in the project spatial parser, inherited properties cannot supply required fields.
  return Object.fromEntries(Object.entries(parsed));
}
function integer(value: unknown, path: string, minimum: number): number {
  const parsed = requireNumber(path, value);
  assert(Number.isSafeInteger(parsed) && parsed >= minimum, `${path}: expected integer >= ${minimum}`);
  return parsed;
}
function text(value: unknown, path: string): string {
  const parsed = requireString(path, value);
  assert(parsed.trim().length > 0, `${path}: expected nonblank ID`);
  return parsed;
}

/** Compiler input uses the project's error/guard contract, without an extra dependency. */
export function parseCompileRequest(value: unknown): SpatialCompileRequest {
  const request = record(value, "compile", ["occurrenceId", "target"]);
  const occurrenceId = spatialId(text(request.occurrenceId, "compile.occurrenceId"));
  if (request.target === undefined) return { occurrenceId };
  const target = record(request.target, "compile.target", ["mapId", "rect", "entry"]);
  const rect = record(target.rect, "compile.target.rect", ["x", "y", "width", "height"]);
  const entry = record(target.entry, "compile.target.entry", ["x", "y"]);
  return { occurrenceId, target: { mapId: text(target.mapId, "compile.target.mapId"), rect: {
    x: integer(rect.x, "compile.target.rect.x", 0), y: integer(rect.y, "compile.target.rect.y", 0),
    width: integer(rect.width, "compile.target.rect.width", 1), height: integer(rect.height, "compile.target.rect.height", 1),
  }, entry: { x: integer(entry.x, "compile.target.entry.x", 0), y: integer(entry.y, "compile.target.entry.y", 0) } } };
}

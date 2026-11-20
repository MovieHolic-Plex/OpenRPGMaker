import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import type { JsonSchema, JsonSchemaType } from "@/editor/tools/types";
import { EventCommandEditError } from "@/project/eventCommands/singleCommandOps";
import type { Project } from "@/project/types";
import { plainSummary } from "../plainSummary";
import type { SmallTaskTarget } from "../target";
import { primitiveScope } from "./core/scope";
import { PrimitiveError } from "./errors";
import { PRIMITIVES } from "./index";
import { getPrimitive } from "./registry";
import type { PrimitiveContext } from "./types";

function matchesType(value: unknown, type: JsonSchemaType): boolean {
  switch (type) {
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "null": return value === null;
    default: return typeof value === type;
  }
}

export function matchesPrimitiveSchema(schema: JsonSchema, value: unknown): boolean {
  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types && !types.some(type => matchesType(value, type))) return false;
  if (schema.enum && !schema.enum.includes(value as string | number)) return false;
  if (schema.oneOf && schema.oneOf.filter(choice => matchesPrimitiveSchema(choice, value)).length !== 1) return false;
  if (typeof value === "string") {
    return value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity)
      && (schema.pattern === undefined || new RegExp(schema.pattern, "u").test(value));
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  }
  if (Array.isArray(value)) {
    return value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity)
      && (!schema.items || value.every(item => matchesPrimitiveSchema(schema.items!, item)));
  }
  if (value !== null && typeof value === "object") {
    const fields = schema.properties ?? {};
    if (schema.required?.some(key => !Object.hasOwn(value, key) || Reflect.get(value, key) === undefined)) return false;
    return Object.entries(value).every(([key, entry]) => Object.hasOwn(fields, key)
      ? matchesPrimitiveSchema(fields[key]!, entry) : schema.additionalProperties !== false);
  }
  return true;
}

export function runPrimitive(
  project: Project, target: SmallTaskTarget, id: string, args: Record<string, unknown>, selection?: PrimitiveContext["selection"],
  live?: PrimitiveContext["live"],
) {
  const publicRow = PRIMITIVES.find(row => row.id === id);
  const primitive = getPrimitive(id);
  if (!primitive || !publicRow) throw new PrimitiveError("요청한 동작을 찾을 수 없어요.");
  if (!publicRow.targets.includes(target.kind) || !primitive.targets.includes(target.kind)) {
    throw new PrimitiveError("범위 밖: 선택한 대상에 이 동작을 쓸 수 없어요.");
  }
  if (!args || typeof args !== "object" || Array.isArray(args) || !matchesPrimitiveSchema(primitive.args, args)) {
    throw new PrimitiveError("동작에 필요한 값의 형식을 확인해 주세요.");
  }

  const ctx: PrimitiveContext = { project, target, selection, live };
  try {
    const scope = primitiveScope(ctx, primitive, args);
    const after = primitive.apply(ctx, args);
    const result = checkSmallTaskScope(project, after, scope, live);
    if (!result.ok) throw new PrimitiveError(result.reason);
    return { after, sentence: primitive.describe(ctx, args), summary: plainSummary(project, after) };
  } catch (error) {
    if (error instanceof EventCommandEditError) throw new PrimitiveError(error.message);
    throw error;
  }
}

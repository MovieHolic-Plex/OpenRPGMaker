import { describe, expect, test } from "bun:test";
import { antigravityToolEnumPayload } from "../scripts/lib/ohMyPiToolEnums.ts";
import { allTools, toOpenAiTools } from "../src/editor/tools/toolRegistry.ts";
import { WORK_PLAN_TOOLS } from "../src/ai/assistantSession.ts";
import { ACCEPTANCE_TOOLS } from "../src/ai/assistantAcceptanceTools.ts";
import capturedTools from "./fixtures/oh-my-pi/round4-tools.json";

type SchemaNode = { type?: string; enum?: unknown[]; properties?: Record<string, SchemaNode>; items?: SchemaNode };
function numericEnumLeaves(value: unknown, path: string[] = []): { path: string[]; schema: SchemaNode }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const schema = value as SchemaNode;
  return [
    ...(schema.enum?.some(value => typeof value === "number") ? [{ path, schema }] : []),
    ...Object.entries(schema.properties ?? {}).flatMap(([key, child]) => numericEnumLeaves(child, [...path, "properties", key])),
    ...(schema.items ? numericEnumLeaves(schema.items, [...path, "items"]) : []),
  ];
}
function atPath(schema: SchemaNode, path: string[]): SchemaNode {
  let node: unknown = schema;
  for (const key of path) {
    if (!node || typeof node !== "object" || !(key in node)) throw new Error(`Missing wire schema ${path.join(".")}`);
    node = (node as Record<string, unknown>)[key];
  }
  return node as SchemaNode;
}
const corpus = [...toOpenAiTools(allTools()), ...WORK_PLAN_TOOLS, ...ACCEPTANCE_TOOLS];

describe("numeric tool enums registry and CCA payload guard", () => {
  test("the captured set and full live registry cover all five numeric leaves", () => {
    expect(capturedTools).toHaveLength(48);
    const affected = allTools().filter(tool => numericEnumLeaves(tool.parameters as SchemaNode).length > 0);
    expect(affected.map(tool => tool.name)).toEqual([
      "author_house", "start_interior_room_session", "run_interior_room_pipeline", "upsert_autotile_group",
    ]);
    expect(affected.flatMap(tool => numericEnumLeaves(tool.parameters as SchemaNode))).toHaveLength(5);
    for (const tool of capturedTools) {
      for (const { path, schema } of numericEnumLeaves(tool.function.parameters)) {
        const live = atPath(affected.find(entry => entry.name === tool.function.name)!.parameters as SchemaNode, path);
        expect({ type: live.type, enum: live.enum }).toEqual({ type: schema.type, enum: schema.enum });
      }
    }
  });

  test("full live tool corpus passes antigravityToolEnumPayload validation cleanly", () => {
    const toolDefs = corpus.map((entry) => ({
      name: entry.function.name,
      parameters: entry.function.parameters,
    }));
    const encode = antigravityToolEnumPayload("offline-check", toolDefs);
    const wire = {
      request: {
        tools: [{
          functionDeclarations: toolDefs.map((tool) => ({
            name: tool.name,
            parameters: structuredClone(tool.parameters),
          })),
        }],
      },
    };
    const encoded = encode(wire) as typeof wire;
    expect(encoded.request.tools[0].functionDeclarations.length).toBe(toolDefs.length);
  });
});

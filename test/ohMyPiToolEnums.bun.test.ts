import { describe, expect, test } from "bun:test";
import { antigravityToolEnumPayload, stripEmptyEnumMembers, ToolSchemaTransportError } from "../scripts/lib/ohMyPiToolEnums.ts";
import { allTools } from "../src/editor/tools/toolRegistry.ts";

const original = allTools().find(tool => tool.name === "upsert_autotile_group")!;
const tools = [{ name: original.name, description: original.description, parameters: { ...original.parameters } }];

type Node = { type?: unknown; enum?: unknown; nullable?: unknown; properties?: Record<string, Node>; items?: Node };
type Payload = { request: { tools: { functionDeclarations: { name?: string; parameters?: Node; parametersJsonSchema?: Node }[] }[] } };

/** Minimal CCA-shaped wire payload fixture (replaces removed @oh-my-pi google-gemini-cli buildRequest). */
function ccaWire(toolList: readonly { name: string; parameters: unknown }[]): Payload {
  return {
    request: {
      tools: [{
        functionDeclarations: toolList.map((tool) => ({
          name: tool.name,
          parameters: normalizeForWire(structuredClone(tool.parameters)) as Node,
        })),
      }],
    },
  };
}

function normalizeForWire(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(normalizeForWire);
  const rec = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = normalizeForWire(v);
  if (Array.isArray(out.type) && out.type.includes("integer") && out.type.includes("null")) {
    out.type = "integer";
    out.nullable = true;
    if (Array.isArray(out.enum)) out.enum = out.enum.filter((v) => v !== null);
  }
  return out;
}

function group(payload: unknown): Node {
  return (payload as Payload).request.tools[0].functionDeclarations[0].parameters!.properties!.group;
}

describe("post-normalization CCA enum preservation", () => {
  test("preserves optional integer membership plus null", () => {
    const nullableTools = [{ name: "terrain", description: "terrain", parameters: { type: "object", properties: { level: { type: ["integer", "null"], enum: [1, 2, null] } } } }];
    const before = JSON.stringify(nullableTools);
    const wire = ccaWire(nullableTools);
    const encode = antigravityToolEnumPayload("gemini-3.7-flash", nullableTools);
    const encoded = encode(wire) as Payload;
    expect(encoded.request.tools[0].functionDeclarations[0].parameters!.properties!.level).toMatchObject({ type: "integer", enum: ["1", "2"], nullable: true });
    expect(encode(encoded)).toEqual(encoded);
    expect(JSON.stringify(nullableTools)).toBe(before);
  });

  test("changes only numeric enum arrays and is idempotent", () => {
    const sourceBefore = JSON.stringify(tools);
    const wire = ccaWire(tools);
    const before = JSON.stringify(wire);
    const encode = antigravityToolEnumPayload("claude-opus-4-6", tools);
    const encoded = encode(wire);
    expect(group(encoded).properties!.neighborhood).toMatchObject({ type: "integer", enum: ["4", "8"] });
    const expected = structuredClone(wire);
    group(expected).properties!.neighborhood.enum = ["4", "8"];
    expect(encoded).toEqual(expected);
    expect(encode(encoded)).toEqual(encoded);
    expect(JSON.stringify(wire)).toBe(before);
    expect(JSON.stringify(tools)).toBe(sourceBefore);
  });

  test("does not protobuf-encode parametersJsonSchema or instance data", () => {
    const wire = ccaWire(tools);
    const declaration = wire.request.tools[0].functionDeclarations[0];
    declaration.parametersJsonSchema = declaration.parameters;
    delete declaration.parameters;
    const before = structuredClone(wire);
    expect(antigravityToolEnumPayload("claude-opus-4-6", tools)(wire)).toEqual(before);
    const literal = { type: "object", properties: { enum: { type: "string", enum: ["1", "2"] } },
      default: { type: "integer", enum: [1, 2] }, examples: [{ type: "integer", enum: [] }] };
    const payload = { request: { tools: [{ functionDeclarations: [{ name: "literal", parameters: literal }] }] } };
    expect(antigravityToolEnumPayload("claude-opus-4-6", [{ name: "literal", parameters: literal }])(payload)).toBe(payload);
  });

  test.each([
    { type: "integer", enum: [] }, { type: "integer", enum: [1, "2"] },
    { type: "integer", enum: [1, 1.5] }, { type: "integer", enum: [1, Number.MAX_SAFE_INTEGER + 1] },
    { type: "integer", enum: [1, true] }, { type: "integer", enum: [1, null] },
    { type: "integer", enum: [1, 1] }, { type: "number", enum: [1, 2] },
    { type: "string", enum: [1, 2] }, { type: ["integer", "null"], enum: [1, 2] },
    { type: "integer", enum: "1,2" },
  ])("rejects unsupported source numeric enum %j", (leaf) => {
    expect(() => antigravityToolEnumPayload("claude-opus-4-6", [{
      name: "unsupported",
      parameters: { type: "object", properties: { stories: leaf } },
    }])).toThrow(ToolSchemaTransportError);
  });

  const corruptions: [string, (payload: unknown) => void][] = [
    ["lost field", payload => { delete group(payload).properties!.neighborhood; }],
    ["changed type", payload => { group(payload).properties!.neighborhood.type = "string"; }],
    ["broadened membership", payload => { group(payload).properties!.neighborhood.enum = [4, 6, 8]; }],
    ["narrowed membership", payload => { group(payload).properties!.neighborhood.enum = [4]; }],
    ["mixed membership", payload => { group(payload).properties!.neighborhood.enum = [4, "8"]; }],
    ["duplicate membership", payload => { group(payload).properties!.neighborhood.enum = [4, 4]; }],
    ["noncanonical spelling", payload => { group(payload).properties!.neighborhood.enum = ["04", "8"]; }],
    ["lost declaration", payload => { (payload as Payload).request.tools[0].functionDeclarations = []; }],
    ["ambiguous declaration", payload => {
      const declarations = (payload as Payload).request.tools[0].functionDeclarations;
      declarations.push(structuredClone(declarations[0]));
    }],
  ];
  test.each(corruptions)("%s: throws ToolSchemaTransportError without mutating input", (_label, corrupt) => {
    const payload = ccaWire(tools);
    corrupt(payload);
    const before = JSON.stringify(payload);
    const encode = antigravityToolEnumPayload("claude-opus-4-6", tools);
    expect(() => encode(payload)).toThrow(ToolSchemaTransportError);
    expect(JSON.stringify(payload)).toBe(before);
  });
});

describe("CCA empty enum member guard", () => {
  test("drops only empty string members and keeps identity when clean", () => {
    const fontTools = [{ name: "fonts", description: "fonts", parameters: { type: "object", properties: {
      ui: { type: "string", enum: ["", "neodgm", "galmuri9"] }, none: { type: "string", enum: [""] },
      list: { type: "array", items: { type: "string", enum: ["", "a"] } },
    } } }];
    const wire = ccaWire(fontTools);
    const before = JSON.stringify(wire);
    const fixed = antigravityToolEnumPayload("gemini-3.7-flash", fontTools)(wire) as Payload;
    const props = fixed.request.tools[0].functionDeclarations[0].parameters!.properties!;
    expect(props.ui.enum).toEqual(["neodgm", "galmuri9"]);
    expect(props.none).not.toHaveProperty("enum");
    expect(props.list.items!.enum).toEqual(["a"]);
    expect(JSON.stringify(wire)).toBe(before);
    expect(stripEmptyEnumMembers(fixed)).toBe(fixed);
  });
});

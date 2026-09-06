import { describe, expect, it } from "vitest";
import { compileSimplePages, resolveCommandKind } from "@/editor/tools/eventCompile";
import { normalizeArgsForSchema, validateArgs } from "@/editor/tools/jsonSchema";
import { COMMAND_SCHEMA, CONDITION_SCHEMA, SIMPLE_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { generateToolCatalogMarkdown } from "@/editor/tools/toolCatalog";
import { runTool } from "@/editor/tools/toolRunner";
import type { JsonSchema, SimplePage, ToolContext } from "@/editor/tools/types";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { validateCommandArray, validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Command } from "@/project/types";

const graphic = { transparent: true } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected JSON object");
  return value;
}

function schemaErrors(schema: JsonSchema, value: unknown): string[] {
  const errors = schema.type === "object" ? validateArgs(schema, value) : [];
  if (schema.type === "object") {
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      const field = record(value)[key];
      if (field !== undefined) errors.push(...schemaErrors(child, field));
    }
  }
  if (schema.type === "array" && schema.items && Array.isArray(value)) {
    for (const entry of value) errors.push(...schemaErrors(schema.items, entry));
  }
  return errors;
}

describe("NPC model-visible command contract", () => {
  it("advertises only executable command kinds, including choice commands", () => {
    const kinds = COMMAND_SCHEMA.properties?.kind?.enum;
    expect(kinds).toEqual([...COMMAND_KINDS]);
    expect(kinds?.every(kind => typeof kind === "string" && resolveCommandKind(kind) === kind)).toBe(true);
    expect(SIMPLE_PAGE_SCHEMA.properties?.commands?.items).toBe(COMMAND_SCHEMA);
    expect(SIMPLE_PAGE_SCHEMA.properties?.choices?.items?.properties?.commands?.items).toBe(COMMAND_SCHEMA);
    expect(CONDITION_SCHEMA.properties?.kind?.enum).toEqual([...CONDITION_KINDS]);
  });

  it("declares the item operation and both command and condition value fields", () => {
    expect(COMMAND_SCHEMA.properties?.op?.enum).toEqual(["=", "+=", "-=", "*=", "/="]);
    expect(COMMAND_SCHEMA.properties?.value).toBeDefined();
    expect(CONDITION_SCHEMA.properties?.value).toBeDefined();
  });

  it.each([
    { kind: "setSelfSwitch", key: "A", value: true },
    { kind: "setSelfSwitch", key: "D", value: false },
    { kind: "setSwitch", switchId: "s1", value: true },
    { kind: "setSwitch", switchId: "s1", value: "toggle" },
    { kind: "setSwitch", switchId: "s1", value: { kind: "var", id: "v1" } },
    { kind: "setVariable", variableId: "v1", op: "=", value: 5 },
    { kind: "setVariable", variableId: "v1", op: "+=", value: { kind: "var", id: "v2" } },
    { kind: "changeItem", itemId: "item_ball", op: "+=", amount: 5 },
    { kind: "text", body: "Hello" },
  ] satisfies Command[])("accepts and preserves $kind value=$value through schema, compiler and shape", command => {
    const normalized = normalizeArgsForSchema(COMMAND_SCHEMA, command);
    expect(schemaErrors(COMMAND_SCHEMA, normalized)).toEqual([]);
    const pages = compileSimplePages("npc", "Guide", [{ commands: [normalized] }], graphic);
    expect(pages[0]?.commands).toEqual([command]);
    expect(() => validateCommandArray("commands", pages[0]?.commands)).not.toThrow();
  });

  it.each([
    { kind: "selfSwitch", key: "A", value: true },
    { kind: "switch", switchId: "s1", value: false },
    { kind: "variable", variableId: "v1", op: ">=", value: 5 },
    { kind: "item", itemId: "item_ball", present: true },
  ])("keeps $kind available as a real page condition", condition => {
    expect(schemaErrors(CONDITION_SCHEMA, condition)).toEqual([]);
    const pages = compileSimplePages("npc", "Guide", [{ lines: ["Hello"], conditions: [condition] }], graphic);
    expect(pages[0]?.conditions).toEqual([condition]);
    expect(() => validateConditionShape("condition", pages[0]?.conditions[0])).not.toThrow();
    expect(pages[0]?.commands).toEqual([{ kind: "text", speaker: "Guide", body: "Hello" }]);
  });

  it("still rejects invalid variant values at the real shape boundary", () => {
    expect(() => validateCommandArray("commands", [{ kind: "setSelfSwitch", key: "A", value: 1 }])).toThrow();
    expect(() => compileSimplePages("npc", "Guide", [{ conditions: [{ kind: "switch", switchId: "s1", value: 1 }] }], graphic)).toThrow();
  });

  it("keeps typeless and union-valued field consumers faithful", () => {
    const schema: JsonSchema = { type: "object", properties: {
      value: {}, choice: { type: ["boolean", "number", "string", "object"], properties: { kind: { type: "string" }, id: { type: "string" } } },
    } };
    const args = { value: false, choice: { kind: "var", id: "v1" } };
    expect(normalizeArgsForSchema(schema, args)).toEqual(args);
    expect(validateArgs(schema, args)).toEqual([]);
    const catalog = generateToolCatalogMarkdown([{ name: "probe", mode: "read", description: "", parameters: schema, run: () => ({ summary: "" }) }]);
    expect(catalog).toContain("value?: any");
    expect(catalog).toContain("choice?: boolean\\|number\\|string\\|object");
  });
});

describe("actionable NPC command repairs", () => {
  it.each(["changeItems", "gainItem", "item"])("returns a parseable changeItem repair for %s through the real tool surface", kind => {
    const ctx: ToolContext = { project: createBlankProject() };
    const itemId = ctx.project.database.items[0]?.id;
    if (!itemId) throw new Error("Blank project needs its default item fixture");
    const args = { mapId: ctx.project.startMapId, x: 3, y: 3, id: "npc_repair", name: "Guide", graphic,
      pages: [{ choices: [{ text: "Receive", commands: [{ kind, itemId, amount: 5 }] }] }],
    };
    const result = runTool(ctx, "place_npc", args);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    const repairLine = result.issues?.[0]?.message.split("\n").find(line => line.startsWith("repair: "));
    expect(repairLine).toBeDefined();
    if (!repairLine) throw new Error("Missing machine-readable repair");
    const repair = record(JSON.parse(repairLine.slice("repair: ".length)));
    expect(repair.path).toBe("pages[0].choices[0].commands[0]");
    expect(repair.example).toEqual({ kind: "changeItem", itemId, op: "+=", amount: 5 });
    expect(schemaErrors(COMMAND_SCHEMA, repair.example)).toEqual([]);
    expect(() => validateCommandArray("repair", [repair.example])).not.toThrow();
    expect(resolveCommandKind(kind)).toBeNull();
    const pages: SimplePage[] = [{ choices: [{ text: "Receive", commands: [repair.example] }] }];
    const compiled = compileSimplePages("npc", "Guide", pages, graphic);
    expect(() => validateCommandArray("commands", compiled[0]?.commands)).not.toThrow();
    const retried = runTool(ctx, "place_npc", { ...args, pages });
    expect(retried.ok, JSON.stringify(retried)).toBe(true);
    const stored = ctx.project.maps[ctx.project.startMapId]?.events.find(event => event.id === "npc_repair");
    expect(stored?.pages?.[0]?.commands).toEqual(compiled[0]?.commands);
  });
});

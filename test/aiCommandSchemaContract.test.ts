import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { compileSimplePages } from "@/editor/tools/eventCompile";
import { normalizeArgsForSchema } from "@/editor/tools/jsonSchema";
import { COMMAND_SCHEMA, CONDITION_SCHEMA, SIMPLE_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, EventPageCondition } from "@/project/types";

describe("advertised command and condition contract", () => {
  it("advertises only executable kinds in command positions", () => {
    expect(COMMAND_SCHEMA.properties?.kind?.enum).toEqual([...COMMAND_KINDS]);
    const conditionOnly = CONDITION_KINDS.filter(kind => !COMMAND_KINDS.some(command => command === kind));
    for (const kind of conditionOnly) expect(COMMAND_SCHEMA.properties?.kind?.enum).not.toContain(kind);
  });

  it("exposes canonical operators, ending selection and item presence", () => {
    expect(COMMAND_SCHEMA.properties?.op).toMatchObject({ type: "string", enum: expect.arrayContaining(["=", "+=", "-="]) });
    expect(COMMAND_SCHEMA.properties?.endingId).toMatchObject({ type: "string" });
    expect(CONDITION_SCHEMA.properties?.present).toMatchObject({ type: "boolean" });
  });

  it("exposes polymorphic values without a false single-type constraint", () => {
    // Provider schemas forbid unions; kind-specific shape validators own the types.
    for (const schema of [COMMAND_SCHEMA, CONDITION_SCHEMA]) {
      expect(schema.properties).toHaveProperty("value");
      expect(schema.properties?.value?.type).toBeUndefined();
    }
    const commands: Command[] = [
      { kind: "setSwitch", switchId: "sw_1", value: false },
      { kind: "setSwitch", switchId: "sw_1", value: "toggle" },
      { kind: "setVariable", variableId: "var_1", op: "=", value: 1.5 },
      { kind: "setVariable", variableId: "var_1", op: "=", value: { kind: "var", id: "var_2" } },
    ];
    expect(normalizeArgsForSchema(SIMPLE_PAGE_SCHEMA, { commands })).toEqual({ commands });
  });

  it.each(["upsert_event", "place_npc", "upsert_common_event", "define_ending"])("find_tools returns the registered %s schema", name => {
    const tool = getTool(name);
    expect(tool).toBeDefined();
    const result = runTool({ project: createBlankProject() }, "find_tools", { query: name, limit: 1 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ matches: [{ name, parameters: tool?.parameters }] });
  });
});

function fixture() {
  const context = { project: createBlankProject() };
  const switchId = context.project.switches[0]?.id;
  const variableId = context.project.variables[0]?.id;
  if (!switchId || !variableId) throw new Error("Blank project needs flag slots");
  const ending = runTool(context, "define_ending", { id: "ending_schema", name: "Schema ending", conditions: [] });
  expect(ending.ok, ending.summary).toBe(true);
  const commands: Command[] = [
    { kind: "changeItem", itemId: "item_potion", op: "-=", amount: 1 },
    { kind: "setSwitch", switchId, value: true },
    { kind: "setSwitch", switchId, value: "toggle" },
    { kind: "setVariable", variableId, op: "=", value: 2.5 },
    { kind: "triggerEnding", endingId: "ending_schema" },
    { kind: "triggerEnding" },
  ];
  const conditions: EventPageCondition[] = [
    { kind: "item", itemId: "item_potion", present: true },
    { kind: "switch", switchId, value: false },
    { kind: "variable", variableId, op: ">=", value: 0 },
  ];
  return { context, commands, conditions, mapId: context.project.startMapId };
}

describe("canonical commands through authoring and persistence", () => {
  it("compiles and serializes item removal, typed values, item presence and both ending invocations", () => {
    const { context, mapId, commands, conditions } = fixture();
    const pages = compileSimplePages("ev_schema", "Schema", [{ conditions, commands }], { transparent: true }, { injectFace: false });
    expect(pages[0]?.commands).toEqual(commands);
    expect(pages[0]?.conditions).toEqual(conditions);
    const result = runTool(context, "upsert_event", {
      mapId, event: { id: "ev_schema", x: 3, y: 3, pages },
    });
    expect(result.ok, result.summary).toBe(true);
    const reloaded = deserialize(serialize(context.project));
    const event = reloaded.maps[mapId]?.events.find(entry => entry.id === "ev_schema");
    expect(event?.pages?.[0]?.commands).toEqual(commands);
    expect(event?.pages?.[0]?.conditions).toEqual(conditions);
  });

  it.each([
    { kind: "switch", switchId: "sw_1", value: true },
    { kind: "removeItem", itemId: "item_potion", amount: 1 },
    { kind: "setSwitch", switchId: "sw_1", value: 1 },
    { kind: "setVariable", variableId: "var_1", op: "=", value: "toggle" },
  ])("rejects invalid command $kind atomically rather than dropping effects", invalid => {
    const { context, mapId, commands } = fixture();
    const before = serialize(context.project);
    const result = runTool(context, "upsert_event", {
      mapId, event: { id: "ev_invalid", x: 3, y: 3, commands: [...commands, invalid] },
    });
    expect(result.ok, result.summary).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    expect(serialize(context.project)).toBe(before);
  });

  it.each([
    { kind: "switch", switchId: "sw_1" },
    { kind: "variable", variableId: "var_1", op: ">=" },
    { kind: "item", itemId: "item_potion" },
    { kind: "item", itemId: "item_potion", present: "true" },
  ])("rejects missing or mistyped condition values for $kind atomically", condition => {
    const { context, mapId, commands } = fixture();
    const before = serialize(context.project);
    const result = runTool(context, "place_npc", {
      mapId, id: "ev_invalid", name: "Schema", x: 3, y: 3,
      pages: [{ commands, conditions: [condition] }],
    });
    expect(result.ok, result.summary).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    expect(serialize(context.project)).toBe(before);
  });

  it("still requires reference reads before the canonical item-removal write", () => {
    const { context, mapId, commands } = fixture();
    const args = { mapId, event: { id: "ev_schema", x: 3, y: 3, commands } };
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: [], references: true });
    expect(evidence.beforeWrite(context.project, "upsert_event", args)?.ok).toBe(false);
    const readArgs = { collection: "items", ids: ["item_potion"], include: "full" };
    evidence.observe("get_database_records", readArgs, runTool(context, "get_database_records", readArgs));
    expect(evidence.beforeWrite(context.project, "upsert_event", args)).toBeNull();
  });
});

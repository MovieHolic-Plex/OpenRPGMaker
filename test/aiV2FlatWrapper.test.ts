import { describe, expect, it } from "vitest";
import { flattenWrapperTool, flatWrapperShape } from "@/ai/v2/flatWrapper";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";

const echo = (name: string, parameters: unknown): PiToolShape => ({
  name, label: name, description: name, parameters,
  execute: async (_id, params) => ({ content: [{ type: "text", text: JSON.stringify(params) }] }),
});
const run = async (tool: PiToolShape, args: unknown): Promise<unknown> => JSON.parse(((await tool.execute("1", args)).content[0] as { text: string }).text);

describe("J67 flattened single-wrapper schemas", () => {
  const spec = { type: "object", properties: { spec: { type: "object", properties: { type: { type: "string" }, name: { type: "string" } }, required: ["type", "name"] } }, required: ["spec"] };
  it("shows inner fields at the top and rewraps them", async () => {
    const tool = flattenWrapperTool(echo("make_place", spec));
    expect(Object.keys((tool.parameters as { properties: object }).properties)).toEqual(["type", "name"]);
    expect(await run(tool, { type: "village", name: "a" })).toEqual({ spec: { type: "village", name: "a" } });
  });
  it("still accepts the old wrapped shape", async () => {
    const tool = flattenWrapperTool(echo("make_place", spec));
    expect(await run(tool, { spec: { type: "village", name: "a" } })).toEqual({ spec: { type: "village", name: "a" } });
  });
  it("fills a partial wrapper from flat fields instead of leaving them outside", async () => {
    const tool = flattenWrapperTool(echo("make_place", spec));
    expect(await run(tool, { spec: { type: "village" }, name: "a" })).toEqual({ spec: { type: "village", name: "a" } });
    expect(await run(tool, { spec: { type: "village", name: "안" }, name: "밖" })).toEqual({ spec: { type: "village", name: "안" } });
  });
  it("refuses a flat call missing an inner required field", async () => {
    const tool = flattenWrapperTool(echo("make_place", spec));
    expect(await run(tool, { type: "village" })).toMatchObject({ ok: false });
  });
  it("flattens one person of add_people and keeps the list for several", async () => {
    const people = { type: "object", properties: { mapId: { type: "string" }, people: { type: "array", items: { type: "object", properties: { role: { type: "string" }, mapId: { type: "string" } }, required: ["role"] } } }, required: ["people"] };
    const shape = flatWrapperShape("add_people", people)!;
    expect(Object.keys(shape.parameters.properties!)).toEqual(["mapId", "role", "people"]);
    const tool = flattenWrapperTool(echo("add_people", people));
    expect(await run(tool, { mapId: "m", role: "guard" })).toEqual({ mapId: "m", people: [{ role: "guard" }] });
    expect(await run(tool, { mapId: "m", people: [{ role: "a" }, { role: "b" }] })).toEqual({ mapId: "m", people: [{ role: "a" }, { role: "b" }] });
    expect(await run(tool, { mapId: "m", people: [{ role: "guard" }], name: "경비" })).toEqual({ mapId: "m", people: [{ role: "guard", name: "경비" }] });
    expect(await run(tool, { mapId: "m", people: [{ role: "a", name: "가" }, { role: "b" }], name: "찌꺼기" })).toEqual({ mapId: "m", people: [{ role: "a", name: "가" }, { role: "b" }] });
    expect(await run(tool, { mapId: "m", people: [{ role: "a" }], role: "clerk", name: "다" })).toEqual({ mapId: "m", people: [{ role: "a" }, { role: "clerk", name: "다" }] });
  });
  it("moves extra fields into an open inner object (upsert_event)", async () => {
    const ev = { type: "object", properties: { mapId: { type: "string" }, event: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: true } }, required: ["mapId", "event"] };
    const tool = flattenWrapperTool(echo("upsert_event", ev));
    expect(await run(tool, { mapId: "m", id: "e", name: "문" })).toEqual({ mapId: "m", event: { id: "e", name: "문" } });
  });
  it("leaves other tools alone", () => {
    const t = echo("edit_place", spec);
    expect(flattenWrapperTool(t)).toBe(t);
  });
});

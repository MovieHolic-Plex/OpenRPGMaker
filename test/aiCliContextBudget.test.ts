import { describe, expect, it } from "vitest";
import { capResultImages, CLI_CONTEXT_EXHAUSTED_PREFIX, compactCliToolList, isCliApiErrorText, isCliContextExhaustedError, isCliContextExhaustedText, schemaShapeProblem } from "@/ai/piAgent/cliContextBudget";

const command = { type: "object", description: "명령", properties: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, { type: "string", description: `긴 설명 ${"가".repeat(80)} ${i}` }])) };

describe("compactCliToolList (J79)", () => {
  it("drops deep descriptions but keeps top-level ones", () => {
    const [tool] = compactCliToolList([{ name: "a", description: "도구", inputSchema: { type: "object", properties: { x: { type: "string", description: "윗칸", properties: { y: { type: "string", description: "깊은" } } } } } }]);
    const schema = tool!.inputSchema as { properties: { x: { description?: string; properties: { y: { description?: string } } } } };
    expect(schema.properties.x.description).toBe("윗칸");
    expect(schema.properties.x.properties.y.description).toBeUndefined();
    expect(tool!.description).toBe("도구");
  });
  it("replaces a large sub-schema repeated by a later tool with a pointer", () => {
    const wrap = { type: "object", properties: { cmd: { type: "array", items: command } } };
    const out = compactCliToolList([{ name: "upsert_event", description: "", inputSchema: wrap }, { name: "place_npc", description: "", inputSchema: wrap }]);
    expect(JSON.stringify(out[0]!.inputSchema).length).toBeGreaterThan(3000);
    expect(JSON.stringify(out[1]!.inputSchema)).toContain("형식은 upsert_event");
    expect(JSON.stringify(out[1]!.inputSchema).length).toBeLessThan(400);
  });
});

describe("capResultImages (J79)", () => {
  const img = { type: "image", data: "x", mimeType: "image/png" };
  it("keeps one image for multi-image verbs and notes the rest", () => {
    const out = capResultImages("inspect", [{ type: "text", text: "ok" }, img, img, img]);
    expect(out.filter((p) => p.type === "image")).toHaveLength(1);
    expect(JSON.stringify(out.at(-1))).toContain("3장");
  });
  it("leaves other tools and single images alone", () => {
    expect(capResultImages("view_map", [img, img])).toHaveLength(2);
    expect(capResultImages("inspect", [img])).toHaveLength(1);
  });
});

describe("CLI context-limit reply is a failure (J79)", () => {
  it("recognises the thrash text and the prefixed error", () => {
    expect(isCliContextExhaustedText("Autocompact is thrashing: the context refilled")).toBe(true);
    expect(isCliContextExhaustedText("Prompt is too long")).toBe(true);
    expect(isCliContextExhaustedText("게임을 다 지었습니다. Autocompact is thrashing 은 없었습니다")).toBe(false);
    expect(isCliContextExhaustedError(`${CLI_CONTEXT_EXHAUSTED_PREFIX} Autocompact is thrashing`)).toBe(true);
    expect(isCliContextExhaustedError("rate limited")).toBe(false);
  });
});

describe("compactCliToolList keeps an argument named description (J79 review)", () => {
  it("only strips description strings, not a property schema keyed 'description'", () => {
    const [tool] = compactCliToolList([{ name: "a", description: "", inputSchema: { type: "object", properties: { item: { type: "object", properties: { description: { type: "string" } } } } } }]);
    expect(JSON.stringify(tool!.inputSchema)).toContain("\"description\":{\"type\":\"string\"}");
  });
});

describe("schema-aware compaction (J79b)", () => {
  const bigProps = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, { type: "string", enum: [`값${i}`, "x".repeat(60)] }]));
  it("never replaces a properties map or a default value with a pointer", () => {
    const list = compactCliToolList([
      { name: "a", description: "", inputSchema: { type: "object", properties: { x: { type: "object", properties: bigProps } } } },
      { name: "b", description: "", inputSchema: { type: "object", properties: { y: { type: "object", properties: bigProps, default: { note: "x".repeat(4000) } } } } },
      { name: "c", description: "", inputSchema: { type: "object", properties: { z: { type: "object", properties: bigProps } } } },
    ]);
    for (const tool of list) expect(schemaShapeProblem(tool.inputSchema)).toBeUndefined();
    expect(JSON.stringify(list[1]!.inputSchema)).not.toContain("형식은");
    expect(JSON.stringify(list[2]!.inputSchema)).toContain("형식은 a 도구의 x 칸");
  });
  it("reads a provider error reply as a failure, not a report", () => {
    expect(isCliApiErrorText("API Error: 400 Invalid request. Please check your request parameters.")).toBe(true);
    expect(isCliApiErrorText("게임을 다 지었습니다")).toBe(false);
  });
});

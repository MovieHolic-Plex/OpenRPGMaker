import { describe, expect, it } from "vitest";
import { capResultImages, CLI_CONTEXT_EXHAUSTED_PREFIX, compactCliToolList, isCliContextExhaustedError, isCliContextExhaustedText } from "@/ai/piAgent/cliContextBudget";

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

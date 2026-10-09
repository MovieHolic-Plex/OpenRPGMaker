import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function scriptTwice(args: Record<string, unknown>) {
  const ctx = { project: createBlankProject() };
  const beats = [{ kind: "say", speaker: "나", text: "그날." }];
  const first = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, eventId: "ev_memory", beats, ...args });
  const second = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, eventId: "ev_memory", beats: [{ kind: "say", speaker: "나", text: "다시." }], ...args });
  const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_memory");
  return { first, second, event };
}

describe("script_cutscene replace and once", () => {
  it("defaults to replacing existing 컷신 pages instead of stacking them", () => {
    const { first, second, event } = scriptTwice({});
    expect(first.ok, JSON.stringify(first.issues)).toBe(true);
    expect(second.ok, JSON.stringify(second.issues)).toBe(true);
    expect(event?.pages).toHaveLength(1);
    expect(event?.pages?.[0]?.name).toBe("컷신");
    expect(JSON.stringify(event?.pages?.[0]?.commands)).toContain("다시");
    expect(JSON.stringify(event?.pages?.[0]?.commands)).not.toContain("그날.");
  });

  it("mode append still stacks a new 컷신 page", () => {
    const { event } = scriptTwice({ mode: "append" });
    expect(event?.pages).toHaveLength(2);
  });

  it("once adds a self-switch A off condition and turns A on at the end", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", {
      mapId: ctx.project.startMapId,
      eventId: "ev_once",
      once: true,
      beats: [{ kind: "say", speaker: "나", text: "한 번만." }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_once");
    expect(event?.pages?.[0]?.conditions).toContainEqual({ kind: "selfSwitch", key: "A", value: false });
    expect(event?.pages?.[0]?.commands).toContainEqual({ kind: "setSelfSwitch", key: "A", value: true });
  });
});

import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function ctx() {
  const context = { project: createBlankProject() } as ToolContext;
  return { context, mapId: context.project.startMapId };
}

describe("npc movement selection", () => {
  it("make_villager defaults to roaming, not fixed", () => {
    const { context, mapId } = ctx();
    const result = runTool(context, "make_villager", {
      mapId,
      name: "평범 주민",
      home: { x: 2, y: 2 },
      dialogue: [{ text: "안녕." }],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "평범 주민");
    expect(event?.pages?.[0]?.movement.type).toBe("random");
  });

  it("make_villager stays still when fixed is explicit", () => {
    const { context, mapId } = ctx();
    const result = runTool(context, "make_villager", {
      mapId,
      name: "고정 주민",
      home: { x: 2, y: 2 },
      movement: "fixed",
      dialogue: [{ text: "안녕." }],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "고정 주민");
    expect(event?.pages?.[0]?.movement.type).toBe("fixed");
  });

  it("make_villager movement random wanders", () => {
    const { context, mapId } = ctx();
    const result = runTool(context, "make_villager", {
      mapId,
      name: "배회 주민",
      home: { x: 3, y: 3 },
      movement: "random",
      dialogue: [{ text: "돌아다녀요." }],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "배회 주민");
    expect(event?.pages?.every((p) => p.movement.type === "random")).toBe(true);
  });

  it("place_npc movement random wanders, default fixed", () => {
    const { context, mapId } = ctx();
    const wander = runTool(context, "place_npc", {
      mapId,
      x: 1,
      y: 1,
      id: "npc_wander_move",
      name: "배회상인",
      movement: "random",
      pages: [{ text: "구경해." }],
    });
    expect(wander.ok, wander.summary).toBe(true);
    const fixed = runTool(context, "place_npc", {
      mapId,
      x: 10,
      y: 10,
      id: "npc_fixed_move",
      name: "고정상인",
      pages: [{ text: "어서 와." }],
    });
    expect(fixed.ok, fixed.summary).toBe(true);
    const w = context.project.maps[mapId].events.find((e) => e.id === "npc_wander_move");
    const f = context.project.maps[mapId].events.find((e) => e.id === "npc_fixed_move");
    expect(w?.pages?.[0]?.movement.type).toBe("random");
    expect(f?.pages?.[0]?.movement.type).toBe("fixed");
  });
});

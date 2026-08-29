// make_hunting_ground 가 FieldSpawnDef 의 진영·발자국·킬 필드를 드롭하지 않는지.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function huntingContext(): { context: ToolContext; mapId: string; troopId: string; switchId: string } {
  const context: ToolContext = { project: createBlankProject() };
  const mapId = context.project.startMapId;
  const troopId = context.project.database.troops[0]?.id;
  const switchId = context.project.switches[0]?.id;
  if (!troopId) throw new Error("troop missing");
  if (!switchId) throw new Error("switch missing");
  return { context, mapId, troopId, switchId };
}

describe("make_hunting_ground field spawn contract", () => {
  it("appends a spawn that preserves factionId, persistKill, onKillSwitchId, footprint, and passRows", () => {
    const { context, mapId, troopId, switchId } = huntingContext();
    const result = runTool(context, "make_hunting_ground", {
      mapId,
      area: { x: 1, y: 1, w: 3, h: 3 },
      troopId,
      factionId: "bandit",
      persistKill: true,
      onKillSwitchId: switchId,
      footprint: { width: 2, height: 3 },
      passRows: 1,
    });
    expect(result.ok, result.summary).toBe(true);
    const spawn = context.project.maps[mapId]?.fieldSpawns?.at(-1);
    expect(spawn).toMatchObject({
      troopId,
      factionId: "bandit",
      persistKill: true,
      onKillSwitchId: switchId,
      footprint: { width: 2, height: 3 },
      passRows: 1,
    });
  });

  it("omits the five fields when the caller does not pass them", () => {
    const { context, mapId, troopId } = huntingContext();
    const result = runTool(context, "make_hunting_ground", {
      mapId,
      area: { x: 1, y: 1, w: 3, h: 3 },
      troopId,
    });
    expect(result.ok, result.summary).toBe(true);
    const spawn = context.project.maps[mapId]?.fieldSpawns?.at(-1);
    expect(spawn).toBeDefined();
    expect(spawn).not.toHaveProperty("factionId");
    expect(spawn).not.toHaveProperty("persistKill");
    expect(spawn).not.toHaveProperty("onKillSwitchId");
    expect(spawn).not.toHaveProperty("footprint");
    expect(spawn).not.toHaveProperty("passRows");
  });
});

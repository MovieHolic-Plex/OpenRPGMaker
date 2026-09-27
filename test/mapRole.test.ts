import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { guessMapRole } from "@/ai/mapPlacementContext";
import { isMapRoleKind } from "@/project/mapRole";
import { runTool } from "@/editor/tools/toolRunner";

describe("map role", () => {
  it("accepts only known kinds", () => {
    expect(isMapRoleKind("town")).toBe(true);
    expect(isMapRoleKind("castle")).toBe(false);
    expect(isMapRoleKind(undefined)).toBe(false);
  });

  it("prefers the author's choice over encounter signals", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.encounterRate = 25;
    map.encounterTable = [{ troopId: project.database.troops[0]!.id, weight: 1 }];
    map.mapRole = "town";
    expect(guessMapRole(project, map)).toMatchObject({ role: "town", explicit: true });
  });

  it("set_map_properties sets, rejects unknown, and clears with auto", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "dungeon" }).ok).toBe(true);
    expect(ctx.project.maps[mapId]!.mapRole).toBe("dungeon");
    expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "castle" }).ok).toBe(false);
    expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "auto" }).ok).toBe(true);
    expect(ctx.project.maps[mapId]!.mapRole).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isActionCombatMap } from "@/project/actionCombat";
import type { WikiCombatMode } from "@/project/world";

describe("wiki decisions constrain actual monster authoring", () => {
  it("rejects unresolved graphic queries instead of creating an invisible field monster", () => {
    const project = createBlankProject();
    const ctx = { project };

    const result = runTool(ctx, "make_hunting_ground", {
      mapId: project.startMapId, troopId: "troop_slime",
      area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
      graphic: { query: "monster", characterIndex: 0 },
    });

    expect(result.ok).toBe(false);
    expect(ctx.project.maps[project.startMapId]?.fieldSpawns ?? []).toEqual([]);
  });
  it("uses visible contact battles for an existing JRPG without an explicit override", () => {
    const project = createBlankProject();
    project.system.genre = "adventure-jrpg";
    const ctx = { project };

    const result = runTool(ctx, "make_hunting_ground", {
      mapId: project.startMapId, troopId: "troop_slime",
      area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[project.startMapId]?.encounterRate).toBe(0);
    expect(ctx.project.maps[project.startMapId]?.fieldSpawns).toHaveLength(1);
  });
  for (const mode of ["contact", "action"] satisfies WikiCombatMode[]) {
    it(`creates ${mode} field combat without random encounters`, () => {
      const project = createBlankProject();
      project.world = { entities: [{
        id: "w_combat", type: "guideline", name: "Combat", summary: mode, origin: "ai",
        wiki: { kind: "declaration", basis: "explicit", combatMode: mode,
          sources: [{ id: "turn-1", kind: "user", text: mode, at: 1 }] },
      }], relations: [] };
      const ctx = { project };

      const result = runTool(ctx, "make_hunting_ground", {
        mapId: project.startMapId, troopId: "troop_slime",
        area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1, chase: false,
      });

      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[project.startMapId];
      expect(map?.fieldSpawns).toHaveLength(1);
      expect(map?.encounterRate).toBe(0);
      expect(map?.encounterTable ?? []).toEqual([]);
      expect(isActionCombatMap(ctx.project, map)).toBe(mode === "action");
    });
  }

  it("reads full selected document content rather than only its opening excerpt", () => {
    const project = createBlankProject();
    const body = `${"Earlier notes. ".repeat(100)}\nSecret door: tile 37.`;
    project.world = { entities: [{
      id: "w_location", type: "place", name: "Location", summary: "Door details", body, origin: "user",
    }], relations: [] };

    const result = runTool({ project }, "read_project_wiki", { ids: ["w_location"] });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ documents: [{ id: "w_location", body }] });
  });
});

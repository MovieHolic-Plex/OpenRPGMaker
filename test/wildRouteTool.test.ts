import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";
import { eligibleEncounterEntries } from "@/player/encounters";
import { startSession } from "@/project/session";
import { TILE } from "@/project/defaults/constants";

function monsterProject() {
  const choice = newProjectChoiceById("monster-collect")!;
  const project = createNewProjectSeed(choice.packId, "도로 시험");
  const troopId = project.database.troops[0]!.id;
  return { context: { project }, troopId };
}

describe("author_wild_route", () => {
  it("lays a road, forest and tall-grass patches whose encounters only fire inside the grass", () => {
    const { context, troopId } = monsterProject();
    const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
    expect(created.ok, created.summary).toBe(true);
    const result = runTool(context, "author_wild_route", {
      mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
    });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_route_1!;
    const data = result.data as { grassPatches: { id: string; x: number; y: number; w: number; h: number }[]; trainerSpots: unknown[] };
    expect(data.grassPatches.length).toBeGreaterThanOrEqual(2);
    expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));
    expect(map.lowerTiles.filter(tile => tile !== TILE.GRASS).length).toBeGreaterThan(40);
    expect(map.upperTiles.some(tile => tile !== TILE.EMPTY)).toBe(true);
    expect(map.encounterTable?.every(entry => entry.conditions?.locationId?.startsWith("loc_wild_grass_"))).toBe(true);
    const session = startSession(context.project);
    const patch = data.grassPatches[0]!;
    expect(eligibleEncounterEntries(map, session, { x: patch.x, y: patch.y })).not.toHaveLength(0);
    expect(eligibleEncounterEntries(map, session, { x: 14, y: 21 })).toHaveLength(0);
  });

  it("refuses to repaint an authored map without replace", () => {
    const { context } = monsterProject();
    const start = context.project.startMapId;
    const map = context.project.maps[start]!;
    map.upperTiles[0] = 5;
    const result = runTool(context, "author_wild_route", { mapId: start, exits: [{ x: 0, y: 1 }, { x: map.width - 1, y: 1 }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("replace:true");
  });
});

describe("monster-collect brief prompt", () => {
  it("names the route builder so its schema is exposed on the first turn", async () => {
    const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
    const preset = welcomeGenrePresetById("monster-collect")!;
    const prompt = buildWelcomeGenrePresetPrompt(preset, {
      version: 1, presetId: "monster-collect", summary: "첫 체육관까지",
      answers: { scope: { question: "범위", label: "첫 제작 범위", text: "첫 도전장", source: "user" } },
    } as never);
    expect(prompt).toContain("author_wild_route");
    expect(prompt).toContain("battleProcessing");
  });
});
